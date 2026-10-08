import { EntityManager, LockMode } from '@mikro-orm/core';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { v7 } from 'uuid';
import {
  matchesAdvancedIssueFilters,
  parseAdvancedIssueFilters,
} from './advanced-issue-filter';
import { canAssignIssueToMember } from './assignee-scope';
import {
  AddReactionDto,
  AddRelationDto,
  CreateCommentDto,
  CreateIssueDto,
  UpdateIssueDto,
} from './dto/issue.dto';
import { IssueEstimateSettings, validateIssueEstimate } from './issue-estimates';
import { resolveIssueMilestone } from './issue-milestone-scope';
import {
  getIssuePropertyValidationError,
  resolveDefaultIssueTeamId,
} from './issue-rules';
import { selectIssueNotificationRecipients } from './notification-recipients';
import { isRelationInIssueTeam } from './relation-scope';
import {
  Cycle,
  FileAttachment,
  Issue,
  IssueActivity,
  IssueComment,
  IssueLabel,
  IssueRelation,
  IssueStatus,
  IssueSubscription,
  Label,
  LabelGroup,
  Member,
  Notification,
  PrLink,
  Project,
  ProjectMilestone,
  ProjectTeam,
  Team,
  TeamMember,
  toSafeMember,
  Workspace,
  WorkspaceMember,
} from '../../data-access';
import { DEFAULT_ISSUE_STATUSES } from '../issue-statuses/issue-statuses.service';
import { assertMutuallyExclusiveLabelSelection } from '../labels/label-rules';
import { isLabelAvailableForTeam } from '../labels/label-scope';
import { isProjectScopeVisible } from '../projects/project-scope';
import { WorkspacesService } from '../workspaces/workspaces.service';

const DUPLICATE_STATUS = {
  id: 'duplicate',
  name: 'Duplicate',
  color: '#95a2b3',
  category: 'canceled',
};

const ALL_PRIORITIES: Record<string, { id: string; name: string }> = {
  'no-priority': { id: 'no-priority', name: 'No priority' },
  urgent: { id: 'urgent', name: 'Urgent' },
  high: { id: 'high', name: 'High' },
  medium: { id: 'medium', name: 'Medium' },
  low: { id: 'low', name: 'Low' },
};

@Injectable()
export class IssuesService {
  constructor(
    private readonly em: EntityManager,
    private readonly workspacesService: WorkspacesService,
  ) {}

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

  private async assertTeamAccess(
    memberId: string,
    teamId: string,
    notFoundMessage: string,
  ) {
    const accessibleTeamIds = await this.workspacesService.getAccessibleTeamIds(memberId);
    if (!accessibleTeamIds.includes(teamId)) {
      throw new NotFoundException(notFoundMessage);
    }
  }

