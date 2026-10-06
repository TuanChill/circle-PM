import { EntityManager } from '@mikro-orm/core';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { v7, validate } from 'uuid';
import {
  CreateMilestoneDto,
  CreateProjectDto,
  CreateProjectUpdateDto,
  UpdateProjectDto,
  UpdateProjectUpdateDto,
} from './dto/project.dto';
import { getProjectPropertyValidationError } from './project-rules';
import { isProjectScopeVisible, projectIssueWhere } from './project-scope';
import {
  Initiative,
  Issue,
  Label,
  LabelGroup,
  Member,
  Project,
  ProjectActivity,
  ProjectLabel,
  ProjectMember,
  ProjectMilestone,
  ProjectStatus,
  ProjectSubscription,
  ProjectTeam,
  ProjectUpdate,
  Team,
  toSafeMember,
  Workspace,
  WorkspaceMember,
} from '../../data-access';
import { assertMutuallyExclusiveLabelSelection } from '../labels/label-rules';
import { isLabelAvailableForTeam } from '../labels/label-scope';
import { WorkspacesService } from '../workspaces/workspaces.service';

// Standard status lookup
const STATUS_DATA: Record<
  string,
  { id: string; name: string; color: string; category: string }
> = {
  backlog: { id: 'backlog', name: 'Backlog', color: '#bec2c8', category: 'backlog' },
  'in-progress': {
    id: 'in-progress',
    name: 'In Progress',
    color: '#f2c94c',
    category: 'started',
  },
  done: { id: 'done', name: 'Done', color: '#5e6ad2', category: 'completed' },
  canceled: { id: 'canceled', name: 'Canceled', color: '#95a2b3', category: 'canceled' },
  paused: { id: 'paused', name: 'Paused', color: '#8f9299', category: 'unstarted' },
};

const HEALTH_DATA: Record<
  string,
  { id: string; name: string; color: string; description: string }
> = {
  'no-update': {
    id: 'no-update',
    name: 'No Update',
    color: '#8f9299',
    description: 'The project has not been updated in the last 30 days.',
  },
  'off-track': {
    id: 'off-track',
    name: 'Off Track',
    color: '#eb5757',
    description: 'The project is not on track and may be delayed.',
  },
  'on-track': {
    id: 'on-track',
    name: 'On Track',
    color: '#4cb782',
    description: 'The project is on track and on schedule.',
  },
  'at-risk': {
    id: 'at-risk',
    name: 'At Risk',
    color: '#f2c94c',
    description: 'The project is at risk and may be delayed.',
  },
};

const PRIORITY_DATA: Record<string, { id: string; name: string }> = {
  'no-priority': { id: 'no-priority', name: 'No priority' },
  urgent: { id: 'urgent', name: 'Urgent' },
  high: { id: 'high', name: 'High' },
  medium: { id: 'medium', name: 'Medium' },
  low: { id: 'low', name: 'Low' },
};

@Injectable()
export class ProjectsService {
  constructor(
    private readonly em: EntityManager,
    private readonly workspacesService: WorkspacesService,
  ) {}

  private async resolveProjectStatus(
    statusId: string,
    requestedCategory: string | undefined,
    teamId: string,
  ) {
    const builtinStatus = STATUS_DATA[statusId];
    if (builtinStatus) {
      if (requestedCategory && requestedCategory !== builtinStatus.category) {
        throw new BadRequestException(
          `Project status ${statusId} does not belong to category ${requestedCategory}`,
        );
      }
      return builtinStatus;
    }

    const team = await this.em.findOne(Team, { id: teamId });
    if (!team?.workspaceId) {
      throw new BadRequestException(`Unknown project status ${statusId}`);
    }
    const customStatus = await this.em.findOne(ProjectStatus, {
      id: statusId,
      workspaceId: team.workspaceId,
    });
    if (!customStatus) {
      throw new BadRequestException(`Unknown project status ${statusId}`);
    }
    return {
      id: customStatus.id,
      name: customStatus.name,
      color: customStatus.color,
      category: customStatus.category,
    };
  }

  private async findCustomStatuses(workspaceIds: string[], statusIds: string[]) {
    const customStatusIds = [
      ...new Set(
        statusIds.filter((statusId) => !STATUS_DATA[statusId] && validate(statusId)),
      ),
    ];
    if (workspaceIds.length === 0 || customStatusIds.length === 0) return [];

    return this.em.find(ProjectStatus, {
      workspaceId: { $in: workspaceIds },
      id: { $in: customStatusIds },
    });
  }

  private async getAccessibleTeamIds(memberId: string, workspaceId?: string) {
    const accessibleTeamIds = await this.workspacesService.getAccessibleTeamIds(memberId);
    if (!workspaceId) return accessibleTeamIds;

    const workspaceIds = await this.workspacesService.getAccessibleWorkspaceIds(memberId);
    const workspace = await this.em.findOne(Workspace, {
      $or: [{ id: workspaceId }, { slug: workspaceId }],
    });
    if (!workspace || !workspaceIds.includes(workspace.id)) return [];

    const teams = await this.em.find(Team, {
      workspaceId: workspace.id,
      id: { $in: accessibleTeamIds },
    });
    return teams.map((team) => team.id);
  }

