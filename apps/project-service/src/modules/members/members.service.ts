import { EntityManager } from '@mikro-orm/core';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateMemberDto, UpdateMemberDto } from './dto/member.dto';
import { filterVisibleTeamIds } from './member-scope';
import {
  Member,
  Team,
  TeamMember,
  Workspace,
  WorkspaceInvitation,
  WorkspaceMember,
} from '../../data-access';
import { canManageWorkspaceRole } from '../access-control';
import { SesMailerService } from '../email/ses-mailer.service';
import { PresenceService } from '../presence/presence.service';
import { createInvitationToken } from '../workspaces/invitation-token';
import { buildInvitationUrl } from '../workspaces/invitation-url';
import { WorkspacesService } from '../workspaces/workspaces.service';

@Injectable()
export class MembersService {
  constructor(
    private readonly em: EntityManager,
    private readonly sesMailerService: SesMailerService,
    private readonly workspacesService: WorkspacesService,
    private readonly presenceService: PresenceService,
  ) {}

  private async resolveWorkspaceId(actorId: string, requestedWorkspaceId: string) {
    const accessibleWorkspaceIds =
      await this.workspacesService.getAccessibleWorkspaceIds(actorId);
    const workspace = await this.em.findOne(Workspace, {
      $or: [{ id: requestedWorkspaceId }, { slug: requestedWorkspaceId }],
    });
    if (!workspace || !accessibleWorkspaceIds.includes(workspace.id)) {
      throw new NotFoundException(`Workspace ${requestedWorkspaceId} not found`);
    }
    return workspace.id;
  }

  private async assertWorkspaceManager(actorId: string, workspaceId: string) {
    const [workspace, membership] = await Promise.all([
      this.em.findOne(Workspace, { id: workspaceId }),
      this.em.findOne(WorkspaceMember, { workspaceId, memberId: actorId }),
    ]);
    if (
      !workspace ||
      !membership ||
      (!canManageWorkspaceRole(membership.role) && workspace.ownerId !== actorId)
    ) {
      throw new NotFoundException(`Workspace ${workspaceId} not found`);
    }
  }

  private async getVisibleTeamIds(
    requesterId: string,
    workspaceId?: string,
  ): Promise<Set<string>> {
    if (workspaceId) {
      const resolvedWorkspaceId = await this.resolveWorkspaceId(requesterId, workspaceId);
      const teams = await this.em.find(Team, { workspaceId: resolvedWorkspaceId });
      return new Set(teams.map((team) => team.id));
    }

    return new Set(await this.workspacesService.getAccessibleTeamIds(requesterId));
  }

  async findAll(memberId?: string, workspaceId?: string): Promise<any[]> {
    let members: Member[];
    const visibleTeamIds = memberId
      ? await this.getVisibleTeamIds(memberId, workspaceId)
      : new Set<string>();
    if (workspaceId) {
      const resolvedWorkspaceId = await this.resolveWorkspaceId(memberId, workspaceId);
      const workspaceMembers = await this.em.find(WorkspaceMember, {
        workspaceId: resolvedWorkspaceId,
      });
      const memberIds = workspaceMembers.map((wm) => wm.memberId);
      members = await this.em.find(Member, { id: { $in: memberIds } });
    } else if (memberId) {
      // No explicit workspace given: scope to every workspace the requester belongs to.
      const userWorkspaces = await this.em.find(WorkspaceMember, { memberId });
      const wsIds = userWorkspaces.map((wm) => wm.workspaceId);
      const workspaceMembers = await this.em.find(WorkspaceMember, {
        workspaceId: { $in: wsIds },
      });
      const memberIds = [...new Set(workspaceMembers.map((wm) => wm.memberId))];
      members = await this.em.find(Member, { id: { $in: memberIds } });
    } else {
      members = await this.em.find(Member, {});
    }
    const [teamMembers, presenceMap] = await Promise.all([
      this.em.find(TeamMember, {
        teamId: { $in: [...visibleTeamIds] },
      }),
      this.presenceService.getUsersPresence(members.map((m) => m.id)),
    ]);

    return members.map((member) => {
      const teamIds = teamMembers
        .filter((tm) => tm.memberId === member.id)
        .map((tm) => tm.teamId);
      return {
        id: member.id,
        name: member.name,
        email: member.email,
        avatarUrl: member.avatarUrl,
        status: presenceMap[member.id] || 'offline',
        role: member.role,
        timezone: member.timezone,
        teamIds,
        joinedDate: member.joinedDate
          ? member.joinedDate.toISOString().split('T')[0]
          : null,
      };
    });
  }

  async findOne(id: string, requesterId: string): Promise<any> {
    const member = await this.em.findOne(Member, { id });
    if (!member) throw new NotFoundException(`Member ${id} not found`);

    const [requesterWorkspaceIds, targetWorkspaceMemberships] = await Promise.all([
      this.workspacesService.getAccessibleWorkspaceIds(requesterId),
      this.em.find(WorkspaceMember, { memberId: id }),
    ]);
    if (
      !targetWorkspaceMemberships.some((membership) =>
        requesterWorkspaceIds.includes(membership.workspaceId),
      )
    ) {
      throw new NotFoundException(`Member ${id} not found`);
    }

    const [visibleTeamIds, teamMembers, presenceMap] = await Promise.all([
      this.getVisibleTeamIds(requesterId),
      this.em.find(TeamMember, { memberId: id }),
      this.presenceService.getUsersPresence([member.id]),
    ]);
    return {
      id: member.id,
      name: member.name,
      email: member.email,
      avatarUrl: member.avatarUrl,
      status: presenceMap[member.id] || 'offline',
      role: member.role,
      timezone: member.timezone,
      teamIds: filterVisibleTeamIds(teamMembers, visibleTeamIds),
      joinedDate: member.joinedDate
        ? member.joinedDate.toISOString().split('T')[0]
        : null,
    };
  }

