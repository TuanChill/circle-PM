# Phase 04 — Migrate Legacy Tracking Rows

## Context Links
- Plan overview: [plan.md](plan.md)
- Depends on: [phase-03](phase-03-baseline-schema-inspection-and-triage.md) (new tables exist)
- Confirmed old-table contents: `SELECT name FROM mikro_orm_migrations` → `Migration20251121025600` (user-service), `Migration20260830120000` (project-service)

## Overview
- Priority: P0
- Status: pending
- Small, mechanical phase: carry the 2 correct rows from the old shared table into each service's new table, preserving their original `executed_at` timestamp (don't fabricate a new one).

## Key Insights
- Table schema for both old and new tables is identical (`id serial PK`, `name varchar`, `executed_at timestamptz default now()`) — confirmed via `@mikro-orm/migrations@7.0.10`'s `MigrationStorage.js:106-115` entity definition. A straight `INSERT ... SELECT` across tables is safe.
- Do not delete anything from the old `mikro_orm_migrations` table yet — it stays untouched until phase 07's cleanup decision, so this step is trivially reversible (`DELETE FROM project_service_migrations WHERE name = '...'`).

## Requirements
- Functional: `project_service_migrations` gets exactly 1 row for `Migration20260830120000`; `user_service_migrations` gets exactly 1 row for `Migration20251121025600`. Original `executed_at` preserved.
- Non-functional: old shared table remains fully intact after this phase.

## Architecture
```
mikro_orm_migrations (old, untouched)
  ├─ Migration20251121025600 ──copy──→ user_service_migrations
  └─ Migration20260830120000 ──copy──→ project_service_migrations
```

## Related Code Files
- None (data-only operation via psql).

## Implementation Steps

1. **[⚠️ REQUIRES EXPLICIT GO-AHEAD — INSERTs into 2 real tables]**
   ```bash
   docker exec nest_turbo_db psql -U "$DEFAULT_PG_USER" -d ai-agent -c \
     "INSERT INTO project_service_migrations (name, executed_at)
      SELECT name, executed_at FROM mikro_orm_migrations WHERE name = 'Migration20260830120000';"

   docker exec nest_turbo_db psql -U "$DEFAULT_PG_USER" -d ai-agent -c \
     "INSERT INTO user_service_migrations (name, executed_at)
      SELECT name, executed_at FROM mikro_orm_migrations WHERE name = 'Migration20251121025600';"
   ```
2. Verify each new table has exactly 1 row with the expected name and a non-null `executed_at`:
   ```bash
   docker exec nest_turbo_db psql -U "$DEFAULT_PG_USER" -d ai-agent -c "SELECT * FROM project_service_migrations;"
   docker exec nest_turbo_db psql -U "$DEFAULT_PG_USER" -d ai-agent -c "SELECT * FROM user_service_migrations;"
   ```
3. Confirm the old shared table is unchanged (still 2 rows):
   ```bash
   docker exec nest_turbo_db psql -U "$DEFAULT_PG_USER" -d ai-agent -c "SELECT name FROM mikro_orm_migrations;"
   ```
4. Re-run `pnpm --filter project-service migration:pending` — expect exactly 33 pending (down from 34), confirming `Migration20260830120000` is now recognized as executed under the new table.

## Todo List
- [ ] `project_service_migrations` has 1 row: `Migration20260830120000`
- [ ] `user_service_migrations` has 1 row: `Migration20251121025600`
- [ ] Old `mikro_orm_migrations` table still has its original 2 rows (untouched)
- [ ] `migration:pending` on project-service now shows 33 (not 34)

## Success Criteria
- Both new tables' single rows match the old table's `name` and `executed_at` exactly (spot-check via `SELECT`).
- `migration:pending` count drops from 34 to 33 for project-service.

## Risk Assessment
- Likelihood x Impact: Low x Low — additive INSERT only, old table untouched, trivially reversible via `DELETE`.

## Security Considerations
- None beyond standard DB-credential handling (reuse `.env` vars, never print password to logs).

## Next Steps
- Phase 05: reconcile the remaining 33 pending project-service migrations using the phase-03 triage classification.
