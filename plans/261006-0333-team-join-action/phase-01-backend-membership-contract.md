---
title: "Phase 1: Backend membership contract coverage"
status: todo
priority: P2
effort: "45m"
dependencies: []
---

# Phase 1: Backend membership contract coverage

## Overview

Protect the existing distinction between joining as the authenticated member
and a manager adding a workspace member. No backend behavior change is planned
unless these tests expose a mismatch with the current service contract.

## Key Insights

- `TeamsService.toggleJoin` checks team visibility and changes membership for
  the authenticated member; it does not require manager role.
- `TeamsService.addMember` requires team-manager permission and verifies the
  target is a member of the team's workspace.
- The `Admin` value on a `Member` record is not the workspace or team role used
  by `canManageTeamRole`.
- Unauthorized manager operations currently return 404 by design to conceal
  access to the team. Preserve that response contract in this work.

## Requirements

- [x] A workspace member with access to the team can toggle their own membership.
- [x] A non-manager cannot add another member through `addMember`.
- [x] A workspace Owner/Admin or team lead/admin can add another valid workspace member.
- [x] Existing API routes, role rules, and response shapes remain unchanged.

## Related Code Files

- Modify: `apps/project-service/src/modules/teams/teams-permissions.spec.ts`
- Read: `apps/project-service/src/modules/teams/teams.service.ts`
- Read: `apps/project-service/src/modules/access-control.ts`

## Implementation Steps

1. Extend the existing TeamsService Jest spec with focused cases for joining,
   leaving through the existing toggle, and the manager-only `addMember` path.
2. Assert denied `addMember` attempts do not persist or flush a `TeamMember`.
3. Keep role fixtures explicit: set `WorkspaceMember.role` and
   `TeamMember.role`; do not use `Member.role` as a proxy for either permission.

## Todo

- [x] Add regression cases for self-membership and member administration.
- [x] Run the focused project-service test file.

## Success Criteria

- Focused tests prove an accessible non-member can join and can leave through
  the existing toggle endpoint.
- Focused tests prove ordinary members cannot add other people and managers
  can add valid workspace members.
- No production service behavior changes are needed to support the FE action.

## Verification

- `pnpm --filter project-service test -- teams-permissions.spec.ts`

## Risk Assessment

- Permission mocks can hide role-source mistakes. Use fixtures that represent
  the actual workspace membership and team membership rows separately.

## Security Considerations

- Keep `addMember` manager authorization on the server. A hidden or disabled FE
  control is not an authorization boundary.

## Next Steps

- Phase 2 consumes the existing self-join mutation and preserves manager-only
  member administration.
