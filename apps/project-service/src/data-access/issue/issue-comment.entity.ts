import { Entity, Index, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import { v7 } from 'uuid';

@Entity({ tableName: 'issue_comments' })
@Index({ properties: ['issueIdentifier', 'createdAt'] })
export class IssueComment {
  @PrimaryKey({ type: 'uuid' })
  id: string = v7();

  @Property({ type: 'string' })
  issueIdentifier: string;

  @Property({ type: 'string' })
  actorId: string;

  @Property({ type: 'text', nullable: true })
  text?: string;

  @Property({ type: 'json', nullable: true })
  commentBlocks?: any[];

  @Property({ type: 'json', default: '[]' })
  reactions: any[] = [];

  @Property({ type: 'timestamp with time zone', onCreate: () => new Date() })
  createdAt: Date = new Date();

  constructor(partial?: Partial<IssueComment>) {
    if (partial) Object.assign(this, partial);
  }
}
