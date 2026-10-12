---
title: Fix issue card assignee persistence
date: 2026-10-12
summary: Passed issue identifiers from issue cards and other assignee selectors so assignment changes reach the update API.
---

# Fix issue card assignee persistence

## What happened
Issue cards showed the newly selected assignee locally, but reloading restored the previous assignment. The card and list selectors did not pass an issue identifier to `AssigneeUser`, so its persistence callback returned before calling the update mutation.

## Decision
Pass each issue's identifier to every issue-backed assignee selector: grid cards, list rows, drag previews, and sub-issues. The existing issue update API already supports assignee changes, so no backend contract change was needed.

## Next steps
Focused ESLint passed. The web TypeScript check remains blocked by the existing `apps/web/app/layout.tsx` side-effect CSS import diagnostic.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
