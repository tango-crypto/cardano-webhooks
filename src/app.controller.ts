import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { EventPattern } from '@nestjs/microservices';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @EventPattern('new_epoch')
  onNewEpoch(data: any) {
    this.appService.onNewEpoch(data.value);
  }

  @EventPattern('new_block')
  onNewBlock(data: any) {
    this.appService.onNewBlock(data.value);
  }

  @EventPattern('new_delegation')
  onNewDelegation(data: any) {
    this.appService.onNewDelegation(data.value);
  }

  @EventPattern('new_payment')
  onNewPayment(data: any) {
    this.appService.onNewPayment(data.value);
  }
  
  @EventPattern('new_transaction')
  onNewTransaction(data: any) {
    this.appService.onNewTransaction(data.value);
  }

}
