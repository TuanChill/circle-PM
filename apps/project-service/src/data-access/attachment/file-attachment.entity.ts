import { Entity, Index, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import { v7 } from 'uuid';

@Entity({ tableName: 'file_attachments' })
@Index({ properties: ['workspaceId', 'issueIdentifier'] })
@Index({ properties: ['workspaceId', 'projectId'] })
@Index({ properties: ['commentId'] })
export class FileAttachment {
  @PrimaryKey({ type: 'uuid' })
  id: string = v7();

  @Property({ type: 'string' })
  workspaceId: string;

  @Property({ type: 'string' })
  teamId: string;

  @Property({ type: 'string', nullable: true })
  issueIdentifier?: string;

  @Property({ type: 'uuid', nullable: true })
  commentId?: string;

  @Property({ type: 'string', nullable: true })
  projectId?: string;

  @Property({ type: 'string' })
  uploaderId: string;

  @Property({ type: 'string' })
  fileName: string;

  @Property({ type: 'string' })
  contentType: string;

  @Property({ type: 'integer' })
  fileSize: number;

  @Property({ type: 'string' })
  fileKey: string;

  @Property({ type: 'text' })
  fileUrl: string;

  @Property({ type: 'string', default: 'pending' })
  status: 'pending' | 'completed' = 'pending';

  @Property({ type: 'timestamp with time zone', onCreate: () => new Date() })
  createdAt: Date = new Date();

  @Property({ type: 'timestamp with time zone', nullable: true })
  completedAt?: Date;

  constructor(partial?: Partial<FileAttachment>) {
    if (partial) Object.assign(this, partial);
  }
}
