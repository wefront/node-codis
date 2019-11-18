# Node Codis

![](https://img.shields.io/npm/l/node-codis.svg)
![](https://img.shields.io/npm/v/node-codis.svg?label=version)
![](https://img.shields.io/node/v/node-codis.svg)

Node-codis is a codis client running on nodejs, Used to connect to redis cluster services.

Use the [node-zookeeper-client](https://www.npmjs.com/package/node-zookeeper-client) library for service discovery.

Use the [redis](https://www.npmjs.com/package/redis) library to connect to the codis proxy service. The [ioredis](https://github.com/luin/ioredis) is supported as well.

[中文说明](https://github.com/wefront/node-codis/blob/master/README-zh.md)

# Getting started

## Installation

```bash
npm i node-codis -S
```

## Usage

```js
const { NodeCodis } = require('node-codis')

const nodeCodis = new NodeCodis({
  zkServers: '127.0.0.1:6701, 127.0.0.1:6702',
  zkCodisProxyDir: '/zk/codis/db_test_node/proxy',
  codisPassword: 'your_codis_password'
})

nodeCodis.on('connected', (err, client) => {
  if (err) {
    console.log(err)
    return
  }

  // Expires after 100 seconds
  client.SETEX('node-codis:test', 100, 'hello world', NodeCodis.print)
  client.GET('node-codis:test', (err, data) => {
    console.log(data) // hello world
  })
})
```

### ioredis

Codis instance with [ioredis](https://github.com/luin/ioredis) can be created by `NodeIOCodis`.

```js
const Codis = require('node-codis')
const nodeCodis = new Codis.NodeIOCodis({
  // ...
})

nodeCodis.on('connected',
/**
 * @param {Codis.CodisIOClient} client
 */
(err, client) => {
  // ...
})
```

> Please NOTE that `NodeIOCodis` doesn't have a `print` method like `NodeCodis`!

## Documentation

### Constructor Options

#### zkServers `string` `required`

Comma separated `host:port` pairs, each represents a ZooKeeper server. You can optionally append a chroot path, then the client would be rooted at the given path. e.g.

```bash
'localhost:3000,localhost:3001,localhost:3002'
'localhost:2181,localhost:2182/test'
```

#### zkCodisProxyDir `string` `required`

Node path of codis-proxy on zookeeper. NodeCodis will establish a connection with all codis-proxy in this directory, and then randomly select one as the client. link this:

```bash
/zk/codis/db_test_node/proxy
```

> In the `codis2.x`, it is usually located at `/zk/codis/db_${product_name}/proxy`

> In the `codis3.x`, If the server codis-proxy is configured as `jodis_compatible = false`, it is usually located at `/jodis/${product_name}/proxy`

#### codisPassword `string` `optional`

Login password for codis-proxy.

#### zkClientOpts `object` `optional`

An object to set the zookeeper client options. Currently available options are:

- `sessionTimeout` Session timeout in milliseconds, defaults to 30 seconds.

- `spinDelay` The delay (in milliseconds) between each connection attempts.

- `retries` The number of retry attempts for connection loss exception.

Defaults options:

```js
{
    sessionTimeout: 30000,
    spinDelay: 1000,
    retries: 1
}
```

For example:

```js
const nodeCodis = new NodeCodis({
  zkServers: '127.0.0.1:6701, 127.0.0.1:6702',
  zkCodisProxyDir: '/zk/codis/db_test_node/proxy',
  codisPassword: 'your_codis_password',
  zkClientOpts: {
    sessionTimeout: 10000
  }
})
```

#### redisClientOpts `object` `optional`

We use redis to connect to the codis-proxy service, so you can pass in these parameters when redis creates the client.

Reference here [https://github.com/NodeRedis/node_redis#rediscreateclient](https://github.com/NodeRedis/node_redis#rediscreateclient)

#### log `boolean | Function`

Whether to enable the log, default open, use the [debug](https://www.npmjs.com/package/debug) library.
The printed log looks like this:

`node-codis` Connect to codis at proxy:e203bf77d1c7b3e2c132984f14827c04 @192.168.3.62:19201 +0ms

`node-codis` Connect to codis at proxy:40297cde8c3453714459ab1c452c6c56 @192.168.3.72:19201 +7ms

You can also set up a custom logger, like this:

```js
const nodeCodis = new NodeCodis({
  zkServers: '127.0.0.1:6701, 127.0.0.1:6702',
  zkCodisProxyDir: '/zk/codis/db_test_node/proxy',
  codisPassword: 'your_codis_password',
  log: console.log
})
```

You can pass `false` to close log.

#### proxyAddrKey `string` `optional`

Proxy address field. Usually when the codis-proxy is registered to zk, the field of the proxy address is called `addr`. If not, you can pass in a custom field. link this:

```js
const nodeCodis = new NodeCodis({
  zkServers: '127.0.0.1:6701, 127.0.0.1:6702',
  zkCodisProxyDir: '/zk/codis/db_test_node/proxy',
  codisPassword: 'your_codis_password',
  proxyAddrKey: 'proxy_addr'
})
```

---

### Property

#### codisClientPool

Return all connected codis client. link this:

```js
const nodeCodis = new NodeCodis({
  zkServers: '127.0.0.1:6701, 127.0.0.1:6702',
  zkCodisProxyDir: '/zk/codis/db_test_node/proxy',
  codisPassword: 'your_codis_password'
})

console.log(nodeCodis.codisClientPool)
```

---


### Event

#### connected

When all codis-proxy are connected for the first time, the connect event is fired and a connected codis client is randomly selected as the argument to the callback function. link this:

```js
const nodeCodis = new NodeCodis({
  zkServers: '127.0.0.1:6701, 127.0.0.1:6702',
  zkCodisProxyDir: '/zk/codis/db_test_node/proxy',
  codisPassword: 'your_codis_password'
})

nodeCodis.on('connected', (err, client) => {
  if (err) {
    console.log(err)
    return
  }

  // Expires after 100 seconds
  client.SETEX('node-codis:test', 100, 'hello world', NodeCodis.print)
  client.GET('node-codis:test', (err, data) => {
    console.log(data) // hello world
  })
})
```

#### reconnected

When the zookeeper node of codis changes, the codis-proxy is reconnected internally, and the reconnected event is triggered, and a random connected codis client is passed to the callback function. link this:

```js

const nodeCodis = new NodeCodis({
  zkServers: '127.0.0.1:6701, 127.0.0.1:6702',
  zkCodisProxyDir: '/zk/codis/db_test_node/proxy',
  codisPassword: 'your_codis_password'
})

nodeCodis.on('reconnected', (err, client) => {
  if (err) {
    console.log(err)
    return
  }

  console.log(client)
})
```

---

### Static methods

#### getRandomClient(clientsMap: CodisClientPool) 

Randomly get a connected codis client, if the client pool is empty, return `null`.
You can use this method in some framework middleware to achieve load balancing. link this:

```js
// app.js
var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var { NodeCodis } = require('node-codis')

var indexRouter = require('./routes/index');

var app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

const nodeCodis = new NodeCodis({
  zkServers: '127.0.0.1:6701, 127.0.0.1:6702',
  zkCodisProxyDir: '/zk/codis/db_test_node/proxy',
  codisPassword: 'your_codis_password'
})

nodeCodis.on('connected', (err, client) => {
  if (err) {
    console.log(err)
    return
  }
  app.set('codisClientPool', nodeCodis.codisClientPool)
})

app.use(function(req, res, next) {
  var codisClientPool = req.app.get('codisClientPool')
  req.codisClientPool = NodeCodis.getRandomClient(codisClientPool)
  next()
})

app.use('/', indexRouter);

app.use(function (req, res, next) {
  next(createError(404));
});

app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;

```

```js
// routes/index.js
var express = require('express');
var router = express.Router();

router.get('/test', function (req, res) {
  const codisClient = req.codisClient
  if (codisClient) {
    console.log(codisClient.address)
  }
})

module.exports = router;

```

When you always request `localhost:3000/test`, printed as follows:

```bash
192.168.3.72:19201
GET /test - - ms - -
192.168.3.72:19201
GET /test - - ms - -
192.168.3.62:19201
GET /test - - ms - -
192.168.3.62:19201
GET /test - - ms - -
192.168.3.72:19201
GET /test - - ms - -
192.168.3.62:19201
GET /test - - ms - -
192.168.3.62:19201
GET /test - - ms - -
192.168.3.62:19201
GET /test - - ms - -
192.168.3.72:19201
GET /test - - ms - -
192.168.3.62:19201
```

## Licence

NodeCodis is licensed under the MIT License - see the [LICENSE](https://github.com/wefront/node-codis/blob/master/LICENCE) file for details.
