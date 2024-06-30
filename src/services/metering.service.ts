import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClusterNode, ClusterOptions, RedisOptions } from 'ioredis';
import { Metering } from 'src/providers/metering';

@Injectable()
export class MeteringService implements OnModuleDestroy {
    client: Metering;

    constructor(private readonly configService: ConfigService) {
        const config: { options: ClusterOptions | RedisOptions, nodes?: ClusterNode[] } = this.configService.get<string>('NODE_ENV') == 'development' ? {
            options: {
                host: this.configService.get<string>('REDIS_HOST'),
                port: this.configService.get<number>('REDIS_PORT')
            }
        } : {
            options: {
                redisOptions: {
                    showFriendlyErrorStack: true,
                    password: this.configService.get<string>('REDIS_PWD'),
                }
            },
            nodes: JSON.parse(configService.get<string>('REDIS_CLUSTERS'))
        };
        this.client = new Metering(config);
    }

    async processWebhook(account: string, wbhId: string, increment = 1, fails = 0): Promise<Record<string, any>>{
        return this.client.processWebhook(account, wbhId, increment, fails);
    }

    onModuleDestroy() {
        this.client?.redis.disconnect(false);
    }
}