  private async getProjectTeamIds(projectId: string, primaryTeamId: string) {
    const links = await this.em.find(ProjectTeam, { projectId });
    return [...new Set([primaryTeamId, ...links.map((link) => link.teamId)])];
  }

  private async assertProjectAccess(memberId: string, project: Project) {
    const projectTeamIds = await this.getProjectTeamIds(project.id, project.teamId);
    const accessibleTeamIds = await this.workspacesService.getAccessibleTeamIds(memberId);
    if (!projectTeamIds.some((teamId) => accessibleTeamIds.includes(teamId))) {
      throw new NotFoundException(`Project ${project.id} not found`);
    }
    return projectTeamIds;
  }

  private async validateProjectTeamIds(
    teamIds: string[],
    primaryTeamId: string,
    actorId: string,
  ) {
    const normalizedTeamIds = [...new Set([primaryTeamId, ...teamIds])];
    const accessibleTeamIds = await this.workspacesService.getAccessibleTeamIds(actorId);
    const teams = await this.em.find(Team, { id: { $in: normalizedTeamIds } });
    const existingTeamIds = new Set(teams.map((team) => team.id));
    const missingTeamIds = normalizedTeamIds.filter(
      (teamId) => !existingTeamIds.has(teamId),
    );
    const forbiddenTeamIds = normalizedTeamIds.filter(
      (teamId) => !accessibleTeamIds.includes(teamId),
    );
    if (missingTeamIds.length > 0 || forbiddenTeamIds.length > 0) {
      const invalidTeamIds = [...new Set([...missingTeamIds, ...forbiddenTeamIds])];
      throw new NotFoundException(`Team(s) ${invalidTeamIds.join(', ')} not found`);
    }

    const workspaceIds = new Set(teams.map((team) => team.workspaceId).filter(Boolean));
    if (workspaceIds.size > 1) {
      throw new BadRequestException(
        'A project can only include teams from one workspace',
      );
    }
    return normalizedTeamIds;
  }

  private async replaceProjectTeams(projectId: string, teamIds: string[]) {
    const existing = await this.em.find(ProjectTeam, { projectId });
    this.em.remove(existing);
    this.em.persist(teamIds.map((teamId) => new ProjectTeam({ projectId, teamId })));
  }

  /**
   * Project labels are a replace-all property, like Linear's project label
   * picker. Validate the full set before changing the join table so an invalid
   * label can never be silently ignored by transformProject().
   */
  private async validateLabelIds(labelIds: string[], teamId: string) {
    const uniqueLabelIds = [...new Set(labelIds)];
    const team = await this.em.findOne(Team, { id: teamId });
    const labels = await this.em.find(Label, {
      id: { $in: uniqueLabelIds },
      scope: { $in: ['project', 'both'] },
      archivedAt: null,
      ...(team?.workspaceId ? { workspaceId: team.workspaceId } : {}),
      $or: [{ teamId: null }, { teamId }],
    });
    const availableLabels = labels.filter((label) =>
      isLabelAvailableForTeam(label.teamId, teamId),
    );
    const existingIds = new Set(availableLabels.map((label) => label.id));
    const missingIds = uniqueLabelIds.filter((labelId) => !existingIds.has(labelId));
    if (missingIds.length > 0) {
      throw new BadRequestException(`Unknown project label(s): ${missingIds.join(', ')}`);
    }
    const groupedLabelIds = new Set(
      availableLabels.map((label) => label.groupId).filter(Boolean),
    );
    const exclusiveGroups = await this.em.find(LabelGroup, {
      id: { $in: [...groupedLabelIds] },
    });
    assertMutuallyExclusiveLabelSelection(availableLabels, exclusiveGroups);
    return uniqueLabelIds;
  }

  private async validateMemberIds(memberIds: string[], teamId: string, actorId: string) {
    const team = await this.em.findOne(Team, { id: teamId });
    const workspaceIds = team?.workspaceId
      ? [team.workspaceId]
      : await this.workspacesService.getAccessibleWorkspaceIds(actorId);
    const memberships = await this.em.find(WorkspaceMember, {
      memberId: { $in: memberIds },
      workspaceId: { $in: workspaceIds },
    });
    const validIds = new Set(memberships.map((membership) => membership.memberId));
    const missingIds = memberIds.filter((memberId) => !validIds.has(memberId));
    if (missingIds.length > 0) {
      throw new BadRequestException(
        `Project member(s) are not in the team workspace: ${missingIds.join(', ')}`,
      );
    }
    return [...new Set(memberIds)];
  }

  private async validateLeadId(
    leadId: string | undefined,
    teamId: string,
    actorId: string,
  ) {
    if (leadId) await this.validateMemberIds([leadId], teamId, actorId);
  }

