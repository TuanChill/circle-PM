import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCommentDto } from './dto/issue.dto';
import { IssuesService } from './issues.service';
import { FileAttachment, Issue, IssueComment, Team } from '../../data-access';

jest.mock('@mikro-orm/core', () => ({
  EntityManager: class EntityManager {},
  LockMode: { PESSIMISTIC_WRITE: 'pessimistic_write' },
}));

jest.mock('../../data-access', () => {
  const createEntity = () =>
    class EntityDouble {
      constructor(partial?: Record<string, unknown>) {
        if (partial) Object.assign(this, partial);
      }
    };
  return {
    FileAttachment: createEntity(),
    Issue: createEntity(),
    IssueComment: createEntity(),
    Team: createEntity(),
  };
});

describe('IssuesService comment attachments', () => {
  const issue = new Issue({ identifier: 'ENG-1', teamId: 'team-1' });
  const team = new Team({ id: 'team-1', workspaceId: 'workspace-1' });

  function buildService(attachments: FileAttachment[]) {
    const transactionalEm = {
      find: jest.fn(async () => attachments),
      persist: jest.fn(),
      flush: jest.fn(),
    };
    const em = {
      findOne: jest.fn(async (entity: unknown) => {
        if (entity === Issue) return issue;
        if (entity === Team) return team;
        return null;
      }),
      transactional: jest.fn(async (callback: (em: typeof transactionalEm) => unknown) =>
        callback(transactionalEm),
      ),
      find: jest.fn(async () => []),
      flush: jest.fn(),
    };
    const workspacesService = {
      getAccessibleTeamIds: jest.fn(async () => ['team-1']),
    };
    return {
      transactionalEm,
      em,
      service: new IssuesService(em as never, workspacesService as never),
    };
  }

  const validAttachment = (partial: Record<string, unknown> = {}) =>
    new FileAttachment({
      id: 'file-1',
      status: 'completed',
      issueIdentifier: 'ENG-1',
      projectId: null,
      teamId: 'team-1',
      workspaceId: 'workspace-1',
      uploaderId: 'member-1',
      commentId: null,
      ...partial,
    });

  it.each([
    ['upload is incomplete', { status: 'pending' }],
    ['upload belongs to another issue', { issueIdentifier: 'ENG-2' }],
    ['upload is linked to a project', { projectId: 'project-1' }],
    ['upload belongs to another team', { teamId: 'team-2' }],
    ['upload belongs to another workspace', { workspaceId: 'workspace-2' }],
    ['upload belongs to another member', { uploaderId: 'member-2' }],
    ['upload is already linked', { commentId: 'comment-existing' }],
  ])('rejects the full comment when an attachment %s', async (_case, invalid) => {
    const { service, transactionalEm } = buildService([
      validAttachment(),
      validAttachment({ ...invalid, id: 'file-2' }),
    ]);

    await expect(
      service.addComment(
        'ENG-1',
        { textContent: 'Comment with files', attachmentIds: ['file-1', 'file-2'] },
        'member-1',
      ),
    ).rejects.toThrow(BadRequestException);

    expect(transactionalEm.persist).not.toHaveBeenCalled();
    expect(transactionalEm.flush).not.toHaveBeenCalled();
  });

  it('rejects attachment-only comments', async () => {
    const { service } = buildService([validAttachment()]);

    await expect(
      service.addComment('ENG-1', { attachmentIds: ['file-1'] }, 'member-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('limits a comment to ten unique attachment IDs', async () => {
    const dto = plainToInstance(CreateCommentDto, {
      textContent: 'Comment with files',
      attachmentIds: Array.from({ length: 11 }, (_, index) => `file-${index}`),
    });

    const errors = await validate(dto);

    const attachmentError = errors.find((error) => error.property === 'attachmentIds');
    expect(attachmentError?.constraints).toHaveProperty('arrayMaxSize');
  });

  it('requires attachment IDs to be UUIDs', async () => {
    const validDto = plainToInstance(CreateCommentDto, {
      textContent: 'Comment with a file',
      attachmentIds: ['01890f3e-7cc5-7abc-8def-0123456789ab'],
    });
    await expect(validate(validDto)).resolves.toHaveLength(0);

    const dto = plainToInstance(CreateCommentDto, {
      textContent: 'Comment with a file',
      attachmentIds: ['not-a-uuid'],
    });

    const errors = await validate(dto);

    expect(
      errors.find((error) => error.property === 'attachmentIds')?.constraints,
    ).toHaveProperty('isUuid');
  });

  it('claims all valid uploads on the new comment in one transaction', async () => {
    const attachment = validAttachment();
    const { service, transactionalEm, em } = buildService([attachment]);
    transactionalEm.persist.mockImplementation((comment: IssueComment) => {
      comment.id = 'comment-1';
    });
    Object.assign(service, {
      getMemberIdsForTeam: async () => new Set<string>(),
      ensureSubscription: async () => undefined,
      resolveRecipients: async () => [],
      notifyMany: async () => undefined,
      findDetail: async () => ({ identifier: 'ENG-1' }),
    });

    await service.addComment(
      'ENG-1',
      { textContent: 'Comment with an attachment', attachmentIds: ['file-1'] },
      'member-1',
    );

    expect(attachment.commentId).toBe('comment-1');
    expect(transactionalEm.find).toHaveBeenCalledWith(
      FileAttachment,
      { id: { $in: ['file-1'] } },
      { lockMode: 'pessimistic_write' },
    );
    expect(transactionalEm.flush).toHaveBeenCalledTimes(1);
    expect(em.flush).toHaveBeenCalledTimes(1);
  });
});
