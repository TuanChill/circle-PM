import { Migration } from '@mikro-orm/migrations';

export class Migration20261008010000 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `create table "issue_statuses" ("id" varchar(255) not null, "team_id" varchar(255) not null, "name" varchar(255) not null, "description" text null, "color" varchar(255) not null, "category" varchar(255) not null, "position" int not null default 0, "is_default" boolean not null default false, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "issue_statuses_pkey" primary key ("team_id", "id"));`,
    );
    this.addSql(
      `create unique index "issue_statuses_team_id_name_unique" on "issue_statuses" ("team_id", lower("name"));`,
    );
    this.addSql(
      `create index "issue_statuses_team_id_category_position_index" on "issue_statuses" ("team_id", "category", "position");`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "issue_statuses" cascade;`);
  }
}