  private async validateInitiativeId(
    initiativeId: string | undefined,
    teamId: string,
    actorId: string,
  ) {
    if (!initiativeId) return;
    const [initiative, team] = await Promise.all([
      this.em.findOne(Initiative, { id: initiativeId }),
      this.em.findOne(Team, { id: teamId }),
    ]);
    const accessibleWorkspaceIds =
      await this.workspacesService.getAccessibleWorkspaceIds(actorId);
    if (
      !initiative ||
      !team?.workspaceId ||
      initiative.workspaceId !== team.workspaceId ||
      !accessibleWorkspaceIds.includes(initiative.workspaceId)
    ) {
      throw new BadRequestException(
        `Initiative ${initiativeId} is not available to project team ${teamId}`,
      );
    }
  }

  private recordActivity(
    projectId: string,
    actorId: string,
    event: string,
    metadata: Record<string, unknown> = {},
  ) {
    this.em.persist(new ProjectActivity({ projectId, actorId, event, metadata }));
  }

  private activityText(event: string, metadata: Record<string, unknown>) {
    switch (event) {
      case 'created':
        return 'created this project';
      case 'updated':
        return `updated ${Array.isArray(metadata.fields) ? metadata.fields.join(', ') : 'project properties'}`;
      case 'members_changed':
        return 'updated project members';
      case 'teams_changed':
        return 'updated project teams';
      case 'milestone_added':
        return `added milestone ${String(metadata.name ?? '')}`.trim();
      case 'milestone_toggled':
        return `${metadata.completed ? 'completed' : 'reopened'} a milestone`;
      case 'health_update':
        return 'posted a project update';
      case 'deleted':
        return 'deleted this project';
      default:
        return event;
    }
  }

  private transformProject(
    project: Project,
    membersMap: Map<string, any>,
    labelsMap: Map<string, any>,
    projectLabels: ProjectLabel[],
    projectMembers: ProjectMember[],
    issues: Issue[],
    projectTeamIds: string[] = [],
    isSubscribed = false,
    projectWorkspaceId?: string,
    customStatuses: Map<string, ProjectStatus> = new Map(),
  ) {
    const labelIds = projectLabels
      .filter((pl) => pl.projectId === project.id)
      .map((pl) => pl.labelId);
    const labels = labelIds
      .map((lid) => labelsMap.get(lid))
      .filter(
        (label) =>
          label &&
          label.workspaceId === projectWorkspaceId &&
          projectTeamIds.some((teamId) => isLabelAvailableForTeam(label.teamId, teamId)),
      );
    const members = projectMembers
      .filter((pm) => pm.projectId === project.id)
      .map((pm) => membersMap.get(pm.memberId))
      .filter(Boolean);
    // A project can outlive a soft-deleted lead. Keep the response shape
    // renderable so project lists never crash while displaying that project.
    const lead = project.leadId ? (membersMap.get(project.leadId) ?? null) : null;

    const customStatus = customStatuses.get(project.statusId);
    const status = customStatus
      ? {
          id: customStatus.id,
          name: customStatus.name,
          color: customStatus.color,
          category: customStatus.category,
        }
      : STATUS_DATA[project.statusId] || {
          id: project.statusId,
          name: project.statusId,
          color: '#f2c94c',
          category: project.statusCategory || 'started',
        };

    const health = HEALTH_DATA[project.healthId] || HEALTH_DATA['no-update'];
    const priority = PRIORITY_DATA[project.priorityId] || PRIORITY_DATA['no-priority'];

    let healthUpdatedAgoDays: number | undefined;
    if (project.healthUpdatedAt) {
      const diffMs = Date.now() - new Date(project.healthUpdatedAt).getTime();
      healthUpdatedAgoDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    }

    // Mirrors cycles' enrichCycle(): derive live progress from actual issues,
    // falling back to the stored field only when the project has no issues yet.
    const percentComplete =
      issues.length > 0
        ? Math.round(
            (issues.filter((i) => i.statusCategory === 'completed').length /
              issues.length) *
              100,
          )
        : project.percentComplete;

    return {
      id: project.id,
      name: project.name,
      status,
      icon: project.icon,
      percentComplete,
      issueCount: issues.length,
      startDate: project.startDate
        ? project.startDate.toISOString().split('T')[0]
        : undefined,
      targetDate: project.targetDate
        ? project.targetDate.toISOString().split('T')[0]
        : undefined,
      lead,
      priority,
      health,
      teamId: project.teamId,
      teamIds: [...new Set([project.teamId, ...projectTeamIds])],
      labels,
      members,
      initiative: project.initiativeId,
      healthUpdatedAgoDays,
      summary: project.summary,
      description: project.description,
      resources: project.resources,
      isSubscribed,
    };
  }

