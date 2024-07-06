import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { mapping } from "cassandra-driver";
// import { Subscription } from "src/webhooks/models/subscription.model";
import { ScyllaProvider } from "../providers/scylla.provider";
import { Webhook, WebhookKey } from "src/models/webhook.model";

@Injectable()
export class WebhookService {
    table: string;
    webhookMapper: mapping.ModelMapper<Webhook>;
    webhooksQuery = `SELECT * FROM webhooks WHERE webhook_key = ? AND network = ? AND active = true ALLOW FILTERING`;

    constructor(private readonly configService: ConfigService, private scyllaProvider: ScyllaProvider)  { 
        const mappingOptions: mapping.MappingOptions = {
            models: {
                'Webhook': {
                    tables: ['webhooks'],
                    mappings: new mapping.DefaultTableMappings
                },
            }
        }

        this.webhookMapper = this.scyllaProvider.createMapper(mappingOptions).forModel('Webhook');
    }

    async getWebhook(userId: string, webhookId: string): Promise<Webhook> {
        const result = await this.webhookMapper.find({ user_id: userId, webhook_id: webhookId });
        return result.first();
    }

    async getWebhooks(webhook_key: WebhookKey | string, network: string, state?: string, size: number = 100): Promise<{items: Webhook[], state: string}> {
        const result = await this.scyllaProvider.execute<Webhook>(this.webhooksQuery, { webhook_key, network }, { prepare: true, fetchSize: size, pageState: state });
        return result;
    }
}