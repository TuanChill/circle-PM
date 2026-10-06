# Phase 01 — Backup & Safety Prep

## Context Links
- Plan overview: [plan.md](plan.md)
- DB: container `nest_turbo_db`, db `ai-agent`, port `5534` (`docker-compose.yml:8`), user/pass from `DEFAULT_PG_USER`/`DEFAULT_PG_PASSWORD` in root `.env`.
- Gitignored backup home: `.docker/volumes/` (`.gitignore:1`) — reuse this path, never `plans/` (plan dir is version-controlled).

## Overview
- Priority: P0 (blocks every other phase)
- Status: pending
- Zero-code-change phase. Produces a restorable snapshot of `ai-agent` before anything else touches it.

## Key Insights
- `docker exec nest_turbo_db pg_dump` writes inside the container; must `docker cp` it out to survive a container recreate.
- Custom format (`-Fc`) enables selective/parallel restore; also take a plain-text schema-only dump for cheap diffing in later phases (no data, safe to eyeball).

## Requirements
- Functional: one full-data backup + one schema-only backup, both verified restorable/parseable.
- Non-functional: backups must not go into git-tracked paths.

## Architecture
```
nest_turbo_db (container)
   └─ pg_dump -Fc ai-agent → /tmp/backup.dump (inside container)
        └─ docker cp → .docker/volumes/db-backups/ai-agent-<ts>.dump (host, gitignored)
   └─ pg_dump --schema-only ai-agent → .docker/volumes/db-backups/ai-agent-<ts>.schema.sql
```

## Related Code Files
- None modified. Reads `docker-compose.yml` for container/port only.

## Implementation Steps

1. **[⚠️ REQUIRES EXPLICIT GO-AHEAD — reads DB, writes backup file, no schema/data mutation]**
   Create backup dir and full dump:
   ```bash
   mkdir -p .docker/volumes/db-backups
   TS=$(date +%Y%m%d-%H%M%S)
   docker exec nest_turbo_db pg_dump -U "$DEFAULT_PG_USER" -d ai-agent -F c -f /tmp/ai-agent-$TS.dump
   docker cp nest_turbo_db:/tmp/ai-agent-$TS.dump .docker/volumes/db-backups/ai-agent-$TS.dump
   docker exec nest_turbo_db rm /tmp/ai-agent-$TS.dump
   ```
2. Also take a schema-only text dump (used for diffing in phase 03/05, not a substitute for step 1):
   ```bash
   docker exec nest_turbo_db pg_dump -U "$DEFAULT_PG_USER" -d ai-agent --schema-only \
     > .docker/volumes/db-backups/ai-agent-$TS.schema.sql
   ```
3. Verify the custom-format dump is valid (list its table of contents, does not restore anything):
   ```bash
   docker cp .docker/volumes/db-backups/ai-agent-$TS.dump nest_turbo_db:/tmp/verify.dump
   docker exec nest_turbo_db pg_restore -l /tmp/verify.dump | head -30
   docker exec nest_turbo_db rm /tmp/verify.dump
   ```
   Confirm all 23 known tables (`cycles`, `document_folders`, ..., `workspaces`) appear in the listing.
4. Document the exact restore command (for use if any later phase must be rolled back) — record `$TS` used:
   ```bash
   # Full restore (drops and recreates ai-agent from the backup — DESTROYS anything written after the backup):
   docker cp .docker/volumes/db-backups/ai-agent-<TS>.dump nest_turbo_db:/tmp/restore.dump
   docker exec nest_turbo_db pg_restore -U "$DEFAULT_PG_USER" -d ai-agent --clean --if-exists -1 /tmp/restore.dump
   docker exec nest_turbo_db rm /tmp/restore.dump
   ```

## Todo List
- [ ] Full `-Fc` backup taken and copied to host
- [ ] Schema-only backup taken
- [ ] Backup verified via `pg_restore -l`
- [ ] Restore command recorded with the actual `$TS` value used, shared with user

## Success Criteria
- Two files exist under `.docker/volumes/db-backups/`: `ai-agent-<ts>.dump` and `ai-agent-<ts>.schema.sql`.
- `pg_restore -l` on the dump lists all 23 known tables without error.

## Risk Assessment
- Likelihood x Impact: Low x High (backup itself is safe; the risk it mitigates is everything downstream).
- Mitigation: verify restorability (step 3) before proceeding to any mutating phase.

## Security Considerations
- Backup files contain real member/workspace data — keep under gitignored `.docker/volumes/`, never commit, never paste into chat.

## Next Steps
- Phase 02: code-only config change (no DB access needed, can happen before or after this phase, but do not run any `migration:*` CLI command until this phase's backup is verified).
