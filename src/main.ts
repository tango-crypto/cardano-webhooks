import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const kafkaHost = configService.get<string>('KAFKA_HOST');
  const kafkaPort = configService.get<string>('KAFKA_PORT');
  const clientId = configService.get<string>('KAFKA_CLIENT');
  const groupId = configService.get<string>('KAFKA_CONSUMER_GROUP');

  const microserviceOptions: MicroserviceOptions = {
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: clientId,
        brokers: [`${kafkaHost}:${kafkaPort}`]
      },
      consumer: {
        groupId: groupId,
      },
      run: {
        autoCommit: false
      }
    },
  };

  app.connectMicroservice(microserviceOptions);
  await app.startAllMicroservices();
}

bootstrap();