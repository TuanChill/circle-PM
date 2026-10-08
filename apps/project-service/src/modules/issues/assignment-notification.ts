export function shouldQueueAssignmentNotification(
  previousAssigneeId: string | null | undefined,
  nextAssigneeId: string | null | undefined,
  workspaceId: string | null | undefined,
) {
  return Boolean(nextAssigneeId && nextAssigneeId !== previousAssigneeId && workspaceId);
}
