import * as Redis from 'ioredis';

type Callback<T> = (err: Error | null, res: T) => void;
export class Metering  {
    redis: Redis.Redis | Redis.Cluster;
    config: {options: Redis.ClusterOptions | Redis.RedisOptions, nodes?: Redis.ClusterNode[], prefix?: string};

    onReadyBound: any;
    onRedisReady: Callback<Metering>;

    onCloseBound: any;
    onRedisClose: Callback<boolean>;

    onEndBound: any;
    onRedisEnd: Callback<boolean>;

    private accountPrefix = 'account-quota';
    private apiPrefix = 'quota';
    private mempoolPrefix = 'mempool-capacity';
    private confirmationPrefix = 'wbh-confirmation';
    private globalTickPrefix = 'global-tick';
    public static webhookFailsPrefix = 'wh-fails';

    constructor(config: {options: Redis.ClusterOptions | Redis.RedisOptions, nodes?: Redis.ClusterNode[]}, prefix = 'account-quota') {
        this.config = config
        this.accountPrefix = prefix;
        this.onReadyBound = this.onReady.bind(this);
        this.onEndBound = this.onEnd.bind(this);
        this.onCloseBound = this.onClose.bind(this);
        this.initialize(config);
    }

    private initialize(config: { options: Redis.ClusterOptions | Redis.RedisOptions, nodes?: Redis.ClusterNode[] }) {
        this.redis = config.nodes ? new Redis.Cluster(config.nodes, config.options) : new Redis(config.options);
        this.redis.on('connect', () => console.log('Redis: connect'));
        this.redis.on('reconnecting', (time) => console.log('Redis: reconnecting',  time));
        this.redis.on('ready', this.onReadyBound);
        this.redis.on('close', this.onCloseBound);
        this.redis.on('end', this.onEndBound);
        this.redis.on('error', (err) => console.log('Redis: error', err));
    }

    private async onReady(): Promise<void> {
        console.log("Redis: ready")
        if (this.onRedisReady) {
            this.onRedisReady(null, this);
        }
    }

    private async onClose(): Promise<void> {
        console.log('Redis: close')
        if (this.onRedisClose) {
            this.onRedisClose(null, true);
        }
    }

    private async onEnd(): Promise<void> {
        console.log('Redis: end')
        if (this.onRedisEnd) {
            this.onRedisEnd(null, true);
        }
    }

    async open(callback?: Callback<Metering>): Promise<Metering> {
        let result: Metering | Promise<Metering>;
        if (callback) {
            if (this.isReady()) {
                callback(null, this);
                return this;
            }
            this.onRedisReady = callback;
            result = this;
        } else {
            if (this.isReady()) {
                return Promise.resolve(this);
            }
            result = new Promise<Metering>((resolve, reject) => {
                this.onRedisReady = (err: Error | null, res: Metering) => err ? reject(err) : resolve(res);
            });
        }
        if (!this.isReady() && !this.isConnecting()) {
            this.redis.connect();
        }
        return result;
    }

    async close(callback?: Callback<boolean>): Promise<boolean> {
        const ok = await this.redis.quit();
        if (ok == "OK") {
            if (callback) {
                this.onRedisEnd = callback;
                return true;
            }
            return new Promise((resolve, reject) => {
                this.onRedisEnd = (err: Error | null, res: boolean) => err ? reject(err) : resolve(res);
            });
        } else {
            return false;
        }
    }

    async addAccount(account: string, data: Map<string, string|number>): Promise<boolean> {
        const fields = await this.redis.hset(`${this.accountPrefix}-${account}`, data);
        return fields > 0;
    }

    async getAccount(account: string): Promise<Record<string, string|number>> {
        return this.redis.hgetall(`${this.accountPrefix}-${account}`);
    }

    async resetAccount(account: string, data: Map<string, string|number>): Promise<boolean> {
        const keys = (await this.redis.hkeys(`${this.accountPrefix}-${account}`)).filter(k => k.startsWith(Metering.webhookFailsPrefix));
        let multi = this.redis.multi()
        .hset(`${this.accountPrefix}-${account}`, data);
        if (keys.length > 0) {
            multi = multi.hdel(`${this.accountPrefix}-${account}`, ...keys);
        }
        const result = await multi.exec();
        return !result.some(r => r[0]);
    }

    async deleteAccount(account: string): Promise<boolean> {
        const number = await this.redis.del(`${this.accountPrefix}-${account}`);
        return number == 1;
    }

