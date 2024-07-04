import { Inject, Injectable } from '@nestjs/common';
import { WebhookService } from './webhooks.service';
import { Block } from '../models/block.model';
import { Utils } from '../utils';
import { ClientKafka, KafkaContext } from '@nestjs/microservices';
import { Delegation } from 'src/models/delegation.model';

@Injectable()
export class StreamEventService {

  constructor(
    @Inject("WEBHOOK_NOTIFY_SERVICE") private readonly kafkaClient: ClientKafka, 
    private readonly webhookService: WebhookService) {
  }

  onNewEpoch(value: any) {
    // console.log('New Epoch:', value);

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

  onNewPayment(value: any) {
    // console.log('New Payment:', value);
  }

  onNewTransaction(value: any) {
    // console.log('New Transaction:', value);
  }

}
