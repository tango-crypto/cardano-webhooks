import { Controller, Inject } from '@nestjs/common';
import { StreamEventService } from '../services/stream-event.service';
import { ClientKafka, Ctx, EventPattern, KafkaContext, Payload } from '@nestjs/microservices';
import { Block } from 'src/models/block.model';
import { Utils } from 'src/utils';

@Controller()
export class StreamEventController {
  constructor(
    // @Inject("WEBHOOK_NOTIFY_SERVICE") private readonly kafkaClient: ClientKafka, 
    private readonly streamEventService: StreamEventService
  ) {}

  @EventPattern('new_epoch')
  async onNewEpoch(data: any, @Ctx() context: KafkaContext) {
    await this.streamEventService.onNewEpoch(data);
    await Utils.commitOffsets(null, context);
  }

  @EventPattern('new_block')
  async onNewBlock(@Payload() block: Block, @Ctx() context: KafkaContext) {
    console.log(`Process new stream event (block) ${'-'.repeat(50)}`);
    console.log('BLOCK', JSON.stringify(block));
    await this.streamEventService.onNewBlock(block, context);
    await Utils.commitOffsets(null, context);
  }

  @EventPattern('new_delegation')
  async onNewDelegation(data: any, @Ctx() context: KafkaContext) {
    await this.streamEventService.onNewDelegation(data);
    await Utils.commitOffsets(null, context);
  }

  @EventPattern('new_payment')
  async onNewPayment(data: any, @Ctx() context: KafkaContext) {
    await this.streamEventService.onNewPayment(data);
    await Utils.commitOffsets(null, context);
  }
  
  @EventPattern('new_transaction')
  async onNewTransaction(data: any, @Ctx() context: KafkaContext) {
    await this.streamEventService.onNewTransaction(data);
    await Utils.commitOffsets(null, context);
  }

}
