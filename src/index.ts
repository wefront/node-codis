import zookeeper = require('node-zookeeper-client')
import redis = require('redis')
import ioredis = require('ioredis')
import _ = require('lodash')
import debug = require('debug')

const DISCONNECTED = 'DISCONNECTED'
const RECONNECTED = 'RECONNECTED'
const CONNECTED = 'CONNECTED'

let log: any

export interface CodisClientPoolItem {
  client: ioredis.Redis | redis.RedisClient
  detail: any
}

export interface CodisClientPool {
  [proxy: string]: CodisClientPoolItem
}

export interface NodeCodisOpts {
  zkServers: string
  zkCodisProxyDir: string
  codisPassword?: string
  zkClientOpts?: zookeeper.Option
  redisClientOpts?: redis.ClientOpts | ioredis.RedisOptions
  redisClient?: 'redis' | 'ioredis'
  log?: boolean | Function,
  proxyAddrKey?: string
}

export class BaseCodis {
  public static print?= redis.print

  // Zookeeper client
  private _zkClient: zookeeper.Client
  // Constructor parameters
  private _opts: any
  // Current connection status
  private _state: string
  private _lastProxies: string[]
  // Redis client for all established connections
  private _codisClientPool: CodisClientPool
  // All event subscribers
  private _subscribers: any
  // Currently connected codis client
  private _codisClient: any
  // Used to detect zookeeper timeout
  private _zkTimeId: any

  constructor(opts: NodeCodisOpts) {
    this._opts = opts || Object.create(null)
    this._validParameter()
    this._manageLog()
    this._state = DISCONNECTED
    this._codisClientPool = Object.create(null)
    this._subscribers = Object.create(null)
    this._lastProxies = []
    this._zkClient = zookeeper.createClient(opts.zkServers, { retries: 1, ...opts.zkClientOpts })
    this._validZkTimeout()
    this._connect()
  }

  // validation constructor params
  private _validParameter() {
    if (!this._opts.zkServers) {
      throw new Error('The parameter zkServers is required!')
    }
    if (!this._opts.zkCodisProxyDir) {
      throw new Error('The parameter zkCodisProxyDir is required!')
    }
  }

  // node-zookeeper-client has a bug that will reconnect indefinitely when not connected to zk,
  // so manually do a timeout detection
  private _validZkTimeout() {
    const { retries, sessionTimeout } = (this._zkClient as any).options
    this._zkTimeId = setTimeout(() => {
      log(`Could not connect zk ${this._opts.zkCodisProxyDir}, time out`)
      this._zkClient.close()
    }, retries * sessionTimeout)
    this._zkClient.on('connected', () => {
      clearTimeout(this._zkTimeId)
    })
  }

  private _connect() {
    const rootPath = this._opts.zkCodisProxyDir
    this._zkClient.once('connected', () => {
      log('Zookeeper successfully connected on ' + this._opts.zkServers)
      this._getChildren(rootPath, (children: string[]) => {
        // The proxy that needs to be connected
        const toCreate = children.filter(item => !this._lastProxies.includes(item))
        // The proxy that needs to be disconnected
        const toDelete = this._lastProxies.filter(item => !children.includes(item))
        this._lastProxies = children

        toDelete.forEach(proxy => {
          log('Codis client disconnect from proxy:' + proxy)
          this._removeCodisClient(proxy)
          const randomClient = NodeCodis.getRandomClient(this._codisClientPool)
          const error = randomClient ? null : new Error('Codis client pool is empty.')
          this._codisClient = randomClient
          this._emit(RECONNECTED.toLowerCase(), error, randomClient)
        })

        toCreate.forEach((proxy, index) => {
          const childPath = rootPath + '/' + proxy
          this._getData(childPath, (data: any) => {
            try {
              const detail = JSON.parse(data.toString('utf8'))
              const proxyAddr = detail[this._opts.proxyAddrKey || 'addr']

              const clientOpts = Object.assign({}, this._opts.redisClientOpts, { url: `redis://${proxyAddr}` })

              if (this._opts.codisPassword) {
                clientOpts.password = this._opts.codisPassword
              }
              let client: redis.RedisClient | ioredis.Redis
              if (this._opts.redisClient === 'ioredis') {
                // new ioredis won't throw
                client = new ioredis(clientOpts.url, clientOpts)
                log(`Connect to codis on proxy:${proxy} @${proxyAddr}`)
              } else {
                client = redis.createClient(clientOpts)
                client.on('connect', () => log(`Connect to codis on proxy:${proxy} @${proxyAddr}`))
                client.on('error', e => log('Connect codis failed: ', e))
              }
              this._addCodisClient(proxy, { client, detail })
            } catch (e) {
              log('Connect codis failed:', e)
            }

            // After initializing all redis clients, throw the corresponding event
            if (index === toCreate.length - 1) {
              if (this._state !== RECONNECTED) {
                this._state = CONNECTED
              }
              const randomClient = NodeCodis.getRandomClient(this._codisClientPool)
              const event = this._state.toLowerCase()
              const error = randomClient ? null : new Error('Codis client pool is empty.')
              this._codisClient = randomClient
              this._emit(event, error, randomClient)
            }
          })
        })
      })
    })

    this._zkClient.connect()
  }

