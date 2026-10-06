import type { EntityManager } from '@mikro-orm/core';
import { MembersService } from './members.service';
import {
  Member,
  Team,
  Workspace,
  WorkspaceInvitation,
  WorkspaceMember,
} from '../../data-access';

jest.mock('@mikro-orm/core', () => ({ EntityManager: class MockEntityManager {} }));
jest.mock('../../data-access', () => {
  class MockMember {}
  class MockTeam {}
  class MockWorkspace {}
  class MockWorkspaceInvitation {
    id = 'invitation-1';

    constructor(partial?: Record<string, unknown>) {
      Object.assign(this, partial);
      this.id = this.id ?? 'invitation-1';
    }
  }
  return {
    Member: MockMember,
    Team: MockTeam,
    TeamMember: class MockTeamMember {},
    Workspace: MockWorkspace,
    WorkspaceInvitation: MockWorkspaceInvitation,
    WorkspaceMember: class MockWorkspaceMember {},
  };
});

describe('MembersService invitations', () => {
  const originalFrontendUrl = process.env.FRONTEND_URL;

  beforeEach(() => {
    process.env.FRONTEND_URL = 'https://app.example.test';
  });

  afterEach(() => {
    if (originalFrontendUrl === undefined) {
      delete process.env.FRONTEND_URL;
    } else {
      process.env.FRONTEND_URL = originalFrontendUrl;
    }
  });

  it('stores a pending invitation instead of a placeholder member', async () => {
    const workspace = { id: 'workspace-1', name: 'Acme', slug: 'acme' };
    const actor = { id: 'owner-1', name: 'Owner' };
    const persisted: unknown[] = [];
    const em = {
      findOne: jest.fn(async (entity: unknown, where?: Record<string, unknown>) => {
        if (entity === Workspace) return workspace;
        if (entity === WorkspaceMember) return { role: 'Owner' };
        if (entity === Member && where?.id === actor.id) return actor;
        return null;
      }),
      find: jest.fn(async (entity: unknown) =>
        entity === Team ? [{ id: 'team-1', workspaceId: workspace.id }] : [],
      ),
      persist: jest.fn((entity: unknown) => persisted.push(entity)),
      flush: jest.fn().mockResolvedValue(undefined),
    } as unknown as EntityManager;
    const workspacesService = {
      getAccessibleWorkspaceIds: jest.fn().mockResolvedValue([workspace.id]),
    };
    const mailer = { sendMemberInviteEmail: jest.fn().mockResolvedValue(true) };
    const service = new MembersService(
      em,
      mailer as never,
      workspacesService as never,
      {} as never,
    );

    const result = await service.create(
      {
        name: 'Invitee',
        email: 'Invitee@example.com',
        workspaceId: workspace.id,
        teamIds: ['team-1'],
      },
      actor.id,
    );

    expect(result).toEqual(
      expect.objectContaining({
        email: 'invitee@example.com',
        invitationId: expect.any(String),
        inviteUrl: expect.stringMatching(
          /^https:\/\/app\.example\.test\/invite\?token=[^&]+&email=invitee%40example\.com$/,
        ),
      }),
    );
    expect(persisted).toHaveLength(1);
    expect(persisted[0]).toBeInstanceOf(WorkspaceInvitation);
    expect(mailer.sendMemberInviteEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'invitee@example.com',
        inviteToken: expect.any(String),
      }),
    );
    expect(result.inviteUrl).not.toContain('org=');
    expect(result.inviteUrl).not.toContain('/signup');
  });

  it('rejects an invitation without a real invitee name', async () => {
    const em = {
      findOne: jest.fn(),
      find: jest.fn(),
      persist: jest.fn(),
      flush: jest.fn(),
    } as unknown as EntityManager;
    const service = new MembersService(
      em,
      { sendMemberInviteEmail: jest.fn() } as never,
      { getAccessibleWorkspaceIds: jest.fn() } as never,
      {} as never,
    );

    await expect(
      service.create(
        {
          name: '   ',
          email: 'invitee@example.com',
          workspaceId: 'workspace-1',
        },
        'owner-1',
      ),
    ).rejects.toThrow('name is required');
    expect(em.persist).not.toHaveBeenCalled();
  });
});
