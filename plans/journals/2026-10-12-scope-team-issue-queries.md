---
title: Scope team issue queries
date: 2026-10-12
summary: Fixed the team issue list to send its active route team ID to the issues API.
---

# Scope team issue queries

## What happened
The team issue list at `/{orgId}/team/{teamId}/all` read `teamId` from the route but called `useIssues()` without it, so the request was limited only by workspace and included issues from other teams.

## Decision
Pass the route's `teamId` to `useIssues` in `apps/web/components/common/issues/all-issues.tsx`. The shared component also fixes the Active and Backlog team tabs, which use the same query path.

## Validation
`pnpm exec prettier --check apps/web/components/common/issues/all-issues.tsx` and `pnpm --filter web exec tsc --noEmit --pretty false` passed. `git diff --check` passed.

## Next steps
No additional work required.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