  async findAll(
    memberId: string,
    query?: { teamId?: string; health?: string; workspaceId?: string },
  ) {
    const accessibleTeamIds = await this.getAccessibleTeamIds(
      memberId,
      query?.workspaceId,
    );
    if (accessibleTeamIds.length === 0) return [];

    const accessibleLinks = await this.em.find(ProjectTeam, {
      teamId: { $in: accessibleTeamIds },
    });
    const projectsVisibleThroughLinks = [
      ...new Set(accessibleLinks.map((link) => link.projectId)),
    ];
    const where: any = {
      $or: [
        { teamId: { $in: accessibleTeamIds } },
        ...(projectsVisibleThroughLinks.length > 0
          ? [{ id: { $in: projectsVisibleThroughLinks } }]
          : []),
      ],
    };
    if (query?.teamId) {
      if (!accessibleTeamIds.includes(query.teamId)) return [];
      const teamLinks = accessibleLinks
        .filter((link) => link.teamId === query.teamId)
        .map((link) => link.projectId);
      where.$or = [
        { teamId: query.teamId },
        ...(teamLinks.length > 0 ? [{ id: { $in: teamLinks } }] : []),
      ];
    }
    if (query?.health) where.healthId = query.health;

    const projects = await this.em.find(Project, where);
    const candidateProjectIds = projects.map((project) => project.id);
    const projectTeamLinks = await this.em.find(ProjectTeam, {
      projectId: { $in: candidateProjectIds },
    });
    const candidateTeamIdsByProject = new Map<string, string[]>();
    for (const project of projects) {
      candidateTeamIdsByProject.set(project.id, [project.teamId]);
    }
    for (const link of projectTeamLinks) {
      const ids = candidateTeamIdsByProject.get(link.projectId) ?? [];
      ids.push(link.teamId);
      candidateTeamIdsByProject.set(link.projectId, ids);
    }
    const allProjectTeamIds = [
      ...new Set([
        ...projects.map((project) => project.teamId),
        ...projectTeamLinks.map((link) => link.teamId),
      ]),
    ];
    const teams = await this.em.find(Team, {
      id: { $in: allProjectTeamIds },
    });
    const workspaceByTeamId = new Map(teams.map((team) => [team.id, team.workspaceId]));
    const accessibleTeamIdSet = new Set(accessibleTeamIds);
    const visibleProjects = projects.filter((project) =>
      isProjectScopeVisible(
        [...new Set(candidateTeamIdsByProject.get(project.id) ?? [])],
        workspaceByTeamId,
        accessibleTeamIdSet,
      ),
    );
    const projectIds = visibleProjects.map((project) => project.id);
    const visibleProjectIds = new Set(projectIds);
    const visibleProjectTeamLinks = projectTeamLinks.filter((link) =>
      visibleProjectIds.has(link.projectId),
    );
    const projectTeamIdsByProject = new Map<string, string[]>();
    for (const project of visibleProjects) {
      projectTeamIdsByProject.set(project.id, [project.teamId]);
    }
    for (const link of visibleProjectTeamLinks) {
      const ids = projectTeamIdsByProject.get(link.projectId) ?? [];
      if (!ids.includes(link.teamId)) ids.push(link.teamId);
      projectTeamIdsByProject.set(link.projectId, ids);
    }
    const visibleTeamIds = [
      ...new Set(
        visibleProjects.flatMap(
          (project) => projectTeamIdsByProject.get(project.id) ?? [project.teamId],
        ),
      ),
    ];
    const workspaceIds = [
      ...new Set(
        teams
          .filter((team) => visibleTeamIds.includes(team.id))
          .map((team) => team.workspaceId)
          .filter(Boolean),
      ),
    ];
    const projectLabels = await this.em.find(ProjectLabel, {
      projectId: { $in: projectIds },
    });
    const projectMembers = await this.em.find(ProjectMember, {
      projectId: { $in: projectIds },
    });
    const candidateMemberIds = [
      ...new Set([
        ...projectMembers.map((link) => link.memberId),
        ...visibleProjects
          .map((project) => project.leadId)
          .filter((id): id is string => Boolean(id)),
      ]),
    ];
    const workspaceMemberships = workspaceIds.length
      ? await this.em.find(WorkspaceMember, {
          workspaceId: { $in: workspaceIds },
          memberId: { $in: candidateMemberIds },
        })
      : [];
    const allowedMemberIds = workspaceIds.length
      ? workspaceMemberships.map((membership) => membership.memberId)
      : candidateMemberIds;
    const members = await this.em.find(Member, { id: { $in: allowedMemberIds } });
    const labels = await this.em.find(Label, {
      scope: { $in: ['project', 'both'] },
      ...(workspaceIds.length ? { workspaceId: { $in: workspaceIds } } : {}),
      $or: [{ teamId: null }, { teamId: { $in: visibleTeamIds } }],
    });
    const issues = await this.em.find(Issue, {
      projectId: { $in: projectIds },
      teamId: { $in: visibleTeamIds },
    });
    const subscriptions = await this.em.find(ProjectSubscription, {
      projectId: { $in: projectIds },
      memberId,
    });
    const subscribedProjectIds = new Set(
      subscriptions.map((subscription) => subscription.projectId),
    );
    const customStatuses = await this.findCustomStatuses(
      workspaceIds,
      visibleProjects.map((project) => project.statusId),
    );
    const customStatusesById = new Map(
      customStatuses.map((status) => [status.id, status]),
    );

    const membersMap = new Map(members.map((m) => [m.id, toSafeMember(m)]));
    const labelsMap = new Map(labels.map((l) => [l.id, l]));
    const issuesByProject = new Map<string, Issue[]>();
    for (const issue of issues) {
      if (!issue.projectId) continue;
      const bucket = issuesByProject.get(issue.projectId) ?? [];
      bucket.push(issue);
      issuesByProject.set(issue.projectId, bucket);
    }

    return visibleProjects.map((p) =>
      this.transformProject(
        p,
        membersMap,
        labelsMap,
        projectLabels,
        projectMembers,
        issuesByProject.get(p.id) ?? [],
        projectTeamIdsByProject.get(p.id) ?? [],
        subscribedProjectIds.has(p.id),
        workspaceByTeamId.get(p.teamId),
        customStatusesById,
      ),
    );
  }

