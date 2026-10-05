---
phase: 1
title: "Canonical invitation URL contract"
status: pending
priority: P1
effort: "1.5h"
dependencies: []
---

# Phase 1: Canonical invitation URL contract

## Goal

Make every newly generated workspace invitation use one public URL contract:
`/invite?token=<token>&email=<invitee-email>`.

## Files to Modify

- `apps/project-service/src/modules/email/ses-mailer.service.ts` — generate the
  canonical email CTA and plain-text URL with `/invite`.
- `apps/project-service/src/modules/members/members.service.ts` — return the
  same canonical `inviteUrl` from the member-invitation API.
- `apps/project-service/src/modules/members/members-invitation.spec.ts` — assert
  the invitation producer passes a token and preserves the invitee email.

## Requirements and constraints

- Keep the raw token only in the URL returned to the caller or email recipient;
  continue persisting only `tokenHash`.
- Use `token` as the public query parameter and `email` only to prefill signup.
- Do not use the workspace slug as proof of authorization.
- Keep the existing email body, invite role, team IDs, and expiration behavior.

## Tasks & Steps

1. Add a local URL-construction helper or shared expression so the email CTA
   and `inviteUrl` API response cannot drift.
2. Replace both existing `/signup?org=...&email=...&invite=...` producers with
   `/invite?token=...&email=...`.
3. Update the invitation unit test to assert the generated/called contract,
   including no slug-only join fallback.
4. Inspect the resulting diff for any invitation token values accidentally
   logged or persisted outside the existing hash flow.

## Todo

- [x] Define one canonical invite URL construction path.
- [x] Switch email and API-returned URLs to `/invite`.
- [x] Add the invitation producer regression assertion.

## Verification

- `pnpm --filter project-service test -- members-invitation.spec.ts`
- `pnpm --filter project-service check-types`

## Success Criteria

- Both invitation producers yield the same `/invite` URL shape.
- The API response and email CTA still carry the token required by
  `WorkspacesService.join`.
- The updated invitation test proves pending invitations are stored and emitted
  without granting access by slug.

## Risks and rollback

The frontend route must ship with this producer change. Roll back the URL
producer first if `/invite` cannot be served; already-issued legacy token links
remain accepted during the rollout.
