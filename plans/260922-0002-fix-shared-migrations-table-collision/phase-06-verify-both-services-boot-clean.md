# Phase 06 — Verify Both Services Boot Clean

## Context Links
- Plan overview: [plan.md](plan.md)
- Depends on: [phase-05](phase-05-reconcile-project-service-pending-migrations.md) (project-service fully reconciled)
- `apps/mcp-server/README.md` (`Rebuild them: pnpm --filter @app/common build && pnpm --filter @app/core build` — known local gotcha if boot fails with unrelated config errors)

## Overview
- Priority: P0
- Status: pending
- Confirms the fix didn't regress user-service (which must remain functionally untouched) and that project-service now boots against a fully-tracked schema.

## Key Insights
- user-service has exactly 1 migration and was never touched by phase 05 — this phase exists purely to prove the config-only change (phase 02) + tracking-table split (phase 04) didn't break it.
- `migration:pending` returning empty is necessary but not sufficient — actually booting each service (which runs MikroORM's entity-to-schema binding at startup) is the real regression check.

## Requirements
- Functional: both services start without MikroORM/config errors; user-service's own migration is still the only one it recognizes as executed.
- Non-functional: no new migrations are created or run in this phase (verification only).

## Architecture
```
project-service boot → MikroORM connects → entities bind against live schema
                                              (should now match exactly, no drift)
user-service boot    → MikroORM connects → entities bind against its own tables
                                              (should be identical to pre-fix behavior)
```

## Related Code Files
- None modified. Verification only.

## Implementation Steps

1. **[Read-only / process start, no DB mutation]** Boot project-service:
   ```bash
   pnpm --filter project-service start:dev
   ```
   Confirm clean startup log, no `relation "..." does not exist` or config validation errors. If it fails with unrelated required-env errors, rebuild shared libs first per the mcp-server README gotcha:
   ```bash
   pnpm --filter @app/common build && pnpm --filter @app/core build
   ```
2. In a separate terminal, confirm `migration:pending` still empty and `migration:list` shows all 34 names with real timestamps:
   ```bash
   pnpm --filter project-service migration:list
   ```
3. Stop project-service, boot user-service:
   ```bash
   pnpm --filter user-service start:dev
   ```
   Confirm clean startup, no errors referencing `user_service_migrations` or `mikro_orm_migrations`.
4. Confirm user-service's tracking table is unaffected:
   ```bash
   pnpm --filter user-service migration:pending   # expect: No pending migrations
   pnpm --filter user-service migration:list       # expect: 1 row, Migration20251121025600
   ```
5. Exercise one real user-service read path (whatever existing smoke check the service already exposes, e.g. its health endpoint or an existing e2e test) to confirm no functional regression beyond migration tracking:
   ```bash
   pnpm --filter user-service test:e2e
   ```

## Todo List
- [ ] project-service boots clean, no schema/config errors
- [ ] project-service `migration:list` shows all 34 names
- [ ] user-service boots clean, no schema/config errors
- [ ] user-service `migration:pending` still empty, `migration:list` still shows its 1 original migration
- [ ] user-service e2e/smoke check passes (no regression)

## Success Criteria
- Both services start and serve requests without any migration- or schema-related error in logs.
- user-service's existing test suite (`test:e2e`) passes exactly as it did before this plan's changes.

## Risk Assessment
- Likelihood x Impact: Low x Medium — if user-service fails to boot, the root cause is isolated to phase 02's config edit or phase 04's row-copy (small, easily diffable changes) — revert those two specific changes rather than the full DB restore.

## Security Considerations
- None new.

## Next Steps
- Phase 07: end-to-end proof via mcp-server's previously-failing tool calls, then finalize the old shared table's fate and add the regression-guard doc note.
