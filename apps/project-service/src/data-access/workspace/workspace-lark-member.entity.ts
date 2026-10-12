import { EntityRepositoryType } from '@mikro-orm/core';
import { Entity, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/legacy';
import { WorkspaceLarkMemberRepository } from './workspace-lark-member.repository';

@Entity({
  tableName: 'workspace_lark_members',
  repository: () => WorkspaceLarkMemberRepository,
})
@Unique({ properties: ['workspaceId', 'memberId'] })
@Unique({ properties: ['workspaceId', 'openId'] })
export class WorkspaceLarkMember {
  [EntityRepositoryType]?: WorkspaceLarkMemberRepository;

  @PrimaryKey({ type: 'string' })
  id: string;

  @Property({ type: 'string' })
  workspaceId: string;

  @Property({ type: 'string' })
  memberId: string;

  @Property({ type: 'string' })
  openId: string;

  @Property({ type: 'timestamp with time zone', onCreate: () => new Date() })
  createdAt: Date = new Date();

  @Property({ type: 'timestamp with time zone', onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  constructor(partial?: Partial<WorkspaceLarkMember>) {
    if (partial) Object.assign(this, partial);
  }
}
