import type { EntityManager } from '@mikro-orm/core';
import { BadRequestException } from '@nestjs/common';
import { IssueStatusesService } from './issue-statuses.service';
import {
  Issue,
  IssueStatus,
  IssueTemplate,
  Team,
  TeamMember,
  WorkspaceMember,
} from '../../data-access';

jest.mock('@mikro-orm/core', () => ({
  EntityManager: class MockEntityManager {},
}));

jest.mock('../../data-access', () => ({
  Issue: class MockIssue {},
  IssueStatus: class MockIssueStatus {},
  IssueTemplate: class MockIssueTemplate {},
  Team: class MockTeam {},
  TeamMember: class MockTeamMember {},
  WorkspaceMember: class MockWorkspaceMember {},
}));

jest.mock('../workspaces/workspaces.service', () => ({
  WorkspacesService: class WorkspacesService {},
}));

describe('IssueStatusesService', () => {
  const status = {
    id: 'custom-status',
    teamId: 'team-a',
    name: 'Ready for QA',
    color: '#22c55e',
    category: 'started',
    position: 1,
    isDefault: false,
  };

  function buildService(
    templateCount = 0,
    siblingStatuses = [status, { ...status, id: 'other' }],
  ) {
    const team = { id: 'team-a', workspaceId: 'workspace-a' };
    const em = {
      find: jest.fn().mockResolvedValue(siblingStatuses),
      findOne: jest.fn((entity: unknown) => {
        if (entity === Team) return Promise.resolve(team);
        if (entity === WorkspaceMember) return Promise.resolve({ role: 'Admin' });
        if (entity === TeamMember) return Promise.resolve(null);
        if (entity === IssueStatus) return Promise.resolve(status);
        return Promise.resolve(null);
      }),
      count: jest.fn((entity: unknown) =>
        Promise.resolve(entity === Issue ? 0 : templateCount),
      ),
      remove: jest.fn(),
      flush: jest.fn().mockResolvedValue(undefined),
    } as unknown as EntityManager;
    const workspacesService = {
      getAccessibleTeamIds: jest.fn().mockResolvedValue(['team-a']),
    };
    return { service: new IssueStatusesService(em, workspacesService as never), em };
  }

  it('prevents deleting a status referenced by an issue template', async () => {
    const { service, em } = buildService(1);

    await expect(service.remove('team-a', status.id, 'member-a')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(em.count).toHaveBeenCalledWith(Issue, {
      teamId: 'team-a',
      statusId: status.id,
    });
    expect(em.count).toHaveBeenCalledWith(IssueTemplate, {
      config: { statusId: status.id },
      deletedAt: null,
    });
    expect(em.remove).not.toHaveBeenCalled();
    expect(em.flush).not.toHaveBeenCalled();
  });

  it('keeps at least one status in each required lifecycle category', async () => {
    const { service, em } = buildService(0, [status]);

    await expect(service.remove('team-a', status.id, 'member-a')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(em.count).not.toHaveBeenCalled();
    expect(em.remove).not.toHaveBeenCalled();
  });
});
