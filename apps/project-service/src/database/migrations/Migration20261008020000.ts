import { Migration } from '@mikro-orm/migrations';

export class Migration20261008020000 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(`
      insert into "issue_statuses" ("id", "team_id", "name", "color", "category", "position", "is_default", "created_at", "updated_at")
      select defaults."id", teams."id", defaults."name", defaults."color", defaults."category", 0, defaults."is_default", now(), now()
      from "teams" cross join (values
        ('backlog', 'Backlog', '#95a2b3', 'backlog', false),
        ('to-do', 'Todo', '#99a2b2', 'unstarted', true),
        ('in-progress', 'In Progress', '#facc15', 'started', false),
        ('done', 'Done', '#5e6ad2', 'completed', false),
        ('canceled', 'Canceled', '#95a2b3', 'canceled', false)
      ) as defaults("id", "name", "color", "category", "is_default");
    `);
    this.addSql(`
      update "issues" set
        "status_id" = case "status_id"
          when 'idea' then 'backlog'
          when 'triage' then 'backlog'
          when 'paused' then 'to-do'
          when 'in-review' then 'in-progress'
          when 'technical-review' then 'in-progress'
          when 'product-feedback' then 'in-progress'
          when 'shipped' then 'done'
        end,
        "status_category" = case "status_id"
          when 'idea' then 'backlog'
          when 'triage' then 'backlog'
          when 'paused' then 'unstarted'
          when 'in-review' then 'started'
          when 'technical-review' then 'started'
          when 'product-feedback' then 'started'
          when 'shipped' then 'completed'
        end
      where "status_id" in ('idea', 'triage', 'paused', 'in-review', 'technical-review', 'product-feedback', 'shipped');
    `);
    this.addSql(`
      update "issue_templates" set "config" = jsonb_set(
        jsonb_set("config", '{statusId}', to_jsonb(case "config"->>'statusId'
          when 'idea' then 'backlog'
          when 'triage' then 'backlog'
          when 'paused' then 'to-do'
          when 'in-review' then 'in-progress'
          when 'technical-review' then 'in-progress'
          when 'product-feedback' then 'in-progress'
          when 'shipped' then 'done'
        end)),
        '{statusCategory}', to_jsonb(case "config"->>'statusId'
          when 'idea' then 'backlog'
          when 'triage' then 'backlog'
          when 'paused' then 'unstarted'
          when 'in-review' then 'started'
          when 'technical-review' then 'started'
          when 'product-feedback' then 'started'
          when 'shipped' then 'completed'
        end)
      ) where "config"->>'statusId' in ('idea', 'triage', 'paused', 'in-review', 'technical-review', 'product-feedback', 'shipped');
    `);
  }

  override down(): void | Promise<void> {
    // Reversing many removed statuses into a single category default is lossy.
    // Production recovery uses the pre-migration database backup.
  }
}
