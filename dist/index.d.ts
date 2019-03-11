import zookeeper = require('node-zookeeper-client');
import redis = require('redis');
export interface CodisClientPoolItem {
    client: redis.RedisClient;
    detail: any;
}
export interface CodisClientPool {
    [proxy: string]: CodisClientPoolItem;
}
export interface NodeCodisOpts {
    zkServers: string;
    zkCodisProxyDir: string;
    codisPassword?: string;
    zkClientOpts?: zookeeper.Option;
    redisClientOpts?: redis.ClientOpts;
    log?: boolean;
}
export interface CodisClient extends redis.RedisClient {
}
export declare class NodeCodis {
    static print: typeof redis.print;
    private _zkClient;
    private _opts;
    private _state;
    private _lastProxies;
    private _codisClientPool;
    private _subscribers;
    private _codisClient;
    constructor(opts: NodeCodisOpts);
    private _validParameter;
    private _connect;
    private _getChildren;
    private _getData;
    private _removeCodisClient;
    private _addCodisClient;
    private _emit;
    private _manageLog;
    readonly codisClientPool: CodisClientPool;
    readonly codisClient: any;
    on(event: string, handler: Function): void;
    static getRandomClient(clientsMap: any): any;
}
