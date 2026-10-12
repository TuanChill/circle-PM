import { User } from '@app/common';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AddTeamMemberDto, CreateTeamDto, UpdateTeamDto } from './dto/team.dto';
import { TeamsService } from './teams.service';

@ApiTags('Teams')
@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @ApiOperation({ summary: 'Get all teams for user or workspace' })
  @ApiQuery({ name: 'workspaceId', required: false })
  @Get()
  findAll(
    @User('id') memberId: string,
    @Req() req: Request,
    @Query('workspaceId') workspaceId?: string,
  ) {
    const headerWsId = req.headers['x-workspace-id'] as string;
    return this.teamsService.findAll(memberId, workspaceId || headerWsId);
  }

  @ApiOperation({ summary: 'Get team by ID' })
  @Get(':id')
  findOne(
    @Param('id') id: string,
    @User('id') memberId: string,
    @User('role') memberRole: string,
  ) {
    return this.teamsService.findOne(id, memberId, memberRole);
  }

  @ApiOperation({ summary: 'Get team members' })
  @Get(':id/members')
  findMembers(@Param('id') id: string, @User('id') memberId: string) {
    return this.teamsService.findMembers(id, memberId);
  }

  @ApiOperation({ summary: 'Create new team' })
  @Post()
  create(@Body() dto: CreateTeamDto, @User('id') memberId: string) {
    return this.teamsService.create(dto, memberId);
  }

  @ApiOperation({ summary: 'Update team' })
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTeamDto,
    @User('id') memberId: string,
    @User('role') memberRole: string,
  ) {
    return this.teamsService.update(id, dto, memberId, memberRole);
  }

  @ApiOperation({ summary: 'Toggle join status for a team' })
  @Post(':id/join')
  toggleJoin(@Param('id') id: string, @User('id') memberId: string) {
    return this.teamsService.toggleJoin(id, memberId);
  }

  @ApiOperation({ summary: 'Add member to team' })
  @Post(':id/members')
  addMember(
    @Param('id') id: string,
    @Body() dto: AddTeamMemberDto,
    @User('id') actorId: string,
    @User('role') actorRole: string,
  ) {
    return this.teamsService.addMember(id, dto, actorId, actorRole);
  }

  @ApiOperation({ summary: 'Remove member from team' })
  @Delete(':id/members/:memberId')
  removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @User('id') actorId: string,
    @User('role') actorRole: string,
  ) {
    return this.teamsService.removeMember(id, memberId, actorId, actorRole);
  }

  @ApiOperation({ summary: 'Delete team' })
  @Delete(':id')
  delete(@Param('id') id: string, @User('id') actorId: string) {
    return this.teamsService.delete(id, actorId);
  }
}
