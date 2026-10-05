---
phase: 3
title: "Regression coverage and production validation"
status: pending
priority: P1
effort: "1.5h"
dependencies: [1, 2]
---

# Phase 3: Regression coverage and production validation

## Goal

Prove the new route preserves secure invitation acceptance across session states
and does not revive the legacy slug-join vulnerability.

## Files to Create / Modify

- Create or modify the nearest supported web test surface for middleware and
  invitation-route behavior. Do not introduce a second test framework solely
  for this feature.
- Modify: `apps/project-service/src/modules/members/members-invitation.spec.ts`
  if phase 1 needs contract assertions beyond its current coverage.
- Modify: `apps/project-service/src/modules/workspaces/workspaces-invitation.spec.ts`
  only when acceptance regressions are not already covered.

## Test matrix

| Scenario | Expected result |
|---|---|
| Existing user opens valid `/invite` | Joined and replaced into invited workspace. |
| New user opens valid `/invite` | Reaches signup with token/email; after signup joins invited workspace. |
| Google user opens valid `/invite` | After Google callback, joins before workspace fallback. |
| Expired/used/wrong-email token | Explicit invitation error; no workspace fallback. |
| `/signup?org=<slug>` | No membership grant and no foreign-workspace route. |
| Existing secure `/signup?invite=<token>` | Continues to accept while outstanding emails expire. |

## Tasks & Steps

1. Add focused regression coverage using the project’s existing testing setup;
   if web has no suitable runner, document the static middleware assertion and
   cover service behavior in Jest rather than adding test infrastructure.
2. Run project-service invitation tests, web formatting/type checks, and the
   production web build.
3. Deploy only after CI is green. Verify the resulting Vercel deployment is on
   the release commit before browser testing.
4. In production, use a designated test invitee: issue a new `/invite` link,
   open it with an already-authenticated account that has another workspace,
   and verify the browser ends at the invited workspace. Repeat signed-out
   signup/login handoff if test credentials are available.
5. Review the final diff and verify no unrelated dirty worktree files were
   staged or changed.

## Todo

- [ ] Cover the invitation producer and acceptance regressions.
- [ ] Run focused backend tests and web build/type checks.
- [ ] Confirm CI and Vercel serve the release revision.
- [ ] Complete authenticated and anonymous production invite journeys.

## Verification

- `pnpm --filter project-service test -- members-invitation.spec.ts workspaces-invitation.spec.ts`
- `pnpm --filter web exec tsc --noEmit`
- `pnpm --filter web build`
- `git diff --check`
- GitHub Actions: **Backend CI** and the Vercel production deployment succeed.

## Success Criteria

- The test matrix passes with fresh evidence.
- Browser validation proves the saved workspace cannot win over a valid
  invitation for an authenticated user.
- Browser validation proves org-only signup URLs do not enter foreign
  workspaces.
- Production failures return API-originated invitation errors with CORS headers,
  not a redirect masking the result.

## Rollback

Revert only the new URL producer and invite route as one release unit if the
handoff fails. Keep the previous secure signup-token path available until all
issued invitations have expired.
