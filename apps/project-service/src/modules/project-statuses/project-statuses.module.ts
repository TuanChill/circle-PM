import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { ProjectStatusesController } from './project-statuses.controller';
import { ProjectStatusesService } from './project-statuses.service';
import { ProjectStatus } from '../../data-access/project/project-status.entity';
import { WorkspacesModule } from '../workspaces/workspaces.module';

@Module({
  imports: [MikroOrmModule.forFeature([ProjectStatus]), WorkspacesModule],
  controllers: [ProjectStatusesController],
  providers: [ProjectStatusesService],
})
export class ProjectStatusesModule {}
