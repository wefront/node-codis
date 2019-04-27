# Node Codis

![](https://img.shields.io/npm/l/node-codis.svg)
![](https://img.shields.io/npm/v/node-codis.svg?label=version)
![](https://img.shields.io/node/v/node-codis.svg)

Node-codis是在nodejs上运行的codis客户端，用于连接到redis集群服务。

使用了 [node-zookeeper-client](https://www.npmjs.com/package/node-zookeeper-client) 这个库来用于服务发现。

使用了 [redis](https://www.npmjs.com/package/redis) 这个库来连接 codis 代理服务。

[English Document](https://github.com/wefront/node-codis/blob/master/README.md)

# 开始

## 安装

```bash
npm i node-codis -S
```

## 简单示例

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

## 文档

### 构造函数

#### zkServers `string` `required`

以逗号分隔的 `host:port`, 每个代表一个 ZooKeeper 服务端。你也可以在后面跟上子路径，然后客户端将以此路径为根节点。例如：

```bash
'localhost:3000,localhost:3001,localhost:3002'
'localhost:2181,localhost:2182/test'
```

#### zkCodisProxyDir `string` `required`

在 zookeeper 上的 codis proxy 的节点路径。 NodeCodis 将与此目录中的所有 codis proxy 建立连接，然后随机选择一个作为客户端。例如：

> 在 `codis2.x` 版本, 一般位于 `/zk/codis/db_${product_name}/proxy`。

> 在 `codis3.x` 版本, 如果服务端 codis-proxy 配置成 `jodis_compatible = false`, 一般位于 `/jodis/${product_name}/proxy`。

##### example

```bash
/zk/codis/db_test_node/proxy
```

#### codisPassword `string` `optional`

Codis proxy 的登录密码。

#### zkClientOpts `object` `optional`

用于设置zookeeper客户端的选项，包括以下几个参数：

- `sessionTimeout` 会话超时（以毫秒为单位），默认为30秒。

- `spinDelay` 每次连接尝试之间的延迟（以毫秒为单位）。

- `retries` 连接丢失例外的重试尝试次数。

默认选项：

```js
{
    sessionTimeout: 30000,
    spinDelay: 1000,
    retries: 1
}
```

##### example

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

我们使用 `redis` 连接到 codis-proxy 服务，因此您可以在创建 redis 户端时传递这些选项。

参考这里 [https://github.com/NodeRedis/node_redis#rediscreateclient](https://github.com/NodeRedis/node_redis#rediscreateclient)

#### log `boolean` `default=true`

是否启用日志，默认使用 [debug](https://www.npmjs.com/package/debug) 这个库，并且是开启状态，打印的日志格式如下：

`node-codis` Connect to codis at proxy:e203bf77d1c7b3e2c132984f14827c04 @192.168.3.62:19201 +0ms

`node-codis` Connect to codis at proxy:40297cde8c3453714459ab1c452c6c56 @192.168.3.72:19201 +7ms

你也可以传入自定的logger:

```js
const nodeCodis = new NodeCodis({
  zkServers: '127.0.0.1:6701, 127.0.0.1:6702',
  zkCodisProxyDir: '/zk/codis/db_test_node/proxy',
  codisPassword: 'your_codis_password',
  log: console.log
})
```

也可以传入 `false` 来关闭日志。

---

### 属性

#### codisClientPool

返回所有连接的codis客户端。

##### example

```js
const nodeCodis = new NodeCodis({
  zkServers: '127.0.0.1:6701, 127.0.0.1:6702',
  zkCodisProxyDir: '/zk/codis/db_test_node/proxy',
  codisPassword: 'your_codis_password'
})

console.log(nodeCodis.codisClientPool)
```

---

### 事件

#### connected

当第一次连接完所有的 codis-proxy 时，将触发 `connect` 事件，并随机选择一个已连接的codis客户端传入回调函数。

##### example

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

当 codis 的 zookeeper 节点发生变化时，内部会进行 codis-proxy 的重新连接，并触发 `reconnected` 事件，并将随机一个已连接的 codis 客户端传入回调函数。

##### example

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

### 静态方法

#### getRandomClient(clientsMap: CodisClientPool) 

随机获取已连接的codis客户端，如果客户端列表为空，则返回 `null`。
你可以在某些框架的中间件中使用此方法来实现负载平衡。

##### example

use express.js:

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

当你一直请求 `localhost: 3000/test` 时，打印如下：

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

## 许可证

NodeCodis 基于 MIT 许可证，查看[LICENSE](https://github.com/wefront/node-codis/blob/master/LICENCE)获取详细信息。
