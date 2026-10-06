import type { EntityManager } from '@mikro-orm/core';
import { NotFoundException } from '@nestjs/common';
import { IssuesService } from './issues.service';
import { Issue, IssueComment } from '../../data-access';

jest.mock('@mikro-orm/core', () => ({
  EntityManager: class MockEntityManager {},
  LockMode: { PESSIMISTIC_WRITE: 'pessimistic_write' },
}));

jest.mock('../../data-access', () => {
  class MockIssueComment {
    id?: string;
    issueIdentifier?: string;
    reactions?: unknown[];

    constructor(partial?: Record<string, unknown>) {
      Object.assign(this, partial);
    }
  }

  class MockIssue {
    identifier?: string;
    teamId?: string;

    constructor(partial?: Record<string, unknown>) {
      Object.assign(this, partial);
    }
  }

  return { Issue: MockIssue, IssueComment: MockIssueComment };
});

describe('IssuesService reactions', () => {
  function buildService(comment: IssueComment, accessibleTeamIds = ['team-1']) {
    const issue = new Issue({ identifier: 'ENG-1', teamId: 'team-1' });
    const em = {
      findOne: jest.fn(async (entity: unknown) => {
        if (entity === IssueComment) return comment;
        if (entity === Issue) return issue;
        return null;
      }),
      flush: jest.fn(async () => undefined),
    } as unknown as EntityManager;
    const workspacesService = {
      getAccessibleTeamIds: jest.fn(async () => accessibleTeamIds),
    };
    return {
      em,
      service: new IssuesService(em, workspacesService as never),
    };
  }

  it('removes only the authenticated member from a reaction', async () => {
    const comment = new IssueComment({
      id: 'comment-1',
      issueIdentifier: 'ENG-1',
      reactions: [{ emoji: '👍', count: 2, userIds: ['member-1', 'member-2'] }],
    });
    const { em, service } = buildService(comment);

    await service.removeReaction('comment-1', '👍', 'member-1');

    expect(comment.reactions).toEqual([{ emoji: '👍', count: 1, userIds: ['member-2'] }]);
    expect(em.flush).toHaveBeenCalledTimes(1);
  });

  it('removes the reaction record when the last member toggles it off', async () => {
    const comment = new IssueComment({
      id: 'comment-1',
      issueIdentifier: 'ENG-1',
      reactions: [{ emoji: '👍', count: 1, userIds: ['member-1'] }],
    });
    const { service } = buildService(comment);

    await service.removeReaction('comment-1', '👍', 'member-1');

    expect(comment.reactions).toEqual([]);
  });

  it('does not mutate reactions for an inaccessible issue team', async () => {
    const comment = new IssueComment({
      id: 'comment-1',
      issueIdentifier: 'ENG-1',
      reactions: [{ emoji: '👍', count: 1, userIds: ['member-1'] }],
    });
    const { em, service } = buildService(comment, []);

    await expect(service.removeReaction('comment-1', '👍', 'member-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(em.flush).not.toHaveBeenCalled();
    expect(comment.reactions).toEqual([{ emoji: '👍', count: 1, userIds: ['member-1'] }]);
  });
});
