import { Module } from '@nestjs/common';
import { StreamEventController } from './controllers/stream-event.controller';
import { StreamEventService } from './services/stream-event.service';
import { ClientOptions, ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WebhookService } from './services/webhooks.service';
import { ScyllaProvider } from './providers/scylla.provider';
import { NotifyService } from './services/notify.service';
import { NotifyController } from './controllers/notify.controller';
import { MeteringService } from './services/metering.service';

@Module({
  imports: [
    ConfigModule.forRoot(),
    ClientsModule.registerAsync([
      {
        name: 'WEBHOOK_NOTIFY_SERVICE',
        imports: [ConfigModule],
        useFactory: async (configService: ConfigService): Promise<ClientOptions> => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: configService.get<string>('KAFKA_CLIENT'),
              brokers: [`${configService.get<string>('KAFKA_HOST')}:${configService.get<string>('KAFKA_PORT')}`],
            },
            consumer: {
              groupId: configService.get<string>('KAFKA_CONSUMER_GROUP'),
            },
            run: {
              autoCommit: false
            }
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [StreamEventController, NotifyController],
  providers: [StreamEventService, NotifyService, WebhookService, ScyllaProvider, MeteringService],
})
export class AppModule {}
