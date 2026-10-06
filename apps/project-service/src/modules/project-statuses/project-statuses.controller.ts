import { User } from '@app/common';
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CreateProjectStatusDto } from './dto/project-status.dto';
import { ProjectStatusesService } from './project-statuses.service';

@ApiTags('Project statuses')
@Controller('workspaces/:workspaceId/project-statuses')
export class ProjectStatusesController {
  constructor(private readonly projectStatusesService: ProjectStatusesService) {}

  @Get()
  @ApiOperation({ summary: 'List project statuses in a workspace' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID or slug' })
  findAll(@Param('workspaceId') workspaceId: string, @User('id') memberId: string) {
    return this.projectStatusesService.findAll(workspaceId, memberId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a project status in a lifecycle category' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID or slug' })
  create(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateProjectStatusDto,
    @User('id') memberId: string,
  ) {
    return this.projectStatusesService.create(workspaceId, dto, memberId);
  }
}