  async findOne(id: string, memberId?: string) {
    const project = await this.em.findOne(Project, { id });
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    const projectTeamIds = await this.getProjectTeamIds(project.id, project.teamId);
    if (memberId) {
      const accessibleTeamIds =
        await this.workspacesService.getAccessibleTeamIds(memberId);
      if (!projectTeamIds.some((teamId) => accessibleTeamIds.includes(teamId))) {
        throw new NotFoundException(`Project ${id} not found`);
      }
    }

    const teams = await this.em.find(Team, { id: { $in: projectTeamIds } });
    const workspaceByTeamId = new Map(
      teams.map((candidate) => [candidate.id, candidate.workspaceId]),
    );
    if (
      teams.length !== new Set(projectTeamIds).size ||
      !isProjectScopeVisible(projectTeamIds, workspaceByTeamId, new Set(projectTeamIds))
    ) {
      throw new NotFoundException(`Project ${id} not found`);
    }
    const team = teams.find((candidate) => candidate.id === project.teamId);
    if (!team) throw new NotFoundException(`Project ${id} not found`);
    const projectLabels = await this.em.find(ProjectLabel, { projectId: id });
    const projectMembers = await this.em.find(ProjectMember, { projectId: id });
    const issues = await this.em.find(Issue, projectIssueWhere(id, projectTeamIds));
    const candidateMemberIds = [
      ...new Set([
        ...projectMembers.map((link) => link.memberId),
        ...(project.leadId ? [project.leadId] : []),
      ]),
    ];
    const workspaceMemberships = team?.workspaceId
      ? await this.em.find(WorkspaceMember, {
          workspaceId: team.workspaceId,
          memberId: { $in: candidateMemberIds },
        })
      : [];
    const allowedMemberIds = team?.workspaceId
      ? workspaceMemberships.map((membership) => membership.memberId)
      : candidateMemberIds;
    const members = await this.em.find(Member, { id: { $in: allowedMemberIds } });
    const labels = await this.em.find(Label, {
      scope: { $in: ['project', 'both'] },
      ...(team?.workspaceId ? { workspaceId: team.workspaceId } : {}),
      $or: [{ teamId: null }, { teamId: { $in: projectTeamIds } }],
    });
    const customStatuses = await this.findCustomStatuses(
      team.workspaceId ? [team.workspaceId] : [],
      [project.statusId],
    );

    const membersMap = new Map(members.map((m) => [m.id, toSafeMember(m)]));
    const labelsMap = new Map(labels.map((l) => [l.id, l]));
    const subscription = await this.em.findOne(ProjectSubscription, {
      projectId: id,
      memberId: memberId ?? '',
    });

    return this.transformProject(
      project,
      membersMap,
      labelsMap,
      projectLabels,
      projectMembers,
      issues,
      projectTeamIds,
      Boolean(subscription),
      team.workspaceId,
      new Map(customStatuses.map((status) => [status.id, status])),
    );
  }

  async getSubscription(projectId: string, memberId: string) {
    const project = await this.em.findOne(Project, { id: projectId });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    await this.assertProjectAccess(memberId, project);
    const subscription = await this.em.findOne(ProjectSubscription, {
      projectId,
      memberId,
    });
    return { projectId, subscribed: Boolean(subscription) };
  }

  async subscribe(projectId: string, memberId: string) {
    const project = await this.em.findOne(Project, { id: projectId });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    await this.assertProjectAccess(memberId, project);
    const existing = await this.em.findOne(ProjectSubscription, {
      projectId,
      memberId,
    });
    if (!existing) {
      this.em.persist(new ProjectSubscription({ projectId, memberId }));
      await this.em.flush();
    }
    return { projectId, subscribed: true };
  }

  async unsubscribe(projectId: string, memberId: string) {
    const project = await this.em.findOne(Project, { id: projectId });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    await this.assertProjectAccess(memberId, project);
    const existing = await this.em.findOne(ProjectSubscription, {
      projectId,
      memberId,
    });
    if (existing) {
      this.em.remove(existing);
      await this.em.flush();
    }
    return { projectId, subscribed: false };
  }

