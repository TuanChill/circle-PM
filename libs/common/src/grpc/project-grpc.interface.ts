import { Observable } from 'rxjs';

export interface ClaimIssueAssignmentNotificationsRequest {
  workerId: string;
  limit: number;
  leaseSeconds: number;
}

export interface IssueAssignmentDelivery {
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
}

export interface ClaimIssueAssignmentNotificationsResponse {
  deliveries: IssueAssignmentDelivery[];
}

export interface AcknowledgeIssueAssignmentNotificationRequest {
  id: string;
  workerId: string;
}

export interface FailIssueAssignmentNotificationRequest {
  id: string;
  workerId: string;
  errorCode: string;
  retryable: boolean;
}

export interface IssueAssignmentNotificationResult {
  success: boolean;
}

export interface ProjectGrpcService {
  claimIssueAssignmentNotifications(
    request: ClaimIssueAssignmentNotificationsRequest,
  ): Observable<ClaimIssueAssignmentNotificationsResponse>;
  acknowledgeIssueAssignmentNotification(
    request: AcknowledgeIssueAssignmentNotificationRequest,
  ): Observable<IssueAssignmentNotificationResult>;
  failIssueAssignmentNotification(
    request: FailIssueAssignmentNotificationRequest,
  ): Observable<IssueAssignmentNotificationResult>;
}