  async create(dto: CreateMemberDto, actorId: string): Promise<any> {
    if (!dto.workspaceId) {
      throw new BadRequestException('workspaceId is required when creating a member');
    }
    const name = dto.name?.trim();
    if (!name) {
      throw new BadRequestException('name is required when inviting a member');
    }
    const resolvedWorkspaceId = await this.resolveWorkspaceId(actorId, dto.workspaceId);
    await this.assertWorkspaceManager(actorId, resolvedWorkspaceId);
    const email = dto.email.trim().toLowerCase();
    const existingMember = await this.em.findOne(Member, { email });
    if (existingMember) {
      const existingMembership = await this.em.findOne(WorkspaceMember, {
        workspaceId: resolvedWorkspaceId,
        memberId: existingMember.id,
      });
      if (existingMembership) {
        throw new ConflictException('This member is already in the workspace');
      }
    }
    const teamIds = [...new Set(dto.teamIds ?? [])];
    const role = dto.role === 'Admin' || dto.role === 'Guest' ? dto.role : 'Member';
    if (teamIds && Array.isArray(teamIds) && teamIds.length > 0) {
      const teams = await this.em.find(Team, { id: { $in: [...new Set(teamIds)] } });
      const invalidTeamIds = teamIds.filter(
        (teamId) =>
          !teams.some(
            (team) => team.id === teamId && team.workspaceId === resolvedWorkspaceId,
          ),
      );
      if (invalidTeamIds.length > 0) {
        throw new BadRequestException(
          `Team(s) ${[...new Set(invalidTeamIds)].join(', ')} do not belong to the workspace`,
        );
      }
    }
    const { token, tokenHash } = createInvitationToken();
    const existingInvitation = await this.em.findOne(WorkspaceInvitation, {
      workspaceId: resolvedWorkspaceId,
      email,
      acceptedAt: null,
    });
    const invitation =
      existingInvitation ??
      new WorkspaceInvitation({
        workspaceId: resolvedWorkspaceId,
        inviterMemberId: actorId,
        email,
        name,
      });
    invitation.inviterMemberId = actorId;
    invitation.email = email;
    invitation.name = name;
    invitation.role = role;
    invitation.teamIds = teamIds;
    invitation.tokenHash = tokenHash;
    invitation.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    this.em.persist(invitation);
    await this.em.flush();

    const workspace = await this.em.findOne(Workspace, { id: resolvedWorkspaceId });
    const inviter = await this.em.findOne(Member, { id: actorId });
    if (workspace && inviter) {
      this.sesMailerService
        .sendMemberInviteEmail({
          to: invitation.email,
          name: invitation.name,
          role: invitation.role,
          orgName: workspace.name,
          orgSlug: workspace.slug,
          inviterName: inviter.name,
          inviteToken: token,
        })
        .catch((err) => console.error('Failed to send invite email:', err));
    }

    const inviteUrl = buildInvitationUrl(
      process.env.FRONTEND_URL,
      token,
      invitation.email,
    );

    return {
      invitationId: invitation.id,
      email: invitation.email,
      name: invitation.name,
      role: invitation.role,
      teamIds: invitation.teamIds,
      expiresAt: invitation.expiresAt,
      ...(inviteUrl ? { inviteUrl } : {}),
    };
  }

  async update(id: string, dto: UpdateMemberDto, actorId: string): Promise<any> {
    const member = await this.em.findOne(Member, { id });
    if (!member) throw new NotFoundException(`Member ${id} not found`);
    await this.findOne(id, actorId);

    const hasProfileChanges =
      dto.name !== undefined ||
      dto.avatarUrl !== undefined ||
      dto.status !== undefined ||
      dto.timezone !== undefined;
    if (hasProfileChanges && id !== actorId) {
      throw new NotFoundException(`Member ${id} not found`);
    }

    if (dto.role) {
      if (!dto.workspaceId) {
        throw new BadRequestException(
          'workspaceId is required when changing a member role',
        );
      }
      const workspaceId = await this.resolveWorkspaceId(actorId, dto.workspaceId);
      await this.assertWorkspaceManager(actorId, workspaceId);
      const targetMembership = await this.em.findOne(WorkspaceMember, {
        workspaceId,
        memberId: id,
      });
      if (!targetMembership) throw new NotFoundException(`Member ${id} not found`);
      const workspace = await this.em.findOne(Workspace, { id: workspaceId });
      if (workspace?.ownerId === id || targetMembership.role === 'Owner') {
        throw new BadRequestException('The workspace owner role cannot be changed');
      }
      targetMembership.role = dto.role;
    }

    if (dto.name) member.name = dto.name;
    if (dto.avatarUrl !== undefined) member.avatarUrl = dto.avatarUrl;
    if (dto.status) member.status = dto.status;
    if (dto.timezone) member.timezone = dto.timezone;

    await this.em.flush();
    return this.findOne(member.id, actorId);
  }

  async getMemberTeams(id: string, requesterId: string): Promise<any[]> {
    await this.findOne(id, requesterId);
    const visibleTeamIds = await this.getVisibleTeamIds(requesterId);
    const teamMembers = await this.em.find(TeamMember, { memberId: id });
    return filterVisibleTeamIds(teamMembers, visibleTeamIds);
  }
}
