---
title: "Create child statuses in settings"
status: complete
priority: P2
effort: "2h"
dependencies: [1]
---

# Phase 2: Create child statuses in settings

## Overview

Replace the disabled plus buttons with a focused create-status form in each lifecycle group. Group choice fixes the parent category; the new status is stored in the current workspace and shown even when no projects use it yet.

## Requirements

- [x] Use the current route workspace identity and the workspace status API.
- [x] Require a non-empty status name; allow description and color, with accessible color choices/input.
- [x] Derive the category from the group whose plus button was used. Display `unstarted` as `Planned` in the UI.
- [x] Show status rows from the catalog and merge project-use counts; preserve server position rather than sorting by count.
- [x] Expose creation only to workspace Owners/Admins, and provide loading, validation, duplicate-name, API-error, and success states.
- [x] Keep existing `No statuses` behavior for empty categories with no configured custom status.

## Implementation Steps

1. Add a project-status service and React Query list/create hooks using the resolved workspace ID in the query key.
2. Update `ProjectStatusesSettings` to fetch the catalog and project counts, group statuses by lifecycle, and enable the plus action for authorized workspace managers.
3. Add the create dialog or inline form with name, optional description, and color; the clicked group supplies the immutable category.
4. On success, close the form and invalidate status catalog and project queries. On failure, retain input and surface the API error.
5. The web package has no test runner; verify form states in the existing app and run the web build without adding test infrastructure for this feature.

## Todo

- [x] Add workspace project-status query and create mutation.
- [x] Implement category-scoped creation from the existing plus buttons.
- [x] Render configured custom statuses and project counts in stable order.
- [x] Add explicit loading, error, validation, and permission states.

## Success Criteria

- [x] Creating from Backlog, Planned, In Progress, Completed, or Canceled stores the status under that group and survives refresh.
- [x] Blank/duplicate names and invalid colors show an actionable error without losing entered values.
- [x] Custom statuses with zero assigned projects remain visible with a zero count.
- [x] Members without management permission cannot create statuses through either UI or API.

## Files to Create / Modify

- Create `apps/web/services/project-statuses.service.ts` and a project status query module under `apps/web/hooks/queries/`.
- Modify `apps/web/hooks/queries/keys.ts` — add workspace-scoped status query keys.
- Modify `apps/web/components/common/settings/project-statuses-settings.tsx` — render catalog-backed lifecycle groups, counts, and plus actions.
- Create a small status creation dialog/component under `apps/web/components/common/settings/` if needed by local settings patterns.
- Modify the workspace role/context consumer only as required to gate the creation control.

## Verification

- Exercise create success, validation failure, API failure, unauthorized, and zero-project-count states.
- `pnpm --filter web build`
