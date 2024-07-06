import { Controller, Inject } from '@nestjs/common';
import { StreamEventService } from '../services/stream-event.service';
import { ClientKafka, Ctx, EventPattern, KafkaContext, Payload } from '@nestjs/microservices';
import { Block } from 'src/models/block.model';
import { Utils } from 'src/utils';
import { Delegation } from 'src/models/delegation.model';
import { Epoch } from 'src/models/epoch.model';
import { Payment, Transaction } from 'src/models/payment.model';

@Controller()
export class StreamEventController {
  constructor(
    private readonly streamEventService: StreamEventService
  ) {}

  @EventPattern('new_epoch')
  async onNewEpoch(@Payload() epoch: Epoch, @Ctx() context: KafkaContext) {
    console.log(`Process new stream event (epoch) ${'-'.repeat(50)}`);
    console.log('EPOCH', JSON.stringify(epoch));
    await this.streamEventService.onNewEpoch(epoch);
    await Utils.commitOffsets(context);
  }

  @EventPattern('new_block')
  async onNewBlock(@Payload() block: Block, @Ctx() context: KafkaContext) {
    console.log(`Process new stream event (block) ${'-'.repeat(50)}`);
    console.log('BLOCK', JSON.stringify(block));
    await this.streamEventService.onNewBlock(block);
    await Utils.commitOffsets(context);
  }

  @EventPattern('new_delegation')
  async onNewDelegation(@Payload() delegation: Delegation, @Ctx() context: KafkaContext) {
    console.log(`Process new stream event (delegation) ${'-'.repeat(50)}`);
    console.log('DELEGATION', JSON.stringify(delegation));
    await this.streamEventService.onNewDelegation(delegation);
    await Utils.commitOffsets(context);
  }

  @EventPattern('new_payment')
  async onNewPayment(@Payload() payment: Payment, @Ctx() context: KafkaContext) {
    console.log(`Process new stream event (payment) ${'-'.repeat(50)}`);
    console.log('PAYMENT', JSON.stringify(payment));
    await this.streamEventService.onNewPayment(payment);
    await Utils.commitOffsets(context);
  }
  
  @EventPattern('new_transaction')
  async onNewTransaction(@Payload() tx: Transaction, @Ctx() context: KafkaContext) {
    console.log(`Process new stream event (transaction) ${'-'.repeat(50)}`);
    console.log('TRANSACTION', JSON.stringify(tx));
    await this.streamEventService.onNewTransaction(tx);
    await Utils.commitOffsets(context);
  }

}
