import {
  ClaimIssueAssignmentNotificationsRequest,
  IssueAssignmentDelivery,
} from '@app/common';
import { decryptSecret, encryptSecret } from '@app/common';
import { EntityManager, LockMode } from '@mikro-orm/core';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { v7 } from 'uuid';
import {
  acknowledgeAssignmentDelivery,
  failAssignmentDelivery,
  resolveAssignmentDelivery,
} from './assignment-delivery';
import { UpdateLarkIntegrationDto } from './dto/update-lark-integration.dto';
import {
  IssueAssignmentOutbox,
  Member,
  Workspace,
  WorkspaceLarkIntegration,
  WorkspaceLarkMember,
  WorkspaceMember,
} from '../../data-access';
import { canManageWorkspaceRole } from '../access-control';

const DEFAULT_LARK_DOMAIN = 'https://open.larksuite.com';

@Injectable()
export class LarkIntegrationService {
  constructor(private readonly em: EntityManager) {}

  private async resolveManagedWorkspace(workspaceIdOrSlug: string, actorId: string) {
    const workspace = await this.em.findOne(Workspace, {
      $or: [{ id: workspaceIdOrSlug }, { slug: workspaceIdOrSlug }],
    });
    if (!workspace) throw new NotFoundException('Workspace not found');

    const membership = await this.em.findOne(WorkspaceMember, {
      workspaceId: workspace.id,
      memberId: actorId,
    });
    if (workspace.ownerId !== actorId && !canManageWorkspaceRole(membership?.role)) {
      throw new NotFoundException('Workspace not found');
    }
    return workspace;
  }

  async get(workspaceIdOrSlug: string, actorId: string) {
    const workspace = await this.resolveManagedWorkspace(workspaceIdOrSlug, actorId);
    const [
      integration,
      memberships,
      mappingRows,
      pendingDeliveries,
      needsConfiguration,
      failedDeliveries,
    ] = await Promise.all([
      this.em.findOne(WorkspaceLarkIntegration, { workspaceId: workspace.id }),
      this.em.find(WorkspaceMember, { workspaceId: workspace.id }),
      this.em.find(WorkspaceLarkMember, { workspaceId: workspace.id }),
      this.em.count(IssueAssignmentOutbox, {
        workspaceId: workspace.id,
        status: 'pending',
      }),
      this.em.count(IssueAssignmentOutbox, {
        workspaceId: workspace.id,
        status: 'needs_config',
      }),
      this.em.count(IssueAssignmentOutbox, {
        workspaceId: workspace.id,
        status: 'failed',
      }),
    ]);
    const members = memberships.length
      ? await this.em.find(Member, {
          id: { $in: memberships.map((membership) => membership.memberId) },
        })
      : [];
    const mappingByMember = new Map(mappingRows.map((row) => [row.memberId, row.openId]));

    return {
      configured: Boolean(integration),
      enabled: integration?.enabled ?? false,
      appId: integration?.appId ?? '',
      domain: integration?.domain ?? DEFAULT_LARK_DOMAIN,
      groupChatId: integration?.groupChatId ?? '',
      appSecretConfigured: Boolean(integration?.appSecretCiphertext),
      members: members.map((member) => ({
        id: member.id,
        name: member.name,
        email: member.email,
        openId: mappingByMember.get(member.id) ?? '',
      })),
      pendingDeliveries,
      needsConfiguration,
      failedDeliveries,
    };
  }

  async update(
    workspaceIdOrSlug: string,
    actorId: string,
    dto: UpdateLarkIntegrationDto,
  ) {
    const workspace = await this.resolveManagedWorkspace(workspaceIdOrSlug, actorId);
    const openIds = dto.memberMappings
      ?.map((mapping) => mapping.openId.trim())
      .filter(Boolean);
    if (openIds && new Set(openIds).size !== openIds.length) {
      throw new BadRequestException('A Lark user can only be mapped once per workspace');
    }

    await this.em.transactional(async (tx) => {
      let integration = await tx.findOne(WorkspaceLarkIntegration, {
        workspaceId: workspace.id,
      });
      if (!integration) {
        integration = new WorkspaceLarkIntegration({
          id: v7(),
          workspaceId: workspace.id,
          appId: dto.appId?.trim() ?? '',
          appSecretCiphertext: dto.appSecret ? encryptSecret(dto.appSecret) : '',
          domain: dto.domain ?? DEFAULT_LARK_DOMAIN,
          groupChatId: dto.groupChatId?.trim() ?? '',
          enabled: false,
        });
      } else {
        if (dto.appId !== undefined) integration.appId = dto.appId.trim();
        if (dto.appSecret) integration.appSecretCiphertext = encryptSecret(dto.appSecret);
        if (dto.domain !== undefined) integration.domain = dto.domain;
        if (dto.groupChatId !== undefined)
          integration.groupChatId = dto.groupChatId.trim();
      }

      if (dto.enabled === true) {
        if (
          !integration.appId ||
          !integration.appSecretCiphertext ||
          !integration.groupChatId
        ) {
          throw new BadRequestException(
            'App ID, App Secret, and group chat ID are required before enabling Lark notifications',
          );
        }
      }
      if (dto.enabled !== undefined) integration.enabled = dto.enabled;
      tx.persist(integration);

      if (dto.memberMappings !== undefined) {
        const requestedIds = dto.memberMappings.map((mapping) => mapping.memberId);
        const workspaceMembers = requestedIds.length
          ? await tx.find(WorkspaceMember, {
              workspaceId: workspace.id,
              memberId: { $in: requestedIds },
            })
          : [];
        if (workspaceMembers.length !== new Set(requestedIds).size) {
          throw new BadRequestException(
            'Lark mappings may only reference workspace members',
          );
        }

        await tx.nativeDelete(WorkspaceLarkMember, { workspaceId: workspace.id });
        for (const mapping of dto.memberMappings) {
          const openId = mapping.openId.trim();
          if (!openId) continue;
          tx.persist(
            new WorkspaceLarkMember({
              id: v7(),
              workspaceId: workspace.id,
              memberId: mapping.memberId,
              openId,
            }),
          );
        }
      }

      // Re-queue previously failed notifications after workspace configuration is changed.
      await tx.nativeUpdate(
        IssueAssignmentOutbox,
        { workspaceId: workspace.id, status: { $in: ['failed', 'needs_config'] } },
        {
          status: 'pending',
          attempts: 0,
          nextAttemptAt: null,
          leaseUntil: null,
          leaseOwner: null,
          lastErrorCode: null,
        },
      );
      await tx.flush();
    });

    return this.get(workspace.id, actorId);
  }

