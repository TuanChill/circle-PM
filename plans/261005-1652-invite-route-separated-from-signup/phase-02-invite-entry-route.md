---
phase: 2
title: "Dedicated invitation entry route"
status: pending
priority: P1
effort: "3h"
dependencies: [1]
---

# Phase 2: Dedicated invitation entry route

## Goal

Add a public `/invite` route that owns invitation handoff and acceptance,
leaving `/signup` responsible only for account creation.

## Files to Create / Modify

- Create: `apps/web/app/invite/page.tsx` — client invitation entry screen and
  handoff logic.
- Modify: `apps/web/middleware.ts` — treat `/invite` as a public entry path;
  do not redirect it to login or a saved workspace.
- Modify: `apps/web/constants/routes.ts` — add the canonical invitation route
  builder.
- Modify: `apps/web/app/signup/page.tsx` — consume an invitation token only
  after account creation; retain compatibility with legacy secure
  `?invite=<token>` links.
- Modify: `apps/web/components/auth/google-login-button.tsx` — preserve the
  invitation token through Google signup/login handoff and prioritize the
  invited workspace over saved-workspace persistence after acceptance.
- Modify: `apps/web/store/auth-store.ts` and/or
  `apps/web/components/providers/auth-provider.tsx` only if an explicit session
  hydration state is required to avoid treating a signed-in invitee as anonymous.

## Architecture

```text
Email / copied URL
  /invite?token=T&email=E
          |
          v
       Invite entry
      /           \
session ready     no session
  |                    |
POST join(T)       /signup?invite=T&email=E
  |                    |
save invited       create/login account
workspace          |
  \________________/
          |
          v
 /<invited-workspace>/my-issues
```

## Tasks & Steps

1. Add `ROUTES.INVITE` and a small URL helper that preserves `token` and
   `email` through route transitions without exposing them in logs or toasts.
2. Make `/invite` public in middleware while retaining the normal redirect
   protection for `/signup`, `/login`, and other auth pages.
3. Build the invite-entry page with clear loading and error states. It must wait
   for session initialization before choosing between direct acceptance and the
   signup handoff; it must call the existing `useJoinWorkspace` mutation exactly
   once per page load.
4. For an authenticated member, accept the invitation, save the invited
   workspace, and use `router.replace` to its My Issues route.
5. For an anonymous member, replace to signup with legacy-compatible `invite`
   and `email` parameters. Ensure email/password and Google completion both join
   before considering the saved workspace or onboarding destination.
6. Keep secure legacy `/signup?invite=...` handling during the transition, but
   remove any dependence on `org` for access or routing.

## Todo

- [x] Add the public canonical `/invite` route and route constant.
- [x] Wait for session hydration before choosing direct acceptance or signup.
- [x] Preserve token and email through both email/password and Google flows.
- [x] Keep legacy secure signup-token links while rejecting org-only access.

## Security and failure handling

- The join API remains the sole authority for token validity, expiration, and
  invitee-email matching.
- Do not render workspace details based solely on a token query parameter.
- Show the API error for expired, used, or wrong-email tokens; do not fall back
  to an arbitrary saved workspace.
- Ensure React strict-mode/effect reruns cannot accept the invitation twice.

## Success Criteria

- `/invite?token=...` is reachable while signed out and signed in.
- Signed-in invitees are added to and routed into the invited workspace.
- Signed-out invitees are sent to signup with the token/email intact, then
  complete the same join flow.
- A plain `/signup?org=test-tesst` never grants membership or routes to that
  workspace.
