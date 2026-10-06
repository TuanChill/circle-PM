---
title: "Persist and serve workspace statuses"
status: in-progress
priority: P2
effort: "3h"
dependencies: []
---

# Phase 1: Persist and serve workspace statuses

## Overview

Add the additive, workspace-scoped custom status registry and API while keeping the existing built-in status IDs intact. Resolve custom project statuses from the owning workspace and derive their category on the server.

## Requirements

- [x] Store custom status ID, workspace ID, name, optional description, color, lifecycle category, position, and timestamps.
- [x] Accept only existing lifecycle categories: `backlog`, `unstarted`, `started`, `completed`, and `canceled`; the UI label `Planned` maps to `unstarted`.
- [x] Members who can access a workspace may list its status catalog; only workspace Owners/Admins may create statuses.
- [x] When assigning a status to a project, validate that it is either a built-in status or a custom status belonging to the project's workspace; set `statusCategory` from the resolved status.
- [x] Preserve existing project status IDs and templates without backfilling or rewriting current project rows.

## Implementation Steps

1. Add a `ProjectStatus` entity and register/export it through MikroORM's entity indexes.
2. Add an additive migration for the workspace-scoped `project_statuses` table with uniqueness and category/position lookup indexes.
3. Back up the target database before applying the migration. Keep the custom status table during an application rollback if any project references a custom ID; only drop it after those projects are reassigned and the backup is verified.
4. Add workspace-scoped list/create DTOs, service, and controller routes with OpenAPI metadata. Reuse workspace visibility and Owner/Admin checks from the workspace access-control patterns.
5. Resolve custom status metadata in project responses and validate project create/update status IDs against the project workspace. Batch-load custom statuses for list responses to avoid per-project queries.
6. Add service tests for workspace isolation, permissions, category validation, ID resolution, and unchanged built-in statuses.

## Todo

- [x] Add the custom project status entity and migration.
- [x] Add workspace status list/create API with role and input validation.
- [x] Resolve the status category on project status changes and serialize custom name/color.
- [x] Add focused service, project-assignment, and template coverage.

## Success Criteria

- [x] Workspace Members can read their workspace catalog, and unrelated members cannot read it.
- [x] Only Owners/Admins can create a status; duplicate/blank names, invalid colors, and unsupported categories are rejected.
- [x] A project accepts a custom status only from its own workspace and receives the category stored on that status.
- [x] Existing built-in project statuses retain their current IDs and response metadata.
- [ ] The migration is additive, verified against a database backup, and rollback does not strand projects using custom status IDs.

## Files to Create / Modify

- Create `apps/project-service/src/data-access/project/project-status.entity.ts` — persistent custom status model.
- Modify `apps/project-service/src/data-access/project/index.ts` and `apps/project-service/src/data-access/all.entity.ts` — export/register the entity.
- Create `apps/project-service/src/database/migrations/Migration<timestamp>.ts` — additive table migration.
- Create `apps/project-service/src/modules/project-statuses/` — DTO, controller, module, and workspace-scoped service.
- Modify `apps/project-service/src/modules/app.module.ts` — register the status module.
- Modify `apps/project-service/src/modules/projects/projects.service.ts` and `project-rules.ts` — resolve and validate built-in/custom statuses.
- Create `apps/project-service/src/modules/project-statuses/project-statuses.service.spec.ts` — cover catalog access, creation, and workspace isolation.
- Create `apps/project-service/src/modules/projects/project-status-assignment.spec.ts` — cover custom assignment, serialization, and built-in compatibility.
- Modify `apps/project-service/src/modules/project-templates/project-templates.service.spec.ts` — verify a saved custom status is validated when a template creates a project.

## Verification

- `pnpm --filter project-service test -- --runInBand`
- `pnpm --filter project-service check-types`
- Production deployment creates and validates a PostgreSQL custom-format dump before any new project-service migration; verify the deploy log records the backup before migration execution.
- The migration is additive. Before rollback, reassign projects using custom IDs; the production backup remains outside the application checkout.
