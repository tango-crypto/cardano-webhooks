import { Controller } from '@nestjs/common';
import { StreamEventService } from '../services/stream-event.service';
import { EventPattern } from '@nestjs/microservices';

@Controller()
export class StreamEventController {
  constructor(private readonly streamEventService: StreamEventService) {}

  @EventPattern('new_epoch')
  onNewEpoch(data: any) {
    this.streamEventService.onNewEpoch(data.value);
  }

  @EventPattern('new_block')
  onNewBlock(data: any) {
    this.streamEventService.onNewBlock(data.value);
  }

  @EventPattern('new_delegation')
  onNewDelegation(data: any) {
    this.streamEventService.onNewDelegation(data.value);
  }

  @EventPattern('new_payment')
  onNewPayment(data: any) {
    this.streamEventService.onNewPayment(data.value);
  }
  
  @EventPattern('new_transaction')
  onNewTransaction(data: any) {
    this.streamEventService.onNewTransaction(data.value);
  }

}
