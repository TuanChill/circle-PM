# Phase 02 — Isolate Migration Tracking Config

## Context Links
- Plan overview: [plan.md](plan.md)
- `apps/project-service/mikro-orm.config.ts:6-21` (current `migrations` block, no `tableName`)
- `apps/user-service/mikro-orm.config.ts:6-12` (current `migrations` block, no `tableName`)

## Overview
- Priority: P0
- Status: pending
- Pure code change. No DB access in this phase — the new tables don't get created until phase 03 runs a `migration:*` CLI command against the new config.

## Key Insights
- MikroORM defaults `migrations.tableName` to `mikro_orm_migrations` when unset — confirmed via `@mikro-orm/migrations@7.0.10`'s `MigrationStorage.getTableName()` splitting `options.tableName` (no fallback logic exists for a per-service default, it's a flat string you must set).
- Table name only needs to be unique per-database, not globally — `project_service_migrations` / `user_service_migrations` in the shared `public` schema is sufficient since both services also share that schema already for other tables.

## Requirements
- Functional: each service's `mikro-orm.config.ts` sets an explicit, distinct `migrations.tableName`.
- Non-functional: no other config keys change; preserve existing `snapshot: false` / `skipTables` on project-service untouched.

## Architecture
```
Before: project-service ─┐
                          ├─→ mikro_orm_migrations (shared, colliding)
        user-service ────┘

After:  project-service ──→ project_service_migrations
        user-service ─────→ user_service_migrations
        (old mikro_orm_migrations left untouched until phase 04/07)
```

## Related Code Files
- Modify: `apps/project-service/mikro-orm.config.ts`
- Modify: `apps/user-service/mikro-orm.config.ts`

## Implementation Steps

1. Edit `apps/project-service/mikro-orm.config.ts` — add `tableName` to the `migrations` block:
   ```ts
   migrations: {
     path: path.join(__dirname, 'src/database/migrations'),
     tableName: 'project_service_migrations',
     snapshot: false,
   },
   ```
2. Edit `apps/user-service/mikro-orm.config.ts` — add `tableName` to the `migrations` block:
   ```ts
   migrations: {
     path: path.join(__dirname, 'src/database/migrations'),
     tableName: 'user_service_migrations',
   },
   ```
3. Add a short comment above each `tableName` line noting *why* (prevents a future 3rd service repeating the mistake without needing to read this plan):
   ```ts
   // Explicit per-service table: MikroORM defaults to "mikro_orm_migrations"
   // for every service, which silently collides when services share a DB.
   tableName: 'project_service_migrations',
   ```
4. `pnpm --filter project-service check-types` and `pnpm --filter user-service check-types` — confirm no type errors (this is a plain object literal addition, should be a no-op compile-wise).

## Todo List
- [ ] `project-service` config sets `tableName: 'project_service_migrations'`
- [ ] `user-service` config sets `tableName: 'user_service_migrations'`
- [ ] Explanatory comment added to both
- [ ] Both services type-check clean

## Success Criteria
- `git diff` shows only the `tableName` addition (+ comment) in both config files — no other lines touched.
- Type-check passes for both services.

## Risk Assessment
- Likelihood x Impact: Low x Low — this is additive config, not yet executed against the DB. Nothing breaks until a `migration:*` command runs (phase 03).

## Security Considerations
- None (no secrets, no data access in this phase).

## Next Steps
- Phase 03: first CLI invocation against the new config — this is where DB mutation begins (new empty tables get created).
