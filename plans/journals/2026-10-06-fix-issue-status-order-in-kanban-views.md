---
title: Fix issue status order in Kanban views
date: 2026-10-06
summary: Use lifecycle status ordering across all-issues and cycle board/list views.
---

# Fix issue status order in Kanban views

## What happened

All-issues and cycle issue views supplied `displayOrderedStatus` to the shared grouped view, which put started statuses ahead of triage, backlog, and unstarted statuses. Category-filtered issue tabs used the same display-first ordering.

## Decision

Use the existing `workflowOrderedStatus` sequence for All Issues and cycle views, and derive Active/Backlog subsets from it. This keeps status order consistent for board and list layouts without changing grouping or issue records.

## Next steps

Monorepo and web TypeScript checks passed, and the exported sequence/category helper were checked at runtime. A visual board/list smoke test remains unverified because the local app route requires authentication.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
