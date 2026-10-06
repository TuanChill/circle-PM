---
title: "Make team join and member administration clear"
description: "Expose self-join and leave as accurate team membership actions while preserving manager-only member administration."
status: in-progress
priority: P2
effort: "2.5h"
branch: "main"
tags: [bugfix, frontend, backend, api]
blockedBy: []
blocks: []
created: 2026-10-06
---

# Make team join and member administration clear

## Overview

Make the team UI direct a member joining themselves to the existing self-join
route, while keeping the member administration route restricted to managers.

## Evidence and decision

- `POST /teams/:id/join` already toggles the authenticated member's membership
  after checking team access in `apps/project-service/src/modules/teams/teams.service.ts`.
- `POST /teams/:id/members` is for managers adding another workspace member and
  checks workspace/team manager roles. It deliberately returns 404 when that
  permission check fails.
- The Teams Members screen always offers “Add a member” and currently includes
  the authenticated member when they are not already on that team.
- Team Settings always labels its toggle action “Leave team”, even when
  `team.joined` is false. That state would actually join the member while
  presenting the opposite action.
- The supplied team list shows `PROD` exists and `joined` is false for the
  authenticated member. This rules out the earlier missing-team diagnosis.

Keep the existing backend authorization model and route contracts. Fix the FE
action choice and lock down the existing backend behavior with focused tests;
do not allow self-join through the privileged member-administration endpoint.

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Give non-members a correctly labeled self-join action and members a confirmed leave action. | P1 |
| 2 | Keep “Add a member” for adding other workspace members and omit the current user from that picker. | P1 |
| 3 | Verify self-join access and manager-only member administration at the service boundary. | P1 |

## Non-goals

- Do not weaken workspace or team manager authorization.
- Do not add a new API route, role model, database field, or migration.
- Do not change the existing `POST /teams/:id/join` toggle contract.
- Do not change team keys or repair production database contents.
- Do not include existing unrelated worktree changes in this plan.

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Backend membership contract coverage](./phase-01-backend-membership-contract.md) | Pending |
| 2 | [Frontend membership actions](./phase-02-frontend-membership-actions.md) | Pending |

## Success Criteria

- [ ] A non-member sees “Join team”; activating it calls the existing self-join endpoint and refreshes team membership state.
- [ ] A member sees “Leave team”; leaving requires confirmation and updates membership state.
- [ ] The current user is not offered as a target in “Add a member”.
- [ ] A normal workspace member can self-join an accessible team, while adding another member still requires manager permission.
- [ ] Focused project-service checks and web type/lint checks pass; no public API or database contract changes.

## Dependencies

- Existing `useToggleJoinTeam` mutation and `teamsService.toggleJoinTeam` client.
- Existing team `joined` response field and manager authorization in `TeamsService`.

<!-- slug: team-join-action -->
