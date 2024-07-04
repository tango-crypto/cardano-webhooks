import { Controller, Inject, OnModuleInit } from '@nestjs/common';
import { ClientKafka, Ctx, EventPattern, KafkaContext, Payload } from '@nestjs/microservices';
import { WebhookMessage } from 'src/models/webhook-message.model';
import { NotifyService } from 'src/services/notify.service';
import { Utils } from 'src/utils';

@Controller()
export class NotifyController {
  constructor(
    private readonly notifyService: NotifyService
  ) {}


  @EventPattern('wbh_event')
  async onNewEpoch(@Payload() data: WebhookMessage, @Ctx() context: KafkaContext) {
    console.log(`Procesing new webhok event (${data.type}) ...`);
    await this.notifyService.notify(data);
    await Utils.commitOffsets(context);
  }
}
