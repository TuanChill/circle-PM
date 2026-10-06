---
title: Fix team self-join UI action
date: 2026-10-06
summary: "Use the self-join route for self-membership, show accurate Join/Leave actions, and preserve manager-only member administration."
---

# Fix team self-join UI action

## What happened

A request tried to add its authenticated user to team `PROD` through the manager-only team-members endpoint. The team existed; the API returns 404 when manager authorization fails. The UI also showed a Leave action when the current user was not a team member and offered the current user in the Add a member picker.

## Decision

Reuse the existing self-join endpoint and preserve backend permission rules. Make Team Settings show Join or confirmed Leave based on the authenticated user's membership, await team query invalidation before allowing another toggle, and remove the current user from the manager add-member picker. Added service tests for self-membership and manager-only member administration.

## Next steps

Run a browser smoke check for joined/unjoined states and the manager picker when an authenticated test environment is available. The task plan remains in progress until that check is recorded.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
