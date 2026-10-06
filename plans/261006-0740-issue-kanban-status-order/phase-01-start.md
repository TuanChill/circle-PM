---
title: "Order issue statuses by workflow lifecycle"
status: done
priority: P2
effort: "1h"
dependencies: []
---

# Phase 1: Order issue statuses by workflow lifecycle

## Overview

Replace the display-first status ordering used by issue, cycle, and Project Issues views with the existing canonical workflow lifecycle order.

## Requirements

- [x] Use one shared status sequence for status-grouped issue lists and Kanban boards.
- [x] Apply the sequence to all-issues (including category-filtered tabs), cycle views, and Project Issues.
- [x] Keep existing grouping, empty-column, completed-issue, and per-group issue sorting behavior intact.

## Implementation Steps

1. In `apps/web/lib/workflow-status.tsx`, make `getStatusesByCategory` filter `workflowOrderedStatus` so Active and Backlog use the same lifecycle sequence.
2. In `apps/web/components/common/issues/all-issues.tsx`, provide `workflowOrderedStatus` for all-issues.
3. In `apps/web/components/common/issues/cycle-issues.tsx`, provide the same canonical order to `GroupedIssuesView`.
4. In `apps/web/components/common/projects/details/project-issues.tsx`, use the same canonical order for the project issue view.

## Todo

- [x] Update grouped status ordering without changing non-status grouping behavior.
- [x] Verify triage/backlog/unstarted/started/completed/canceled ordering in board and list modes.
- [x] Verify Active and Backlog category filtering still excludes unrelated statuses.
- [x] Verify Project Issues uses the canonical workflow order.
- [x] No web test runner or test files are currently present; do not add test infrastructure for this focused fix.

## Success Criteria

- [x] Both issue and cycle views render status groups in canonical workflow lifecycle order.
- [x] Focused checks pass and no unrelated behavior changes.

## Files to Modify

- `apps/web/components/common/issues/all-issues.tsx` — use lifecycle ordering for all-issues.
- `apps/web/components/common/issues/cycle-issues.tsx` — use lifecycle ordering for cycle status groups.
- `apps/web/lib/workflow-status.tsx` — filter category-specific status groups from the canonical lifecycle order.

## Verification

- Run `pnpm check-types` from the monorepo root.
- Manually verify issue, cycle, and Project Issues views in board and list modes, including Active and Backlog tabs.
