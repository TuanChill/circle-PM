import { User } from '@app/common';
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CreateIssueStatusDto,
  ReorderIssueStatusesDto,
  UpdateIssueStatusDto,
} from './dto/issue-status.dto';
import { IssueStatusesService } from './issue-statuses.service';

@ApiTags('Issue statuses')
@Controller('teams/:teamId/issue-statuses')
export class IssueStatusesController {
  constructor(private readonly issueStatusesService: IssueStatusesService) {}

  @Get()
  @ApiOperation({ summary: 'List issue statuses for a team workflow' })
  findAll(@Param('teamId') teamId: string, @User('id') memberId: string) {
    return this.issueStatusesService.findAll(teamId, memberId);
  }

  @Post()
  @ApiOperation({ summary: 'Create an issue status in a team workflow category' })
  create(
    @Param('teamId') teamId: string,
    @Body() dto: CreateIssueStatusDto,
    @User('id') memberId: string,
  ) {
    return this.issueStatusesService.create(teamId, dto, memberId);
  }

  @Patch('order')
  @ApiOperation({ summary: 'Reorder statuses within a workflow category' })
  reorder(
    @Param('teamId') teamId: string,
    @Body() dto: ReorderIssueStatusesDto,
    @User('id') memberId: string,
  ) {
    return this.issueStatusesService.reorder(teamId, dto, memberId);
  }

  @Patch(':statusId')
  @ApiOperation({ summary: 'Update an issue status name, description, or color' })
  update(
    @Param('teamId') teamId: string,
    @Param('statusId') statusId: string,
    @Body() dto: UpdateIssueStatusDto,
    @User('id') memberId: string,
  ) {
    return this.issueStatusesService.update(teamId, statusId, dto, memberId);
  }

  @Delete(':statusId')
  @ApiOperation({ summary: 'Delete an unused issue status' })
  remove(
    @Param('teamId') teamId: string,
    @Param('statusId') statusId: string,
    @User('id') memberId: string,
  ) {
    return this.issueStatusesService.remove(teamId, statusId, memberId);
  }
}
