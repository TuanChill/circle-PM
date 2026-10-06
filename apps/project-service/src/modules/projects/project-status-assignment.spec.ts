import { BadRequestException } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectStatus } from '../../data-access';

jest.mock('@mikro-orm/core', () => ({ EntityManager: class MockEntityManager {} }));

jest.mock('../../data-access', () => {
  class MockProjectStatus {
    constructor(partial?: Record<string, unknown>) {
      Object.assign(this, partial);
    }
  }
  return {
    Initiative: class MockInitiative {},
    Issue: class MockIssue {},
    Label: class MockLabel {},
    LabelGroup: class MockLabelGroup {},
    Member: class MockMember {},
    Project: class MockProject {},
    ProjectActivity: class MockProjectActivity {},
    ProjectLabel: class MockProjectLabel {},
    ProjectMember: class MockProjectMember {},
    ProjectMilestone: class MockProjectMilestone {},
    ProjectSubscription: class MockProjectSubscription {},
    ProjectStatus: MockProjectStatus,
    ProjectTeam: class MockProjectTeam {},
    ProjectUpdate: class MockProjectUpdate {},
    Team: class MockTeam {},
    Workspace: class MockWorkspace {},
    WorkspaceMember: class MockWorkspaceMember {},
    toSafeMember: (member: unknown) => member,
  };
});

describe('project status assignment', () => {
  it('resolves a custom status in the primary team workspace and uses its category', async () => {
    const customStatus = new ProjectStatus({
      id: '2f3c98ec-35dd-4b51-9db3-455772a24ea0',
      workspaceId: 'workspace-a',
      name: 'Ready for QA',
      color: '#22c55e',
      category: 'started',
      position: 0,
    });
    const em = {
      findOne: jest
        .fn()
        .mockImplementation((entity) =>
          entity === ProjectStatus
            ? Promise.resolve(customStatus)
            : Promise.resolve({ workspaceId: 'workspace-a' }),
        ),
    };
    const service = new ProjectsService(em as never, {} as never);

    const result = await (service as any).resolveProjectStatus(
      customStatus.id,
      'completed',
      'CORE',
    );

    expect(result).toMatchObject({
      id: customStatus.id,
      name: 'Ready for QA',
      category: 'started',
    });
  });

  it('rejects a custom status that does not belong to the project workspace', async () => {
    const em = {
      findOne: jest
        .fn()
        .mockImplementation((entity) =>
          entity === ProjectStatus
            ? Promise.resolve(null)
            : Promise.resolve({ workspaceId: 'workspace-b' }),
        ),
    };
    const service = new ProjectsService(em as never, {} as never);

    await expect(
      (service as any).resolveProjectStatus(
        '2f3c98ec-35dd-4b51-9db3-455772a24ea0',
        'started',
        'CORE',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('retains the unchanged metadata for built-in statuses', async () => {
    const service = new ProjectsService({} as never, {} as never);

    await expect(
      (service as any).resolveProjectStatus('in-progress', 'started', 'CORE'),
    ).resolves.toMatchObject({
      id: 'in-progress',
      name: 'In Progress',
      category: 'started',
    });
    await expect(
      (service as any).resolveProjectStatus('in-progress', 'completed', 'CORE'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not query the UUID status table with legacy project status IDs', async () => {
    const em = { find: jest.fn() };
    const service = new ProjectsService(em as never, {} as never);

    await expect(
      (service as any).findCustomStatuses(['workspace-a'], ['in-progress', 'done']),
    ).resolves.toEqual([]);

    expect(em.find).not.toHaveBeenCalled();
  });

  it('queries custom status metadata only for valid UUID IDs', async () => {
    const customStatusId = '2f3c98ec-35dd-4b51-9db3-455772a24ea0';
    const em = { find: jest.fn().mockResolvedValue([]) };
    const service = new ProjectsService(em as never, {} as never);

    await (service as any).findCustomStatuses(
      ['workspace-a'],
      ['in-progress', 'invalid-status-id', customStatusId],
    );

    expect(em.find).toHaveBeenCalledWith(ProjectStatus, {
      workspaceId: { $in: ['workspace-a'] },
      id: { $in: [customStatusId] },
    });
  });

  it('serializes custom status name, color, and category in project responses', () => {
    const service = new ProjectsService({} as never, {} as never);
    const status = new ProjectStatus({
      id: '2f3c98ec-35dd-4b51-9db3-455772a24ea0',
      workspaceId: 'workspace-a',
      name: 'Ready for QA',
      color: '#22c55e',
      category: 'started',
      position: 0,
    });
    const project = {
      id: 'project-1',
      name: 'Release',
      statusId: status.id,
      statusCategory: 'started',
      healthId: 'on-track',
      priorityId: 'high',
      percentComplete: 20,
      icon: 'Cuboid',
      teamId: 'CORE',
      teamIds: ['CORE'],
    };

    const result = (service as any).transformProject(
      project,
      new Map(),
      new Map(),
      [],
      [],
      [],
      ['CORE'],
      false,
      'workspace-a',
      new Map([[status.id, status]]),
    );

    expect(result.status).toEqual({
      id: status.id,
      name: 'Ready for QA',
      color: '#22c55e',
      category: 'started',
    });
  });
});
