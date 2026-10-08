import type { EntityManager } from '@mikro-orm/core';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { v7 } from 'uuid';
import {
  CreateIssueStatusDto,
  ISSUE_STATUS_CATEGORIES,
  ReorderIssueStatusesDto,
  UpdateIssueStatusDto,
} from './dto/issue-status.dto';
import {
  Issue,
  IssueStatus,
  IssueStatusCategory,
  IssueTemplate,
  Team,
  TeamMember,
  WorkspaceMember,
} from '../../data-access';
import { canManageTeamRole } from '../access-control';
import { WorkspacesService } from '../workspaces/workspaces.service';

export const DEFAULT_ISSUE_STATUSES: Omit<
  IssueStatus,
  'teamId' | 'createdAt' | 'updatedAt'
>[] = [
  {
    id: 'backlog',
    name: 'Backlog',
    color: '#95a2b3',
    category: 'backlog',
    position: 0,
    isDefault: false,
  },
  {
    id: 'to-do',
    name: 'Todo',
    color: '#99a2b2',
    category: 'unstarted',
    position: 0,
    isDefault: true,
  },
  {
    id: 'in-progress',
    name: 'In Progress',
    color: '#facc15',
    category: 'started',
    position: 0,
    isDefault: false,
  },
  {
    id: 'done',
    name: 'Done',
    color: '#5e6ad2',
    category: 'completed',
    position: 0,
    isDefault: false,
  },
  {
    id: 'canceled',
    name: 'Canceled',
    color: '#95a2b3',
    category: 'canceled',
    position: 0,
    isDefault: false,
  },
];

const DUPLICATE_STATUS = {
  id: 'duplicate',
  name: 'Duplicate',
  description: undefined,
  color: '#95a2b3',
  category: 'canceled' as const,
  position: Number.MAX_SAFE_INTEGER,
  isDefault: false,
  isSystem: true,
};

@Injectable()
export class IssueStatusesService {
  constructor(
    private readonly em: EntityManager,
    private readonly workspacesService: WorkspacesService,
  ) {}

  async ensureDefaults(teamId: string) {
    const existing = await this.em.find(IssueStatus, { teamId });
    if (existing.length > 0) return existing;
    const statuses = DEFAULT_ISSUE_STATUSES.map(
      (status) => new IssueStatus({ ...status, teamId }),
    );
    this.em.persist(statuses);
    await this.em.flush();
    return statuses;
  }

  async findAll(teamId: string, memberId: string) {
    await this.assertTeamAccess(teamId, memberId);
    const statuses = await this.ensureDefaults(teamId);
    return [
      ...statuses.sort(
        (a, b) =>
          categoryOrder(a.category) - categoryOrder(b.category) ||
          a.position - b.position,
      ),
      DUPLICATE_STATUS,
    ].map((status) => this.serialize(status));
  }

  async create(teamId: string, dto: CreateIssueStatusDto, memberId: string) {
    await this.assertTeamManager(teamId, memberId);
    const statuses = await this.ensureDefaults(teamId);
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Status name is required');
    if (
      statuses.some(
        (status) => status.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
      )
    ) {
      throw new BadRequestException(
        'A status with this name already exists in this team',
      );
    }
    const status = new IssueStatus({
      id: v7(),
      teamId,
      name,
      description: dto.description?.trim() || undefined,
      color: dto.color.toLowerCase(),
      category: dto.category,
      position:
        statuses
          .filter((item) => item.category === dto.category)
          .reduce((max, item) => Math.max(max, item.position), -1) + 1,
      isDefault: false,
    });
    this.em.persist(status);
    await this.em.flush();
    return this.serialize(status);
  }