  // Zookeeper get child node information
  private _getChildren(path: string, cb: Function) {
    this._zkClient.getChildren(path,
      (event) => {
        log('Zookeeper getChildren event emit: %o', event)
        this._state = RECONNECTED
        this._getChildren(path, cb)
      },
      (err, children) => {
        if (err) {
          log(`Zookeeper getChildren error in ${path}: `, err)
          return
        }
        cb(children)
      }
    )
  }

  // Zookeeper get node data
  private _getData(path: string, cb: Function) {
    this._zkClient.getData(path,
      (event) => {
        log('Zookeeper getData event emit: %o', event)
        // Retrieve node data when node data changes
        // Result is: getData will listen for NODE_DELETE event when node is deleted, 
        // at the same time getChildren will also listen to the NODE_CHILDREN_CHANGED event.
        // Prevent confusion
        if (event.type === zookeeper.Event.NODE_DATA_CHANGED) {
          this._state = RECONNECTED
          this._getData(path, cb)
        }
      },
      (err, data) => {
        if (err) {
          log(`Zookeeper getData error in ${path}: `, err)
          return
        }
        cb(data)
      }
    )
  }

  private _removeCodisClient(proxy: string) {
    const client = _.get(this._codisClientPool[proxy], 'client')
    if (client) {
      client.quit()
    }
    delete this._codisClientPool[proxy]
  }

  private _addCodisClient(proxy: string, item: CodisClientPoolItem) {
    this._codisClientPool[proxy] = item
  }

  // Throw a custom event
  private _emit(event: string, err, payload) {
    const subscriber = this._subscribers[event]
    if (Array.isArray(subscriber)) {
      for (let handler of subscriber) {
        if (typeof handler === 'function') {
          handler(err, payload)
        }
      }
    }
  }

  private _manageLog() {
    const logger = this._opts.log
    if (typeof logger === 'function') {
      log = logger
      return
    }
    if (logger === false) {
      log = () => {}
      return
    }
    log = debug('node-codis')
    debug.enable('node-codis')
  }

  public get codisClientPool() {
    return this._codisClientPool
  }

  public get codisClient() {
    return this._codisClient
  }

  // Register custom event
  public on(event: string, handler: Function) {
    if (!this._subscribers[event]) {
      this._subscribers[event] = [handler]
      return
    }
    this._subscribers[event].push(handler)
  }

  // Randomly get a connected redis client
  public static getRandomClient(clientsMap: CodisClientPool) {
    const proxies = Object.keys(clientsMap)
    if (!proxies.length) {
      return null
    }
    const randomProxy = proxies[_.random(0, proxies.length - 1)]
    return clientsMap[randomProxy].client
  }
}

export interface CodisClient extends redis.RedisClient { }

export class NodeCodis extends BaseCodis {
  public static print = redis.print
  constructor(opts: NodeCodisOpts) {
    opts.redisClient = 'redis'
    super(opts)
  }
  public static getRandomClient(clientsMap: CodisClientPool) {
    return super.getRandomClient(clientsMap) as redis.RedisClient
  }
}

export interface CodisIOClient extends ioredis.Redis { }

export class NodeIOCodis extends BaseCodis {
  public static print = undefined
  constructor(opts: NodeCodisOpts) {
    opts.redisClient = 'ioredis'
    super(opts)
  }
  public static getRandomClient(clientsMap: CodisClientPool) {
    return super.getRandomClient(clientsMap) as ioredis.Redis
  }
}
