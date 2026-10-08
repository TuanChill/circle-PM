import {
  AcknowledgeIssueAssignmentNotificationRequest,
  ClaimIssueAssignmentNotificationsRequest,
  FailIssueAssignmentNotificationRequest,
  PROJECT_GRPC_SERVICE,
} from '@app/common';
import { EntityManager, RequestContext } from '@mikro-orm/core';
import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { LarkIntegrationService } from './lark-integration.service';

@Controller()
export class LarkIntegrationGrpcController {
  constructor(
    private readonly service: LarkIntegrationService,
    private readonly em: EntityManager,
  ) {}

  @GrpcMethod(PROJECT_GRPC_SERVICE, 'ClaimIssueAssignmentNotifications')
  claimIssueAssignmentNotifications(request: ClaimIssueAssignmentNotificationsRequest) {
    return RequestContext.create(this.em, () => this.service.claimDeliveries(request));
  }

  @GrpcMethod(PROJECT_GRPC_SERVICE, 'AcknowledgeIssueAssignmentNotification')
  acknowledgeIssueAssignmentNotification(
    request: AcknowledgeIssueAssignmentNotificationRequest,
  ) {
    return RequestContext.create(this.em, () =>
      this.service.acknowledgeDelivery(request.id, request.workerId),
    );
  }

  @GrpcMethod(PROJECT_GRPC_SERVICE, 'FailIssueAssignmentNotification')
  failIssueAssignmentNotification(request: FailIssueAssignmentNotificationRequest) {
    return RequestContext.create(this.em, () =>
      this.service.failDelivery(
        request.id,
        request.workerId,
        request.errorCode,
        request.retryable,
      ),
    );
  }
}
