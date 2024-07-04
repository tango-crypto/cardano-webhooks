import { Controller, Inject, OnModuleInit } from '@nestjs/common';
import { ClientKafka, Ctx, EventPattern, KafkaContext, Payload } from '@nestjs/microservices';
import { NotifyService } from 'src/services/notify.service';
import { Utils } from 'src/utils';

@Controller()
export class NotifyController implements OnModuleInit {
  constructor(
    // @Inject("WEBHOOK_NOTIFY_SERVICE") private readonly kafkaClient: ClientKafka,
    private readonly notifyService: NotifyService
  ) {}

  async onModuleInit() {
    // Ensure the client is connected
    // await this.kafkaClient.connect();
  }

  @EventPattern('wbh_event')
  async onNewEpoch(@Payload() data: any, @Ctx() context: KafkaContext) {
    console.log('Procesing new webhok event ...');
    await this.notifyService.notify(data);
    await Utils.commitOffsets(null, context);
  }
}
