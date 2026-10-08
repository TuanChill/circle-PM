import { EntityRepositoryType } from '@mikro-orm/core';
import { Entity, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/legacy';
import { WorkspaceLarkIntegrationRepository } from './workspace-lark-integration.repository';

@Entity({
  tableName: 'workspace_lark_integrations',
  repository: () => WorkspaceLarkIntegrationRepository,
})
@Unique({ properties: ['workspaceId'] })
export class WorkspaceLarkIntegration {
  [EntityRepositoryType]?: WorkspaceLarkIntegrationRepository;

  @PrimaryKey({ type: 'string' })
  id: string;

  @Property({ type: 'string' })
  workspaceId: string;

  @Property({ type: 'string' })
  appId: string;

  @Property({ type: 'text' })
  appSecretCiphertext: string;

  @Property({ type: 'string' })
  domain: string;

  @Property({ type: 'string' })
  groupChatId: string;

  @Property({ type: 'boolean', default: false })
  enabled = false;

  @Property({ type: 'timestamp with time zone', onCreate: () => new Date() })
  createdAt: Date = new Date();

  @Property({ type: 'timestamp with time zone', onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  constructor(partial?: Partial<WorkspaceLarkIntegration>) {
    if (partial) Object.assign(this, partial);
  }
}
