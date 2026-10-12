export interface AssignmentDeliveryEvent {
  id: string;
  workspaceId: string;
  issueIdentifier: string;
  issueTitle: string;
  assigneeId: string;
  attempts: number;
  status: 'pending' | 'needs_config' | 'sent' | 'failed';
  leaseOwner?: string | null;
  leaseUntil?: Date | null;
  nextAttemptAt?: Date | null;
  sentAt?: Date | null;
  lastErrorCode?: string | null;
}

export interface AssignmentDeliveryIntegration {
  workspaceId: string;
  appId: string;
  appSecretCiphertext: string;
  domain: string;
  groupChatId: string;
}

export interface AssignmentDeliveryMapping {
  workspaceId: string;
  memberId: string;
  openId: string;
}

export interface AssignmentDeliveryAssignee {
  name: string;
}

export type AssignmentDeliveryResolution =
  | { kind: 'needs_config'; errorCode: string }
  | {
      kind: 'ready';
      delivery: {
        id: string;
        workspaceId: string;
        issueIdentifier: string;
        issueTitle: string;
        assigneeName: string;
        openId: string;
        appId: string;
        appSecretCiphertext: string;
        domain: string;
        groupChatId: string;
      };
    };

export function resolveAssignmentDelivery(
  event: Pick<
    AssignmentDeliveryEvent,
    'id' | 'workspaceId' | 'issueIdentifier' | 'issueTitle' | 'assigneeId'
  >,
  integration?: AssignmentDeliveryIntegration,
  mapping?: AssignmentDeliveryMapping,
  assignee?: AssignmentDeliveryAssignee,
): AssignmentDeliveryResolution {
  const integrationUnavailable =
    !integration || integration.workspaceId !== event.workspaceId;
  if (
    integrationUnavailable ||
    !mapping ||
    mapping.workspaceId !== event.workspaceId ||
    mapping.memberId !== event.assigneeId ||
    !assignee
  ) {
    return {
      kind: 'needs_config',
      errorCode: integrationUnavailable
        ? 'workspace_lark_integration_disabled_or_missing'
        : 'assignee_lark_mapping_missing',
    };
  }

  return {
    kind: 'ready',
    delivery: {
      id: event.id,
      workspaceId: event.workspaceId,
      issueIdentifier: event.issueIdentifier,
      issueTitle: event.issueTitle,
      assigneeName: assignee.name,
      openId: mapping.openId,
      appId: integration.appId,
      appSecretCiphertext: integration.appSecretCiphertext,
      domain: integration.domain,
      groupChatId: integration.groupChatId,
    },
  };
}

export function acknowledgeAssignmentDelivery(
  event: AssignmentDeliveryEvent,
  now = new Date(),
) {
  event.status = 'sent';
  event.sentAt = now;
  event.leaseUntil = null;
  event.leaseOwner = null;
  event.lastErrorCode = null;
}

export function failAssignmentDelivery(
  event: AssignmentDeliveryEvent,
  errorCode: string,
  retryable: boolean,
  now = new Date(),
) {
  event.lastErrorCode = errorCode.slice(0, 255);
  event.leaseUntil = null;
  event.leaseOwner = null;
  if (!retryable || event.attempts >= 8) {
    event.status = 'failed';
    event.nextAttemptAt = null;
    return;
  }

  const delayMs = Math.min(5_000 * 2 ** (event.attempts - 1), 5 * 60_000);
  event.nextAttemptAt = new Date(now.getTime() + delayMs);
}