  async claimDeliveries(request: ClaimIssueAssignmentNotificationsRequest) {
    const workerId = request.workerId?.trim();
    if (!workerId) throw new BadRequestException('workerId is required');
    const limit = Math.max(1, Math.min(Number(request.limit) || 5, 20));
    const leaseSeconds = Math.max(15, Math.min(Number(request.leaseSeconds) || 60, 300));

    return this.em.transactional(async (tx) => {
      const now = new Date();
      const events = await tx.find(
        IssueAssignmentOutbox,
        {
          status: 'pending',
          $and: [
            { $or: [{ nextAttemptAt: null }, { nextAttemptAt: { $lte: now } }] },
            { $or: [{ leaseUntil: null }, { leaseUntil: { $lte: now } }] },
          ],
        },
        {
          orderBy: { createdAt: 'ASC' },
          limit,
          lockMode: LockMode.PESSIMISTIC_WRITE,
        },
      );
      const workspaceIds = [...new Set(events.map((event) => event.workspaceId))];
      const assigneeIds = [...new Set(events.map((event) => event.assigneeId))];
      const [integrations, mappings, assignees] = events.length
        ? await Promise.all([
            tx.find(WorkspaceLarkIntegration, {
              workspaceId: { $in: workspaceIds },
              enabled: true,
            }),
            tx.find(WorkspaceLarkMember, {
              workspaceId: { $in: workspaceIds },
              memberId: { $in: assigneeIds },
            }),
            tx.find(Member, { id: { $in: assigneeIds } }),
          ])
        : [[], [], []];
      const integrationByWorkspace = new Map(
        integrations.map((integration) => [integration.workspaceId, integration]),
      );
      const mappingByWorkspaceMember = new Map(
        mappings.map((mapping) => [
          `${mapping.workspaceId}:${mapping.memberId}`,
          mapping,
        ]),
      );
      const assigneeById = new Map(assignees.map((assignee) => [assignee.id, assignee]));
      const deliveries: IssueAssignmentDelivery[] = [];

      for (const event of events) {
        const integration = integrationByWorkspace.get(event.workspaceId);
        const mapping = mappingByWorkspaceMember.get(
          `${event.workspaceId}:${event.assigneeId}`,
        );
        const assignee = assigneeById.get(event.assigneeId);
        const resolution = resolveAssignmentDelivery(
          event,
          integration,
          mapping,
          assignee,
        );
        if (resolution.kind === 'needs_config') {
          event.status = 'needs_config';
          event.lastErrorCode = resolution.errorCode;
          event.leaseUntil = null;
          event.leaseOwner = null;
          continue;
        }

        event.attempts += 1;
        event.leaseOwner = workerId;
        event.leaseUntil = new Date(now.getTime() + leaseSeconds * 1000);
        event.lastErrorCode = null;
        deliveries.push(resolution.delivery);
      }

      await tx.flush();
      return { deliveries };
    });
  }

  async acknowledgeDelivery(id: string, workerId: string) {
    const event = await this.em.findOne(IssueAssignmentOutbox, {
      id,
      status: 'pending',
      leaseOwner: workerId,
    });
    if (!event) return { success: false };
    acknowledgeAssignmentDelivery(event);
    await this.em.flush();
    return { success: true };
  }

  async failDelivery(
    id: string,
    workerId: string,
    errorCode: string,
    retryable: boolean,
  ) {
    const event = await this.em.findOne(IssueAssignmentOutbox, {
      id,
      status: 'pending',
      leaseOwner: workerId,
    });
    if (!event) return { success: false };
    failAssignmentDelivery(event, errorCode, retryable);
    await this.em.flush();
    return { success: true };
  }

  getDecryptedAppSecret(ciphertext: string) {
    return decryptSecret(ciphertext);
  }
}
