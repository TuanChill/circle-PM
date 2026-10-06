import type { EntityManager } from '@mikro-orm/core';
import { ProjectTemplatesService } from './project-templates.service';
import {
  ProjectTemplate,
  Team,
  TeamMember,
  Workspace,
  WorkspaceMember,
} from '../../data-access';
import type { ProjectTemplateConfig } from '../../data-access';

jest.mock('@mikro-orm/core', () => ({
  EntityManager: class MockEntityManager {},
}));

jest.mock('../issues/issues.service', () => ({
  IssuesService: class MockIssuesService {},
}));

jest.mock('../projects/projects.service', () => ({
  ProjectsService: class MockProjectsService {},
}));

jest.mock('../workspaces/workspaces.service', () => ({
  WorkspacesService: class MockWorkspacesService {},
}));

jest.mock('../../data-access', () => {
  class MockProjectTemplate {
    constructor(partial?: Record<string, unknown>) {
      Object.assign(this, partial);
    }
  }
  class MockTeam {}
  class MockTeamMember {}
  class MockWorkspace {}
  class MockWorkspaceMember {}
  class MockInitiative {}
  class MockLabel {}
  class MockLabelGroup {}
  class MockProjectMember {}
  return {
    Initiative: MockInitiative,
    Label: MockLabel,
    LabelGroup: MockLabelGroup,
    ProjectMember: MockProjectMember,
    ProjectTemplate: MockProjectTemplate,
    Team: MockTeam,
    TeamMember: MockTeamMember,
    Workspace: MockWorkspace,
    WorkspaceMember: MockWorkspaceMember,
  };
});

