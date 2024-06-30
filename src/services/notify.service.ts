import { Inject, Injectable } from '@nestjs/common';
import { WebhookService } from './webhooks.service';
import { Utils } from '../utils';
import { WebhookMessage } from 'src/models/webhook-message.model';
import { ConfigService } from '@nestjs/config';
import { PostgresClient } from '@tangocrypto/tango-ledger';
import axios from 'axios';
import { ClientKafka } from '@nestjs/microservices';
import { MeteringService } from './metering.service';

@Injectable()
export class NotifyService {
    confirmationFactor: number;
    timeout: number;
    requestsWarning: number;
    webhooksRequestsFailedLimit: number;
    headerSignature: string;
    dbClient: PostgresClient;
    dbClientTestnet: PostgresClient;

    constructor(
        @Inject("WEBHOOK_NOTIFY_SERVICE") private readonly kafkaClient: ClientKafka,
        private readonly meteringService: MeteringService,
        private readonly configService: ConfigService,
        private readonly webhookService: WebhookService
    ) {
        this.confirmationFactor = this.configService.get<number>('CONFIRMATION_FACTOR', 10);
        this.timeout = this.configService.get<number>('NOTIFY_REQUEST_TIMEOUT', 5000);
        this.requestsWarning = this.configService.get<number>('WEBHOOKS_REQUESTS_WARNING', 0.95);
        this.webhooksRequestsFailedLimit = this.configService.get<number>('WBH_REQUEST_FAILED_LIMIT', 1);
        this.headerSignature = this.configService.get<string>('NOTIFY_REQUEST_HEADER_SIGNATURE', 'X-TangoCrypto-Signature');
        this.dbClient = new PostgresClient({
            connection: {
                host: this.configService.get<string>('DB_HOST'),
                user: this.configService.get<string>('DB_USER'),
                port: this.configService.get<number>('DB_PORT'),
                password: this.configService.get<string>('DB_PWD'),
                database: this.configService.get<string>('DB_NAME'),
            },
            pool: {
                min: this.configService.get<number>('DB_POOL_MIN', 0),
                max: this.configService.get<number>('DB_POOL_MAX', 2)
            },
            debug: process.env.DB_DEBUG == "true"
        });
        this.dbClientTestnet = new PostgresClient({
            connection: {
                host: this.configService.get<string>('DB_HOST_TESTNET'),
                user: this.configService.get<string>('DB_USER_TESTNET'),
                port: this.configService.get<number>('DB_PORT_TESTNET'),
                password: this.configService.get<string>('DB_PWD_TESTNET'),
                database: this.configService.get<string>('DB_NAME_TESTNET'),
            },
            pool: {
                min: this.configService.get<number>('DB_POOL_MIN_TESTNET', 0),
                max: this.configService.get<number>('DB_POOL_MAX_TESTNET', 2)
            },
            debug: this.configService.get<string>('DB_DEBUG_TESTNET') == "true"
        });
    }

