import { Module } from '@nestjs/common';
import { IssueStatusesController } from './issue-statuses.controller';
import { IssueStatusesService } from './issue-statuses.service';
import { WorkspacesModule } from '../workspaces/workspaces.module';

@Module({
  imports: [WorkspacesModule],
  controllers: [IssueStatusesController],
  providers: [IssueStatusesService],
  exports: [IssueStatusesService],
})
export class IssueStatusesModule {}
