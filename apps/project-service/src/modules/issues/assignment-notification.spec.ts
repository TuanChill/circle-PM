import { shouldQueueAssignmentNotification } from './assignment-notification';

describe('shouldQueueAssignmentNotification', () => {
  it('queues initial assignments and reassignment in a workspace', () => {
    expect(shouldQueueAssignmentNotification(undefined, 'member-1', 'workspace-1')).toBe(
      true,
    );
    expect(shouldQueueAssignmentNotification('member-1', 'member-2', 'workspace-1')).toBe(
      true,
    );
  });

  it('does not queue no-op assignment, unassignment, or unscoped issues', () => {
    expect(shouldQueueAssignmentNotification('member-1', 'member-1', 'workspace-1')).toBe(
      false,
    );
    expect(shouldQueueAssignmentNotification('member-1', undefined, 'workspace-1')).toBe(
      false,
    );
    expect(shouldQueueAssignmentNotification(undefined, 'member-1', undefined)).toBe(
      false,
    );
  });
});
