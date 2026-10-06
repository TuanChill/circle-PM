import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UploadsService } from './uploads.service';
import { FileAttachment, Issue, Project, ProjectTeam, Team } from '../../data-access';

jest.mock('../../data-access', () => {
  class EntityDouble {
    status = 'pending';

    constructor(partial?: Record<string, unknown>) {
      if (partial) Object.assign(this, partial);
    }
  }
  return {
    FileAttachment: EntityDouble,
    Issue: class FakeIssue extends EntityDouble {},
    Project: class FakeProject extends EntityDouble {},
    Team: class FakeTeam extends EntityDouble {},
    ProjectTeam: class FakeProjectTeam extends EntityDouble {},
  };
});

jest.mock('@app/core', () => ({
  AwsS3Service: class AwsS3Service {},
}));

jest.mock('@mikro-orm/core', () => ({
  EntityManager: class EntityManager {},
}));

jest.mock('../workspaces/workspaces.service', () => ({
  WorkspacesService: class WorkspacesService {},
}));

describe('UploadsService', () => {
  const em = {
    findOne: jest.fn(),
    find: jest.fn(),
    persist: jest.fn(),
    flush: jest.fn(),
  };
  const workspacesService = {
    getAccessibleTeamIds: jest.fn(),
  };
  const s3Service = {
    isConfigured: jest.fn(),
    getPresignedUploadUrl: jest.fn(),
    getPresignedDownloadUrl: jest.fn(),
    assertObjectExists: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    s3Service.isConfigured.mockReturnValue(true);
  });

  it('requires exactly one target and never creates an unscoped upload', async () => {
    const service = new UploadsService(
      em as any,
      workspacesService as any,
      s3Service as any,
    );

    await expect(
      service.createPresignedUpload(
        { fileName: 'x.txt', contentType: 'text/plain', fileSize: 1 } as any,
        'member-1',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(em.persist).not.toHaveBeenCalled();
  });

  it('excludes comment-linked files from issue-level attachment results', async () => {
    workspacesService.getAccessibleTeamIds.mockResolvedValue(['team-1']);
    em.findOne.mockImplementation(async (entity: unknown) => {
      if (entity === Issue) return new Issue({ identifier: 'ENG-1', teamId: 'team-1' });
      if (entity === Team) return new Team({ id: 'team-1', workspaceId: 'ws-1' });
      return null;
    });
    em.find.mockResolvedValue([]);
    const service = new UploadsService(
      em as any,
      workspacesService as any,
      s3Service as any,
    );

    await service.findAll('member-1', 'ENG-1');

    expect(em.find).toHaveBeenCalledWith(FileAttachment, {
      workspaceId: 'ws-1',
      status: 'completed',
      issueIdentifier: 'ENG-1',
      teamId: 'team-1',
      commentId: null,
    });
  });

  it('rejects a project outside the member accessible teams', async () => {
    s3Service.isConfigured.mockReturnValue(true);
    workspacesService.getAccessibleTeamIds.mockResolvedValue(['team-a']);
    em.find.mockResolvedValue([]);
    em.findOne.mockImplementation(async (entity: unknown) =>
      entity === Project ? new Project({ id: 'project-b', teamId: 'team-b' }) : null,
    );
    const service = new UploadsService(
      em as any,
      workspacesService as any,
      s3Service as any,
    );

    await expect(
      service.createPresignedUpload(
        {
          fileName: 'x.txt',
          contentType: 'text/plain',
          fileSize: 1,
          projectId: 'project-b',
        },
        'member-1',
      ),
    ).rejects.toThrow(NotFoundException);
    expect(s3Service.getPresignedUploadUrl).not.toHaveBeenCalled();
  });

  it('accepts a project through an accessible secondary team', async () => {
    workspacesService.getAccessibleTeamIds.mockResolvedValue(['team-b']);
    em.findOne.mockImplementation(async (entity: unknown) => {
      if (entity === Project) return new Project({ id: 'project-1', teamId: 'team-a' });
      if (entity === Team) return new Team({ id: 'team-b', workspaceId: 'ws-a' });
      return null;
    });
    em.find.mockImplementation(async (entity: unknown) => {
      if (entity === ProjectTeam)
        return [new ProjectTeam({ projectId: 'project-1', teamId: 'team-b' })];
      if (entity === Team)
        return [
          new Team({ id: 'team-a', workspaceId: 'ws-a' }),
          new Team({ id: 'team-b', workspaceId: 'ws-a' }),
        ];
      return [];
    });
    s3Service.getPresignedUploadUrl.mockResolvedValue({
      uploadUrl: 'https://storage.test/signed',
      fileUrl: 'https://storage.test/project-file',
      fileKey: 'workspaces/ws-a/attachments/project-file.txt',
    });
    const service = new UploadsService(
      em as any,
      workspacesService as any,
      s3Service as any,
    );

    await service.createPresignedUpload(
      {
        fileName: 'project-file.txt',
        contentType: 'text/plain',
        fileSize: 10,
        projectId: 'project-1',
      },
      'member-1',
    );

    expect((em.persist.mock.calls[0][0] as FileAttachment).teamId).toBe('team-b');
  });

  it('allows project attachment access through any accessible project team', async () => {
    workspacesService.getAccessibleTeamIds.mockResolvedValue(['team-b']);
    em.findOne.mockImplementation(async (entity: unknown) => {
      if (entity === Project) return new Project({ id: 'project-1', teamId: 'team-a' });
      if (entity === Team) return new Team({ id: 'team-a', workspaceId: 'ws-a' });
      return null;
    });
    em.find.mockImplementation(async (entity: unknown) => {
      if (entity === ProjectTeam)
        return [new ProjectTeam({ projectId: 'project-1', teamId: 'team-b' })];
      if (entity === Team)
        return [
          new Team({ id: 'team-a', workspaceId: 'ws-a' }),
          new Team({ id: 'team-b', workspaceId: 'ws-a' }),
        ];
      return [];
    });
    const service = new UploadsService(
      em as any,
      workspacesService as any,
      s3Service as any,
    );
    const attachment = new FileAttachment({
      id: 'attachment-1',
      workspaceId: 'ws-a',
      projectId: 'project-1',
      teamId: 'team-a',
    });

    await expect(
      (service as any).assertAttachmentAccess('member-1', attachment),
    ).resolves.toBeUndefined();
  });

  it('lists all completed project attachments across the project teams', async () => {
    workspacesService.getAccessibleTeamIds.mockResolvedValue(['team-b']);
    em.findOne.mockImplementation(async (entity: unknown) => {
      if (entity === Project) return new Project({ id: 'project-1', teamId: 'team-a' });
      if (entity === Team) return new Team({ id: 'team-b', workspaceId: 'ws-a' });
      return null;
    });
    const projectAttachment = new FileAttachment({
      id: 'attachment-1',
      workspaceId: 'ws-a',
      projectId: 'project-1',
      teamId: 'team-a',
      status: 'completed',
    });
    em.find.mockImplementation(async (entity: unknown) => {
      if (entity === ProjectTeam)
        return [new ProjectTeam({ projectId: 'project-1', teamId: 'team-b' })];
      if (entity === Team)
        return [
          new Team({ id: 'team-a', workspaceId: 'ws-a' }),
          new Team({ id: 'team-b', workspaceId: 'ws-a' }),
        ];
      if (entity === FileAttachment) return [projectAttachment];
      return [];
    });
    const service = new UploadsService(
      em as any,
      workspacesService as any,
      s3Service as any,
    );

    await expect(service.findAll('member-1', undefined, 'project-1')).resolves.toEqual([
      expect.objectContaining({ id: 'attachment-1' }),
    ]);
    expect(em.find).toHaveBeenCalledWith(FileAttachment, {
      workspaceId: 'ws-a',
      status: 'completed',
      projectId: 'project-1',
    });
  });

  it('hides project attachments whose team is not a project team', async () => {
    workspacesService.getAccessibleTeamIds.mockResolvedValue(['team-b']);
    const project = new Project({ id: 'project-1', teamId: 'team-a' });
    const visibleAttachment = new FileAttachment({
      id: 'attachment-visible',
      workspaceId: 'ws-a',
      projectId: 'project-1',
      teamId: 'team-a',
      status: 'completed',
    });
    const corruptAttachment = new FileAttachment({
      id: 'attachment-corrupt',
      workspaceId: 'ws-a',
      projectId: 'project-1',
      teamId: 'team-outside-project',
      status: 'completed',
    });
    em.findOne.mockImplementation(
      async (entity: unknown, where?: Record<string, unknown>) => {
        if (entity === Project) return project;
        if (entity === Team) {
          const teamId = where?.id;
          if (teamId === 'team-outside-project')
            return new Team({ id: 'team-outside-project', workspaceId: 'ws-a' });
          if (teamId === 'team-a') return new Team({ id: 'team-a', workspaceId: 'ws-a' });
          return new Team({ id: 'team-b', workspaceId: 'ws-a' });
        }
        return null;
      },
    );
    em.find.mockImplementation(async (entity: unknown) => {
      if (entity === ProjectTeam)
        return [new ProjectTeam({ projectId: 'project-1', teamId: 'team-b' })];
      if (entity === Team)
        return [
          new Team({ id: 'team-a', workspaceId: 'ws-a' }),
          new Team({ id: 'team-b', workspaceId: 'ws-a' }),
        ];
      if (entity === FileAttachment) return [visibleAttachment, corruptAttachment];
      return [];
    });
    const service = new UploadsService(
      em as any,
      workspacesService as any,
      s3Service as any,
    );

    await expect(service.findAll('member-1', undefined, 'project-1')).resolves.toEqual([
      expect.objectContaining({ id: 'attachment-visible' }),
    ]);
  });

  it('rejects a project attachment assigned to a team outside that project', async () => {
    workspacesService.getAccessibleTeamIds.mockResolvedValue(['team-b']);
    const attachment = new FileAttachment({
      id: 'attachment-1',
      workspaceId: 'ws-a',
      projectId: 'project-1',
      teamId: 'team-outside-project',
      status: 'completed',
    });
    em.findOne.mockImplementation(
      async (entity: unknown, where?: Record<string, unknown>) => {
        if (entity === Team) {
          if (where?.id === 'team-outside-project')
            return new Team({ id: 'team-outside-project', workspaceId: 'ws-a' });
          return new Team({ id: 'team-b', workspaceId: 'ws-a' });
        }
        if (entity === Project) return new Project({ id: 'project-1', teamId: 'team-a' });
        return null;
      },
    );
    em.find.mockImplementation(async (entity: unknown) => {
      if (entity === ProjectTeam)
        return [new ProjectTeam({ projectId: 'project-1', teamId: 'team-b' })];
      if (entity === Team)
        return [
          new Team({ id: 'team-a', workspaceId: 'ws-a' }),
          new Team({ id: 'team-b', workspaceId: 'ws-a' }),
        ];
      return [];
    });
    const service = new UploadsService(
      em as any,
      workspacesService as any,
      s3Service as any,
    );

    await expect(
      (service as any).assertAttachmentAccess('member-1', attachment),
    ).rejects.toThrow(NotFoundException);
  });

  it('persists a pending issue upload with the workspace-scoped object key', async () => {
    s3Service.isConfigured.mockReturnValue(true);
    workspacesService.getAccessibleTeamIds.mockResolvedValue(['team-a']);
    s3Service.getPresignedUploadUrl.mockResolvedValue({
      uploadUrl: 'https://storage.test/signed',
      fileUrl: 'https://storage.test/workspaces/ws-a/attachments/1-design.png',
      fileKey: 'workspaces/ws-a/attachments/1-design.png',
    });
    em.findOne.mockImplementation(async (entity: unknown) => {
      if (entity === Issue) return new Issue({ identifier: 'ENG-1', teamId: 'team-a' });
      if (entity === Team) return new Team({ id: 'team-a', workspaceId: 'ws-a' });
      return null;
    });
    const service = new UploadsService(
      em as any,
      workspacesService as any,
      s3Service as any,
    );

    const result = await service.createPresignedUpload(
      {
        fileName: '../design.png',
        contentType: 'image/png',
        fileSize: 42,
        issueIdentifier: 'ENG-1',
      },
      'member-1',
    );

    const persisted = em.persist.mock.calls[0][0] as FileAttachment;
    expect(persisted.status).toBe('pending');
    expect(persisted.workspaceId).toBe('ws-a');
    expect(persisted.teamId).toBe('team-a');
    expect(persisted.issueIdentifier).toBe('ENG-1');
    expect(persisted.fileKey).toBe('workspaces/ws-a/attachments/1-design.png');
    expect(result.uploadUrl).toBe('https://storage.test/signed');
  });

  it('does not mark an upload complete until storage confirms the object exists', async () => {
    workspacesService.getAccessibleTeamIds.mockResolvedValue(['team-a']);
    const attachment = new FileAttachment({
      id: 'attachment-1',
      workspaceId: 'ws-a',
      teamId: 'team-a',
      uploaderId: 'member-1',
      fileName: 'x.txt',
      contentType: 'text/plain',
      fileSize: 1,
      fileKey: 'workspaces/ws-a/attachments/x.txt',
      fileUrl: 'https://storage.test/x.txt',
    });
    em.findOne.mockImplementation(async (entity: unknown) =>
      entity === FileAttachment
        ? attachment
        : new Team({ id: 'team-a', workspaceId: 'ws-a' }),
    );
    s3Service.assertObjectExists.mockRejectedValue(new Error('not found'));
    const service = new UploadsService(
      em as any,
      workspacesService as any,
      s3Service as any,
    );

    await expect(service.complete('attachment-1', 'member-1')).rejects.toThrow(
      'The uploaded object is not available yet',
    );
    expect(attachment.status).toBe('pending');
    expect(em.flush).not.toHaveBeenCalled();
  });

  it('creates a signed download URL only for completed attachments in accessible teams', async () => {
    workspacesService.getAccessibleTeamIds.mockResolvedValue(['team-a']);
    const attachment = new FileAttachment({
      id: 'attachment-1',
      workspaceId: 'ws-a',
      teamId: 'team-a',
      fileName: 'design.png',
      contentType: 'image/png',
      fileKey: 'workspaces/ws-a/attachments/design.png',
      status: 'completed',
    });
    em.findOne.mockImplementation(async (entity: unknown) =>
      entity === FileAttachment
        ? attachment
        : new Team({ id: 'team-a', workspaceId: 'ws-a' }),
    );
    s3Service.getPresignedDownloadUrl.mockResolvedValue('https://storage.test/download');
    const service = new UploadsService(
      em as any,
      workspacesService as any,
      s3Service as any,
    );

    await expect(service.getDownloadUrl('attachment-1', 'member-1')).resolves.toEqual({
      downloadUrl: 'https://storage.test/download',
    });
    expect(s3Service.getPresignedDownloadUrl).toHaveBeenCalledWith(
      'workspaces/ws-a/attachments/design.png',
      'design.png',
      'image/png',
    );
  });

  it('does not create a download URL for pending attachments', async () => {
    em.findOne.mockResolvedValue(
      new FileAttachment({ id: 'attachment-1', status: 'pending' }),
    );
    const service = new UploadsService(
      em as any,
      workspacesService as any,
      s3Service as any,
    );

    await expect(service.getDownloadUrl('attachment-1', 'member-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(s3Service.getPresignedDownloadUrl).not.toHaveBeenCalled();
  });

  it('rejects an issue attachment whose workspace does not match its team', async () => {
    workspacesService.getAccessibleTeamIds.mockResolvedValue(['team-a']);
    const attachment = new FileAttachment({
      id: 'attachment-1',
      workspaceId: 'ws-other',
      teamId: 'team-a',
      issueIdentifier: 'ENG-1',
      status: 'completed',
    });
    em.findOne.mockImplementation(async (entity: unknown) =>
      entity === FileAttachment
        ? attachment
        : new Team({ id: 'team-a', workspaceId: 'ws-a' }),
    );
    const service = new UploadsService(
      em as any,
      workspacesService as any,
      s3Service as any,
    );

    await expect(service.getDownloadUrl('attachment-1', 'member-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(s3Service.getPresignedDownloadUrl).not.toHaveBeenCalled();
  });
});
