---
title: "Use custom statuses throughout projects"
status: in-progress
priority: P2
effort: "3h"
dependencies: [1, 2]
---

# Phase 3: Use custom statuses throughout projects

## Overview

Make newly created status metadata usable in every project flow that currently depends on the fixed five-status list. Preserve category-driven filtering and initiative progress semantics.

## Requirements

- [x] Project status selectors use the workspace catalog plus the existing built-in statuses.
- [x] Status names and colors render for custom IDs even when no issue status icon exists for that ID.
- [x] Create-project defaults and project-template configurations continue to resolve existing built-in IDs and may select a custom status.
- [x] Status changes always store the category from the selected status; never trust a client-supplied mismatched category.
- [x] Category-based project tabs, initiative progress, and issue status groupings remain unchanged.

## Implementation Steps

1. Introduce a serializable project status view type/renderer for lifecycle icon shape and configured color, separate from the issue status catalog.
2. Update project detail and row selectors, create-project dialog, and project-template settings to load and display workspace custom statuses.
3. Update project status display fallbacks in project peek panels/tooltips and status settings; leave issue-only consumers of `renderStatusIcon` untouched.
4. Verify create/update/template application with custom IDs and ensure category-based tabs and initiative rollups still classify by lifecycle.
5. Add backend coverage for selecting another workspace's custom ID and for existing built-in status compatibility; run type/build checks and manual UI acceptance.

## Todo

- [x] Replace fixed-only options in overview/detail/list status selectors.
- [x] Connect create-project and project-template forms to the workspace status catalog.
- [x] Render custom status names/colors/icons in project-specific summary surfaces.
- [x] Verify lifecycle filters and issue-status views remain unaffected.

## Success Criteria

- [ ] A custom status can be assigned from project overview, details panel, project list, project creation, and project templates.
- [ ] Selected custom status shows its configured name/color in selectors and project summary surfaces.
- [ ] Existing projects, templates, and the default `in-progress` selection continue to work unchanged.
- [ ] Project category filters and initiative progress still use the parent lifecycle category.
- [ ] Issue status selectors and project issue-grouping behavior are unchanged.

## Files to Create / Modify

- Create `apps/web/lib/project-status.tsx` — serializable project status type and category-aware custom icon/color renderer, separate from issue status UI components.
- Modify `apps/web/mock-data/projects.ts` — type `Project.status` with the project status view model.
- Modify `apps/web/components/common/projects/status-selector.tsx` and `status-with-percent.tsx` — consume workspace status options and render custom metadata.
- Modify `apps/web/components/common/projects/create-project-dialog.tsx` — use the catalog and preserve the current default.
- Modify `apps/web/components/common/settings/project-templates-settings.tsx` — use the same catalog when authoring project templates.
- Modify project-specific metadata surfaces such as `project-peek-panel.tsx` and `teams/projects-tooltip.tsx` to render custom status metadata.
- Modify project response types/services and `apps/project-service/src/modules/projects/project-status-assignment.spec.ts` to enforce the final API contract.

## Verification

- `pnpm --filter project-service test -- --runInBand`
- `pnpm --filter project-service check-types`
- `pnpm --filter web build`
- Manually create one custom status per lifecycle group and verify assignment/display on an existing project, a new project, and a project template.
