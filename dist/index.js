"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var zookeeper = require("node-zookeeper-client");
var redis = require("redis");
var _ = require("lodash");
var debug = require("debug");
var log = debug('node-codis');
var DISCONNECTED = 'DISCONNECTED';
var RECONNECTED = 'RECONNECTED';
var CONNECTED = 'CONNECTED';
var NodeCodis = /** @class */ (function () {
    function NodeCodis(opts) {
        this._opts = opts || Object.create(null);
        this._validParameter();
        this._manageLog();
        this._state = DISCONNECTED;
        this._codisClientPool = Object.create(null);
        this._subscribers = Object.create(null);
        this._lastProxies = [];
        this._zkClient = zookeeper.createClient(opts.zkServers, opts.zkClientOpts);
        this._connect();
    }
    // 校验传参
    NodeCodis.prototype._validParameter = function () {
        if (!this._opts.zkServers) {
            throw new Error('The parameter zkServers is required!');
        }
        if (!this._opts.zkCodisProxyDir) {
            throw new Error('The parameter zkCodisProxyDir is required!');
        }
    };
    // initialization
    NodeCodis.prototype._connect = function () {
        var _this = this;
        var rootPath = this._opts.zkCodisProxyDir;
        this._zkClient.once('connected', function () {
            _this._getChildren(rootPath, function (children) {
                // The proxy that needs to be connected
                var toCreate = children.filter(function (item) { return !_this._lastProxies.includes(item); });
                // The proxy that needs to be disconnected
                var toDelete = _this._lastProxies.filter(function (item) { return !children.includes(item); });
                _this._lastProxies = children;
                toDelete.forEach(function (proxy) {
                    log('Codis client disconnect from proxy:' + proxy);
                    _this._removeCodisClient(proxy);
                    var randomClient = NodeCodis.getRandomClient(_this._codisClientPool);
                    var error = randomClient ? null : new Error('Codis client pool is empty.');
                    _this._codisClient = randomClient;
                    _this._emit(RECONNECTED.toLowerCase(), error, randomClient);
                });
                toCreate.forEach(function (proxy, index) {
                    var childPath = rootPath + '/' + proxy;
                    _this._getData(childPath, function (data) {
                        try {
                            var detail_1 = JSON.parse(data.toString('utf8'));
                            var redisClientOpts = _this._opts.redisClientOpts || {};
                            var clientOpts = {
                                url: "redis://" + detail_1.addr
                            };
                            if (_this._opts.codisPassword) {
                                clientOpts.password = _this._opts.codisPassword;
                            }
                            var client = redis.createClient(Object.assign(redisClientOpts, clientOpts));
                            client.on('connect', function () { return log("Connect to codis at proxy:" + proxy + " @" + detail_1.addr); });
                            client.on('error', function (e) { return log('Connect codis failed: ', e); });
                            _this._addCodisClient(proxy, { client: client, detail: detail_1 });
                        }
                        catch (e) {
                            log('Connect codis failed:', e);
                        }
                        // After initializing all redis clients, throw the corresponding event
                        if (index === toCreate.length - 1) {
                            if (_this._state !== RECONNECTED) {
                                _this._state = CONNECTED;
                            }
                            var randomClient = NodeCodis.getRandomClient(_this._codisClientPool);
                            var event = _this._state.toLowerCase();
                            var error = randomClient ? null : new Error('Codis client pool is empty.');
                            _this._codisClient = randomClient;
                            _this._emit(event, error, randomClient);
                        }
                    });
                });
            });
        });
        this._zkClient.connect();
    };
    // Zookeeper get child node information
    NodeCodis.prototype._getChildren = function (path, cb) {
        var _this = this;
        this._zkClient.getChildren(path, function (event) {
            log('Zookeeper getChildren event emit: %o', event);
            _this._state = RECONNECTED;
            _this._getChildren(path, cb);
        }, function (err, children) {
            if (err) {
                log("Zookeeper getChildren error in " + path + ": ", err);
                return;
            }
            cb(children);
        });
    };
    // Zookeeper get node data
    NodeCodis.prototype._getData = function (path, cb) {
        var _this = this;
        this._zkClient.getData(path, function (event) {
            log('Zookeeper getData event emit: %o', event);
            // Retrieve node data when node data changes
            // Result is: getData will listen for NODE_DELETE event when node is deleted, 
            // at the same time getChildren will also listen to the NODE_CHILDREN_CHANGED event.
            // Prevent confusion
            if (event.type === zookeeper.Event.NODE_DATA_CHANGED) {
                _this._state = RECONNECTED;
                _this._getData(path, cb);
            }
        }, function (err, data) {
            if (err) {
                log("Zookeeper getData error in " + path + ": ", err);
                return;
            }
            cb(data);
        });
    };
    NodeCodis.prototype._removeCodisClient = function (proxy) {
        var client = _.get(this._codisClientPool[proxy], 'client');
        if (client) {
            client.quit();
        }
        delete this._codisClientPool[proxy];
    };
    NodeCodis.prototype._addCodisClient = function (proxy, item) {
        this._codisClientPool[proxy] = item;
    };
    // Throw a custom event
    NodeCodis.prototype._emit = function (event, err, payload) {
        var subscriber = this._subscribers[event];
        if (Array.isArray(subscriber)) {
            for (var _i = 0, subscriber_1 = subscriber; _i < subscriber_1.length; _i++) {
                var handler = subscriber_1[_i];
                if (typeof handler === 'function') {
                    handler(err, payload);
                }
            }
        }
    };
    NodeCodis.prototype._manageLog = function () {
        debug.enable('node-codis');
        if (this._opts.log === false) {
            debug.disable();
        }
    };
    Object.defineProperty(NodeCodis.prototype, "codisClientPool", {
        get: function () {
            return this._codisClientPool;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(NodeCodis.prototype, "codisClient", {
        get: function () {
            return this._codisClient;
        },
        enumerable: true,
        configurable: true
    });
    // Register custom event
    NodeCodis.prototype.on = function (event, handler) {
        if (!this._subscribers[event]) {
            this._subscribers[event] = [handler];
            return;
        }
        this._subscribers[event].push(handler);
    };
    // Randomly get a connected redis client
    NodeCodis.getRandomClient = function (clientsMap) {
        var proxies = Object.keys(clientsMap);
        if (!proxies.length) {
            return null;
        }
        var randomProxy = proxies[_.random(0, proxies.length - 1)];
        return clientsMap[randomProxy].client;
    };
    NodeCodis.print = redis.print;
    return NodeCodis;
}());
exports.NodeCodis = NodeCodis;
