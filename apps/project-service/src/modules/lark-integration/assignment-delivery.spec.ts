import {
  acknowledgeAssignmentDelivery,
  AssignmentDeliveryEvent,
  failAssignmentDelivery,
  resolveAssignmentDelivery,
} from './assignment-delivery';

describe('workspace-scoped assignment delivery', () => {
  it('resolves the event workspace app and exact member mapping', () => {
    const event = createEvent();
    const integration = {
      workspaceId: 'workspace-2',
      appId: 'app-2',
      appSecretCiphertext: 'secret-2',
      domain: 'https://open.larksuite.com',
      groupChatId: 'chat-2',
    };
    const memberOneMapping = {
      workspaceId: 'workspace-1',
      memberId: 'member-1',
      openId: 'ou-1',
    };
    const assignee = { name: 'Member One' };

    expect(
      resolveAssignmentDelivery(event, integration, memberOneMapping, assignee),
    ).toEqual({
      kind: 'needs_config',
      errorCode: 'workspace_lark_integration_disabled_or_missing',
    });
    expect(
      resolveAssignmentDelivery(
        event,
        {
          ...integration,
          workspaceId: 'workspace-1',
          appId: 'app-1',
          groupChatId: 'chat-1',
        },
        { ...memberOneMapping, memberId: 'member-2' },
        assignee,
      ),
    ).toEqual({ kind: 'needs_config', errorCode: 'assignee_lark_mapping_missing' });
    expect(
      resolveAssignmentDelivery(
        event,
        {
          ...integration,
          workspaceId: 'workspace-1',
          appId: 'app-1',
          groupChatId: 'chat-1',
        },
        memberOneMapping,
        assignee,
      ),
    ).toEqual({
      kind: 'ready',
      delivery: expect.objectContaining({
        workspaceId: 'workspace-1',
        appId: 'app-1',
        groupChatId: 'chat-1',
        openId: 'ou-1',
      }),
    });
  });

  it('acknowledges sent deliveries and schedules bounded retries', () => {
    const event = createEvent();
    event.attempts = 2;
    event.leaseOwner = 'worker-1';
    event.leaseUntil = new Date('2026-01-01T00:01:00.000Z');
    const now = new Date('2026-01-01T00:00:00.000Z');

    failAssignmentDelivery(event, 'temporary_error', true, now);
    expect(event.status).toBe('pending');
    expect(event.nextAttemptAt).toEqual(new Date('2026-01-01T00:00:10.000Z'));
    expect(event.leaseOwner).toBeNull();

    event.status = 'pending';
    event.leaseOwner = 'worker-1';
    acknowledgeAssignmentDelivery(event, now);
    expect(event.status).toBe('sent');
    expect(event.sentAt).toBe(now);
    expect(event.lastErrorCode).toBeNull();
  });

  it('marks non-retryable and exhausted deliveries failed', () => {
    const event = createEvent();
    event.attempts = 8;

    failAssignmentDelivery(event, 'permanent_error', true, new Date());
    expect(event.status).toBe('failed');
    expect(event.nextAttemptAt).toBeNull();
  });
});

function createEvent(): AssignmentDeliveryEvent {
  return {
    id: 'event-1',
    workspaceId: 'workspace-1',
    issueIdentifier: 'CIR-1',
    issueTitle: 'Title',
    assigneeId: 'member-1',
    attempts: 0,
    status: 'pending',
  };
}
