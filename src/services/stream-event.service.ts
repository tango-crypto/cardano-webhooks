import { Inject, Injectable } from '@nestjs/common';
import { WebhookService } from './webhooks.service';
import { Block } from '../models/block.model';
import { Utils } from '../utils';
import { ClientKafka, KafkaContext } from '@nestjs/microservices';
import { Delegation } from 'src/models/delegation.model';
import { Epoch } from 'src/models/epoch.model';
import { Payment, Asset, Transaction } from 'src/models/payment.model';
import { PostgresClient } from '@tangocrypto/tango-ledger';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StreamEventService {
  dbClient: PostgresClient;
  dbClientTestnet: PostgresClient;

  constructor(
    @Inject("WEBHOOK_NOTIFY_SERVICE") private readonly kafkaClient: ClientKafka,
    private readonly configService: ConfigService,
    private readonly webhookService: WebhookService,
  ) {
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

  async onNewEpoch(epoch: Epoch) {
    let nextState = undefined;
    do {
      const { items, state } = await this.webhookService.getWebhooks('WBH_EPOCH', epoch.block.network, nextState);
      for (const webhook of items) {
        if (webhook.rules.length == 0 || Utils.matchRules(webhook.rules, epoch)) {
          const confirmations = Number(webhook.confirmations) || 0;
          await Utils.processWebhook(this.kafkaClient, webhook, 'epoch', epoch, confirmations);
        }
      }
      nextState = state;
    } while (nextState);

  }

  async onNewBlock(block: Block) {
    let nextState = undefined;
    do {
      const { items, state } = await this.webhookService.getWebhooks('WBH_BLOCK', block.network, nextState);
      for (const webhook of items) {
        const confirmations = Number(webhook.confirmations) || 0;
        // only check all rules at this stage if no confirmations needed
        // since we can't guarantee this block's data remains after n confirmations and possible rollbacks occurs.
        const rules = confirmations == 0 ? webhook.rules : webhook.rules.filter(r => r.field == 'block_no');
        if (rules.length == 0 || Utils.matchRules(rules, block)) {
          await Utils.processWebhook(this.kafkaClient, webhook, 'block', block, confirmations);
        }
      }
      nextState = state;
    } while (nextState);
  }

  async onNewDelegation(delegation: Delegation) {
    let nextState = undefined;
    do {
      const { items, state } = await this.webhookService.getWebhooks('WBH_DELEGATION', delegation.network, nextState);
      for (const webhook of items) {
        if (webhook.rules.length == 0 || Utils.matchRules(webhook.rules, delegation)) {
          const confirmations = Number(webhook.confirmations) || 0;
          await Utils.processWebhook(this.kafkaClient, webhook, 'delegation', delegation, confirmations);
        }
      }
      nextState = state;
    } while (nextState);
  }

  async onNewPayment(payment: Payment) {
    const ledger = payment.transaction.block.network == 'mainnet' ? this.dbClient : this.dbClientTestnet;
    const utxos = await ledger.getTransactionUtxos(payment.transaction.hash);
    const outputs = Utils.groupBy(utxos.outputs, 'address');
    const inputs = Utils.groupBy(utxos.inputs, 'address');
    const addresses = new Set(Object.keys(outputs).concat(Object.keys(inputs)));
    for (const address of addresses) {
      let assets: Asset[];
      let nextState = undefined;
      const outUtxos = outputs[address] || [];
      do {
        const { items, state } = await this.webhookService.getWebhooks(address, payment.transaction.block.network, nextState);
        if (items.length == 0) break;
        if (!assets) {
          const arrayAssets = outUtxos.flatMap(utxo => utxo.assets || []);
          const accAssets = arrayAssets.reduce((obj: { [key: string]: Asset }, asset) => {
            const key = `${asset.policy_id}.${asset.asset_name}`;
            if (!obj[key]) {
              obj[key] = { policy_id: asset.policy_id, asset_name: asset.asset_name, quantity: 0 };
            }
            obj[key].quantity += +asset.quantity;
            return obj;
          }, {})
          assets = Object.values(accAssets);
        }
        for (const webhook of items) {
          if (webhook.rules.length == 0 || outUtxos.some(utxo => Utils.matchRules(webhook.rules, utxo)) || assets.some(asset => Utils.matchRules(webhook.rules, asset))) {
            const confirmations = Number(webhook.confirmations) || 0;
            await Utils.processWebhook(this.kafkaClient, webhook, 'payment', { transaction: payment.transaction, address, from: utxos.inputs, to: utxos.outputs }, confirmations);
          }
        }
        nextState = state;
      } while (nextState);
    }
  }

  async onNewTransaction(tx: Transaction) {
    let nextState = undefined;
    do {
      const { items, state } = await this.webhookService.getWebhooks('WBH_TRANSACTION', tx.block.network, nextState);
      for (const webhook of items) {
        if (webhook.rules.length == 0 || Utils.matchRules(webhook.rules, tx)) {
          const confirmations = Number(webhook.confirmations) || 0;
          await Utils.processWebhook(this.kafkaClient, webhook, 'transaction', tx, confirmations);
        }
      }
      nextState = state;
    } while (nextState);
  }

}