  async findDetail(id: string, memberId?: string) {
    const baseProject = await this.findOne(id, memberId);
    const milestones = await this.em.find(
      ProjectMilestone,
      { projectId: id },
      { orderBy: { orderIndex: 'ASC' } },
    );
    const updates = await this.em.find(
      ProjectUpdate,
      { projectId: id },
      { orderBy: { createdAt: 'DESC' } },
    );
    const detailTeam = await this.em.findOne(Team, { id: baseProject.teamId });
    const teamWorkspaceIds = detailTeam?.workspaceId ? [detailTeam.workspaceId] : [];
    const detailWorkspaceMemberIds = teamWorkspaceIds.length
      ? await this.em.find(WorkspaceMember, {
          workspaceId: { $in: teamWorkspaceIds },
        })
      : [];
    const detailMemberIds = [
      ...new Set(detailWorkspaceMemberIds.map((membership) => membership.memberId)),
    ];
    const members = await this.em.find(Member, {
      id: detailMemberIds.length ? { $in: detailMemberIds } : { $in: [] },
    });
    const membersMap = new Map(members.map((m) => [m.id, toSafeMember(m)]));
    const activities = await this.em.find(
      ProjectActivity,
      { projectId: id },
      { orderBy: { createdAt: 'ASC' } },
    );

    const enrichedUpdates = updates.map((u) => ({
      id: u.id,
      authorId: u.authorId,
      author: membersMap.get(u.authorId) ?? null,
      date: u.createdAt.toISOString().split('T')[0],
      health: u.health,
      blocks: u.blocks,
    }));

    return {
      projectId: id,
      summary: baseProject.summary ?? '',
      description: baseProject.description || [],
      resources: baseProject.resources || [],
      milestones: milestones.map((m) => ({
        id: m.id,
        name: m.name,
        targetDate: m.targetDate ? m.targetDate.toISOString().split('T')[0] : undefined,
        completed: m.completed,
      })),
      updates: enrichedUpdates,
      activity: activities.map((activity) => ({
        id: activity.id,
        user: membersMap.get(activity.actorId) ?? null,
        date: activity.createdAt.toISOString().split('T')[0],
        text: this.activityText(activity.event, activity.metadata),
      })),
    };
  }

  async create(dto: CreateProjectDto, memberId: string) {
    const startDate = dto.startDate ? new Date(dto.startDate) : undefined;
    const targetDate = dto.targetDate ? new Date(dto.targetDate) : undefined;
    const projectTeamIds = await this.validateProjectTeamIds(
      dto.teamIds ?? [],
      dto.teamId,
      memberId,
    );
    const resolvedStatus = await this.resolveProjectStatus(
      dto.statusId || 'in-progress',
      dto.statusCategory,
      dto.teamId,
    );
    const createPropertyError = getProjectPropertyValidationError({
      statusId: resolvedStatus.id,
      statusCategory: resolvedStatus.category,
      allowCustomStatus: true,
      priorityId: dto.priorityId || 'no-priority',
      healthId: dto.healthId || 'on-track',
      percentComplete: dto.percentComplete ?? 0,
      startDate,
      targetDate,
    });
    if (createPropertyError) throw new BadRequestException(createPropertyError);
    await this.validateLeadId(dto.leadId || memberId, dto.teamId, memberId);
    await this.validateInitiativeId(dto.initiativeId, dto.teamId, memberId);
    if (dto.labelIds !== undefined) await this.validateLabelIds(dto.labelIds, dto.teamId);

    let id = dto.id || v7();
    const existing = await this.em.findOne(Project, { id });
    if (existing) {
      id = v7();
    }
    const project = new Project({
      id,
      name: dto.name,
      teamId: dto.teamId,
      leadId: dto.leadId || memberId,
      statusId: resolvedStatus.id,
      statusCategory: resolvedStatus.category,
      priorityId: dto.priorityId || 'no-priority',
      healthId: dto.healthId || 'on-track',
      percentComplete: dto.percentComplete || 0,
      icon: dto.icon || 'Cuboid',
      startDate,
      targetDate,
      initiativeId: dto.initiativeId,
      summary: dto.summary,
      description: dto.description || [],
      resources: dto.resources || [],
      healthUpdatedAt: new Date(),
    });

    this.em.persist(project);
    this.em.persist(
      projectTeamIds.map((teamId) => new ProjectTeam({ projectId: id, teamId })),
    );

    const memberIds = await this.validateMemberIds(
      dto.memberIds ?? [memberId],
      dto.teamId,
      memberId,
    );
    this.em.persist(
      memberIds.map(
        (projectMemberId) =>
          new ProjectMember({ projectId: id, memberId: projectMemberId }),
      ),
    );
    this.recordActivity(id, memberId, 'created', { name: dto.name });

    if (dto.labelIds !== undefined) {
      const labelIds = await this.validateLabelIds(dto.labelIds, dto.teamId);
      const plEntities = labelIds.map((lid) => new ProjectLabel(id, lid));
      this.em.persist(plEntities);
    }
    await this.em.flush();

    return this.findOne(id, memberId);
  }

