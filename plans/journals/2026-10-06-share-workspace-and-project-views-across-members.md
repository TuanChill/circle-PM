---
title: Share workspace and project views across members
date: 2026-10-06
summary: Made workspace-scoped and project-scoped saved views visible to other members of the same workspace while preserving workspace and team access checks.
---

# Share workspace and project views across members

## What happened

Saved views without a team were returned only to their owner, and opening them by ID also rejected other workspace members. This affected workspace-wide views and project views created without a team scope.

## Decision

Include team-less views in workspace and project list queries. Allow view access when the requesting member already has access to the view's workspace; retain the existing accessible-team check for team-scoped views.

## Next steps

The project-service TypeScript check passed. No database or public API changes were needed.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
