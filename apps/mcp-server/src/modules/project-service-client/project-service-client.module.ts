import { HttpModule } from '@app/core';
import { Module } from '@nestjs/common';
import { PROJECT_ACCESS_TOKEN } from './project-access-token.constant';
import { ProjectServiceHttpClient } from './project-service-http.client';

@Module({
  imports: [HttpModule],
  providers: [
    ProjectServiceHttpClient,
    {
      provide: PROJECT_ACCESS_TOKEN,
      // Read once, after main.ts's validateTokenOrExit already confirmed this
      // env var is present and well-formed — single source of truth stays
      // process.env, not a second decode.
      useFactory: () => process.env.PROJECT_ACCESS_TOKEN,
    },
  ],
  exports: [ProjectServiceHttpClient],
})
export class ProjectServiceClientModule {}
