import { Migration } from '@mikro-orm/migrations';

export class Migration20261006140000 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `create table "project_statuses" ("id" uuid not null, "workspace_id" varchar(255) not null, "name" varchar(255) not null, "description" text null, "color" varchar(255) not null, "category" varchar(255) not null, "position" int not null default 0, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "project_statuses_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create unique index "project_statuses_workspace_id_name_unique" on "project_statuses" ("workspace_id", "name");`,
    );
    this.addSql(
      `create index "project_statuses_workspace_id_category_position_index" on "project_statuses" ("workspace_id", "category", "position");`,
    );
  }

  override down(): void | Promise<void> {
    // Only roll this back after projects no longer reference custom status IDs.
    this.addSql(`drop table if exists "project_statuses" cascade;`);
  }
}
