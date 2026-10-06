import type { EntityManager } from '@mikro-orm/core';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MembersService } from './members.service';
import { Workspace, WorkspaceMember } from '../../data-access';

jest.mock('@mikro-orm/core', () => ({ EntityManager: class MockEntityManager {} }));
jest.mock('../../data-access', () => ({
  Member: class MockMember {},
  Team: class MockTeam {},
  TeamMember: class MockTeamMember {},
  Workspace: class MockWorkspace {},
  WorkspaceInvitation: class MockWorkspaceInvitation {},
  WorkspaceMember: class MockWorkspaceMember {},
}));

describe('MembersService role permissions', () => {
  it('rejects an unscoped role change instead of mutating the global member record', async () => {
    const member = { id: 'member-1', name: 'Member' };
    const em = {
      findOne: jest.fn().mockResolvedValue(member),
      flush: jest.fn(),
    } as unknown as EntityManager;
    const service = new MembersService(
      em,
      { sendMemberInviteEmail: jest.fn() } as never,
      { getAccessibleWorkspaceIds: jest.fn() } as never,
      {} as never,
    );
    jest.spyOn(service, 'findOne').mockResolvedValue(member as never);

    await expect(
      service.update('member-1', { role: 'Admin' }, 'actor-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(em.flush).not.toHaveBeenCalled();
    expect(member).toEqual({ id: 'member-1', name: 'Member' });
  });

  it('rejects profile changes to another member', async () => {
    const member = { id: 'member-1', name: 'Member' };
    const em = {
      findOne: jest.fn().mockResolvedValue(member),
      flush: jest.fn(),
    } as unknown as EntityManager;
    const service = new MembersService(
      em,
      { sendMemberInviteEmail: jest.fn() } as never,
      { getAccessibleWorkspaceIds: jest.fn() } as never,
      {} as never,
    );
    jest.spyOn(service, 'findOne').mockResolvedValue(member as never);

    await expect(
      service.update('member-1', { name: 'Changed by someone else' }, 'actor-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(em.flush).not.toHaveBeenCalled();
    expect(member).toEqual({ id: 'member-1', name: 'Member' });
  });

  it('does not allow changing the workspace owner role', async () => {
    const member = { id: 'owner-1', name: 'Owner' };
    const targetMembership = {
      workspaceId: 'workspace-1',
      memberId: 'owner-1',
      role: 'Owner',
    };
    const em = {
      findOne: jest.fn(async (entity: unknown) => {
        if (entity === Workspace) return { id: 'workspace-1', ownerId: 'owner-1' };
        if (entity === WorkspaceMember) return targetMembership;
        return member;
      }),
      flush: jest.fn(),
    } as unknown as EntityManager;
    const service = new MembersService(
      em,
      { sendMemberInviteEmail: jest.fn() } as never,
      {
        getAccessibleWorkspaceIds: jest.fn().mockResolvedValue(['workspace-1']),
      } as never,
      {} as never,
    );
    jest.spyOn(service, 'findOne').mockResolvedValue(member as never);

    await expect(
      service.update(
        'owner-1',
        {
          role: 'Member',
          workspaceId: 'workspace-1',
        },
        'admin-1',
      ),
    ).rejects.toThrow('workspace owner role cannot be changed');
    expect(em.flush).not.toHaveBeenCalled();
    expect(targetMembership.role).toBe('Owner');
  });
});
