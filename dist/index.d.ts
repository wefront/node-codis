import zookeeper = require('node-zookeeper-client');
import redis = require('redis');
import ioredis = require('ioredis');
export interface CodisClientPoolItem {
    client: ioredis.Redis | redis.RedisClient;
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
    redisClientOpts?: redis.ClientOpts | ioredis.RedisOptions;
    redisClient?: 'redis' | 'ioredis';
    log?: boolean | Function;
    proxyAddrKey?: string;
}
export declare class BaseCodis {
    static print?: typeof redis.print | undefined;
    private _zkClient;
    private _opts;
    private _state;
    private _lastProxies;
    private _codisClientPool;
    private _subscribers;
    private _codisClient;
    private _zkTimeId;
    constructor(opts: NodeCodisOpts);
    private _validParameter;
    private _validZkTimeout;
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
    static getRandomClient(clientsMap: CodisClientPool): redis.RedisClient | ioredis.Redis | null;
}
export interface CodisClient extends redis.RedisClient {
}
export declare class NodeCodis extends BaseCodis {
    static print: typeof redis.print;
    constructor(opts: NodeCodisOpts);
    static getRandomClient(clientsMap: CodisClientPool): redis.RedisClient;
}
export interface CodisIOClient extends ioredis.Redis {
}
export declare class NodeIOCodis extends BaseCodis {
    static print: undefined;
    constructor(opts: NodeCodisOpts);
    static getRandomClient(clientsMap: CodisClientPool): ioredis.Redis;
}
