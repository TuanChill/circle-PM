# Phase 03 — Baseline Schema Inspection & Triage

## Context Links
- Plan overview: [plan.md](plan.md)
- Depends on: [phase-01](phase-01-backup-and-safety-prep.md) (backup verified), [phase-02](phase-02-isolate-migration-tables-config.md) (config merged)
- `apps/project-service/src/database/migrations/` (34 files, `Migration20260824074759.ts` .. `Migration20260917170000.ts`)
- `apps/project-service/mikro-orm.config.ts` (`snapshot: false`, `skipTables: ['users']` — already tuned for schema-diff safety)

## Overview
- Priority: P0
- Status: pending
- Read-heavy phase, but the FIRST `migration:*` command run against the new `tableName` config is a real mutation: `Migrator.init()` unconditionally calls `storage.ensureTable()` (confirmed in `@mikro-orm/migrations@7.0.10`'s `Migrator.js:54`), so even `migration:pending` silently `CREATE TABLE`s `project_service_migrations` / `user_service_migrations` if they don't exist. Flagged below.
- Output of this phase is a **triage classification** of all 33 currently-pending project-service migrations — NOT their execution. Execution happens in phase 05.

## Key Insights
- Do not assume a clean binary split. Evidence already shows a **mixed** migration:
  `Migration20260903081252.ts` both `create table "workspaces"`/`"workspace_user_members"`
  (tables confirmed to already exist) AND `alter table "cycles"/"saved_views"/"teams"`
  (columns whose current state is unverified). Running this file wholesale via
  `migration:up --only` would immediately fail on the `create table` statement
  (same failure mode already observed with `cycles`).
- Exactly one migration file contains non-DDL (data) SQL:
  `Migration20260917130000.ts` (backfills `issue_subscriptions`, idempotent via
  `on conflict do nothing`). Schema-diff tooling (`schema:update`) cannot detect
  whether this ran — it only compares structure, not row data. Must be checked
  separately: `issue_subscriptions` is a confirmed-missing table, so this
  migration is unambiguously **not-applied** regardless of diff output.
- Migration order matters: several migrations alter tables/columns created by
  earlier migrations (e.g. `Migration20260903081252` alters `cycles.scope_delta`
  which an earlier migration created). Triage and later execution must proceed
  in filename-chronological order, not arbitrarily.

## Requirements
- Functional: produce a written classification (fully-applied / not-applied / partial) for each of the 33 pending migrations, with the evidence used per row.
- Non-functional: no schema/data DDL executed in this phase — only the new empty tracking tables get created as an unavoidable side effect.

## Architecture (triage data flow)
```
33 pending migration files (chronological)
        │
        ├─ static read: extract SQL statements per file
        │
        ├─ aggregate signal: `mikro-orm schema:update --run=false --dump`
        │     → lists ALL structural (DDL) gaps between live DB and current
        │       entity metadata in one shot (covers the bulk of 33 files,
        │       since most changes are structural)
        │
        ├─ per-file cross-check: does this file's CREATE/ALTER TABLE/COLUMN
        │     appear in the diff output?
        │     - NOT in diff  → target already exists as specified → applied
        │     - IS in diff   → target missing/mismatched → not-applied (or
        │       partial if only SOME of the file's statements are in the diff)
        │
        └─ special case: any file with INSERT/UPDATE/DELETE (only
              `Migration20260917130000.ts` today) → check target table/row
              existence directly via psql, independent of the schema diff
```

## Related Code Files
- Read-only: all 34 files in `apps/project-service/src/database/migrations/`
- Modified (via CLI side effect, not manual edit): new tables `project_service_migrations`, `user_service_migrations` created in `ai-agent`

## Implementation Steps

1. **[⚠️ REQUIRES EXPLICIT GO-AHEAD — creates 2 new empty tables in `ai-agent` via `ensureTable()` side effect]**
   Trigger table creation for both services (harmless empty tables, but real DDL):
   ```bash
   pnpm --filter project-service migration:pending
   pnpm --filter user-service migration:pending
   ```
   Expect: project-service lists all 34 migration names as pending (since the
   new table starts empty); user-service lists its 1 migration as pending.
   Confirm via psql that the two new tables now exist and are empty:
   ```bash
   docker exec nest_turbo_db psql -U "$DEFAULT_PG_USER" -d ai-agent -c "\dt project_service_migrations"
   docker exec nest_turbo_db psql -U "$DEFAULT_PG_USER" -d ai-agent -c "SELECT count(*) FROM project_service_migrations;"
   ```

2. **[Read-only]** Run the aggregate structural-diff triage tool (dry-run, does not execute anything):
   ```bash
   pnpm --filter project-service exec mikro-orm schema:update --run=false --dump
   ```
   Save the output to `.docker/volumes/db-backups/schema-diff-baseline.sql` (gitignored path, for reference during phase 05 — do not commit).

3. **[Read-only]** For each of the 34 migration files, in filename-chronological order, record one row in a scratch triage table (this can live in your working notes / scratchpad, not committed):
   | Migration | Statement types | Target objects | In diff from step 2? | Classification |
   |---|---|---|---|---|
   `Migration20260830120000` is already known-applied (it's in the old shared
   table) — mark it applied without re-checking.
   For the remaining 33, cross-reference each file's `CREATE TABLE`/`ALTER TABLE ... ADD COLUMN`/`ADD CONSTRAINT`/`CREATE INDEX` targets against the diff from step 2:
   - Zero of the file's targets appear in the diff → **fully-applied**
   - All of the file's targets appear in the diff → **not-applied**
   - Some but not all appear → **partial** (record exactly which statements are missing — these are the only ones to run manually in phase 05)

4. **[Read-only]** Handle the one data-migration specially: confirm `issue_subscriptions` does not exist yet (already confirmed missing) →
   classify `Migration20260917130000` as **not-applied** regardless of what the schema diff says (it has no DDL of its own to show up in a diff).

5. **[Read-only]** Cross-check the 3 known-missing tables (`project_teams`, `cycle_settings`, `issue_subscriptions`) each map to a **not-applied** classification for the migration(s) that create them — this is a sanity check on the triage, not new work.

## Todo List
- [ ] `project_service_migrations` / `user_service_migrations` tables created (empty)
- [ ] `schema:update --dump` baseline captured to `.docker/volumes/db-backups/schema-diff-baseline.sql`
- [ ] All 34 project-service migrations classified: fully-applied / not-applied / partial
- [ ] `Migration20260917130000` explicitly confirmed not-applied (data migration, not caught by schema diff)
- [ ] Partial-bucket migrations have their specific missing statements identified (not just "partial", but which lines)

## Success Criteria
- Written classification exists for all 34 migrations with cited evidence (diff line, `\d` output, or table-existence check) per row — no migration left as "unknown".
- The known-missing tables (`project_teams`, `cycle_settings`, `issue_subscriptions`) trace to specific not-applied migrations in the classification.

## Risk Assessment
- Likelihood x Impact: Medium x Medium — misclassifying a migration as "fully-applied" when it's actually partial would silently skip real schema changes. Mitigation: cross-check every "fully-applied" call against the diff output (absence of evidence in the diff is the actual evidence, not an assumption).
- Likelihood x Impact: Low x Low — the two new empty tables are trivially reversible (`DROP TABLE`) if this phase needs to be redone.

## Security Considerations
- `schema-diff-baseline.sql` may reference column names/table structure only (no row data) — still keep it out of git per the gitignored backups path.

## Next Steps
- Phase 04: copy the 2 legacy rows from the old shared table into the new tables (the `project_service_migrations` row for `Migration20260830120000` must exist before phase 05 treats it as already-applied).
