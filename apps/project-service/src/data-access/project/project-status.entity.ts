import {
  Entity,
  Index,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy';
import { v7 } from 'uuid';

@Entity({ tableName: 'project_statuses' })
@Unique({ properties: ['workspaceId', 'name'] })
@Index({ properties: ['workspaceId', 'category', 'position'] })
export class ProjectStatus {
  @PrimaryKey({ type: 'uuid' })
  id: string = v7();

  @Property({ type: 'string' })
  workspaceId: string;

  @Property({ type: 'string' })
  name: string;

  @Property({ type: 'text', nullable: true })
  description?: string;

  @Property({ type: 'string' })
  color: string;

  @Property({ type: 'string' })
  category: string;

  @Property({ type: 'integer', default: 0 })
  position: number;

  @Property({ type: 'timestamp with time zone', onCreate: () => new Date() })
  createdAt: Date = new Date();

  @Property({ type: 'timestamp with time zone', onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  constructor(partial?: Partial<ProjectStatus>) {
    if (partial) Object.assign(this, partial);
  }
}