  async update(id: string, dto: UpdateProjectDto, memberId: string) {
    const project = await this.em.findOne(Project, { id });
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    const currentProjectTeamIds = await this.assertProjectAccess(memberId, project);

    if (dto.teamId !== undefined && dto.teamId !== project.teamId) {
      await this.validateProjectTeamIds([dto.teamId], dto.teamId, memberId);
    }

    const nextTeamId = dto.teamId ?? project.teamId;
    const nextStartDate =
      dto.startDate !== undefined ? new Date(dto.startDate) : project.startDate;
    const nextTargetDate =
      dto.targetDate !== undefined ? new Date(dto.targetDate) : project.targetDate;
    const resolvedStatus =
      dto.statusId !== undefined || dto.statusCategory !== undefined
        ? await this.resolveProjectStatus(
            dto.statusId ?? project.statusId,
            dto.statusCategory,
            nextTeamId,
          )
        : undefined;
    const updatePropertyError = getProjectPropertyValidationError({
      statusId: resolvedStatus?.id,
      statusCategory: resolvedStatus?.category,
      allowCustomStatus: true,
      priorityId: dto.priorityId,
      healthId: dto.healthId,
      percentComplete: dto.percentComplete,
      startDate: nextStartDate,
      targetDate: nextTargetDate,
    });
    if (updatePropertyError) throw new BadRequestException(updatePropertyError);
    const nextProjectTeamIds = await this.validateProjectTeamIds(
      dto.teamIds !== undefined
        ? dto.teamIds
        : dto.teamId !== undefined
          ? [...currentProjectTeamIds, dto.teamId]
          : currentProjectTeamIds,
      nextTeamId,
      memberId,
    );
    await this.validateLeadId(dto.leadId, nextTeamId, memberId);
    await this.validateInitiativeId(
      dto.initiativeId ?? project.initiativeId,
      nextTeamId,
      memberId,
    );
    if (dto.labelIds !== undefined) await this.validateLabelIds(dto.labelIds, nextTeamId);

    if (dto.name !== undefined) project.name = dto.name;
    if (dto.teamId !== undefined) project.teamId = dto.teamId;
    if (dto.leadId !== undefined) project.leadId = dto.leadId;
    if (resolvedStatus) {
      project.statusId = resolvedStatus.id;
      project.statusCategory = resolvedStatus.category;
    }
    if (dto.priorityId !== undefined) project.priorityId = dto.priorityId;
    if (dto.healthId !== undefined) {
      project.healthId = dto.healthId;
      project.healthUpdatedAt = new Date();
    }
    if (dto.percentComplete !== undefined) project.percentComplete = dto.percentComplete;
    if (dto.icon !== undefined) project.icon = dto.icon;
    if (dto.startDate !== undefined) project.startDate = nextStartDate;
    if (dto.targetDate !== undefined) project.targetDate = nextTargetDate;
    if (dto.initiativeId !== undefined) project.initiativeId = dto.initiativeId;
    if (dto.summary !== undefined) project.summary = dto.summary;
    if (dto.description !== undefined) project.description = dto.description;
    if (dto.resources !== undefined) project.resources = dto.resources;

    if (dto.teamIds !== undefined || dto.teamId !== undefined) {
      await this.replaceProjectTeams(id, nextProjectTeamIds);
      this.recordActivity(id, memberId, 'teams_changed', {
        teamIds: nextProjectTeamIds,
      });
    }

    if (dto.memberIds !== undefined) {
      await this.replaceMembers(id, dto.memberIds, memberId, false);
      this.recordActivity(id, memberId, 'members_changed', {
        count: dto.memberIds.length,
      });
    }

    if (dto.labelIds !== undefined) {
      const labelIds = await this.validateLabelIds(dto.labelIds, nextTeamId);
      const existing = await this.em.find(ProjectLabel, { projectId: id });
      for (const e of existing) {
        this.em.remove(e);
      }
      if (labelIds.length > 0) {
        const newPl = labelIds.map((lid) => new ProjectLabel(id, lid));
        this.em.persist(newPl);
      }
    }

    const changedFields = Object.keys(dto);
    if (changedFields.length > 0) {
      this.recordActivity(id, memberId, 'updated', { fields: changedFields });
    }

    await this.em.flush();
    return this.findOne(id, memberId);
  }

  async delete(id: string, memberId: string) {
    const project = await this.em.findOne(Project, { id });
    if (project) {
      await this.assertProjectAccess(memberId, project);
      this.recordActivity(id, memberId, 'deleted');
      project.deletedAt = new Date();
      await this.em.flush();
    }
    return { success: true };
  }

