import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProjectStatusesService } from './project-statuses.service';
import { ProjectStatus } from '../../data-access/project/project-status.entity';

jest.mock('../../data-access/project/project-status.entity', () => ({
  ProjectStatus: class MockProjectStatus {
    constructor(partial?: Record<string, unknown>) {
      Object.assign(this, partial);
    }
  },
}));
jest.mock('@mikro-orm/core', () => ({ EntityManager: class MockEntityManager {} }));
jest.mock('../workspaces/workspaces.service', () => ({
  WorkspacesService: class MockWorkspacesService {},
}));

describe('ProjectStatusesService', () => {
  const workspace = { id: 'workspace-a', role: 'Owner' };
  let em: { find: jest.Mock; persist: jest.Mock; flush: jest.Mock };
  let workspacesService: { findOne: jest.Mock };
  let service: ProjectStatusesService;

  beforeEach(() => {
    em = { find: jest.fn().mockResolvedValue([]), persist: jest.fn(), flush: jest.fn() };
    workspacesService = { findOne: jest.fn().mockResolvedValue(workspace) };
    service = new ProjectStatusesService(em as never, workspacesService as never);
  });

  it('lists only statuses belonging to an accessible workspace', async () => {
    em.find.mockResolvedValue([
      new ProjectStatus({
        id: 'status-a',
        workspaceId: workspace.id,
        name: 'Ready',
        category: 'started',
        color: '#22c55e',
        position: 0,
      }),
    ]);

    const result = await service.findAll('workspace-a', 'member-a');

    expect(workspacesService.findOne).toHaveBeenCalledWith('workspace-a', 'member-a');
    expect(em.find).toHaveBeenCalledWith(
      ProjectStatus,
      { workspaceId: workspace.id },
      expect.any(Object),
    );
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Ready');
  });

  it('creates a trimmed status at the end of its category for a workspace manager', async () => {
    em.find.mockResolvedValue([
      new ProjectStatus({ position: 0, name: 'Existing', category: 'started' }),
      new ProjectStatus({ position: 3, name: 'Review', category: 'started' }),
      new ProjectStatus({ position: 99, name: 'Other category', category: 'backlog' }),
    ]);

    const result = await service.create(
      'workspace-a',
      {
        name: '  QA  ',
        description: '  Verify release  ',
        color: '#22C55E',
        category: 'started',
      },
      'member-a',
    );

    expect(result).toMatchObject({
      workspaceId: workspace.id,
      name: 'QA',
      description: 'Verify release',
      color: '#22c55e',
      category: 'started',
      position: 4,
    });
    expect(em.persist).toHaveBeenCalledWith(
      expect.objectContaining({ id: expect.any(String) }),
    );
    expect(em.flush).toHaveBeenCalledTimes(1);
    expect(em.find).toHaveBeenCalledWith(ProjectStatus, { workspaceId: workspace.id });
  });

  it('rejects members, duplicate names, blank names, and invalid colors', async () => {
    workspacesService.findOne.mockResolvedValue({ ...workspace, role: 'Member' });
    await expect(
      service.create(
        'workspace-a',
        { name: 'Review', color: '#22c55e', category: 'started' },
        'member-a',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    workspacesService.findOne.mockResolvedValue(workspace);
    em.find.mockResolvedValue([
      new ProjectStatus({ name: 'Review', category: 'started' }),
    ]);
    await expect(
      service.create(
        'workspace-a',
        { name: ' review ', color: '#22c55e', category: 'started' },
        'member-a',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create(
        'workspace-a',
        { name: '   ', color: '#22c55e', category: 'started' },
        'member-a',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create(
        'workspace-a',
        { name: 'Valid', color: 'green', category: 'started' },
        'member-a',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