  async update(
    teamId: string,
    statusId: string,
    dto: UpdateIssueStatusDto,
    memberId: string,
  ) {
    await this.assertTeamManager(teamId, memberId);
    const status = await this.findConfigurableStatus(teamId, statusId);
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException('Status name is required');
      const duplicate = await this.em.findOne(IssueStatus, {
        teamId,
        name: { $ilike: name },
        id: { $ne: statusId },
      });
      if (duplicate)
        throw new BadRequestException(
          'A status with this name already exists in this team',
        );
      status.name = name;
    }
    if (dto.description !== undefined)
      status.description = dto.description.trim() || undefined;
    if (dto.color !== undefined) status.color = dto.color.toLowerCase();
    await this.em.flush();
    return this.serialize(status);
  }

  async remove(teamId: string, statusId: string, memberId: string) {
    await this.assertTeamManager(teamId, memberId);
    const status = await this.findConfigurableStatus(teamId, statusId);
    const siblings = await this.em.find(IssueStatus, {
      teamId,
      category: status.category,
    });
    const categoryRequired = status.category !== 'triage';
    if (categoryRequired && siblings.length <= 1) {
      throw new BadRequestException(
        'Each workflow category must keep at least one status',
      );
    }
    const issueCount = await this.em.count(Issue, { teamId, statusId });
    if (issueCount > 0) {
      throw new BadRequestException(
        `Move the ${issueCount} issue(s) to another status before deleting this status`,
      );
    }
    const templateCount = await this.em.count(IssueTemplate, {
      config: { statusId },
      deletedAt: null,
    });
    if (templateCount > 0) {
      throw new BadRequestException(
        `Update the ${templateCount} issue template(s) using this status before deleting it`,
      );
    }
    if (status.isDefault) {
      const nextDefault = siblings
        .filter((item) => item.id !== statusId)
        .sort((a, b) => a.position - b.position)[0];
      if (nextDefault) nextDefault.isDefault = true;
    }
    this.em.remove(status);
    await this.em.flush();
    return { success: true, id: statusId };
  }

  async reorder(teamId: string, dto: ReorderIssueStatusesDto, memberId: string) {
    await this.assertTeamManager(teamId, memberId);
    const statuses = (
      await this.em.find(IssueStatus, { teamId, category: dto.category })
    ).sort((a, b) => a.position - b.position);
    if (
      statuses.length !== dto.statusIds.length ||
      new Set(dto.statusIds).size !== statuses.length ||
      statuses.some((status) => !dto.statusIds.includes(status.id))
    ) {
      throw new BadRequestException('Provide every status in the category exactly once');
    }
    const byId = new Map(statuses.map((status) => [status.id, status]));
    dto.statusIds.forEach((statusId, position) => {
      const status = byId.get(statusId)!;
      status.position = position;
    });
    await this.em.flush();
    return this.findAll(teamId, memberId);
  }

  async getStatusesForTeams(teamIds: string[]) {
    const uniqueTeamIds = [...new Set(teamIds)];
    if (uniqueTeamIds.length === 0) return new Map<string, Map<string, any>>();
    const statuses = await this.em.find(
      IssueStatus,
      { teamId: { $in: uniqueTeamIds } },
      { orderBy: { category: 'asc', position: 'asc' } },
    );
    const byTeam = new Map<string, Map<string, any>>();
    for (const status of statuses) {
      const teamStatuses = byTeam.get(status.teamId) ?? new Map<string, any>();
      teamStatuses.set(status.id, this.serialize(status));
      byTeam.set(status.teamId, teamStatuses);
    }
    for (const teamId of uniqueTeamIds) {
      if (!byTeam.has(teamId)) {
        const defaults = DEFAULT_ISSUE_STATUSES.map((status) => ({ ...status, teamId }));
        byTeam.set(
          teamId,
          new Map(defaults.map((status) => [status.id, this.serialize(status)])),
        );
      }
      byTeam.get(teamId)!.set(DUPLICATE_STATUS.id, this.serialize(DUPLICATE_STATUS));
    }
    return byTeam;
  }

  async getStatusesForTeam(teamId: string) {
    return (await this.getStatusesForTeams([teamId])).get(teamId)!;
  }

  async getDefaultStatus(teamId: string) {
    const statuses = await this.getStatusesForTeam(teamId);
    return (
      [...statuses.values()].find((status) => status.isDefault) ?? statuses.get('to-do')
    );
  }

  private async findConfigurableStatus(teamId: string, statusId: string) {
    const status = await this.em.findOne(IssueStatus, { teamId, id: statusId });
    if (!status) throw new NotFoundException(`Issue status ${statusId} not found`);
    return status;
  }

  private async assertTeamAccess(teamId: string, memberId: string) {
    const accessibleTeamIds = await this.workspacesService.getAccessibleTeamIds(memberId);
    if (!accessibleTeamIds.includes(teamId))
      throw new NotFoundException(`Team ${teamId} not found`);
    const team = await this.em.findOne(Team, { id: teamId });
    if (!team) throw new NotFoundException(`Team ${teamId} not found`);
    return team;
  }

  private async assertTeamManager(teamId: string, memberId: string) {
    const team = await this.assertTeamAccess(teamId, memberId);
    if (!team.workspaceId) throw new NotFoundException(`Team ${teamId} not found`);
    const [workspaceMembership, teamMembership] = await Promise.all([
      this.em.findOne(WorkspaceMember, { workspaceId: team.workspaceId, memberId }),
      this.em.findOne(TeamMember, { teamId, memberId }),
    ]);
    if (!canManageTeamRole(workspaceMembership?.role, teamMembership?.role)) {
      throw new NotFoundException(`Team ${teamId} not found`);
    }
    return team;
  }

  private serialize(
    status:
      | Omit<IssueStatus, 'teamId' | 'createdAt' | 'updatedAt'>
      | IssueStatus
      | typeof DUPLICATE_STATUS,
  ) {
    return {
      id: status.id,
      teamId: 'teamId' in status ? status.teamId : undefined,
      name: status.name,
      description: status.description,
      color: status.color,
      category: status.category,
      position: status.position,
      isDefault: status.isDefault,
      isSystem: 'isSystem' in status ? status.isSystem : false,
      createdAt: 'createdAt' in status ? status.createdAt : undefined,
      updatedAt: 'updatedAt' in status ? status.updatedAt : undefined,
    };
  }
}

function categoryOrder(category: IssueStatusCategory) {
  return ISSUE_STATUS_CATEGORIES.indexOf(category);
}
