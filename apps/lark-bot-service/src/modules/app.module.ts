import {
  appCommonConfiguration,
  getWinstonConfig,
  grpcConfiguration,
  validationSchema,
} from '@app/common';
import { MicroserviceModule, MicroserviceName } from '@app/core';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService, ConfigType } from '@nestjs/config';
import { Transport } from '@nestjs/microservices';
import { WinstonModule } from 'nest-winston';
import { HealthController } from './health/health.controller';
import { LarkModule } from './lark/lark.module';
import { appConfiguration } from '../config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env', '../../.env'],
      validationSchema,
      validationOptions: { abortEarly: false },
      load: [appCommonConfiguration, appConfiguration, grpcConfiguration],
    }),
    WinstonModule.forRootAsync({
      useFactory: (
        appConfig: ConfigType<typeof appConfiguration>,
        commonConfig: ConfigType<typeof appCommonConfiguration>,
      ) => getWinstonConfig(appConfig.appName, commonConfig.nodeEnv),
      inject: [appConfiguration.KEY, appCommonConfiguration.KEY],
    }),
    MicroserviceModule.registerAsync([
      {
        name: MicroserviceName.ProjectService,
        transport: Transport.GRPC,
        inject: [ConfigService],
        useFactory: (configService: ConfigService) =>
          configService.get('grpc.projectService'),
      },
    ]),
    LarkModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
