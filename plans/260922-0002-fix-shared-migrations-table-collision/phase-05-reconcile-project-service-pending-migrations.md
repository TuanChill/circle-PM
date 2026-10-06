# Phase 05 — Reconcile Project-Service's 33 Pending Migrations

## Context Links
- Plan overview: [plan.md](plan.md)
- Depends on: [phase-04](phase-04-migrate-legacy-tracking-rows.md) (33 pending remain, 1 already tracked)
- Triage input: [phase-03](phase-03-baseline-schema-inspection-and-triage.md) classification (fully-applied / not-applied / partial)
- Known-missing tables (must end up created): `project_teams`, `cycle_settings`, `issue_subscriptions`
- Prior failure to avoid repeating: blind `migration:up` → `TableExistsException: relation "cycles" already exists`

## Overview
- Priority: P0 (this IS the fix)
- Status: pending
- **Highest-risk phase in this plan.** Every sub-step below is a real DDL/data mutation. Work through the 33 migrations **in filename-chronological order** (`Migration20260903081252` → ... → `Migration20260917170000`) — later migrations depend on earlier ones' tables/columns existing.

## Key Insights
- Three buckets from phase 03, each with a different, non-interchangeable action:
  1. **Fully-applied** → mark executed only. Never run via CLI (would re-execute already-applied DDL and fail, per the observed `TableExistsException`).
  2. **Not-applied** → run via CLI (`migration:up --only <name>`), safe because nothing collides.
  3. **Partial** (mixed file, e.g. `Migration20260903081252`) → CANNOT use `--only` (it replays the whole file, including the already-applied statements, and will fail on the first one). Must manually execute ONLY the missing statements (copy exact SQL from the migration's `up()`), then mark the whole migration executed.
- `migration:up --only` accepts a comma/space-separated list and is a real, documented CLI option (`@mikro-orm/cli@7.0.10`'s `MigrationCommandFactory.js`: `-o, --only <string> Migrate only specified versions`) — confirmed in this repo's installed version, not assumed.
- Marking a migration "executed" without running it means a plain SQL INSERT into `project_service_migrations (name, executed_at)` — same mechanism used in phase 04, same table schema.

## Requirements
- Functional: after this phase, `project_service_migrations` has all 34 names, and the live schema matches what running all 34 migrations from scratch would produce — verified via `schema:update --dump` returning empty.
- Non-functional: no statement is executed twice; no already-existing object is re-created; process is resumable (each migration handled = 1 unit of work, safe to stop/restart between migrations since state is persisted in the tracking table after each one).

## Architecture (per-migration decision flow)
```
for each of 33 migrations, in chronological order:
    classification (from phase 03)
        │
        ├─ fully-applied ──→ INSERT INTO project_service_migrations (name, executed_at) VALUES ('<name>', now());
        │
        ├─ not-applied ────→ pnpm --filter project-service migration:up --only <name>
        │                     (verify success, then confirm it auto-logged the row)
        │
        └─ partial ────────→ 1. extract exact missing statements from the .ts file's up()
                              2. run ONLY those statements via psql, wrapped in a transaction
                              3. INSERT INTO project_service_migrations (name, executed_at) VALUES ('<name>', now());
```

## Related Code Files
- Read-only: `apps/project-service/src/database/migrations/*.ts` (all 33 remaining files)
- No source files modified in this phase.

## Implementation Steps

1. **[⚠️ REQUIRES EXPLICIT GO-AHEAD — this phase performs real, irreversible-without-restore DDL/data changes]**
   Confirm the phase-01 backup is still current (no manual DB changes happened since). If any manual poking occurred between phase 01 and now, take a fresh backup before proceeding.

2. For each migration in chronological order, apply its bucket's action from the Architecture diagram above. Example for a **not-applied** migration:
   ```bash
   pnpm --filter project-service migration:up --only Migration20260903081252
   ```
   Wait — `Migration20260903081252` is the known **partial** example, so it must NOT be run this way. Example of the correct partial handling for it specifically:
   ```bash
   # Only the previously-unverified ALTER statements, not the CREATE TABLE ones already present:
   docker exec nest_turbo_db psql -U "$DEFAULT_PG_USER" -d ai-agent -c '
     alter table "cycles" alter column "scope_delta" type double precision using ("scope_delta"::double precision);
   '
   # ...repeat only for statements confirmed missing in phase 03's triage row for this migration...
   docker exec nest_turbo_db psql -U "$DEFAULT_PG_USER" -d ai-agent -c \
     "INSERT INTO project_service_migrations (name, executed_at) VALUES ('Migration20260903081252', now());"
   ```
3. For the confirmed **not-applied** data migration `Migration20260917130000` (issue_subscriptions backfill), run it only after every migration that creates `issue_subscriptions`, `issues`, `issue_activities`, `team_members`, `teams`, `workspace_user_members` has already been reconciled (respects chronological/dependency order):
   ```bash
   pnpm --filter project-service migration:up --only Migration20260917130000
   ```
   This is idempotent (`on conflict do nothing`) — safe even if accidentally run twice.
4. After each migration is handled, re-run `pnpm --filter project-service migration:pending` to confirm the count decrements by exactly 1 and no unexpected migration disappears from or reappears in the list.
5. Once all 33 are handled, confirm zero pending:
   ```bash
   pnpm --filter project-service migration:pending
   # Expect: "No pending migrations"
   ```
6. Run the full structural diff again to confirm live schema now exactly matches entity metadata (no drift left):
   ```bash
   pnpm --filter project-service exec mikro-orm schema:update --run=false --dump
   # Expect: "No changes required, schema is up-to-date"
   ```
7. Spot-check the 3 previously-missing tables now exist with expected columns:
   ```bash
   docker exec nest_turbo_db psql -U "$DEFAULT_PG_USER" -d ai-agent -c "\d project_teams"
   docker exec nest_turbo_db psql -U "$DEFAULT_PG_USER" -d ai-agent -c "\d cycle_settings"
   docker exec nest_turbo_db psql -U "$DEFAULT_PG_USER" -d ai-agent -c "\d issue_subscriptions"
   ```

## Todo List
- [ ] All 33 migrations processed in chronological order per their phase-03 bucket
- [ ] `Migration20260903081252` (known partial) handled via manual-statement patch, not `--only`
- [ ] `Migration20260917130000` (data backfill) run last among its dependents, confirmed idempotent
- [ ] `migration:pending` returns empty for project-service
- [ ] `schema:update --dump` returns "up-to-date" (zero remaining diff)
- [ ] `project_teams`, `cycle_settings`, `issue_subscriptions` confirmed present via `\d`

## Success Criteria
- `project_service_migrations` contains all 34 migration names.
- `migration:pending` empty; `schema:update --dump` shows no diff.
- No `TableExistsException` or similar error occurred during this phase (if one does, STOP, do not continue to the next migration — see Risk Assessment).

## Risk Assessment
- Likelihood x Impact: Medium x High — a misclassified migration run via `--only` could throw mid-file (partial statement execution within that one migration, since MikroORM wraps each migration in its own transaction by default, so a failure rolls back that single migration's statements — but manually-run raw SQL for the "partial" bucket is NOT auto-wrapped, so wrap those in explicit `BEGIN; ... COMMIT;` blocks).
  - Mitigation: if a `migration:up --only` call errors, the CLI's per-migration transaction should roll back that migration's own statements automatically (confirmed default MikroORM behavior) — re-classify that migration as partial/re-triage rather than retrying blindly, and do not proceed to the next migration until resolved.
  - Mitigation: if any raw SQL patch step fails, roll back its transaction and re-verify the triage row's "missing statements" list against current `\d` output before retrying.
- Likelihood x Impact: Low x High — total loss of correctness if this phase is abandoned halfway with inconsistent state. Mitigation: this phase is resumable (state is externalized to `project_service_migrations` after each migration), and phase 01's backup is the full-stop rollback if needed.

## Security Considerations
- None beyond standard DB-credential handling already covered in phase 01/04.

## Next Steps
- Phase 06: boot both services and confirm no regressions, especially for user-service (must remain unaffected).
