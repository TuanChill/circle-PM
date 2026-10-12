import { EntityRepositoryType } from '@mikro-orm/core';
import { Entity, Index, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import { IssueAssignmentOutboxRepository } from './issue-assignment-outbox.repository';

export type IssueAssignmentDeliveryStatus =
  | 'pending'
  | 'needs_config'
  | 'sent'
  | 'failed';

@Entity({
  tableName: 'issue_assignment_outbox',
  repository: () => IssueAssignmentOutboxRepository,
})
@Index({ properties: ['status', 'nextAttemptAt', 'leaseUntil'] })
@Index({ properties: ['workspaceId', 'status'] })
export class IssueAssignmentOutbox {
  [EntityRepositoryType]?: IssueAssignmentOutboxRepository;

  @PrimaryKey({ type: 'string' })
  id: string;

  @Property({ type: 'string' })
  workspaceId: string;

  @Property({ type: 'string' })
  issueIdentifier: string;

  @Property({ type: 'text' })
  issueTitle: string;

  @Property({ type: 'string' })
  assigneeId: string;

  @Property({ type: 'string' })
  actorId: string;

  @Property({ type: 'string', default: 'pending' })
  status: IssueAssignmentDeliveryStatus = 'pending';

  @Property({ type: 'integer', default: 0 })
  attempts = 0;

  @Property({ type: 'timestamp with time zone', nullable: true })
  nextAttemptAt?: Date | null;

  @Property({ type: 'timestamp with time zone', nullable: true })
  leaseUntil?: Date | null;

  @Property({ type: 'string', nullable: true })
  leaseOwner?: string | null;

  @Property({ type: 'timestamp with time zone', nullable: true })
  sentAt?: Date | null;

  @Property({ type: 'string', nullable: true })
  lastErrorCode?: string | null;

  @Property({ type: 'timestamp with time zone', onCreate: () => new Date() })
  createdAt: Date = new Date();

  @Property({ type: 'timestamp with time zone', onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  constructor(partial?: Partial<IssueAssignmentOutbox>) {
    if (partial) Object.assign(this, partial);
  }
}