  async getMembers(id: string, memberId: string) {
    const project = await this.em.findOne(Project, { id });
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    await this.assertProjectAccess(memberId, project);
    const links = await this.em.find(ProjectMember, { projectId: id });
    const members = await this.em.find(Member, {
      id: { $in: links.map((link) => link.memberId) },
    });
    const membersMap = new Map(
      members.map((member) => [member.id, toSafeMember(member)]),
    );
    return links.map((link) => membersMap.get(link.memberId)).filter(Boolean);
  }

  async replaceMembers(id: string, memberIds: string[], actorId: string, flush = true) {
    const project = await this.em.findOne(Project, { id });
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    await this.assertProjectAccess(actorId, project);
    const validMemberIds = await this.validateMemberIds(
      memberIds,
      project.teamId,
      actorId,
    );
    const existing = await this.em.find(ProjectMember, { projectId: id });
    this.em.remove(existing);
    this.em.persist(
      validMemberIds.map(
        (projectMemberId) =>
          new ProjectMember({ projectId: id, memberId: projectMemberId }),
      ),
    );
    if (flush) await this.em.flush();
    return this.getMembers(id, actorId);
  }

  async addUpdate(projectId: string, dto: CreateProjectUpdateDto, memberId: string) {
    const project = await this.em.findOne(Project, { id: projectId });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    await this.assertProjectAccess(memberId, project);

    const update = new ProjectUpdate({
      projectId,
      authorId: memberId,
      health: dto.health,
      blocks: dto.blocks,
    });

    project.healthId = dto.health;
    project.healthUpdatedAt = new Date();

    this.em.persist([update, project]);
    this.recordActivity(projectId, memberId, 'health_update', { health: dto.health });
    await this.em.flush();
    return this.findDetail(projectId, memberId);
  }

  private async assertOwnUpdate(projectId: string, updateId: string, memberId: string) {
    const project = await this.em.findOne(Project, { id: projectId });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    await this.assertProjectAccess(memberId, project);

    const update = await this.em.findOne(ProjectUpdate, {
      id: updateId,
      projectId,
    });
    if (!update) throw new NotFoundException(`Project update ${updateId} not found`);
    if (update.authorId !== memberId) {
      throw new ForbiddenException(
        'Only the update author can change this project update',
      );
    }
    return { project, update };
  }

  private async syncHealthFromLatestUpdate(project: Project, excludedUpdateId?: string) {
    const [latest] = await this.em.find(
      ProjectUpdate,
      {
        projectId: project.id,
        ...(excludedUpdateId ? { id: { $ne: excludedUpdateId } } : {}),
      },
      { orderBy: { createdAt: 'DESC' }, limit: 1 },
    );
    project.healthId = latest?.health ?? 'no-update';
    project.healthUpdatedAt = new Date();
  }

  async updateUpdate(
    projectId: string,
    updateId: string,
    dto: UpdateProjectUpdateDto,
    memberId: string,
  ) {
    const { project, update } = await this.assertOwnUpdate(projectId, updateId, memberId);
    if (dto.health !== undefined) update.health = dto.health;
    if (dto.blocks !== undefined) update.blocks = dto.blocks;

    const latest = await this.em.findOne(
      ProjectUpdate,
      { projectId: project.id },
      { orderBy: { createdAt: 'DESC' } },
    );
    if (latest?.id === update.id) {
      project.healthId = update.health;
      project.healthUpdatedAt = new Date();
    }
    this.recordActivity(projectId, memberId, 'health_update_edited', { updateId });
    await this.em.flush();
    return this.findDetail(projectId, memberId);
  }

  async deleteUpdate(projectId: string, updateId: string, memberId: string) {
    const { project, update } = await this.assertOwnUpdate(projectId, updateId, memberId);
    this.em.remove(update);
    await this.syncHealthFromLatestUpdate(project, update.id);
    this.recordActivity(projectId, memberId, 'health_update_deleted', { updateId });
    await this.em.flush();
    return this.findDetail(projectId, memberId);
  }

  async addMilestone(projectId: string, dto: CreateMilestoneDto, memberId: string) {
    const project = await this.em.findOne(Project, { id: projectId });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    await this.assertProjectAccess(memberId, project);

    const milestone = new ProjectMilestone({
      projectId,
      name: dto.name,
      targetDate: dto.targetDate ? new Date(dto.targetDate) : undefined,
      completed: false,
    });

    this.em.persist(milestone);
    this.recordActivity(projectId, memberId, 'milestone_added', { name: dto.name });
    await this.em.flush();
    return this.findDetail(projectId, memberId);
  }

  async toggleMilestone(projectId: string, milestoneId: string, memberId: string) {
    const project = await this.em.findOne(Project, { id: projectId });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    await this.assertProjectAccess(memberId, project);

    const milestone = await this.em.findOne(ProjectMilestone, {
      id: milestoneId,
      projectId,
    });
    if (!milestone) throw new NotFoundException(`Milestone ${milestoneId} not found`);

    milestone.completed = !milestone.completed;
    this.recordActivity(projectId, memberId, 'milestone_toggled', {
      completed: milestone.completed,
    });
    await this.em.flush();
    return this.findDetail(projectId, memberId);
  }
}
