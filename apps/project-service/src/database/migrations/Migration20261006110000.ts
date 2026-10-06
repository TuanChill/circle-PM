import { Migration } from '@mikro-orm/migrations';

export class Migration20261006110000 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `create table "issue_comments" ("id" uuid not null, "issue_identifier" varchar(255) not null, "actor_id" varchar(255) not null, "text" text null, "comment_blocks" jsonb null, "reactions" jsonb not null default '[]', "created_at" timestamptz not null, primary key ("id"));`,
    );
    this.addSql(
      `create index "issue_comments_issue_identifier_created_at_index" on "issue_comments" ("issue_identifier", "created_at");`,
    );
    this.addSql(
      `insert into "issue_comments" ("id", "issue_identifier", "actor_id", "text", "comment_blocks", "reactions", "created_at") select "id", "issue_identifier", "actor_id", "text", "comment_blocks", "reactions", "created_at" from "issue_activities" where "kind" = 'comment';`,
    );
    this.addSql(`delete from "issue_activities" where "kind" = 'comment';`);
    this.addSql(
      `alter table "issue_activities" drop column "kind", drop column "comment_blocks", drop column "reactions";`,
    );
    this.addSql(`alter table "file_attachments" add column "comment_id" uuid null;`);
    this.addSql(
      `create index "file_attachments_comment_id_index" on "file_attachments" ("comment_id");`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table "issue_activities" add column "kind" varchar(255) not null default 'event', add column "comment_blocks" jsonb null, add column "reactions" jsonb not null default '[]';`,
    );
    this.addSql(
      `insert into "issue_activities" ("id", "issue_identifier", "actor_id", "kind", "event", "text", "comment_blocks", "reactions", "created_at") select "id", "issue_identifier", "actor_id", 'comment', null, "text", "comment_blocks", "reactions", "created_at" from "issue_comments";`,
    );
    this.addSql(`drop index if exists "file_attachments_comment_id_index";`);
    this.addSql(`alter table "file_attachments" drop column "comment_id";`);
    this.addSql(`drop table if exists "issue_comments" cascade;`);
  }
}