    async processWebhook(account: string, wbhId: string, increment = 1,  fails = 0): Promise<Record<string, any>> {
        const keys = ['tier', 'webhooks_requests', 'webhooks_counter', 'webhooks_requests_failed_limit'];
        let multi = this.redis.multi()
        .hincrby(`${this.accountPrefix}-${account}`, 'webhooks_counter', increment);
        if (fails > 0) {
            multi = multi
            .hincrby(`${this.accountPrefix}-${account}`, `${Metering.webhookFailsPrefix}-${wbhId}`, fails);
            keys.push(`${Metering.webhookFailsPrefix}-${wbhId}`);
        } else {
            multi = multi.hdel(`${this.accountPrefix}-${account}`, `${Metering.webhookFailsPrefix}-${wbhId}`);
        }
        const result = await multi
        .hmget(`${this.accountPrefix}-${account}`, ...keys)
        .exec();
        const errors: Error[] = result.reduce((arr, r) => {
            if (r[0]) {
                arr.push(r[0]);
            }
            return arr;
        }, []);
        if (errors.length > 0) {
          throw Error(errors.map(e => e.message).join('\n'));
        } else {
            const data = result[result.length - 1][1];
            return keys.reduce((dict: Record<string, string>, k, index) => {
                const key = k.startsWith(Metering.webhookFailsPrefix) ? 'webhooks_requests_failed' : k;
                dict[key] = data[index];
                return dict;
            }, {});
        }
    }

    async resetWebhookFails(account: string, wbhId: string): Promise<boolean> {
        const n = await this.redis.hdel(`${this.accountPrefix}-${account}`, `${Metering.webhookFailsPrefix}-${wbhId}`);
        return n >= 1;
    }

    async getWebhookQuota(account: string): Promise<number> {
        const item = await this.redis.hmget(`${this.accountPrefix}-${account}`, 'webhooks_counter', 'webhooks_requests');
        const counter = Number(item[0] || 0);
        const requests =  Number(item[1]);
        return requests - counter;
    }

    async getApiQuota(key: string): Promise<number> {
        const quota = await this.redis.get(`${this.apiPrefix}-${key}`);
        return Number(quota);
    }

    async setApiQuota(key: string, value: number): Promise<boolean> {
        const ok = await this.redis.set(`${this.apiPrefix}-${key}`, value);
        return ok == "OK";
    }

    async resetApiQuota(key: string): Promise<boolean> {
        const numb = await this.redis.del(`${this.apiPrefix}-${key}`);
        return numb == 1;
    }

    async processNft(account: string, increment = 1): Promise<number> {
        return this.redis.hincrby(`${this.accountPrefix}-${account}`, 'nft_minted_counter', increment);
    }

    async getNftQuota(account: string): Promise<Record<string, any>> {
        const item = await this.redis.hmget(`${this.accountPrefix}-${account}`, 'nft_mints', 'nft_fees', 'nft_minted_counter', 'tier', 'nft_websites', 'nft_websites_counter');
        const f = JSON.parse(item[1] || '{}');
        const nft_fees = Object.keys(f).reduce((fees, tier) => ({...fees, [`${tier}`]: Number(f[tier])}), {});
        return { 
            nft_free_quota:  Number(item[0] || 0), 
            nft_fees: nft_fees, 
            nft_minted: Number(item[2] || 0), 
            tier: item[3] || 'free',
            nft_website_limit: Number(item[4] || 1), // default 1 website
            nft_websites: Number(item[5] || 0)
        };
    }

    async processWebsite(account: string, increment = 1): Promise<number> {
        return this.redis.hincrby(`${this.accountPrefix}-${account}`, 'nft_websites_counter', increment);
    }

    async updateMempoolCapacity(network: string, id: string, score: number): Promise<boolean> {
        const result = await this.redis.zadd(`${this.mempoolPrefix}-${network}`, score, id);
        return result == 1;
    }

    async getMempoolMaxCapacity(network: string, size: number): Promise<Record<string, any>|null> {
        const items = await this.redis.zrangebyscore(`${this.mempoolPrefix}-${network}`, size, '+inf', "WITHSCORES", "LIMIT", 0, -1);
        return items.length >= 2 ? { id: items[items.length-2], capacity: Number(items[items.length-1]) } : null;
    }

