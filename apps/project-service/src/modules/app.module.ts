import {
  AllExceptionFilter,
  appCommonConfiguration,
  getWinstonConfig,
  HttpLoggerMiddleware,
  validationSchema,
} from '@app/common';
import { AwsS3Module, BaseRepository, RedisModule } from '@app/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { WinstonModule } from 'nest-winston';
import { AgentModule } from './agent/agent.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CyclesModule } from './cycles/cycles.module';
import { DocumentsModule } from './documents/documents.module';
import { InboxModule } from './inbox/inbox.module';
import { InitiativesModule } from './initiatives/initiatives.module';
import { IssueStatusesModule } from './issue-statuses/issue-statuses.module';
import { IssueTemplatesModule } from './issue-templates/issue-templates.module';
import { IssuesModule } from './issues/issues.module';
import { LabelsModule } from './labels/labels.module';
import { MembersModule } from './members/members.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { PresenceModule } from './presence/presence.module';
import { ProjectStatusesModule } from './project-statuses/project-statuses.module';
import { ProjectTemplatesModule } from './project-templates/project-templates.module';
import { ProjectsModule } from './projects/projects.module';
import { ReviewsModule } from './reviews/reviews.module';
import { SeedModule } from './seed/seed.module';
import { TeamsModule } from './teams/teams.module';
import { UploadsModule } from './uploads/uploads.module';
import { ViewsModule } from './views/views.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { appConfiguration, dbConfiguration } from '../config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env', '../../.env'],
      validationSchema,
      validationOptions: { abortEarly: false },
      load: [appCommonConfiguration, appConfiguration, dbConfiguration],
    }),
    MikroOrmModule.forRootAsync({
      useFactory: (dbConfig: ConfigType<typeof dbConfiguration>) => {
        return {
          ...dbConfig,
          entityRepository: BaseRepository,
        };
      },
      inject: [dbConfiguration.KEY],
    }),
    WinstonModule.forRootAsync({
      useFactory: (
        appConfig: ConfigType<typeof appConfiguration>,
        appCommonConfig: ConfigType<typeof appCommonConfiguration>,
      ) => {
        return getWinstonConfig(appConfig.appName, appCommonConfig.nodeEnv);
      },
      inject: [appConfiguration.KEY, appCommonConfiguration.KEY],
    }),
    AuthModule,
    RedisModule,
    PresenceModule,
    OnboardingModule,
    WorkspacesModule,
    MembersModule,
    TeamsModule,
    LabelsModule,
    ProjectsModule,
    ProjectStatusesModule,
    ProjectTemplatesModule,
    CyclesModule,
    IssuesModule,
    IssueStatusesModule,
    IssueTemplatesModule,
    InitiativesModule,
    DocumentsModule,
    InboxModule,
    ViewsModule,
    ReviewsModule,
    AgentModule,
    SeedModule,
    AwsS3Module,
    UploadsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: AllExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HttpLoggerMiddleware).forRoutes('{*splat}');
  }
}
