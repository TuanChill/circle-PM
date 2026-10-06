---
title: "Fix shared MikroORM migrations table collision (project-service / user-service)"
description: "Split migration history tracking per service and reconcile project-service's stale/incomplete history against real local schema, with zero data loss"
status: pending
priority: P1
effort: 6h
branch: main
tags: [infra, database, mikro-orm, migrations, bugfix, high-risk]
created: 2026-09-22
---

# Fix Shared Migrations Table Collision

## Problem (confirmed, not re-derived here)
`project-service` and `user-service` both point at DB `ai-agent` (container
`nest_turbo_db`, `localhost:5534`) and neither sets MikroORM's
`migrations.tableName`, so both default to `mikro_orm_migrations` — one
shared history for two independent migration sets. The shared table has only
2 rows (1 real user-service migration + 1 of project-service's 34), so
33/34 project-service migrations show "pending" even though most of their
target tables already exist (applied by some other mechanism, e.g. earlier
`schema:update --run`). This causes real 500s (`relation "X" does not
exist`) in `apps/mcp-server` verification (`project_list`, `cycle_list`,
`label_list`, `initiative_list`, `view_list`, `issue_create`). A blind
`migration:up` already failed once (`TableExistsException: "cycles"`).

**HIGH RISK**: DB holds real local seeded data. Every phase that mutates the
DB requires a fresh explicit user go-ahead at execution time — plan approval
does not carry forward to execution of destructive steps.

## Phases

| # | Phase | Mutates DB? | Depends on |
|---|-------|-------------|------------|
| 01 | [Backup & safety prep](phase-01-backup-and-safety-prep.md) | Read-only (produces backup files) | — |
| 02 | [Isolate migration tracking config](phase-02-isolate-migration-tables-config.md) | No (code only) | 01 |
| 03 | [Baseline inspection & triage](phase-03-baseline-schema-inspection-and-triage.md) | Yes (creates 2 new empty tables) | 02 |
| 04 | [Migrate legacy tracking rows](phase-04-migrate-legacy-tracking-rows.md) | Yes (2 INSERTs) | 03 |
| 05 | [Reconcile project-service's 33 pending migrations](phase-05-reconcile-project-service-pending-migrations.md) | Yes (DDL/data + INSERTs) | 04 |
| 06 | [Verify both services boot clean](phase-06-verify-both-services-boot-clean.md) | No (read-only + optional restart) | 05 |
| 07 | [mcp-server verification & cleanup](phase-07-mcp-server-verification-and-cleanup.md) | Yes (old table rename, optional) | 06 |

## Key dependency
Phase 05 is the core of the fix and the highest-risk phase — it individually
reconciles each of the 33 currently-"pending" project-service migrations
against live schema (not a blind bulk classification). Phases 01-04 exist
solely to make phase 05 safe and reversible.

## Non-goals
- No entity/schema code changes — only migration bookkeeping and gap-closing
  DDL/data already defined in existing migration files.
- No change to user-service's actual schema (only its tracking-table
  identity moves).
- Dropping (vs renaming) the old shared table is deferred — phase 07 renames
  it; actual drop is a separate future decision.

## Rollback (all phases)
`pg_restore` from the phase-01 backup fully undoes phases 02-07 (config
changes are reverted via git, DB state via restore). See phase-01 for exact
command.

## Unresolved questions
- Full classification of all 33 migrations (fully-applied / not-applied /
  partial) is NOT pre-computed in this plan — phase 05 defines the
  methodology; actual bucketing must happen against the live DB at execution
  time (per task instruction: don't assume the boundary).
- Whether to eventually DROP (not just rename) the old shared
  `mikro_orm_migrations` table is left to the user, post-verification.
