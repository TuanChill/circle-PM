# Rewrite Linear-style cycle business logic

Status: complete

## Outcome

Make enabled team cycles follow a recurring schedule automatically and roll issues forward according to Linear's documented rules, instead of asking users to create each cycle manually.

## Constraints and non-goals

- Cycles belong to teams; projects do not own or receive a cycle when created.
- Keep cycle enablement opt-in, matching Linear; preserve completed history and per-team cadence settings.
- Preserve the existing backend create-cycle contract for integrations, but remove the first-party manual creation flow.
- Avoid unrelated project, issue, or workflow changes.

## Acceptance criteria

- Enabling cycles creates the current/upcoming schedule from duration, start weekday, timezone, cooldown, and upcoming-cycle count.
- Enabled teams are periodically reconciled even when nobody is viewing the Cycles page; reconciliation is idempotent and safe on startup.
- Cycle boundaries complete the old cycle, create/maintain the next scheduled cycle, and roll only eligible unfinished issues; cooldown and no-cycle Started/Completed behavior matches Linear docs.
- Users no longer need a create-cycle action to continue the cadence; future cycles remain adjustable through existing supported controls.
- Focused backend tests, project-service checks, and updated parity documentation pass.

## Research sources

- [Linear Cycles documentation](https://linear.app/docs/use-cycles)
- [Linear Team pages documentation](https://linear.app/docs/default-team-pages)
- [Linear Projects documentation](https://linear.app/docs/projects)

## Phases

1. Research, implementation, focused verification, and docs update: [phase-01-auto-cycle-scheduling-and-rollover.md](./phase-01-auto-cycle-scheduling-and-rollover.md)

## Delivery verification

- Added startup and one-minute reconciliation for enabled team schedules; removed the first-party manual cycle creation UI while preserving the backend API.
- Cycle behavior remains team-scoped; project creation and project records do not receive a cycle.
- All 11 cycle test suites passed (34 tests); project-service lint, typecheck, and build passed; web lint, typecheck, and production build passed.
- No database migration was required. Cross-instance locking remains unnecessary for the current single-instance Compose deployment and must be added before horizontal scaling.
