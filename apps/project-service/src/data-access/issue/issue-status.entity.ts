import { Entity, Index, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';

export type IssueStatusCategory =
  | 'triage'
  | 'backlog'
  | 'unstarted'
  | 'started'
  | 'completed'
  | 'canceled';

@Entity({ tableName: 'issue_statuses' })
@Index({ properties: ['teamId', 'category', 'position'] })
export class IssueStatus {
  @PrimaryKey({ type: 'string' })
  id: string;

  @PrimaryKey({ type: 'string' })
  teamId: string;

  @Property({ type: 'string' })
  name: string;

  @Property({ type: 'text', nullable: true })
  description?: string;

  @Property({ type: 'string' })
  color: string;

  @Property({ type: 'string' })
  category: IssueStatusCategory;

  @Property({ type: 'integer', default: 0 })
  position: number;

  @Property({ type: 'boolean', default: false })
  isDefault = false;

  @Property({ type: 'timestamp with time zone', onCreate: () => new Date() })
  createdAt: Date = new Date();

  @Property({ type: 'timestamp with time zone', onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  constructor(partial?: Partial<IssueStatus>) {
    if (partial) Object.assign(this, partial);
  }
}