    async notify(message: WebhookMessage) {
        const { webhookId, accountId, webhookName, authToken, callbackUrl, payload, type, network, confirmations, originalConfirmations } = message;
        const webhook = await this.webhookService.getWebhook(accountId, webhookId);
        if (!webhook || !webhook.active) return;
        const data = Utils.cborDecode(Buffer.from(payload, 'base64'));
        if (confirmations == 0) {
            const incr = originalConfirmations ? originalConfirmations * this.confirmationFactor : 1;
            try {
                let content = data.data;
                const ledger = network == 'mainnet' ? this.dbClient : this.dbClientTestnet;
                if (type == 'payment') {
                    const utxos = await ledger.getTransactionUtxos(content.transaction.hash);
                    if (originalConfirmations > 0) {
                        const { block_no, slot_leader } = content.transaction.block;
                        const block = await this.fecthOnChainBlock(ledger, block_no, slot_leader);
                        content.transaction.block = block;
                    }
                    content.from = utxos.inputs;
                    content.to = utxos.outputs;
                } else if (type == 'block' && originalConfirmations > 0) { // posible rollbacks so we need to update block's data
                    const { block_no, slot_leader } = content;
                    const block = await this.fecthOnChainBlock(ledger, block_no, slot_leader);
                    if (webhook.rules.length > 0 && !Utils.matchRules(webhook.rules, block)) return;
                    content = block;
                } else if (type == 'transaction' && originalConfirmations > 0) {
                    const { block_no, slot_leader } = content.block;
                    const block = await this.fecthOnChainBlock(ledger, block_no, slot_leader);
                    content.block = block;
                } else if (type == 'asset' && originalConfirmations > 0) {
                    const { block_no, slot_leader } = content.transaction.block;
                    const block = await this.fecthOnChainBlock(ledger, block_no, slot_leader);
                    content.transaction.block = block;
                }
                data.data = content;
                const webhookPayload = { ...data, network };
                const signature = Utils.buildSignature(webhookPayload, authToken);
                await axios.post(callbackUrl, webhookPayload, { timeout: this.timeout, headers: { [this.headerSignature]: signature }, maxContentLength: Infinity });

                // notify webhooks-metering
                await this.checkWebhookQuota(accountId, webhookId, network, incr);
            } catch (err) {
                let errorMessage = '';
                if (err.response) {
                    console.error('Axios Error:', err.toJSON());
                    errorMessage = `The remote server returned an error: (${err.response.status}) ${err.response.statusText}`;
                } else {
                    console.error('Unknown Error:', err);
                    errorMessage = `The remote server returned an error: (500) ${err.message}`;
                }

                // notify webhooks-metering
                const quota = await this.checkWebhookQuota(accountId, webhookId, network, incr, incr);
                const webhooks_requests_failed = Number(quota.webhooks_requests_failed);
                if (webhooks_requests_failed < quota.webhooks_requests_failed_limit) {
                    // TODO: put it back in stream events (e.g kafka)
                    // batchItemFailures.push({ itemIdentifier: record.messageId });
                } else if (webhooks_requests_failed >= quota.webhooks_requests_failed_limit && webhooks_requests_failed - quota.webhooks_requests_failed_limit < incr) {
                    // deactive webhook (remove from notification's listners) 
                    const eventKey = Utils.getRandomUUID();
                    const message = {
                        eventKey: eventKey,
                        network: network,
                        data: { accountId, webhookId, webhookName, requests: quota.webhooks_requests_failed_limit, timeout: this.timeout },
                    };
                    Utils.publishEvent(this.kafkaClient, 'wbh_unreachable', message);
                }
            }
        } else { // TODO: handle confirmations > 0
        }
    }

    async fecthOnChainBlock(ledger: PostgresClient, block_no: number, slot_leader: string) {
        const block = await ledger.getBlock(block_no);
        block.pool = await ledger.getPool(slot_leader);
        return block;
    }

    async checkWebhookQuota(accountId: string, webhookId: string, network: string, incr: number, fails = 0) {
        let quota = await this.meteringService.processWebhook(accountId, webhookId, incr, fails);
        const webhooks_requests = quota.tier == 'enterprise' ? Number.POSITIVE_INFINITY : Number(quota.webhooks_requests);
        const webhooks_counter = Number(quota.webhooks_counter);
        const warning_requests = Math.floor(webhooks_requests * this.requestsWarning);
        quota.webhooks_requests_failed_limit = Number(quota.webhooks_requests_failed_limit) || this.webhooksRequestsFailedLimit;

        // check webhooks usage warning
        if (webhooks_counter >= warning_requests && webhooks_counter - warning_requests < incr) {
            const eventKey = Utils.getRandomUUID();
            const message = {
                eventKey: eventKey,
                network: network,
                data: { accountId, quota: this.requestsWarning * 100 },
            };
            Utils.publishEvent(this.kafkaClient, 'wbh_warning', message);
        }
        // check deactivate account's webhooks
        if (quota.tier == 'free' && (webhooks_counter >= webhooks_requests && webhooks_counter - webhooks_requests < incr)) {
            const eventKey = Utils.getRandomUUID();
            const message = {
                eventKey: eventKey,
                network: network,
                data: { accountId },
            };
            Utils.publishEvent(this.kafkaClient, 'wbh_maxedout', message);
        }
        return quota;
    }
}