  private async validateLabelIds(labelIds: string[], teamId: string) {
    const team = await this.em.findOne(Team, { id: teamId });
    const uniqueLabelIds = [...new Set(labelIds)];
    const labels = await this.em.find(Label, {
      id: { $in: uniqueLabelIds },
      scope: { $in: ['issue', 'both'] },
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
      throw new BadRequestException(`Unknown issue label(s): ${missingIds.join(', ')}`);
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

  private async getExistingIssueLabelIds(issue: Issue) {
    const existing = await this.em.find(IssueLabel, {
      $or: [{ issueId: issue.id }, { issueId: issue.identifier }],
    });
    return [
      ...new Set(
        existing
          .map((join) => join.labelId)
          .filter((labelId): labelId is string => Boolean(labelId)),
      ),
    ];
  }

  private async validateAssigneeId(assigneeId: string | undefined, teamId: string) {
    if (!assigneeId) return;
    const [member, team, teamMembership] = await Promise.all([
      this.em.findOne(Member, { id: assigneeId }),
      this.em.findOne(Team, { id: teamId }),
      this.em.findOne(TeamMember, { teamId, memberId: assigneeId }),
    ]);
    const workspaceMembership = team?.workspaceId
      ? await this.em.findOne(WorkspaceMember, {
          workspaceId: team.workspaceId,
          memberId: assigneeId,
        })
      : null;
    if (
      !canAssignIssueToMember({
        memberExists: Boolean(member),
        teamExists: Boolean(team),
        teamMembershipExists: Boolean(teamMembership),
        workspaceMembershipExists: Boolean(workspaceMembership),
      })
    ) {
      throw new BadRequestException(
        `Assignee ${assigneeId} is not a member of team ${teamId}`,
      );
    }
  }

  private async getProjectTeamIds(projectId: string, primaryTeamId: string) {
    const links = await this.em.find(ProjectTeam, { projectId });
    return [...new Set([primaryTeamId, ...links.map((link) => link.teamId)])];
  }

  private async validateProjectForTeam(
    projectId: string,
    teamId: string,
    actorId: string,
  ) {
    const project = await this.em.findOne(Project, { id: projectId });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    const projectTeamIds = await this.getProjectTeamIds(project.id, project.teamId);
    const projectTeams = await this.em.find(Team, { id: { $in: projectTeamIds } });
    const workspaceByTeamId = new Map(
      projectTeams.map((team) => [team.id, team.workspaceId]),
    );
    if (!isProjectScopeVisible(projectTeamIds, workspaceByTeamId, new Set([teamId]))) {
      throw new BadRequestException('Project and issue must share a project team');
    }
    await this.assertTeamAccess(actorId, teamId, `Team ${teamId} not found`);
    return project;
  }

  private async resolveMilestoneForProject(
    projectId: string | null | undefined,
    milestone: string | null | undefined,
  ) {
    const trimmedMilestone = milestone?.trim() ?? '';
    if (!trimmedMilestone) return undefined;

    const matchingProjectMilestone = projectId
      ? await this.em.findOne(ProjectMilestone, {
          projectId,
          $or: [{ id: trimmedMilestone }, { name: trimmedMilestone }],
        })
      : null;
    const result = resolveIssueMilestone({
      projectId,
      milestone: trimmedMilestone,
      matchingProjectMilestone,
    });
    if (result.error) throw new BadRequestException(result.error);
    return result.value;
  }

  private async getMemberIdsForTeam(teamId: string) {
    const [team, teamMembers] = await Promise.all([
      this.em.findOne(Team, { id: teamId }),
      this.em.find(TeamMember, { teamId }),
    ]);
    const memberIds = new Set(teamMembers.map((membership) => membership.memberId));
    if (team?.workspaceId) {
      const workspaceMembers = await this.em.find(WorkspaceMember, {
        workspaceId: team.workspaceId,
      });
      for (const membership of workspaceMembers) memberIds.add(membership.memberId);
    }
    return memberIds;
  }

  /** Only authorized issue subscribers receive issue-change notifications. */
  private async resolveRecipients(
    issue: Issue,
    excludeActorId: string,
  ): Promise<string[]> {
    const allowedMemberIds = await this.getMemberIdsForTeam(issue.teamId);
    const subscriptions = await this.em.find(IssueSubscription, {
      issueIdentifier: issue.identifier,
      memberId: { $in: [...allowedMemberIds] },
    });
    return selectIssueNotificationRecipients(
      allowedMemberIds,
      subscriptions,
      excludeActorId,
    );
  }

  /** Persists one Notification per recipient and reopens snoozed issue inbox items. */
  private async notifyMany(
    issueIdentifier: string,
    actorId: string,
    recipientIds: Iterable<string>,
    type: Notification['type'],
    content: string,
  ): Promise<void> {
    const seen = new Set<string>();
    const recipients = [...recipientIds].filter((userId) => {
      if (!userId || userId === actorId || seen.has(userId)) return false;
      seen.add(userId);
      return true;
    });
    if (recipients.length === 0) return;

    await this.em.nativeUpdate(
      Notification,
      { issueIdentifier, userId: { $in: recipients } },
      { snoozedUntil: null },
    );
    for (const userId of recipients) {
      this.em.persist(
        new Notification({
          id: v7(),
          issueIdentifier,
          userId,
          actorId,
          type,
          content,
          read: false,
        }),
      );
    }
  }

  private async ensureSubscription(issueIdentifier: string, memberId: string) {
    const existing = await this.em.findOne(IssueSubscription, {
      issueIdentifier,
      memberId,
    });
    if (!existing) {
      this.em.persist(new IssueSubscription({ issueIdentifier, memberId }));
    }
  }

  private getEstimateSettings(team?: Team): IssueEstimateSettings {
    return {
      enabled: Boolean(team?.estimateEnabled),
      scale: team?.estimateScale ?? 'fibonacci',
      extended: Boolean(team?.estimateExtended),
      allowZero: Boolean(team?.estimateZero),
      unestimatedAsOne: team?.unestimatedAsOne !== false,
    };
  }

  private async getWorkflowStatusMaps(teamIds: string[]) {
    const uniqueTeamIds = [...new Set(teamIds)];
    const rows = uniqueTeamIds.length
      ? await this.em.find(
          IssueStatus,
          { teamId: { $in: uniqueTeamIds } },
          { orderBy: { category: 'asc', position: 'asc' } },
        )
      : [];
    const result = new Map<
      string,
      Map<string, { id: string; name: string; color: string; category: string }>
    >();
    for (const row of rows) {
      const statuses = result.get(row.teamId) ?? new Map();
      statuses.set(row.id, {
        id: row.id,
        name: row.name,
        color: row.color,
        category: row.category,
      });
      result.set(row.teamId, statuses);
    }
    for (const teamId of uniqueTeamIds) {
      const statuses =
        result.get(teamId) ??
        new Map(
          DEFAULT_ISSUE_STATUSES.map((status) => [
            status.id,
            {
              id: status.id,
              name: status.name,
              color: status.color,
              category: status.category,
            },
          ]),
        );
      statuses.set(DUPLICATE_STATUS.id, DUPLICATE_STATUS);
      result.set(teamId, statuses);
    }
    return result;
  }

  private transformIssue(
    issue: Issue,
    membersMap: Map<string, any>,
    labelsMap: Map<string, any>,
    projectsMap: Map<string, any>,
    issueLabels: IssueLabel[],
    subissuesMap: Map<string, string[]>,
    subscribedIssueIdentifiers: Set<string> = new Set(),
    estimateSettings: IssueEstimateSettings = {
      enabled: false,
      scale: 'fibonacci',
      extended: false,
      allowZero: false,
      unestimatedAsOne: true,
    },
    teamWorkspaceId?: string,
    workflowStatuses: Map<
      string,
      { id: string; name: string; color: string; category: string }
    > = new Map(),
  ) {
    const assignee = issue.assigneeId ? (membersMap.get(issue.assigneeId) ?? null) : null;
    const labelIds = issueLabels
      .filter((il) => il.issueId === issue.id || il.issueId === issue.identifier)
      .map((il) => il.labelId);
    const labels = labelIds
      .map((lid) => labelsMap.get(lid))
      .filter(
        (label) =>
          label &&
          label.workspaceId === teamWorkspaceId &&
          isLabelAvailableForTeam(label.teamId, issue.teamId),
      );

    const project = issue.projectId ? projectsMap.get(issue.projectId) : undefined;
    const subissues =
      subissuesMap.get(issue.id) || subissuesMap.get(issue.identifier) || [];

    const status = workflowStatuses.get(issue.statusId) || {
      id: issue.statusId,
      name: issue.statusId,
      color: '#e2e2e2',
      category: issue.statusCategory || 'unstarted',
    };

    const priority = ALL_PRIORITIES[issue.priorityId] || ALL_PRIORITIES['no-priority'];

    return {
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      description: issue.description || '',
      teamId: issue.teamId,
      status,
      assignee,
      creatorId: issue.creatorId,
      priority,
      estimate: issue.estimate ?? null,
      estimateSettings,
      labels,
      createdAt: issue.createdAt
        ? issue.createdAt.toISOString().split('T')[0]
        : undefined,
      cycleId: issue.cycleId ?? '',
      project,
      subissues: subissues.length > 0 ? subissues : undefined,
      rank: issue.rank,
      dueDate: issue.dueDate ? issue.dueDate.toISOString().split('T')[0] : undefined,
      isSubscribed: subscribedIssueIdentifiers.has(issue.identifier),
    };
  }

  async findAll(
    memberId: string,
    query?: {
      teamId?: string;
      workspaceId?: string;
      cycleId?: string;
      projectId?: string;
      statusCategories?: string | string[];
      statusIds?: string | string[];
      priorityIds?: string | string[];
      assigneeId?: string;
      labelIds?: string | string[];
      search?: string;
      advancedFilters?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const accessibleTeamIds = await this.getAccessibleTeamIds(
      memberId,
      query?.workspaceId,
    );
    if (accessibleTeamIds.length === 0) {
      return [];
    }

    const advancedFilters = parseAdvancedIssueFilters(query?.advancedFilters);
    const where: any = { teamId: { $in: accessibleTeamIds } };

    if (query?.teamId) {
      if (!accessibleTeamIds.includes(query.teamId)) {
        return [];
      }
      where.teamId = query.teamId;
    }
    if (query?.cycleId !== undefined) where.cycleId = query.cycleId;
    if (query?.projectId) where.projectId = query.projectId;
    if (query?.assigneeId) where.assigneeId = query.assigneeId;

    if (query?.statusCategories) {
      const cats = Array.isArray(query.statusCategories)
        ? query.statusCategories
        : query.statusCategories.split(',');
      where.statusCategory = { $in: cats };
    }

    if (query?.statusIds) {
      const sids = Array.isArray(query.statusIds)
        ? query.statusIds
        : query.statusIds.split(',');
      where.statusId = { $in: sids };
    }

    if (query?.priorityIds) {
      const pids = Array.isArray(query.priorityIds)
        ? query.priorityIds
        : query.priorityIds.split(',');
      where.priorityId = { $in: pids };
    }

    if (query?.search) {
      where.$or = [
        { title: { $ilike: `%${query.search}%` } },
        { identifier: { $ilike: `%${query.search}%` } },
        { description: { $ilike: `%${query.search}%` } },
      ];
    }

    const issues = await this.em.find(Issue, where, {
      orderBy: { rank: 'ASC', createdAt: 'DESC' },
      // Evaluate saved-view filters before applying the default list cap so a
      // valid match beyond the first page is not silently omitted.
      limit: query?.limit ?? (advancedFilters.length > 0 ? undefined : 200),
      offset: query?.offset,
    });

    const issueIds = issues.flatMap((issue) => [issue.id, issue.identifier]);
    const subscriptions = await this.em.find(IssueSubscription, {
      memberId,
      issueIdentifier: { $in: issues.map((issue) => issue.identifier) },
    });
    const subscribedIssueIdentifiers = new Set(
      subscriptions.map((subscription) => subscription.issueIdentifier),
    );
    const teams = await this.em.find(Team, {
      id: { $in: [...new Set(issues.map((issue) => issue.teamId))] },
    });
    const workspaceIds = [
      ...new Set(teams.map((team) => team.workspaceId).filter(Boolean)),
    ];
    const candidateMemberIds = [
      ...new Set(
        issues
          .flatMap((issue) => [issue.assigneeId, issue.creatorId])
          .filter((id): id is string => Boolean(id)),
      ),
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
      scope: { $in: ['issue', 'both'] },
      ...(workspaceIds.length ? { workspaceId: { $in: workspaceIds } } : {}),
      $or: [
        { teamId: null },
        { teamId: { $in: [...new Set(issues.map((issue) => issue.teamId))] } },
      ],
    });
    const issueProjectIds = issues
      .map((issue) => issue.projectId)
      .filter((id): id is string => Boolean(id));
    const projects = await this.em.find(Project, {
      id: { $in: issueProjectIds },
    });
    const projectTeams = await this.em.find(ProjectTeam, {
      projectId: { $in: issueProjectIds },
    });
    const projectScopeTeamIds = [
      ...new Set([
        ...projects.map((project) => project.teamId),
        ...projectTeams.map((link) => link.teamId),
      ]),
    ];
    const projectScopeTeams = projectScopeTeamIds.length
      ? await this.em.find(Team, { id: { $in: projectScopeTeamIds } })
      : [];
    const projectWorkspaceByTeamId = new Map(
      projectScopeTeams.map((team) => [team.id, team.workspaceId]),
    );
    const projectTeamKeys = new Set(
      projectTeams.map((projectTeam) => `${projectTeam.projectId}:${projectTeam.teamId}`),
    );
    const validProjectIds = new Set(
      issues
        .filter((issue) => {
          if (!issue.projectId) return false;
          const project = projects.find((candidate) => candidate.id === issue.projectId);
          return Boolean(
            project &&
              isProjectScopeVisible(
                [
                  project.teamId,
                  ...projectTeams
                    .filter((link) => link.projectId === project.id)
                    .map((link) => link.teamId),
                ],
                projectWorkspaceByTeamId,
                new Set([issue.teamId]),
              ) &&
              (project.teamId === issue.teamId ||
                projectTeamKeys.has(`${project.id}:${issue.teamId}`)),
          );
        })
        .map((issue) => issue.projectId)
        .filter((id): id is string => Boolean(id)),
    );
    const issueLabels = await this.em.find(IssueLabel, { issueId: { $in: issueIds } });

    const membersMap = new Map(members.map((m) => [m.id, toSafeMember(m)]));
    const labelsMap = new Map(labels.map((l) => [l.id, l]));
    const teamWorkspaceById = new Map(teams.map((team) => [team.id, team.workspaceId]));
    const estimateSettingsMap = new Map<string, IssueEstimateSettings>(
      teams.map((team) => [team.id, this.getEstimateSettings(team)]),
    );
    const projectsMap = new Map(
      projects.filter((project) => validProjectIds.has(project.id)).map((p) => [p.id, p]),
    );

    const visibleLabelIdsByIssue = new Map<string, Set<string>>();
    for (const issueLabel of issueLabels) {
      const issue = issues.find(
        (candidate) =>
          candidate.id === issueLabel.issueId ||
          candidate.identifier === issueLabel.issueId,
      );
      const label = labelsMap.get(issueLabel.labelId);
      if (
        !issue ||
        !label ||
        label.workspaceId !== teamWorkspaceById.get(issue.teamId) ||
        !isLabelAvailableForTeam(label.teamId, issue.teamId)
      ) {
        continue;
      }
      for (const issueKey of [issue.id, issue.identifier]) {
        const labelIds = visibleLabelIdsByIssue.get(issueKey) ?? new Set<string>();
        labelIds.add(label.id);
        visibleLabelIdsByIssue.set(issueKey, labelIds);
      }
    }

    // subissues mapping
    const subissuesMap = new Map<string, string[]>();
    for (const issue of issues) {
      if (issue.parentIssueId) {
        const list = subissuesMap.get(issue.parentIssueId) || [];
        list.push(issue.identifier);
        subissuesMap.set(issue.parentIssueId, list);
      }
    }

    // Filter by labelIds if provided
    let results = issues;
    if (query?.labelIds) {
      const filterLabelIds = Array.isArray(query.labelIds)
        ? query.labelIds
        : query.labelIds.split(',');
      const issueIdsWithLabels = new Set(
        issues
          .filter((issue) =>
            filterLabelIds.some(
              (labelId) =>
                visibleLabelIdsByIssue.get(issue.id)?.has(labelId) ||
                visibleLabelIdsByIssue.get(issue.identifier)?.has(labelId),
            ),
          )
          .flatMap((issue) => [issue.id, issue.identifier]),
      );
      results = results.filter(
        (i) => issueIdsWithLabels.has(i.id) || issueIdsWithLabels.has(i.identifier),
      );
    }

    if (advancedFilters.length > 0) {
      const labelsByIssue = new Map<string, string[]>();
      for (const [issueKey, labelIds] of visibleLabelIdsByIssue) {
        labelsByIssue.set(issueKey, [...labelIds]);
      }
      results = results.filter((issue) =>
        matchesAdvancedIssueFilters(
          issue,
          labelsByIssue.get(issue.id) ?? labelsByIssue.get(issue.identifier) ?? [],
          advancedFilters,
        ),
      );
    }

    const workflowStatuses = await this.getWorkflowStatusMaps(
      results.map((issue) => issue.teamId),
    );

    return results.map((issue) =>
      this.transformIssue(
        issue,
        membersMap,
        labelsMap,
        projectsMap,
        issueLabels,
        subissuesMap,
        subscribedIssueIdentifiers,
        estimateSettingsMap.get(issue.teamId),
        teamWorkspaceById.get(issue.teamId),
        workflowStatuses.get(issue.teamId),
      ),
    );
  }

  async findArchived(memberId: string, teamId?: string) {
    const accessibleTeamIds = await this.getAccessibleTeamIds(memberId);
    if (accessibleTeamIds.length === 0) return [];
    if (teamId && !accessibleTeamIds.includes(teamId)) return [];

    const issues = await this.em.find(
      Issue,
      {
        teamId: teamId ?? { $in: accessibleTeamIds },
        deletedAt: { $ne: null },
      },
      {
        filters: { softDelete: false },
        orderBy: { deletedAt: 'DESC' },
      },
    );

    return issues.map((issue) => ({
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      teamId: issue.teamId,
      statusId: issue.statusId,
      statusCategory: issue.statusCategory,
      priorityId: issue.priorityId,
      deletedAt: issue.deletedAt?.toISOString() ?? null,
      createdAt: issue.createdAt?.toISOString() ?? null,
    }));
  }

  async findFacets(
    memberId: string,
    query?: {
      teamId?: string;
      workspaceId?: string;
      cycleId?: string;
      projectId?: string;
    },
  ) {
    const accessibleTeamIds = await this.getAccessibleTeamIds(
      memberId,
      query?.workspaceId,
    );
    const empty = {
      status: {},
      statusType: {},
      priority: {},
      assignee: {},
      labels: {},
      project: {},
      cycle: {},
    } as Record<string, Record<string, number>>;

    if (accessibleTeamIds.length === 0) return empty;
    if (query?.teamId && !accessibleTeamIds.includes(query.teamId)) return empty;

    const where: any = {
      teamId: query?.teamId ? query.teamId : { $in: accessibleTeamIds },
    };
    if (query?.cycleId !== undefined) where.cycleId = query.cycleId;
    if (query?.projectId) where.projectId = query.projectId;

    const issues = await this.em.find(Issue, where);
    if (issues.length === 0) return empty;

    const increment = (bucket: Record<string, number>, key: string) => {
      bucket[key] = (bucket[key] ?? 0) + 1;
    };
    const facets = {
      status: {},
      statusType: {},
      priority: {},
      assignee: {},
      labels: {},
      project: {},
      cycle: {},
    } as Record<string, Record<string, number>>;

    for (const issue of issues) {
      increment(facets.status, issue.statusId);
      increment(facets.statusType, issue.statusCategory);
      increment(facets.priority, issue.priorityId);
      increment(facets.assignee, issue.assigneeId ?? 'unassigned');
      increment(facets.project, issue.projectId ?? 'no-project');
      increment(facets.cycle, issue.cycleId || 'no-cycle');
    }

    const issueIds = issues.flatMap((issue) => [issue.id, issue.identifier]);
    const issueLabels = await this.em.find(IssueLabel, { issueId: { $in: issueIds } });
    const teams = await this.em.find(Team, {
      id: { $in: [...new Set(issues.map((issue) => issue.teamId))] },
    });
    const workspaceIds = [
      ...new Set(teams.map((team) => team.workspaceId).filter(Boolean)),
    ];
    const labels = await this.em.find(Label, {
      scope: { $in: ['issue', 'both'] },
      workspaceId: { $in: workspaceIds },
      $or: [
        { teamId: null },
        { teamId: { $in: [...new Set(issues.map((issue) => issue.teamId))] } },
      ],
    });
    const labelsById = new Map(labels.map((label) => [label.id, label]));
    const teamWorkspaceById = new Map(teams.map((team) => [team.id, team.workspaceId]));
    const issuesById = new Map(
      issues.flatMap((issue) => [
        [issue.id, issue] as const,
        [issue.identifier, issue] as const,
      ]),
    );
    const visibleIssueIds = new Set(issueIds);
    for (const issueLabel of issueLabels) {
      const issue = issuesById.get(issueLabel.issueId);
      const label = labelsById.get(issueLabel.labelId);
      if (
        issue &&
        label &&
        visibleIssueIds.has(issueLabel.issueId) &&
        label.workspaceId === teamWorkspaceById.get(issue.teamId) &&
        isLabelAvailableForTeam(label.teamId, issue.teamId)
      ) {
        increment(facets.labels, issueLabel.labelId);
      }
    }

    const candidateMemberIds = [
      ...new Set(
        issues.map((issue) => issue.assigneeId).filter((id): id is string => Boolean(id)),
      ),
    ];
    const memberships = workspaceIds.length
      ? await this.em.find(WorkspaceMember, {
          workspaceId: { $in: workspaceIds },
          memberId: { $in: candidateMemberIds },
        })
      : [];
    const visibleMemberIds = new Set(
      memberships.map((membership) => membership.memberId),
    );
    for (const memberIdKey of Object.keys(facets.assignee)) {
      if (memberIdKey !== 'unassigned' && !visibleMemberIds.has(memberIdKey)) {
        delete facets.assignee[memberIdKey];
      }
    }

    const projectIds = [
      ...new Set(
        issues.map((issue) => issue.projectId).filter((id): id is string => Boolean(id)),
      ),
    ];
    const projects = projectIds.length
      ? await this.em.find(Project, { id: { $in: projectIds } })
      : [];
    const projectTeams = projectIds.length
      ? await this.em.find(ProjectTeam, {
          projectId: { $in: projectIds },
        })
      : [];
    const projectScopeTeamIds = [
      ...new Set([
        ...projects.map((project) => project.teamId),
        ...projectTeams.map((link) => link.teamId),
      ]),
    ];
    const projectScopeTeams = projectScopeTeamIds.length
      ? await this.em.find(Team, { id: { $in: projectScopeTeamIds } })
      : [];
    const projectWorkspaceByTeamId = new Map(
      projectScopeTeams.map((team) => [team.id, team.workspaceId]),
    );
    const linkedProjectTeams = new Set(
      projectTeams.map((link) => `${link.projectId}:${link.teamId}`),
    );
    const validProjectIds = new Set(
      issues
        .filter((issue) => {
          if (!issue.projectId) return false;
          const project = projects.find((candidate) => candidate.id === issue.projectId);
          return Boolean(
            project &&
              isProjectScopeVisible(
                [
                  project.teamId,
                  ...projectTeams
                    .filter((link) => link.projectId === project.id)
                    .map((link) => link.teamId),
                ],
                projectWorkspaceByTeamId,
                new Set([issue.teamId]),
              ) &&
              (project.teamId === issue.teamId ||
                linkedProjectTeams.has(`${project.id}:${issue.teamId}`)),
          );
        })
        .map((issue) => issue.projectId)
        .filter((id): id is string => Boolean(id)),
    );
    for (const projectIdKey of Object.keys(facets.project)) {
      if (projectIdKey !== 'no-project' && !validProjectIds.has(projectIdKey)) {
        delete facets.project[projectIdKey];
      }
    }

    return facets;
  }

  async findOne(identifierOrId: string, memberId?: string, workspaceId?: string) {
    const issue = await this.em.findOne(Issue, {
      $or: [{ identifier: identifierOrId }, { id: identifierOrId }],
    });
    if (!issue) throw new NotFoundException(`Issue ${identifierOrId} not found`);
    if (memberId) {
      const accessibleTeamIds = await this.getAccessibleTeamIds(memberId, workspaceId);
      if (!accessibleTeamIds.includes(issue.teamId)) {
        throw new NotFoundException(`Issue ${identifierOrId} not found`);
      }
    }

    const team = await this.em.findOne(Team, { id: issue.teamId });
    const candidateMemberIds = [
      ...new Set(
        [issue.assigneeId, issue.creatorId].filter((id): id is string => Boolean(id)),
      ),
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
      scope: { $in: ['issue', 'both'] },
      ...(team?.workspaceId ? { workspaceId: team.workspaceId } : {}),
      $or: [{ teamId: null }, { teamId: issue.teamId }],
    });
    const projects = issue.projectId
      ? await this.em.find(Project, { id: issue.projectId })
      : [];
    const project = projects[0];
    const projectTeamIds = project
      ? await this.getProjectTeamIds(project.id, project.teamId)
      : [];
    const projectTeams = project
      ? await this.em.find(Team, { id: { $in: projectTeamIds } })
      : [];
    const projectWorkspaceByTeamId = new Map(
      projectTeams.map((candidate) => [candidate.id, candidate.workspaceId]),
    );
    const visibleProjects =
      project &&
      isProjectScopeVisible(
        projectTeamIds,
        projectWorkspaceByTeamId,
        new Set([issue.teamId]),
      )
        ? [project]
        : [];
    const issueLabels = await this.em.find(IssueLabel, {
      $or: [{ issueId: issue.id }, { issueId: issue.identifier }],
    });

    const membersMap = new Map(members.map((m) => [m.id, toSafeMember(m)]));
    const labelsMap = new Map(labels.map((l) => [l.id, l]));
    const projectsMap = new Map(visibleProjects.map((p) => [p.id, p]));

    const subIssues = await this.em.find(Issue, {
      $or: [{ parentIssueId: issue.id }, { parentIssueId: issue.identifier }],
      teamId: issue.teamId,
    });
    const subissuesMap = new Map<string, string[]>();
    if (subIssues.length > 0) {
      const identifiers = subIssues.map((s) => s.identifier);
      subissuesMap.set(issue.id, identifiers);
      subissuesMap.set(issue.identifier, identifiers);
    }

    const subscription = memberId
      ? await this.em.findOne(IssueSubscription, {
          issueIdentifier: issue.identifier,
          memberId,
        })
      : null;

    const workflowStatuses = await this.getWorkflowStatusMaps([issue.teamId]);
    return this.transformIssue(
      issue,
      membersMap,
      labelsMap,
      projectsMap,
      issueLabels,
      subissuesMap,
      new Set(subscription ? [issue.identifier] : []),
      this.getEstimateSettings(team ?? undefined),
      team?.workspaceId,
      workflowStatuses.get(issue.teamId),
    );
  }

  async findDetail(identifierOrId: string, memberId?: string, workspaceId?: string) {
    const base = await this.findOne(identifierOrId, memberId, workspaceId);
    const issue = await this.em.findOne(Issue, {
      $or: [{ identifier: identifierOrId }, { id: identifierOrId }],
    });
    if (!issue) throw new NotFoundException(`Issue ${identifierOrId} not found`);
    const team = await this.em.findOne(Team, { id: issue.teamId });

    const activities = await this.em.find(
      IssueActivity,
      { issueIdentifier: issue.identifier },
      { orderBy: { createdAt: 'ASC' } },
    );

    const comments = await this.em.find(
      IssueComment,
      { issueIdentifier: issue.identifier },
      { orderBy: { createdAt: 'ASC' } },
    );
    const activityActorIds = [
      ...activities.map((activity) => activity.actorId),
      ...comments.map((comment) => comment.actorId),
    ];
    const workspaceMemberships = team?.workspaceId
      ? await this.em.find(WorkspaceMember, {
          workspaceId: team.workspaceId,
          memberId: { $in: activityActorIds },
        })
      : [];
    const allowedActivityActorIds = team?.workspaceId
      ? workspaceMemberships.map((membership) => membership.memberId)
      : activityActorIds;
    const activityMembers = await this.em.find(Member, {
      id: { $in: allowedActivityActorIds },
    });
    const membersMap = new Map(activityMembers.map((m) => [m.id, toSafeMember(m)]));

    const relations = await this.em.find(IssueRelation, {
      $or: [
        { sourceIdentifier: issue.identifier },
        { targetIdentifier: issue.identifier },
      ],
    });

    const relationIdentifiers = [
      ...new Set(
        relations.flatMap((relation) => [
          relation.sourceIdentifier,
          relation.targetIdentifier,
        ]),
      ),
    ];
    const relationEndpoints = await this.em.find(Issue, {
      identifier: { $in: relationIdentifiers },
    });
    const endpointsByIdentifier = new Map(
      relationEndpoints.map((endpoint) => [endpoint.identifier, endpoint]),
    );
    const visibleRelations = relations.filter((relation) =>
      isRelationInIssueTeam(relation, issue, endpointsByIdentifier),
    );

    const prLinks = await this.em.find(PrLink, { issueIdentifier: issue.identifier });

    const blockedByIds: string[] = [];
    const relatedIds: string[] = [];
    const relationItems: Array<{
      id: string;
      identifier: string;
      relationType: 'blocks' | 'blocked_by' | 'relates_to' | 'duplicate_of';
    }> = [];

    for (const rel of visibleRelations) {
      const isSource = rel.sourceIdentifier === issue.identifier;
      const otherIdentifier = isSource ? rel.targetIdentifier : rel.sourceIdentifier;
      const relationType =
        rel.relationType === 'relates_to' || rel.relationType === 'duplicate_of'
          ? rel.relationType
          : rel.relationType === 'blocks'
            ? isSource
              ? 'blocks'
              : 'blocked_by'
            : isSource
              ? 'blocked_by'
              : 'blocks';
      relationItems.push({ id: rel.id, identifier: otherIdentifier, relationType });
      if (
        rel.relationType === 'blocked_by' &&
        rel.sourceIdentifier === issue.identifier
      ) {
        blockedByIds.push(rel.targetIdentifier);
      } else if (
        rel.relationType === 'blocks' &&
        rel.targetIdentifier === issue.identifier
      ) {
        blockedByIds.push(rel.sourceIdentifier);
      } else if (rel.relationType === 'relates_to') {
        const other =
          rel.sourceIdentifier === issue.identifier
            ? rel.targetIdentifier
            : rel.sourceIdentifier;
        relatedIds.push(other);
      }
    }

    const activityFeed = activities.map((act) => {
      const actor = membersMap.get(act.actorId) ?? null;
      const timeAgo = formatTimeAgo(act.createdAt);
      return {
        id: act.id,
        actor,
        event: act.event || 'status',
        text: act.text || '',
        timeAgo,
        createdAt: act.createdAt,
      };
    });

    const commentIds = comments.map((comment) => comment.id);
    const commentAttachments = commentIds.length
      ? await this.em.find(FileAttachment, {
          commentId: { $in: commentIds },
          status: 'completed',
        })
      : [];
    const attachmentsByComment = new Map<string, FileAttachment[]>();
    for (const attachment of commentAttachments) {
      const list = attachmentsByComment.get(attachment.commentId!) ?? [];
      list.push(attachment);
      attachmentsByComment.set(attachment.commentId!, list);
    }
    const commentItems = comments.map((comment) => {
      let body = comment.commentBlocks;
      if (
        !Array.isArray(body) ||
        body.length === 0 ||
        body.every((block) => !block || typeof block !== 'object' || !('type' in block))
      ) {
        body = [{ type: 'paragraph', text: comment.text || '' }];
      }
      return {
        id: comment.id,
        actor: membersMap.get(comment.actorId) ?? null,
        timeAgo: formatTimeAgo(comment.createdAt),
        createdAt: comment.createdAt,
        body,
        reactions: comment.reactions || [],
        attachments: (attachmentsByComment.get(comment.id) ?? []).map((attachment) => ({
          id: attachment.id,
          fileName: attachment.fileName,
          contentType: attachment.contentType,
          fileSize: attachment.fileSize,
          createdAt: attachment.createdAt,
        })),
      };
    });

    const descriptionBlocks = issue.descriptionBlocks || [];

    return {
      identifier: issue.identifier,
      description: descriptionBlocks,
      activity: activityFeed,
      comments: commentItems,
      subIssueIds: base.subissues,
      relatedIds: relatedIds.length > 0 ? relatedIds : undefined,
      blockedByIds: blockedByIds.length > 0 ? blockedByIds : undefined,
      relations: relationItems,
      prLinks: prLinks.map((p) => ({
        id: p.id,
        title: p.title,
        status: p.status,
      })),
      milestone: issue.milestone,
    };
  }

  async create(dto: CreateIssueDto, actorId: string) {
    let identifier = dto.identifier?.trim();
    const accessibleTeamIds = await this.workspacesService.getAccessibleTeamIds(actorId);

    // 1. Resolve project and teamId
    let projectId = dto.projectId;
    let teamId = dto.teamId;

    if (projectId) {
      const proj = await this.em.findOne(Project, { id: projectId });
      if (!proj) {
        throw new NotFoundException(`Project ${projectId} not found`);
      }
      const projectTeamIds = await this.getProjectTeamIds(proj.id, proj.teamId);
      const visibleProjectTeamIds = projectTeamIds.filter((id) =>
        accessibleTeamIds.includes(id),
      );
      if (visibleProjectTeamIds.length === 0) {
        throw new NotFoundException(`Project ${projectId} not found`);
      }
      if (teamId && !projectTeamIds.includes(teamId)) {
        throw new BadRequestException('Project and issue must share a project team');
      }
      if (teamId && !accessibleTeamIds.includes(teamId)) {
        throw new NotFoundException(`Team ${teamId} not found`);
      }
      teamId = resolveDefaultIssueTeamId({
        requestedTeamId: teamId,
        primaryTeamId: proj.teamId,
        projectTeamIds,
        accessibleTeamIds,
      });
      if (!teamId) {
        throw new BadRequestException(
          'teamId is required when a project has multiple accessible teams',
        );
      }
    }

    if (!teamId) {
      throw new BadRequestException('teamId is required when creating an issue');
    }

    let team = accessibleTeamIds.includes(teamId)
      ? await this.em.findOne(Team, { id: teamId })
      : null;
    if (teamId && !team) {
      throw new NotFoundException(`Team ${teamId} not found`);
    }
    if (!team) throw new NotFoundException(`Team ${teamId} not found`);

    const workflowStatuses = await this.getWorkflowStatusMaps([teamId]);
    const teamStatuses = workflowStatuses.get(teamId)!;
    const createPropertyError = getIssuePropertyValidationError({
      statusId: dto.statusId,
      statusCategory: dto.statusCategory,
      priorityId: dto.priorityId,
      knownStatuses: Object.fromEntries(teamStatuses),
      knownPriorities: ALL_PRIORITIES,
    });
    if (createPropertyError) throw new BadRequestException(createPropertyError);
    const createEstimateError = validateIssueEstimate(
      dto.estimate,
      this.getEstimateSettings(team),
    );
    if (createEstimateError) throw new BadRequestException(createEstimateError);
    await this.validateAssigneeId(dto.assigneeId, teamId);

    if (dto.cycleId) {
      const cycle = await this.em.findOne(Cycle, { id: dto.cycleId });
      if (!cycle || cycle.teamId !== teamId) {
        throw new BadRequestException('Cycle and issue must belong to the same team');
      }
      await this.assertTeamAccess(
        actorId,
        cycle.teamId,
        `Cycle ${dto.cycleId} not found`,
      );
    }

    if (dto.parentIssueId) {
      const parent = await this.em.findOne(Issue, {
        $or: [{ identifier: dto.parentIssueId }, { id: dto.parentIssueId }],
      });
      if (!parent || parent.teamId !== teamId) {
        throw new BadRequestException(
          'Parent issue must be another issue in the same team',
        );
      }
      await this.assertTeamAccess(
        actorId,
        parent.teamId,
        `Issue ${dto.parentIssueId} not found`,
      );
    }

    const milestone = await this.resolveMilestoneForProject(dto.projectId, dto.milestone);

    const prefix = team.id.toUpperCase();

    // If identifier is not provided, or already taken in DB, generate unique sequential identifier
    const existing = identifier ? await this.em.findOne(Issue, { identifier }) : null;
    if (!identifier || existing) {
      const issuesForPrefix = await this.em.find(Issue, {
        $or: [{ teamId }, { identifier: { $like: `${prefix}-%` } }],
      });
      let maxNum = 0;
      for (const i of issuesForPrefix) {
        const match = i.identifier.match(new RegExp(`^${prefix}-(\\d+)`, 'i'));
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }

      let nextNum = maxNum + 1;
      identifier = `${prefix}-${nextNum}`;
      // oxlint-disable-next-line no-await-in-loop -- each candidate identifier depends on the previous one being taken
      while (await this.em.findOne(Issue, { identifier })) {
        nextNum++;
        identifier = `${prefix}-${nextNum}`;
      }
    }

    const defaultStatusId =
      (await this.em.findOne(IssueStatus, { teamId, isDefault: true }))?.id || 'to-do';
    const statusId = dto.statusId || defaultStatusId;
    const statusCategory =
      dto.statusCategory || teamStatuses.get(statusId)?.category || 'unstarted';

    const id = v7();
    const issue = new Issue({
      id,
      identifier,
      title: dto.title,
      description: dto.description || '',
      descriptionBlocks: dto.descriptionBlocks || [],
      statusId,
      statusCategory,
      priorityId: dto.priorityId || 'no-priority',
      estimate: dto.estimate ?? undefined,
      assigneeId: dto.assigneeId,
      creatorId: actorId,
      teamId,
      projectId: projectId || undefined,
      cycleId: dto.cycleId ?? '',
      parentIssueId: dto.parentIssueId,
      rank: dto.rank || '0|hzzzzz:',
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      milestone,
    });

    this.em.persist(issue);
    await this.ensureSubscription(identifier, actorId);
    if (dto.assigneeId) await this.ensureSubscription(identifier, dto.assigneeId);

    if (dto.labelIds !== undefined) {
      const labelIds = await this.validateLabelIds(dto.labelIds, teamId);
      const ilEntities = labelIds.map((lid) => new IssueLabel(identifier, lid));
      this.em.persist(ilEntities);
    }

    // Record creation activity
    const activity = new IssueActivity({
      issueIdentifier: identifier,
      actorId,
      event: 'created',
      text: 'created this issue',
    });
    this.em.persist(activity);

    if (dto.assigneeId && dto.assigneeId !== actorId) {
      const actor = await this.em.findOne(Member, { id: actorId });
      await this.notifyMany(
        identifier,
        actorId,
        [dto.assigneeId],
        'assignment',
        `${actor?.name || actorId} assigned this issue to you`,
      );
    }
    await this.em.flush();

    return this.findOne(identifier, actorId);
  }

  async update(identifierOrId: string, dto: UpdateIssueDto, actorId: string) {
    const issue = await this.em.findOne(Issue, {
      $or: [{ identifier: identifierOrId }, { id: identifierOrId }],
    });
    if (!issue) throw new NotFoundException(`Issue ${identifierOrId} not found`);
    await this.assertTeamAccess(
      actorId,
      issue.teamId,
      `Issue ${identifierOrId} not found`,
    );

    const nextTeamId = dto.teamId ?? issue.teamId;
    const workflowStatuses = await this.getWorkflowStatusMaps([nextTeamId]);
    const teamStatuses = workflowStatuses.get(nextTeamId)!;
    const updatePropertyError = getIssuePropertyValidationError({
      statusId: dto.statusId,
      statusCategory: dto.statusCategory,
      priorityId: dto.priorityId,
      knownStatuses: Object.fromEntries(teamStatuses),
      knownPriorities: ALL_PRIORITIES,
    });
    if (updatePropertyError) throw new BadRequestException(updatePropertyError);

    let actorName: string | undefined;
    const getActorName = async () => {
      if (actorName === undefined) {
        const actor = await this.em.findOne(Member, { id: actorId });
        actorName = actor?.name || actorId;
      }
      return actorName;
    };

    const nextTeam = await this.em.findOne(Team, { id: nextTeamId });
    if (!nextTeam) throw new NotFoundException(`Team ${nextTeamId} not found`);
    await this.validateAssigneeId(
      dto.assigneeId !== undefined ? dto.assigneeId : issue.assigneeId,
      nextTeamId,
    );
    if (dto.teamId !== undefined && dto.teamId !== issue.teamId) {
      await this.assertTeamAccess(
        actorId,
        dto.teamId,
        `Issue ${identifierOrId} not found`,
      );
    }

    const nextEstimate = dto.estimate !== undefined ? dto.estimate : issue.estimate;
    if (dto.estimate !== undefined || dto.teamId !== undefined) {
      const updateEstimateError = validateIssueEstimate(
        nextEstimate,
        this.getEstimateSettings(nextTeam),
      );
      if (updateEstimateError) throw new BadRequestException(updateEstimateError);
    }

    const nextProjectId = dto.projectId !== undefined ? dto.projectId : issue.projectId;
    if (nextProjectId) {
      await this.validateProjectForTeam(nextProjectId, nextTeamId, actorId);
    }

    let nextLabelIds: string[] | undefined;
    if (dto.labelIds !== undefined) {
      nextLabelIds = await this.validateLabelIds(dto.labelIds, nextTeamId);
    } else if (dto.teamId !== undefined && dto.teamId !== issue.teamId) {
      const existingLabelIds = await this.getExistingIssueLabelIds(issue);
      if (existingLabelIds.length > 0) {
        nextLabelIds = await this.validateLabelIds(existingLabelIds, nextTeamId);
      }
    }

    let nextMilestone = issue.milestone;
    if (dto.milestone !== undefined || dto.projectId !== undefined) {
      nextMilestone = await this.resolveMilestoneForProject(
        nextProjectId,
        dto.milestone !== undefined ? dto.milestone : issue.milestone,
      );
    }

    const nextCycleId = dto.cycleId !== undefined ? dto.cycleId : issue.cycleId;
    if (nextCycleId) {
      const targetCycle = await this.em.findOne(Cycle, { id: nextCycleId });
      if (!targetCycle || targetCycle.teamId !== nextTeamId) {
        throw new BadRequestException('Cycle and issue must belong to the same team');
      }
      await this.assertTeamAccess(
        actorId,
        targetCycle.teamId,
        `Issue ${identifierOrId} not found`,
      );
    }

    const nextParentIssueId =
      dto.parentIssueId !== undefined ? dto.parentIssueId : issue.parentIssueId;
    if (nextParentIssueId) {
      const parent = await this.em.findOne(Issue, {
        $or: [{ identifier: nextParentIssueId }, { id: nextParentIssueId }],
      });
      if (!parent || parent.teamId !== nextTeamId || parent.id === issue.id) {
        throw new BadRequestException(
          'Parent issue must be another issue in the same team',
        );
      }
      await this.assertTeamAccess(
        actorId,
        parent.teamId,
        `Issue ${identifierOrId} not found`,
      );
    }

    if (dto.title !== undefined && dto.title !== issue.title) {
      issue.title = dto.title;
      this.em.persist(
        new IssueActivity({
          issueIdentifier: issue.identifier,
          actorId,
          event: 'title',
          text: 'changed the title',
        }),
      );
    }
    if (dto.description !== undefined && dto.description !== issue.description) {
      issue.description = dto.description;
      // Editing description invalidates legacy structured blocks; reads fall back to
      // rendering `description` directly (see findDetail()'s "Default description if blocks empty").
      if (dto.descriptionBlocks === undefined) {
        issue.descriptionBlocks = [];
      }
      this.em.persist(
        new IssueActivity({
          issueIdentifier: issue.identifier,
          actorId,
          event: 'description',
          text: 'updated the description',
        }),
      );
    }
    if (dto.descriptionBlocks !== undefined)
      issue.descriptionBlocks = dto.descriptionBlocks;
    if (dto.statusId !== undefined) {
      const oldStatus = issue.statusId;
      issue.statusId = dto.statusId;
      issue.statusCategory =
        dto.statusCategory ||
        teamStatuses.get(dto.statusId)?.category ||
        issue.statusCategory;

      if (oldStatus !== dto.statusId) {
        const statusName = teamStatuses.get(dto.statusId)?.name || dto.statusId;
        const act = new IssueActivity({
          issueIdentifier: issue.identifier,
          actorId,
          event: 'status',
          text: `changed status to ${statusName}`,
        });
        this.em.persist(act);

        const name = await getActorName();
        const statusRecipients = await this.resolveRecipients(issue, actorId);
        await this.notifyMany(
          issue.identifier,
          actorId,
          statusRecipients,
          'status',
          `${name} changed status to ${statusName}`,
        );
      }
    }
    if (dto.priorityId !== undefined) {
      const oldPriority = issue.priorityId;
      issue.priorityId = dto.priorityId;
      if (oldPriority !== dto.priorityId) {
        const act = new IssueActivity({
          issueIdentifier: issue.identifier,
          actorId,
          event: 'priority',
          text: `set priority to ${ALL_PRIORITIES[dto.priorityId]?.name || dto.priorityId}`,
        });
        this.em.persist(act);
        const priorityRecipients = await this.resolveRecipients(issue, actorId);
        await this.notifyMany(
          issue.identifier,
          actorId,
          priorityRecipients,
          'status',
          `${await getActorName()} changed priority to ${ALL_PRIORITIES[dto.priorityId]?.name || dto.priorityId}`,
        );
      }
    }
    if (dto.estimate !== undefined) {
      const previousEstimate = issue.estimate;
      issue.estimate = dto.estimate ?? undefined;
      if (previousEstimate !== issue.estimate) {
        this.em.persist(
          new IssueActivity({
            issueIdentifier: issue.identifier,
            actorId,
            event: 'estimate',
            text:
              dto.estimate === null
                ? 'removed the estimate'
                : `set estimate to ${dto.estimate}`,
          }),
        );
      }
    }
    if (dto.assigneeId !== undefined) {
      const previousAssigneeId = issue.assigneeId;
      issue.assigneeId = dto.assigneeId;
      const act = new IssueActivity({
        issueIdentifier: issue.identifier,
        actorId,
        event: 'assignment',
        text: dto.assigneeId ? `assigned to ${dto.assigneeId}` : 'unassigned',
      });
      this.em.persist(act);

      if (dto.assigneeId && dto.assigneeId !== previousAssigneeId) {
        await this.ensureSubscription(issue.identifier, dto.assigneeId);
        const name = await getActorName();
        await this.notifyMany(
          issue.identifier,
          actorId,
          [dto.assigneeId],
          'assignment',
          `${name} assigned this issue to you`,
        );
      }
    }
    if (dto.teamId !== undefined) issue.teamId = dto.teamId;
    if (dto.projectId !== undefined) issue.projectId = dto.projectId;
    if (dto.cycleId !== undefined) issue.cycleId = dto.cycleId;
    if (dto.parentIssueId !== undefined) issue.parentIssueId = dto.parentIssueId;
    if (dto.rank !== undefined) issue.rank = dto.rank;
    if (dto.dueDate !== undefined)
      issue.dueDate = dto.dueDate ? new Date(dto.dueDate) : undefined;
    if (dto.milestone !== undefined || dto.projectId !== undefined) {
      issue.milestone = nextMilestone;
    }

    if (nextLabelIds !== undefined) {
      const existing = await this.em.find(IssueLabel, {
        $or: [{ issueId: issue.id }, { issueId: issue.identifier }],
      });
      for (const e of existing) {
        this.em.remove(e);
      }
      if (nextLabelIds.length > 0) {
        const newIls = nextLabelIds.map((lid) => new IssueLabel(issue.identifier, lid));
        this.em.persist(newIls);
      }
    }

    await this.em.flush();
    return this.findOne(issue.identifier, actorId);
  }

  async updateRank(identifierOrId: string, rank: string, memberId: string) {
    const issue = await this.em.findOne(Issue, {
      $or: [{ identifier: identifierOrId }, { id: identifierOrId }],
    });
    if (!issue) throw new NotFoundException(`Issue ${identifierOrId} not found`);
    await this.assertTeamAccess(
      memberId,
      issue.teamId,
      `Issue ${identifierOrId} not found`,
    );

    issue.rank = rank;
    await this.em.flush();
    return { success: true, identifier: issue.identifier, rank };
  }

  async delete(identifierOrId: string, memberId: string) {
    const issue = await this.em.findOne(Issue, {
      $or: [{ identifier: identifierOrId }, { id: identifierOrId }],
    });
    if (issue) {
      await this.assertTeamAccess(
        memberId,
        issue.teamId,
        `Issue ${identifierOrId} not found`,
      );
      issue.deletedAt = new Date();
      await this.em.flush();
    }
    return { success: true };
  }

  async restore(identifierOrId: string, memberId: string) {
    const issue = await this.em.findOne(
      Issue,
      { $or: [{ identifier: identifierOrId }, { id: identifierOrId }] },
      { filters: { softDelete: false } },
    );
    if (!issue || !issue.deletedAt) {
      throw new NotFoundException(`Deleted issue ${identifierOrId} not found`);
    }

    await this.assertTeamAccess(
      memberId,
      issue.teamId,
      `Deleted issue ${identifierOrId} not found`,
    );
    issue.deletedAt = undefined;
    await this.em.flush();
    return this.findOne(issue.identifier, memberId);
  }

  async getSubscription(identifierOrId: string, memberId: string) {
    const issue = await this.em.findOne(Issue, {
      $or: [{ identifier: identifierOrId }, { id: identifierOrId }],
    });
    if (!issue) throw new NotFoundException(`Issue ${identifierOrId} not found`);
    await this.assertTeamAccess(
      memberId,
      issue.teamId,
      `Issue ${identifierOrId} not found`,
    );
    const subscription = await this.em.findOne(IssueSubscription, {
      issueIdentifier: issue.identifier,
      memberId,
    });
    return { identifier: issue.identifier, subscribed: Boolean(subscription) };
  }

  async subscribe(identifierOrId: string, memberId: string) {
    const issue = await this.em.findOne(Issue, {
      $or: [{ identifier: identifierOrId }, { id: identifierOrId }],
    });
    if (!issue) throw new NotFoundException(`Issue ${identifierOrId} not found`);
    await this.assertTeamAccess(
      memberId,
      issue.teamId,
      `Issue ${identifierOrId} not found`,
    );
    await this.ensureSubscription(issue.identifier, memberId);
    await this.em.flush();
    return { identifier: issue.identifier, subscribed: true };
  }

  async unsubscribe(identifierOrId: string, memberId: string) {
    const issue = await this.em.findOne(Issue, {
      $or: [{ identifier: identifierOrId }, { id: identifierOrId }],
    });
    if (!issue) throw new NotFoundException(`Issue ${identifierOrId} not found`);
    await this.assertTeamAccess(
      memberId,
      issue.teamId,
      `Issue ${identifierOrId} not found`,
    );
    const subscription = await this.em.findOne(IssueSubscription, {
      issueIdentifier: issue.identifier,
      memberId,
    });
    if (subscription) {
      this.em.remove(subscription);
      await this.em.flush();
    }
    return { identifier: issue.identifier, subscribed: false };
  }

  async addComment(identifierOrId: string, dto: CreateCommentDto, actorId: string) {
    const issue = await this.em.findOne(Issue, {
      $or: [{ identifier: identifierOrId }, { id: identifierOrId }],
    });
    if (!issue) throw new NotFoundException(`Issue ${identifierOrId} not found`);
    await this.assertTeamAccess(
      actorId,
      issue.teamId,
      `Issue ${identifierOrId} not found`,
    );

    const textContent =
      dto.textContent ||
      (Array.isArray(dto.commentBlocks) && dto.commentBlocks[0]?.text) ||
      '';
    const commentBlocks =
      Array.isArray(dto.commentBlocks) &&
      dto.commentBlocks.length > 0 &&
      dto.commentBlocks.some((b) => b && typeof b === 'object' && 'type' in b)
        ? dto.commentBlocks
        : [{ type: 'paragraph', text: textContent }];

    const attachmentIds = [...new Set(dto.attachmentIds ?? [])];
    if (attachmentIds.length > 0 && !textContent.trim()) {
      throw new BadRequestException('A comment is required when attaching files');
    }
    const team = await this.em.findOne(Team, { id: issue.teamId });
    if (attachmentIds.length > 0 && !team?.workspaceId) {
      throw new BadRequestException('Comment attachments are unavailable for this issue');
    }
    await this.em.transactional(async (transactionalEm) => {
      const attachments = attachmentIds.length
        ? await transactionalEm.find(
            FileAttachment,
            { id: { $in: attachmentIds } },
            { lockMode: LockMode.PESSIMISTIC_WRITE },
          )
        : [];
      if (
        attachments.length !== attachmentIds.length ||
        attachments.some(
          (attachment) =>
            attachment.status !== 'completed' ||
            attachment.issueIdentifier !== issue.identifier ||
            attachment.projectId != null ||
            attachment.teamId !== issue.teamId ||
            attachment.workspaceId !== team?.workspaceId ||
            attachment.uploaderId !== actorId ||
            attachment.commentId != null,
        )
      ) {
        throw new BadRequestException('One or more comment attachments are unavailable');
      }

      const comment = new IssueComment({
        issueIdentifier: issue.identifier,
        actorId,
        text: textContent,
        commentBlocks,
      });
      transactionalEm.persist(comment);
      for (const attachment of attachments) attachment.commentId = comment.id;
      await transactionalEm.flush();
    });

    // @mention parsing: `@<memberId>` resolved against real members. A mention takes
    // priority over the generic 'comment' notification for that same recipient (no dupes).
    const memberIds = await this.getMemberIdsForTeam(issue.teamId);
    memberIds.add(actorId);
    const members = await this.em.find(Member, { id: { $in: [...memberIds] } });
    const membersMap = new Map(members.map((m) => [m.id, toSafeMember(m)]));
    const mentionedIds = new Set<string>();
    for (const match of textContent.matchAll(/@([a-z0-9_.-]+)/g)) {
      const candidateId = match[1];
      if (membersMap.has(candidateId) && candidateId !== actorId) {
        mentionedIds.add(candidateId);
      }
    }

    const actor = membersMap.get(actorId);
    const actorName = actor?.name || actorId;
    await this.ensureSubscription(issue.identifier, actorId);
    await Promise.all(
      [...mentionedIds].map((mentionedId) =>
        this.ensureSubscription(issue.identifier, mentionedId),
      ),
    );
    const commentRecipients = await this.resolveRecipients(issue, actorId);

    await this.notifyMany(
      issue.identifier,
      actorId,
      commentRecipients.filter((id) => !mentionedIds.has(id)),
      'comment',
      `${actorName} commented on "${issue.title}"`,
    );
    await this.notifyMany(
      issue.identifier,
      actorId,
      mentionedIds,
      'mention',
      `${actorName} mentioned you in a comment`,
    );

    await this.em.flush();
    return this.findDetail(issue.identifier, actorId);
  }

  async addReaction(activityId: string, dto: AddReactionDto, memberId: string) {
    const act = await this.em.findOne(IssueComment, { id: activityId });
    if (!act) throw new NotFoundException(`Comment ${activityId} not found`);

    const issue = await this.em.findOne(Issue, { identifier: act.issueIdentifier });
    if (!issue) throw new NotFoundException(`Comment ${activityId} not found`);
    await this.assertTeamAccess(
      memberId,
      issue.teamId,
      `Comment ${activityId} not found`,
    );

    const reactions = act.reactions || [];
    const found = reactions.find((r: any) => r.emoji === dto.emoji);
    if (found) {
      const userIds = Array.isArray(found.userIds) ? found.userIds : [];
      if (!userIds.includes(memberId)) {
        found.userIds = [...userIds, memberId];
        found.count = found.userIds.length;
      }
    } else {
      reactions.push({
        emoji: dto.emoji,
        count: 1,
        userIds: [memberId],
      });
    }
    act.reactions = [...reactions];
    await this.em.flush();
    return act;
  }

  async removeReaction(activityId: string, emoji: string, memberId: string) {
    const act = await this.em.findOne(IssueComment, { id: activityId });
    if (!act) throw new NotFoundException(`Comment ${activityId} not found`);

    const issue = await this.em.findOne(Issue, { identifier: act.issueIdentifier });
    if (!issue) throw new NotFoundException(`Comment ${activityId} not found`);
    await this.assertTeamAccess(
      memberId,
      issue.teamId,
      `Comment ${activityId} not found`,
    );

    const reactions = Array.isArray(act.reactions) ? act.reactions : [];
    const found = reactions.find((reaction: any) => reaction.emoji === emoji);
    if (!found || !Array.isArray(found.userIds)) return act;

    const remainingUserIds = found.userIds.filter(
      (userId: string) => userId !== memberId,
    );
    const nextReactions = reactions
      .map((reaction: any) =>
        reaction.emoji === emoji
          ? { ...reaction, userIds: remainingUserIds, count: remainingUserIds.length }
          : reaction,
      )
      .filter((reaction: any) => reaction.emoji !== emoji || reaction.count > 0);

    act.reactions = nextReactions;
    await this.em.flush();
    return act;
  }

  async addRelation(identifierOrId: string, dto: AddRelationDto, memberId: string) {
    const issue = await this.em.findOne(Issue, {
      $or: [{ identifier: identifierOrId }, { id: identifierOrId }],
    });
    if (!issue) throw new NotFoundException(`Issue ${identifierOrId} not found`);
    await this.assertTeamAccess(
      memberId,
      issue.teamId,
      `Issue ${identifierOrId} not found`,
    );

    const target = await this.em.findOne(Issue, {
      $or: [{ identifier: dto.targetIdentifier }, { id: dto.targetIdentifier }],
    });
    if (!target || target.teamId !== issue.teamId || target.id === issue.id) {
      throw new BadRequestException('Related issue must exist in the same team');
    }
    const existing = await this.em.findOne(IssueRelation, {
      sourceIdentifier: issue.identifier,
      targetIdentifier: target.identifier,
      relationType: dto.relationType,
    });
    if (existing) return this.findDetail(issue.identifier, memberId);

    const relation = new IssueRelation({
      sourceIdentifier: issue.identifier,
      targetIdentifier: target.identifier,
      relationType: dto.relationType,
    });

    this.em.persist(relation);
    await this.em.flush();
    return this.findDetail(issue.identifier, memberId);
  }

  async deleteRelation(identifierOrId: string, relationId: string, memberId: string) {
    const issue = await this.em.findOne(Issue, {
      $or: [{ identifier: identifierOrId }, { id: identifierOrId }],
    });
    if (!issue) throw new NotFoundException(`Issue ${identifierOrId} not found`);
    await this.assertTeamAccess(
      memberId,
      issue.teamId,
      `Issue ${identifierOrId} not found`,
    );

    const relation = await this.em.findOne(IssueRelation, { id: relationId });
    if (
      !relation ||
      (relation.sourceIdentifier !== issue.identifier &&
        relation.targetIdentifier !== issue.identifier)
    ) {
      throw new NotFoundException(`Relation ${relationId} not found`);
    }

    this.em.remove(relation);
    await this.em.flush();
    return this.findDetail(issue.identifier, memberId);
  }
}

function formatTimeAgo(date: Date): string {
  const diffMs = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
