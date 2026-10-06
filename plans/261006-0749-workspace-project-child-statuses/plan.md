---
title: "Add workspace project child statuses"
description: "Allow workspace admins to create custom project statuses inside the existing lifecycle groups."
status: in-progress
priority: P2
effort: "1d"
tags: [feature, backend, frontend]
created: 2026-10-06
---

# Add workspace project child statuses

## Overview

Add a workspace-level project status catalog so an Owner or Admin can create child statuses inside Backlog, Planned, In Progress, Completed, or Canceled, matching the interaction shown in the supplied screenshot. A child status stores its name, optional description, color, parent lifecycle category, and stable position. New statuses must be available when creating or updating a project and in project templates.

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Create workspace-scoped child statuses from the Project statuses settings page. | P2 |
| 2 | Make custom statuses persist and render across all project status consumers. | P2 |
| 3 | Preserve the existing five built-in project status IDs and issue status workflow. | P2 |

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Persist and serve workspace statuses](./phase-01-start.md) | In Progress |
| 2 | [Create child statuses in settings](./phase-02-workspace-status-catalog.md) | Complete |
| 3 | [Use custom statuses throughout projects](./phase-03-dynamic-project-status-consumers.md) | Complete |

## Scope and Decisions

- Status definitions are workspace-level. The create action is available to workspace Owners and Admins; workspace members can view and use the catalog.
- Each status belongs to the lifecycle group whose plus button opened the form. The category cannot be changed during creation.
- The UI labels `Planned` over the existing `unstarted` category. Keep that stored category value; do not introduce a new lifecycle category.
- Keep built-in status IDs (`backlog`, `in-progress`, `done`, `paused`, `canceled`) valid and unchanged. Persist only newly created statuses, with workspace-scoped IDs.
- New statuses include a required name, optional description, color, and append position. The first slice supports creation only; editing, deleting, archiving, team-specific status inheritance, custom icons, and manual reordering are outside this request.
- Linear documents workspace-level custom statuses and customization of names, descriptions, and colors; the supplied screenshot shows adding a status from a lifecycle group. [Linear Project status](https://linear.app/docs/project-status)
- The change spans more than eight source files because persistence, workspace access, project serialization, settings creation, and existing project selectors are separate owners; each is required for the status to be usable end to end.

## Dependencies

- None.

## Success Criteria

- [ ] Owners/Admins can create a child status under any existing lifecycle group, and it remains after refresh.
- [ ] A newly created status is isolated to its workspace and cannot be assigned to a project in another workspace.
- [ ] The new status is selectable for existing projects, new projects, and project templates, and its name/color/category render correctly.
- [ ] Existing built-in project statuses and all issue status behavior remain unchanged.
- [ ] Lifecycle-based project tabs and initiative progress continue to use the parent category.
- [ ] Migration is additive, has a reviewed rollback approach, and is applied only after a database backup.

## Research

- [Backend scout](./reports/backend-scout.md)
- [Frontend scout](./reports/frontend-scout.md)

## Validation Log

### Verification Results

- **Tier:** Standard
- **Claims checked:** 12
- **Verified:** 12 | **Failed:** 0 | **Unverified:** 0
- Settings groups and disabled create actions: `apps/web/components/common/settings/project-statuses-settings.tsx:14`, `:54`.
- Fixed project status IDs and category validation: `apps/project-service/src/modules/projects/project-rules.ts:1`; response metadata is static: `apps/project-service/src/modules/projects/projects.service.ts:41`, `:315`.
- Workspace manager roles are `Owner`/`Admin`: `apps/project-service/src/modules/access-control.ts:14`; project status selectors/templates still use the fixed catalog: `apps/web/components/common/projects/status-selector.tsx:13`, `apps/web/components/common/settings/project-templates-settings.tsx:38`.
- The web package has no test script: `apps/web/package.json:5`; verification uses backend tests/typecheck, web build, and manual settings/project flows.
- Implementation now adds the additive custom-status registry/API, category-derived project assignment, workspace settings creation, and dynamic status consumers. Backend tests (71 suites, 254 tests), project-service typecheck, targeted backend lint, and web production build pass.
- CI run [37443361602](https://github.com/TuanChill/circle-PM/actions/runs/37443361602) passed web lint/build and project-service typecheck/build/tests. Deployment [37443686178](https://github.com/TuanChill/circle-PM/actions/runs/37443686178) applied `Migration20261006140000` and started project-service/web successfully, but logged `No new project-service migrations detected; skipping database backup` because the workflow had checked out the target SHA before calling `deploy.sh`.
- Follow-up commit `2d11539` changed the guard to use a persistent last-deployed SHA marker. Deployment [37445331209](https://github.com/TuanChill/circle-PM/actions/runs/37445331209) created and validated `/opt/circle/db-backups/project-service-20261006T095306Z-2d11539.dump` before rerunning `migration:up`, then completed successfully. This is a post-migration baseline backup, not a pre-migration backup for the first application. The migration only created an empty additive table and did not rewrite existing project rows; no destructive rollback was attempted.
- The pre-migration-backup success criterion remains unmet for the first application. Future project-service migrations now fail closed unless a verified backup can be created. The rollback drops the registry and requires projects using custom IDs to be reassigned first.

### Whole-Plan Consistency Sweep

- **Files reread:** `plan.md` and all three `phase-*.md` files.
- **Decision deltas checked:** 4 (workspace-only scope, `Planned` maps to `unstarted`, built-in IDs remain, create-only interaction).
- **Reconciled stale references:** 0.
- **Unresolved contradictions:** 0.

<!-- slug: workspace-project-child-statuses -->
