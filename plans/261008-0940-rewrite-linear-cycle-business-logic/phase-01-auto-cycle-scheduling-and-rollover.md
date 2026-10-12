# Phase 01 — Automatic cycle scheduling and rollover

## Context and requirements

The existing cycle engine can generate upcoming cycles, but cycle settings default to disabled, a manual create-cycle dialog/API remains the primary visible path, and status reconciliation only runs from cycle/settings reads or explicit `startToday`. Align enabled-team behavior with Linear's recurring team cadence, rollover, cooldown, and no-cycle issue automation. Projects stay independent; issues carry both project and cycle relationships.

## Files

- `apps/project-service/src/modules/cycles/cycles.service.ts`
- `apps/project-service/src/modules/cycles/cycle-automation-scheduler.ts`
- `apps/project-service/src/modules/cycles/cycle-automation-scheduler.spec.ts`
- `apps/project-service/src/modules/cycles/cycles.service.spec.ts`
- `apps/web/components/common/cycles/create-cycle-dialog.tsx` and its Cycles page caller
- `apps/web/hooks/queries/use-cycles-query.ts`
- `apps/web/services/cycles.service.ts`
- `apps/web/lib/api/cycles.ts`
- `docs/linear-parity-audit.md`

Adjust the file list only if code ownership requires it; avoid schema changes unless concurrency guarantees need one.

## Steps

1. Extract explicit invariants for scheduled generation, cycle boundary reconciliation, rollover eligibility, and cooldown attribution.
2. Add lifecycle-driven periodic reconciliation for enabled team settings; serialize same-process work per team and make repeated runs idempotent.
3. Remove the user-facing per-cycle creation flow while preserving the backend API contract and editing of scheduled future cycles.
4. Add focused tests for automatic provisioning, repeated/concurrent reconciliation, timezone boundaries, cooldown rollover, excluded statuses, and disabling cycles.
5. Update the Linear parity audit with verified behavior and limits.

## Validation

- Run focused `cycles.service.spec.ts` and cycle settings specs.
- Run project-service lint, typecheck, and build.
- Review the diff for API callers, lifecycle cleanup, and race/idempotency issues.
- Verify docs links and claims against tests and implementation.

## Risks and rollback

- A background timer may overlap request-triggered reconciliation; guard by team and ensure duplicate scheduled dates cannot be produced.
- Removing the first-party manual cycle flow is an intentional UX change; retain the backend create contract, future-cycle date adjustment, and completed history.
- Roll back code and API/UI removal together if reconciliation or issue rollover regresses; no data migration is expected.
