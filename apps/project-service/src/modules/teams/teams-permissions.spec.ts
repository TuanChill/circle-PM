import type { EntityManager } from '@mikro-orm/core';
import { TeamsService } from './teams.service';
import { Member, Team, TeamMember, Workspace, WorkspaceMember } from '../../data-access';

jest.mock('@mikro-orm/core', () => ({ EntityManager: class MockEntityManager {} }));
jest.mock('../../data-access', () => {
  class MockTeam {
    id = '';
    name = '';
    workspaceId?: string;

    constructor(partial?: Record<string, unknown>) {
      Object.assign(this, partial);
    }
  }
  return {
    Member: class MockMember {},
    Project: class MockProject {},
    Team: MockTeam,
    TeamMember: class MockTeamMember {
      teamId = '';
      memberId = '';
      role = '';
      joinedAt?: Date;

      constructor(partial?: Record<string, unknown>) {
        Object.assign(this, partial);
      }
    },
    Workspace: class MockWorkspace {},
    WorkspaceMember: class MockWorkspaceMember {},
    toSafeMember: (member: unknown) => member,
  };
});

describe('TeamsService role permissions', () => {
  it('reports that a regular member cannot manage team members', async () => {
    const team = new Team({
      id: 'team-1',
      name: 'Engineering',
      workspaceId: 'workspace-1',
    });
    const em = {
      findOne: jest.fn(async (entity: unknown) => (entity === Team ? team : null)),
      find: jest.fn(async (entity: unknown) => {
        if (entity === TeamMember) return [{ memberId: 'member-1', role: 'member' }];
        if (entity === WorkspaceMember) return [{ memberId: 'member-1', role: 'Member' }];
        return [];
      }),
    } as unknown as EntityManager;
    const workspacesService = {
      getAccessibleTeamIds: jest.fn().mockResolvedValue(['team-1']),
    };
    const service = new TeamsService(em, workspacesService as never);

    await expect(service.findOne('team-1', 'member-1')).resolves.toMatchObject({
      id: 'team-1',
      canManageMembers: false,
    });
  });

  it('does not let a visible regular member update team settings', async () => {
    const team = new Team({
      id: 'team-1',
      name: 'Engineering',
      workspaceId: 'workspace-1',
    });
    const em = {
      findOne: jest.fn(async (entity: unknown) => {
        if (entity === Team) return team;
        if (entity === WorkspaceMember) return { role: 'Member' };
        if (entity === TeamMember) return { role: 'member' };
        return null;
      }),
      flush: jest.fn(),
    } as unknown as EntityManager;
    const workspacesService = {
      getAccessibleTeamIds: jest.fn().mockResolvedValue(['team-1']),
    };
    const service = new TeamsService(em, workspacesService as never);

    await expect(
      service.update('team-1', { name: 'Changed' }, 'member-1'),
    ).rejects.toThrow('Team team-1 not found');
    expect(em.flush).not.toHaveBeenCalled();
  });

  it('does not let a team lead delete the team', async () => {
    const team = new Team({
      id: 'team-1',
      name: 'Engineering',
      workspaceId: 'workspace-1',
    });
    const em = {
      findOne: jest.fn(async (entity: unknown) => {
        if (entity === Team) return team;
        if (entity === WorkspaceMember) return { role: 'Member' };
        if (entity === TeamMember) return { role: 'lead' };
        return null;
      }),
      flush: jest.fn(),
    } as unknown as EntityManager;
    const workspacesService = {
      getAccessibleTeamIds: jest.fn().mockResolvedValue(['team-1']),
    };
    const service = new TeamsService(em, workspacesService as never);

    await expect(service.delete('team-1', 'member-1')).rejects.toThrow(
      'Team team-1 not found',
    );
    expect(em.flush).not.toHaveBeenCalled();
  });

  it('rejects a duplicate explicit team key instead of changing it silently', async () => {
    const existingTeam = new Team({
      id: 'ENG',
      name: 'Existing Engineering',
      workspaceId: 'workspace-1',
    });
    const em = {
      findOne: jest.fn(async (entity: unknown) => {
        if (entity === Workspace) return { id: 'workspace-1', ownerId: 'member-1' };
        if (entity === WorkspaceMember) return { role: 'Owner' };
        if (entity === Team) return existingTeam;
        return null;
      }),
      persist: jest.fn(),
      flush: jest.fn(),
    } as unknown as EntityManager;
    const workspacesService = {
      getAccessibleWorkspaceIds: jest.fn().mockResolvedValue(['workspace-1']),
    };
    const service = new TeamsService(em, workspacesService as never);

    await expect(
      service.create(
        { id: 'ENG', name: 'New Engineering', workspaceId: 'workspace-1' },
        'member-1',
      ),
    ).rejects.toThrow('Team key ENG is already in use');
    expect(em.persist).not.toHaveBeenCalled();
    expect(em.flush).not.toHaveBeenCalled();
  });

  it('lets an accessible workspace member join and leave their own team', async () => {
    const team = new Team({
      id: 'team-1',
      name: 'Engineering',
      workspaceId: 'workspace-1',
    });
    let membership: InstanceType<typeof TeamMember> | null = null;
    const em = {
      findOne: jest.fn(async (entity: unknown) => {
        if (entity === Team) return team;
        if (entity === TeamMember) return membership;
        return null;
      }),
      find: jest.fn(async (entity: unknown) => {
        if (entity === TeamMember) return membership ? [membership] : [];
        return [];
      }),
      persist: jest.fn((record: InstanceType<typeof TeamMember>) => {
        membership = record;
      }),
      remove: jest.fn(() => {
        membership = null;
      }),
      flush: jest.fn(),
    } as unknown as EntityManager;
    const workspacesService = {
      getAccessibleTeamIds: jest.fn().mockResolvedValue(['team-1']),
    };
    const service = new TeamsService(em, workspacesService as never);

    await expect(service.toggleJoin('team-1', 'member-1')).resolves.toMatchObject({
      id: 'team-1',
      joined: true,
    });
    expect(em.persist).toHaveBeenCalledWith(
      expect.objectContaining({ teamId: 'team-1', memberId: 'member-1', role: 'member' }),
    );

    await expect(service.toggleJoin('team-1', 'member-1')).resolves.toMatchObject({
      id: 'team-1',
      joined: false,
    });
    expect(em.remove).toHaveBeenCalledWith(
      expect.objectContaining({ teamId: 'team-1', memberId: 'member-1' }),
    );
    expect(em.flush).toHaveBeenCalledTimes(2);
  });

  it('does not let a regular workspace member add another team member', async () => {
    const team = new Team({
      id: 'team-1',
      name: 'Engineering',
      workspaceId: 'workspace-1',
    });
    const em = {
      findOne: jest.fn(async (entity: unknown) => {
        if (entity === Team) return team;
        if (entity === WorkspaceMember) return { role: 'Member' };
        if (entity === TeamMember) return { role: 'member' };
        return null;
      }),
      persist: jest.fn(),
      flush: jest.fn(),
    } as unknown as EntityManager;
    const workspacesService = {
      getAccessibleTeamIds: jest.fn().mockResolvedValue(['team-1']),
    };
    const service = new TeamsService(em, workspacesService as never);

    await expect(
      service.addMember('team-1', { memberId: 'member-2' }, 'member-1'),
    ).rejects.toThrow('Team team-1 not found');
    expect(em.persist).not.toHaveBeenCalled();
    expect(em.flush).not.toHaveBeenCalled();
  });

  it('lets a workspace admin add another workspace member to a team', async () => {
    const team = new Team({
      id: 'team-1',
      name: 'Engineering',
      workspaceId: 'workspace-1',
    });
    let addedMembership: InstanceType<typeof TeamMember> | null = null;
    const em = {
      findOne: jest.fn(async (entity: unknown, where?: Record<string, unknown>) => {
        if (entity === Team) return team;
        if (entity === WorkspaceMember) {
          return where?.memberId === 'member-2'
            ? { memberId: 'member-2', role: 'Member' }
            : { memberId: 'admin-1', role: 'Admin' };
        }
        if (entity === TeamMember) {
          return where?.memberId === 'admin-1' ? { role: 'member' } : addedMembership;
        }
        return null;
      }),
      find: jest.fn(async (entity: unknown) => {
        if (entity === TeamMember) return addedMembership ? [addedMembership] : [];
        if (entity === WorkspaceMember) {
          return [
            { memberId: 'admin-1', role: 'Admin' },
            { memberId: 'member-2', role: 'Member' },
          ];
        }
        if (entity === Member) {
          return [
            {
              id: 'member-2',
              email: 'member@example.com',
              name: 'Member Two',
              avatarUrl: '',
              status: 'offline',
              role: 'Member',
              timezone: 'UTC',
              joinedDate: new Date(),
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ];
        }
        return [];
      }),
      persist: jest.fn((record: InstanceType<typeof TeamMember>) => {
        addedMembership = record;
      }),
      flush: jest.fn(),
    } as unknown as EntityManager;
    const workspacesService = {
      getAccessibleTeamIds: jest.fn().mockResolvedValue(['team-1']),
    };
    const service = new TeamsService(em, workspacesService as never);

    await expect(
      service.addMember('team-1', { memberId: 'member-2' }, 'admin-1'),
    ).resolves.toMatchObject({
      id: 'team-1',
      joined: false,
      canManageMembers: true,
    });
    expect(em.persist).toHaveBeenCalledWith(
      expect.objectContaining({ teamId: 'team-1', memberId: 'member-2', role: 'member' }),
    );
    expect(em.flush).toHaveBeenCalledTimes(1);
  });
});
