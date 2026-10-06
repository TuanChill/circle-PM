# Phase 07 — mcp-server Verification & Cleanup

## Context Links
- Plan overview: [plan.md](plan.md)
- Depends on: [phase-06](phase-06-verify-both-services-boot-clean.md) (both services boot clean)
- `apps/mcp-server/README.md` (JWT minting flow, tool invocation via MCP Inspector)
- `plans/260921-1846-add-mcp-server/phase-05-local-verification.md:29,78,86,109` (the exact 6 tool calls that previously 500'd: `project_list`, `cycle_list`, `label_list`, `initiative_list`, `view_list`, `issue_create`)

## Overview
- Priority: P1 (proves the fix from the original bug report, not required for the DB itself to be "fixed")
- Status: pending
- Final phase: prove the originally-reported symptom is gone, then decide the old shared table's fate and document the convention so a 3rd service doesn't repeat this bug.

## Key Insights
- The mcp-server plan (`plans/260921-1846-add-mcp-server/`) already documented this exact bug as an out-of-scope follow-up — this phase is that follow-up's closure, re-running the same 6 tool calls that failed there.
- Renaming (not dropping) the old shared table is the safer default: it's reversible in seconds if something was missed, whereas `DROP TABLE` relies entirely on the phase-01 backup for recovery.

## Requirements
- Functional: all 6 previously-failing mcp-server tool calls succeed against real data; old shared table renamed (not dropped) to make its deprecated status obvious; a short doc note exists warning future services about this collision class.
- Non-functional: no new destructive action beyond a table rename (reversible).

## Architecture
```
mcp-server (stdio) → JWT → project-service (now fully migrated) → ai-agent DB
   6 tool calls that previously hit "relation X does not exist" now succeed
```

## Related Code Files
- Modify: `docs/system-architecture.md` (create if missing — short "Database & Migrations" section; per this repo's `documentation-management.md`, this is the doc that should record such infra decisions).
- No app source code changes.

## Implementation Steps

1. **[Read-only]** Start project-service (if not already running from phase 06) and mint a JWT per `apps/mcp-server/README.md`'s local-dev flow (using a real member id from the now-consistent DB).
2. **[Read-only]** Build and run mcp-server against the MCP Inspector:
   ```bash
   pnpm --filter mcp-server build
   PROJECT_ACCESS_TOKEN=<jwt> PROJECT_SERVICE_APP_URL=http://localhost:3304/circle/api \
     npx @modelcontextprotocol/inspector node apps/mcp-server/dist/main.js
   ```
3. **[Read/write via existing app APIs, not raw DB access — normal application usage]** Re-run the 6 previously-failing tool calls and confirm real JSON responses instead of 500s:
   - `project_list`
   - `cycle_list`
   - `label_list`
   - `initiative_list`
   - `view_list`
   - `issue_create` (happy path — this creates a real row; acceptable since it's the app's own normal write path, not a raw DB mutation)
4. **[⚠️ REQUIRES EXPLICIT GO-AHEAD — renames a live table]** Once all 6 calls are confirmed passing, rename the old shared table to make its deprecated status unambiguous (do not drop):
   ```bash
   docker exec nest_turbo_db psql -U "$DEFAULT_PG_USER" -d ai-agent -c \
     "ALTER TABLE mikro_orm_migrations RENAME TO mikro_orm_migrations_deprecated_shared;"
   ```
   Confirm neither service references this table anymore (both now point at their own `tableName`):
   ```bash
   pnpm --filter project-service migration:pending   # still empty
   pnpm --filter user-service migration:pending      # still empty
   ```
5. Add a short "Database & Migrations" section to `docs/system-architecture.md` (create the file with just this section if it doesn't exist yet — do not backfill unrelated architecture content):
   ```markdown
   ## Database & Migrations
   Services sharing a local Postgres database MUST set a distinct
   `migrations.tableName` in their `mikro-orm.config.ts` — MikroORM defaults
   every service to `mikro_orm_migrations`, which silently collides across
   services on the same DB. Convention: `<service_name>_migrations`
   (e.g. `project_service_migrations`, `user_service_migrations`).
   ```
6. Final sanity pass: re-run `pnpm --filter project-service exec mikro-orm schema:update --run=false --dump` one more time — must still report no diff (confirms the table rename in step 4 didn't disturb anything).

## Todo List
- [ ] `project_list`, `cycle_list`, `label_list`, `initiative_list`, `view_list` return real data (not 500)
- [ ] `issue_create` succeeds (happy path)
- [ ] Old shared table renamed to `mikro_orm_migrations_deprecated_shared`
- [ ] Both services still show empty `migration:pending` after the rename
- [ ] `docs/system-architecture.md` has the Database & Migrations convention note
- [ ] Final `schema:update --dump` still reports up-to-date

## Success Criteria
- All 6 tool calls from `plans/260921-1846-add-mcp-server/phase-05-local-verification.md` succeed against real data.
- Old table renamed, not referenced by either service, still fully intact (nothing dropped).
- Doc note exists so a future 3rd service can discover the convention without re-deriving this incident.

## Risk Assessment
- Likelihood x Impact: Low x Low — `RENAME TABLE` is instantaneous, non-destructive, and trivially reversible (`ALTER TABLE ... RENAME TO mikro_orm_migrations`).

## Security Considerations
- Reuse of the JWT-minting approach already documented and reviewed in `apps/mcp-server/README.md` — no new auth surface introduced. Treat the minted token per that README's existing security note (never commit/paste it).

## Next Steps
- None — this closes the plan. Actually `DROP TABLE mikro_orm_migrations_deprecated_shared` is an explicit future decision for the user, not part of this plan.
