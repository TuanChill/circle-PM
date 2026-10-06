import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import { v7 } from 'uuid';

@Entity({ tableName: 'issue_activities' })
export class IssueActivity {
  @PrimaryKey({ type: 'uuid' })
  id: string = v7();

  @Property({ type: 'string' })
  issueIdentifier: string; // e.g. 'LNUI-703'

  @Property({ type: 'string' })
  actorId: string;

  @Property({ type: 'string', nullable: true })
  event?: string; // 'created' | 'status' | 'label' | 'priority' | 'cycle' | 'blocked' | etc.

  @Property({ type: 'text', nullable: true })
  text?: string;

  @Property({ type: 'timestamp with time zone', onCreate: () => new Date() })
  createdAt: Date = new Date();

  constructor(partial?: Partial<IssueActivity>) {
    if (partial) {
      Object.assign(this, partial);
    }
  }
}
