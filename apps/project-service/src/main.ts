import {
  getAllowedCorsOrigins,
  getAppCommonConfig,
  getWinstonConfig,
  logBootstrapInfo,
  PayloadValidationPipe,
  setupSwagger,
} from '@app/common';
import {
  MicroserviceConfigOptions,
  MicroserviceFactory,
  MicroserviceName,
} from '@app/core';
import { ClassSerializerInterceptor } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import helmet from 'helmet';
import { WinstonModule } from 'nest-winston';
// oxlint-disable-next-line import/no-unassigned-import -- Nest decorators require reflect metadata at bootstrap.
import 'reflect-metadata';
import { getAppConfig } from './config/app.config';
import { AppModule } from './modules/app.module';

async function bootstrap() {
  const { appName, appPort } = getAppConfig();
  const { nodeEnv } = getAppCommonConfig();
  const logger = WinstonModule.createLogger(getWinstonConfig(appName, nodeEnv));

  const app = await NestFactory.create(AppModule, {
    logger,
  });
  const configService = app.get(ConfigService);

  const reflector = app.get(Reflector);

  app.use(helmet());
  app.enableCors({
    origin: getAllowedCorsOrigins(),
    credentials: true,
  });

  app.setGlobalPrefix('circle/api');
  app.useGlobalPipes(new PayloadValidationPipe());
  app.useGlobalInterceptors(new ClassSerializerInterceptor(reflector));

  setupSwagger(app, appName, ['/circle']);

  await app.init();

  const grpcListener = configService.get('grpc.projectService');
  const grpcConfig = new MicroserviceFactory(configService).createConfig({
    serviceName: MicroserviceName.ProjectService,
    transport: Transport.GRPC,
    options: { ...grpcListener },
  } as unknown as MicroserviceConfigOptions);
  await app.connectMicroservice<MicroserviceOptions>(grpcConfig);
  await app.startAllMicroservices();
  await app.listen(appPort);

  logBootstrapInfo(app, {
    nodeEnv,
    logger,
    appPort,
    msListener: { transport: 'gRPC', address: grpcListener?.url },
  });
}

bootstrap();
