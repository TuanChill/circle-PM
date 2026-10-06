---
title: "Fix issue status order in Kanban views"
description: "Arrange issue status columns in workflow lifecycle order across issue and cycle views."
status: completed
priority: P2
effort: "1h"
tags: [bugfix, frontend]
created: 2026-10-06
---

# Fix issue status order in Kanban views

## Overview

Issue views should use the canonical workflow lifecycle order so Kanban columns progress from triage/backlog through unstarted and started work to completed and canceled states. The Project Issues tab was missed by the original fix and continued to use `displayOrderedStatus`.

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Show issue status groups in workflow lifecycle order in board and list views. | P2 |

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Order issue statuses by workflow lifecycle](./phase-01-start.md) | Done |

## Success Criteria

- [x] Status groups render as triage, backlog, unstarted, started, completed, then canceled.
- [x] The same order is used by all-issues, cycle, and Project Issues views in both board and list layouts.
- [x] Active and backlog tabs continue to include only their configured status categories.
- [x] Existing status icons, labels, grouping behavior, and issue updates remain unchanged.

## Validation

- `pnpm check-types` passed (8 tasks).
- `pnpm --filter web exec tsc --noEmit` passed.
- Runtime status sequence and category filtering were checked with the existing status catalog.
- The local app opened at its public landing page; board/list interaction was not manually smoke-tested because the workspace route requires authentication.

## Assumptions

- The canonical lifecycle order is the existing `workflowOrderedStatus` order.
- Statuses within the same category retain the stable order defined by the status catalog.
- This change does not add per-team status configuration or manual column reordering.

<!-- slug: issue-kanban-status-order -->
