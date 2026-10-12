import { decryptSecret, IssueAssignmentDelivery, ProjectGrpcService } from '@app/common';
import { MicroserviceName, MS_INJECTION_TOKEN } from '@app/core';
import { Client } from '@larksuiteoapi/node-sdk';
import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Transport } from '@nestjs/microservices';
import { randomUUID } from 'node:crypto';
import { firstValueFrom, timeout } from 'rxjs';
import { buildIssueAssignmentText } from './lark-message';

const BATCH_SIZE = 5;
const LEASE_SECONDS = 60;

@Injectable()
export class LarkAssignmentWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LarkAssignmentWorker.name);
  private readonly workerId = randomUUID();
  private timer?: NodeJS.Timeout;
  private running = false;
  private lastSuccessfulPollAt?: string;
  private lastErrorCode?: string;

  constructor(
    @Inject(MS_INJECTION_TOKEN(MicroserviceName.ProjectService, Transport.GRPC))
    private readonly projectService: ProjectGrpcService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    const interval = this.configService.get<number>('app.workerPollIntervalMs') || 5000;
    void this.poll();
    this.timer = setInterval(() => void this.poll(), interval);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  getHealth() {
    return {
      worker: this.running ? 'processing' : 'idle',
      lastSuccessfulPollAt: this.lastSuccessfulPollAt ?? null,
      lastErrorCode: this.lastErrorCode ?? null,
    };
  }

  private async poll() {
    if (this.running) return;
    this.running = true;
    try {
      const response = await firstValueFrom(
        this.projectService
          .claimIssueAssignmentNotifications({
            workerId: this.workerId,
            limit: BATCH_SIZE,
            leaseSeconds: LEASE_SECONDS,
          })
          .pipe(timeout(15_000)),
      );
      this.lastSuccessfulPollAt = new Date().toISOString();
      this.lastErrorCode = undefined;
      await Promise.all(
        (response.deliveries ?? []).map((delivery) => this.deliver(delivery)),
      );
    } catch (error) {
      this.lastErrorCode = this.getErrorCode(error);
      this.logger.error(`Lark assignment poll failed: ${this.lastErrorCode}`);
    } finally {
      this.running = false;
    }
  }

  private async deliver(delivery: IssueAssignmentDelivery) {
    try {
      const client = new Client({
        appId: delivery.appId,
        appSecret: decryptSecret(delivery.appSecretCiphertext),
        domain: delivery.domain as never,
      });
      const response = await client.im.v1.message.create({
        params: { receive_id_type: 'chat_id' },
        data: {
          receive_id: delivery.groupChatId,
          msg_type: 'text',
          content: JSON.stringify({
            text: buildIssueAssignmentText({
              issueIdentifier: delivery.issueIdentifier,
              issueTitle: delivery.issueTitle,
              assigneeName: delivery.assigneeName,
              openId: delivery.openId,
            }),
          }),
        },
      });
      const result = response as { code?: number; msg?: string };
      if (result.code !== undefined && result.code !== 0) {
        throw Object.assign(new Error('Lark message API rejected the request'), {
          code: result.code,
        });
      }
      const acknowledgement = await firstValueFrom(
        this.projectService
          .acknowledgeIssueAssignmentNotification({
            id: delivery.id,
            workerId: this.workerId,
          })
          .pipe(timeout(10_000)),
      );
      if (!acknowledgement.success) {
        this.logger.warn(
          `Lark assignment acknowledgement was rejected for event ${delivery.id}`,
        );
      }
    } catch (error) {
      const errorCode = this.getErrorCode(error);
      const retryable = !(
        error instanceof Error && error.message === 'Encrypted secret is invalid'
      );
      this.logger.warn(
        `Lark assignment delivery failed for ${delivery.issueIdentifier} in workspace ${delivery.workspaceId}: ${errorCode}`,
      );
      try {
        await firstValueFrom(
          this.projectService
            .failIssueAssignmentNotification({
              id: delivery.id,
              workerId: this.workerId,
              errorCode,
              retryable,
            })
            .pipe(timeout(10_000)),
        );
      } catch (failureError) {
        this.logger.error(
          `Could not record Lark delivery failure for event ${delivery.id}: ${this.getErrorCode(failureError)}`,
        );
      }
    }
  }

  private getErrorCode(error: unknown) {
    if (error && typeof error === 'object' && 'code' in error) {
      return String((error as { code: unknown }).code).slice(0, 80);
    }
    return error instanceof Error ? error.name : 'unknown_error';
  }
}