describe('ProjectTemplatesService.instantiate', () => {
  function buildService(
    issuesService: { create: jest.Mock; addRelation?: jest.Mock },
    config: ProjectTemplateConfig = {
      issues: [
        { key: 'root', title: 'Root issue' },
        { key: 'child', title: 'Child issue', parentKey: 'root' },
      ],
    },
    access: {
      memberId: string;
      workspaceOwnerId: string;
      workspaceRole?: string;
      teamRole?: string;
    } = {
      memberId: 'member-1',
      workspaceOwnerId: 'member-1',
      workspaceRole: 'Owner',
      teamRole: 'member',
    },
  ) {
    let rolledBack = false;
    const template = new ProjectTemplate({
      id: 'template-1',
      workspaceId: 'workspace-1',
      name: 'Launch',
      scope: 'workspace',
      createdBy: 'member-1',
      config,
    });
    const em = {
      findOne: jest.fn(async (entity: unknown, where?: Record<string, unknown>) => {
        if (entity === ProjectTemplate)
          return where?.id === 'template-1' ? template : null;
        if (entity === Workspace)
          return {
            id: 'workspace-1',
            slug: 'workspace',
            ownerId: access.workspaceOwnerId,
          };
        if (entity === WorkspaceMember) {
          if (where?.memberId !== access.memberId) return null;
          return {
            workspaceId: 'workspace-1',
            memberId: access.memberId,
            role: access.workspaceRole,
          };
        }
        if (entity === TeamMember) {
          if (where?.memberId !== access.memberId) return null;
          return { teamId: 'team-1', memberId: access.memberId, role: access.teamRole };
        }
        if (entity === Team) return { id: 'team-1', workspaceId: 'workspace-1' };
        return null;
      }),
      find: jest.fn(async () => []),
      persist: jest.fn(),
      flush: jest.fn(async () => undefined),
      transactional: jest.fn(async (callback: () => Promise<unknown>) => {
        try {
          return await callback();
        } catch (error) {
          rolledBack = true;
          throw error;
        }
      }),
    } as unknown as EntityManager;
    const projectsService = {
      create: jest.fn(async () => ({ id: 'project-1' })),
      findOne: jest.fn(async () => ({ milestones: [] })),
      addMilestone: jest.fn(async () => ({
        milestones: [{ id: 'milestone-1', name: 'Kickoff' }],
      })),
    };
    const workspacesService = {
      getAccessibleTeamIds: jest.fn(async () => ['team-1']),
    };

    const service = new ProjectTemplatesService(
      em,
      workspacesService as never,
      projectsService as never,
      issuesService as never,
    );

    return { service, em, projectsService, rolledBack: () => rolledBack };
  }

  it('blocks a regular workspace member from creating a workspace template', async () => {
    const { service, em } = buildService(
      { create: jest.fn(), addRelation: jest.fn() },
      undefined,
      {
        memberId: 'member-2',
        workspaceOwnerId: 'owner-1',
        workspaceRole: 'Member',
        teamRole: 'member',
      },
    );

    await expect(
      service.create(
        {
          workspaceId: 'workspace-1',
          name: 'Workspace template',
          scope: 'workspace',
          config: {},
        },
        'member-2',
      ),
    ).rejects.toThrow('Workspace workspace-1 not found');
    expect(em.persist).not.toHaveBeenCalled();
  });

  it('allows a team lead to create a team template', async () => {
    const { service, em } = buildService(
      { create: jest.fn(), addRelation: jest.fn() },
      undefined,
      {
        memberId: 'member-2',
        workspaceOwnerId: 'owner-1',
        workspaceRole: 'Member',
        teamRole: 'lead',
      },
    );

    await expect(
      service.create(
        {
          workspaceId: 'workspace-1',
          name: 'Team template',
          scope: 'team',
          teamId: 'team-1',
          config: {},
        },
        'member-2',
      ),
    ).resolves.toEqual(expect.objectContaining({ teamId: 'team-1' }));
    expect(em.flush).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid template references before persisting a template', async () => {
    const { service, em } = buildService({ create: jest.fn(), addRelation: jest.fn() });

    await expect(
      service.create(
        {
          workspaceId: 'workspace-1',
          name: 'Invalid template',
          scope: 'workspace',
          config: {
            issues: [{ key: 'root', title: 'Root issue' }],
            relations: [
              { sourceKey: 'root', targetKey: 'missing', relationType: 'relates_to' },
            ],
          },
        },
        'member-1',
      ),
    ).rejects.toThrow('Template contains invalid references');

    expect(em.persist).not.toHaveBeenCalled();
    expect(em.flush).not.toHaveBeenCalled();
  });

  it('rejects invalid template updates before flushing the existing template', async () => {
    const { service, em } = buildService({ create: jest.fn(), addRelation: jest.fn() });

    await expect(
      service.update(
        'template-1',
        {
          config: {
            issues: [{ key: 'root', title: 'Root issue' }],
            relations: [
              { sourceKey: 'root', targetKey: 'missing', relationType: 'relates_to' },
            ],
          },
        },
        'member-1',
      ),
    ).rejects.toThrow('Template contains invalid references');

    expect(em.flush).not.toHaveBeenCalled();
  });

  it('rejects duplicating a legacy template with invalid references', async () => {
    const { service, em } = buildService(
      { create: jest.fn(), addRelation: jest.fn() },
      {
        issues: [{ key: 'root', title: 'Root issue' }],
        relations: [
          { sourceKey: 'root', targetKey: 'missing', relationType: 'relates_to' },
        ],
      },
    );

    await expect(service.duplicate('template-1', 'member-1')).rejects.toThrow(
      'Template contains invalid references',
    );

    expect(em.persist).not.toHaveBeenCalled();
    expect(em.flush).not.toHaveBeenCalled();
  });

  it('remaps parent references to newly created issue IDs', async () => {
    const issuesService = {
      create: jest
        .fn()
        .mockResolvedValueOnce({ id: 'issue-root' })
        .mockResolvedValueOnce({ id: 'issue-child' }),
    };
    const { service, projectsService } = buildService(issuesService);

    await service.instantiate(
      'template-1',
      { name: 'Launch copy', teamId: 'team-1' },
      'member-1',
    );

    expect(issuesService.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ parentIssueId: 'issue-root', projectId: 'project-1' }),
      'member-1',
    );
    expect(projectsService.findOne).toHaveBeenCalledWith('project-1', 'member-1');
  });

  it('passes a saved custom project status through the workspace template flow', async () => {
    const { service, projectsService } = buildService(
      { create: jest.fn() },
      {
        project: {
          statusId: '2f3c98ec-35dd-4b51-9db3-455772a24ea0',
          statusCategory: 'completed',
        },
        issues: [],
      },
    );

    await service.instantiate(
      'template-1',
      { name: 'Launch copy', teamId: 'team-1' },
      'member-1',
    );

    expect(projectsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        statusId: '2f3c98ec-35dd-4b51-9db3-455772a24ea0',
        statusCategory: 'completed',
      }),
      'member-1',
    );
  });

  it('remaps cloned issue milestones to the new milestone name', async () => {
    const issuesService = { create: jest.fn().mockResolvedValue({ id: 'issue-1' }) };
    const { service, projectsService } = buildService(issuesService, {
      milestones: [{ key: 'kickoff', name: 'Kickoff' }],
      issues: [{ key: 'root', title: 'Root issue', milestoneKey: 'kickoff' }],
    });
    projectsService.findOne.mockResolvedValue({
      milestones: [{ id: 'milestone-1', name: 'Kickoff' }],
    });

    await service.instantiate(
      'template-1',
      { name: 'Launch copy', teamId: 'team-1' },
      'member-1',
    );

    expect(issuesService.create).toHaveBeenCalledWith(
      expect.objectContaining({ milestone: 'Kickoff' }),
      'member-1',
    );
  });

  it('keeps the transaction failure visible so all cloned records can roll back', async () => {
    const issuesService = {
      create: jest
        .fn()
        .mockResolvedValueOnce({ id: 'issue-root' })
        .mockRejectedValueOnce(new Error('invalid cloned issue')),
    };
    const { service, em, projectsService, rolledBack } = buildService(issuesService);

    await expect(
      service.instantiate(
        'template-1',
        { name: 'Broken copy', teamId: 'team-1' },
        'member-1',
      ),
    ).rejects.toThrow('invalid cloned issue');

    expect(em.transactional).toHaveBeenCalledTimes(1);
    expect(rolledBack()).toBe(true);
    expect(projectsService.findOne).not.toHaveBeenCalled();
  });

  it('remaps template issue relations to the newly created identifiers', async () => {
    const issuesService = {
      create: jest
        .fn()
        .mockResolvedValueOnce({ id: 'issue-root', identifier: 'ENG-101' })
        .mockResolvedValueOnce({ id: 'issue-other', identifier: 'ENG-102' }),
      addRelation: jest.fn().mockResolvedValue({}),
    };
    const { service } = buildService(issuesService, {
      issues: [
        { key: 'root', title: 'Root issue' },
        { key: 'other', title: 'Other issue' },
      ],
      relations: [{ sourceKey: 'root', targetKey: 'other', relationType: 'blocks' }],
    });

    await service.instantiate(
      'template-1',
      { name: 'Launch copy', teamId: 'team-1' },
      'member-1',
    );

    expect(issuesService.addRelation).toHaveBeenCalledWith(
      'ENG-101',
      { targetIdentifier: 'ENG-102', relationType: 'blocks' },
      'member-1',
    );
  });

  it('rejects relations that reference an issue outside the template', async () => {
    const issuesService = {
      create: jest.fn(),
      addRelation: jest.fn(),
    };
    const { service } = buildService(issuesService, {
      issues: [{ key: 'root', title: 'Root issue' }],
      relations: [
        { sourceKey: 'root', targetKey: 'missing', relationType: 'relates_to' },
      ],
    });

    await expect(
      service.instantiate(
        'template-1',
        { name: 'Invalid copy', teamId: 'team-1' },
        'member-1',
      ),
    ).rejects.toThrow('Template contains invalid references');
    expect(issuesService.create).not.toHaveBeenCalled();
  });

  it('rejects duplicate issue keys before cloning any records', async () => {
    const issuesService = { create: jest.fn(), addRelation: jest.fn() };
    const { service, em } = buildService(issuesService, {
      issues: [
        { key: 'duplicate', title: 'First issue' },
        { key: 'duplicate', title: 'Second issue' },
      ],
    });

    await expect(
      service.instantiate(
        'template-1',
        { name: 'Invalid copy', teamId: 'team-1' },
        'member-1',
      ),
    ).rejects.toThrow('duplicateIssueKey');
    expect(issuesService.create).not.toHaveBeenCalled();
    expect(em.transactional).not.toHaveBeenCalled();
  });
});