    async deleteMempool(network: string, id: string): Promise<boolean> {
        const number = await this.redis.zrem(`${this.mempoolPrefix}-${network}`, id);
        return number == 1;
    }

    async processNftTokenUpload(token: string, increment = 1): Promise<number> {
        return this.redis.incrby(`token-${token}`, increment);
    }

    async deleteNftTokenUpload(token: string): Promise<boolean> {
        const number = await this.redis.del(`token-${token}`);
        return number == 1;
    }

    async processTangopayProductUpload(product: string, increment = 1): Promise<number> {
        return this.redis.incrby(`product-${product}`, increment);
    }

    async deleteTangopayProductUpload(product: string): Promise<boolean> {
        const number = await this.redis.del(`product-${product}`);
        return number == 1;
    }

    async getwhitelistRequests(key: string): Promise<number> {
        const r = await this.redis.get(`whitelist-${key}`);
        return Number(r) || 0;
    }

    async processWhitelist(key: string, increment = 1, ttl = 0): Promise<number> {
        let multi = this.redis.multi().incrby(`whitelist-${key}`, increment);
        if (ttl > 0) {
            multi = multi.expire(`whitelist-${key}`, ttl);
        }
        const result = await multi.exec();
        const errors: Error[] = result.reduce((arr, r) => {
            if (r[0]) {
                arr.push(r[0]);
            }
            return arr;
        }, []);
        if (errors.length > 0) {
            throw Error(errors.map(e => e.message).join('\n'));
        } else {
            return parseInt(result[0][1]);
        }
    }

    async whitelistTtl(key: string): Promise<number> {
        return this.redis.ttl(`whitelist-${key}`);
    }

    async getProductRequests(key: string): Promise<number> {
        const r = await this.redis.get(`product-${key}`);
        return Number(r) || 0;
    }

    async processProduct(key: string, increment = 1, ttl = 0): Promise<number> {
        let multi = this.redis.multi().incrby(`product-${key}`, increment);
        if (ttl > 0) {
            multi = multi.expire(`product-${key}`, ttl);
        }
        const result = await multi.exec();
        const errors: Error[] = result.reduce((arr, r) => {
            if (r[0]) {
                arr.push(r[0]);
            }
            return arr;
        }, []);
        if (errors.length > 0) {
            throw Error(errors.map(e => e.message).join('\n'));
        } else {
            return parseInt(result[0][1]);
        }
    }
    
    async productTtl(key: string): Promise<number> {
        return this.redis.ttl(`product-${key}`);
    }

    async addConfirmationWebhook(network: string, event: any, slot: number): Promise<number> {
        const key = `${this.confirmationPrefix}-${network}-${slot}`;
        return this.redis.rpush(key, event);
    }

    async getConfirmationWebhooks(network: string, slot: number): Promise<any[]> {
        const key = `${this.confirmationPrefix}-${network}-${slot}`;
        const result = await this.redis.multi()
        .lrange(key, 0, -1)
        .del(key)
        .exec();
        const errors: Error[] = result.reduce((arr, r) => {
            if (r[0]) {
                arr.push(r[0]);
            }
            return arr;
        }, []);
        if (errors.length > 0) {
          throw Error(errors.map(e => e.message).join('\n'));
        } else {
            return result[0][1].map((e: any) => JSON.parse(e));
        }
    }

    async addWaitingSale(key: string, data: any, ttl = 300): Promise<string> {
        return this.redis.setex(key, ttl, data);
    }

    async deleteWaitingSale(key: string): Promise<number> {
        return this.redis.del(key);
    }

    async incrGlobalTick(network: string, incr = 1): Promise<number> {
        const tick = await this.redis.incrby(`${this.globalTickPrefix}-${network}`, incr);
        return Number(tick);
    }

    async getGlobalTick(network: string): Promise<number> {
        const tick = await this.redis.get(`${this.globalTickPrefix}-${network}`);
        return Number(tick);
    }

    private async reconnect(delay = 200): Promise<void> {
        await this.redis.connect();
        while (!this.isReady()) {
            await this.sleep(delay);
        }
        return;
    }

    private isReady(): boolean {
        return this.redis.status == 'ready';
    }
    
    private isConnecting(): boolean {
        return this.redis.status == 'connecting';
    }

    private sleep(time = 1000): Promise<void> {
        return new Promise((resolve) => {
            setTimeout(() => resolve(), time);
        })
    }
}