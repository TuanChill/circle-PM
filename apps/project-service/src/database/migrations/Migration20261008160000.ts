import { Migration } from '@mikro-orm/migrations';

export class Migration20261008160000 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(`
      create table "workspace_lark_integrations" (
        "id" varchar(255) not null,
        "workspace_id" varchar(255) not null,
        "app_id" varchar(255) not null,
        "app_secret_ciphertext" text not null,
        "domain" varchar(255) not null,
        "group_chat_id" varchar(255) not null,
        "enabled" boolean not null default false,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        constraint "workspace_lark_integrations_pkey" primary key ("id"),
        constraint "workspace_lark_integrations_workspace_id_unique" unique ("workspace_id")
      );
    `);
    this.addSql(`
      create table "workspace_lark_members" (
        "id" varchar(255) not null,
        "workspace_id" varchar(255) not null,
        "member_id" varchar(255) not null,
        "open_id" varchar(255) not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        constraint "workspace_lark_members_pkey" primary key ("id"),
        constraint "workspace_lark_members_workspace_member_unique" unique ("workspace_id", "member_id"),
        constraint "workspace_lark_members_workspace_open_id_unique" unique ("workspace_id", "open_id")
      );
    `);
    this.addSql(
      `create index "workspace_lark_members_workspace_id_index" on "workspace_lark_members" ("workspace_id");`,
    );
    this.addSql(
      `create index "workspace_lark_members_member_id_index" on "workspace_lark_members" ("member_id");`,
    );
    this.addSql(`
      create table "issue_assignment_outbox" (
        "id" varchar(255) not null,
        "workspace_id" varchar(255) not null,
        "issue_identifier" varchar(255) not null,
        "issue_title" text not null,
        "assignee_id" varchar(255) not null,
        "actor_id" varchar(255) not null,
        "status" varchar(255) not null default 'pending',
        "attempts" integer not null default 0,
        "next_attempt_at" timestamptz null,
        "lease_until" timestamptz null,
        "lease_owner" varchar(255) null,
        "sent_at" timestamptz null,
        "last_error_code" varchar(255) null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        constraint "issue_assignment_outbox_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `create index "issue_assignment_outbox_status_retry_lease_index" on "issue_assignment_outbox" ("status", "next_attempt_at", "lease_until");`,
    );
    this.addSql(
      `create index "issue_assignment_outbox_workspace_status_index" on "issue_assignment_outbox" ("workspace_id", "status");`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "issue_assignment_outbox";`);
    this.addSql(`drop table if exists "workspace_lark_members";`);
    this.addSql(`drop table if exists "workspace_lark_integrations";`);
  }
}
