import { Controller, Get } from '@nestjs/common';
import { EventPattern } from '@nestjs/microservices';
import { NotifyService } from 'src/services/notify.service';

@Controller()
export class NotifyController {
  constructor(private readonly notifyService: NotifyService) {}

  @EventPattern('wbh_event')
  onNewEpoch(data: any) {
    this.notifyService.notify(data.value);
  }

}
