import {
  getAllowedCorsOrigins,
  getAppCommonConfig,
  getWinstonConfig,
  logBootstrapInfo,
} from '@app/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { WinstonModule } from 'nest-winston';
// oxlint-disable-next-line import/no-unassigned-import -- Nest decorators require reflect metadata at bootstrap.
import 'reflect-metadata';
import { getAppConfig } from './config/app.config';
import { AppModule } from './modules/app.module';

async function bootstrap() {
  const appConfig = getAppConfig();
  const { nodeEnv } = getAppCommonConfig();
  const logger = WinstonModule.createLogger(getWinstonConfig(appConfig.appName, nodeEnv));
  const app = await NestFactory.create(AppModule, { logger });
  app.use(helmet());
  app.enableCors({ origin: getAllowedCorsOrigins(), credentials: true });
  app.setGlobalPrefix('circle/lark-bot');
  app.enableShutdownHooks();

  await app.listen(appConfig.appPort);
  logBootstrapInfo(app, {
    nodeEnv,
    logger,
    appPort: appConfig.appPort,
  });
}

void bootstrap();
