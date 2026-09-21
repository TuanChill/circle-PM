import { appCommonConfiguration } from '@app/common';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import { ProjectServiceClientModule } from './project-service-client/project-service-client.module';
import { appConfiguration, getAppConfig } from '../config/app.config';
import { getStdioSafeWinstonConfig } from '../config/stdio-safe-winston.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfiguration, appCommonConfiguration],
    }),
    WinstonModule.forRootAsync({
      useFactory: (appCommonConfig: ConfigType<typeof appCommonConfiguration>) =>
        getStdioSafeWinstonConfig(getAppConfig().appName, appCommonConfig.nodeEnv),
      inject: [appCommonConfiguration.KEY],
    }),
    ProjectServiceClientModule,
  ],
})
export class AppModule {}
