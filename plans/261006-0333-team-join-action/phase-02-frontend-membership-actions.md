---
title: "Phase 2: Frontend membership actions"
status: todo
priority: P2
effort: "1h 45m"
dependencies: [1]
---

# Phase 2: Frontend membership actions

## Overview

Make the UI distinguish joining oneself from adding another workspace member,
using the membership state returned for the authenticated user.

## Requirements

- [x] Show “Join team” when `team.joined` is false and call the existing
  `useToggleJoinTeam` mutation.
- [x] Show “Leave team” only when `team.joined` is true and retain confirmation
  before removing the current member.
- [x] Disable the membership action while its mutation is pending and show
  accurate success or failure feedback.
- [x] Exclude the authenticated user from the “Add a member” picker so self-join
  cannot be mistaken for manager administration.
- [x] Keep adding other members on the manager-only `POST /teams/:id/members`
  path and retain backend authorization as the security boundary.

## Architecture

The Teams Settings membership row is the existing location for leaving a team
and already uses the self-toggle mutation. Change it into a membership section
whose action depends on `team.joined`: direct join when false, confirmed leave
when true. Reuse the existing React Query mutation and its list/detail
invalidation. The Members tab remains the manager's “Add a member” workflow, but
filters out the signed-in user using `useAuthStore`.

## Related Code Files

- Modify: `apps/web/components/common/settings/team-settings.tsx`
- Modify: `apps/web/components/common/teams/team-members.tsx`
- Modify: `apps/web/hooks/queries/use-teams-query.ts`
- Read/reuse: `apps/web/services/teams.service.ts`
- Read: `apps/web/store/auth-store.ts`

## Implementation Steps

1. Replace the unconditional Leave team row in the Danger zone with a regular
   Membership section.
2. For a non-member, show a “Join team” action that calls the existing toggle,
   stays on the page, and reports that the member joined.
3. For a member, show “Leave team”; keep its confirmation dialog and route back
   to the teams page after a successful leave.
4. Disable the action through the membership query refresh and ensure errors
   leave the displayed membership state intact. Await active list/detail
   invalidation so the toggle cannot be submitted again against stale state.
5. Read the current user ID from `useAuthStore` in the Members tab and exclude
   that ID from `addableMembers`; leave the manager add flow for other members
   unchanged.

## Todo

- [x] Implement state-aware Join/Leave UI with accurate copy and pending state.
- [x] Exclude the signed-in user from the manager add-member picker.
- [x] Run web type and lint checks.
- [ ] Manually smoke-test joined and unjoined UI states and the manager add-member picker.

## Success Criteria

- An unjoined user sees only “Join team” for their own membership action; it
  invokes the existing `POST /circle/api/teams/:id/join` route and list/detail
  queries refresh.
- A joined user sees “Leave team” with confirmation; a successful leave returns
  to the team list.
- The current user does not appear in “Add a member”; other eligible workspace
  members continue through the manager-only flow.
- Errors are shown without displaying a false success state.

## Verification

- `pnpm --filter web exec tsc --noEmit`
- `pnpm --filter web lint`
- Manual/browser smoke check as an unjoined workspace member and as a joined
  member, including the manager add-member picker.

## Risk Assessment

- The backend endpoint is a toggle. Prevent duplicate requests until list/detail
  invalidation completes so the next action reflects the current state.
- `team.joined` is computed for the authenticated member. Do not derive it from
  the member's global role or from another member's team membership.

## Security Considerations

- The FE picker filter only improves the flow. `TeamsService.addMember` must
  continue to enforce manager permission and workspace membership checks.

## Next Steps

- Complete backend contract tests from Phase 1, then verify the FE flow against
  the existing backend behavior.
