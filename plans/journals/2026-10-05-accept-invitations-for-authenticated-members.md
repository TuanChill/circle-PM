---
title: Accept invitations for authenticated members
date: 2026-10-05
summary: Fixed authenticated invite links so they join and open the invited workspace instead of redirecting to the saved one.
---

# Accept invitations for authenticated members

## What happened

Opening a member invitation while already signed in redirected to the account's saved workspace. The invitation email targets `/signup?invite=...`, but `apps/web/middleware.ts` redirected every authenticated request to `/signup` before the page could accept the token.

## Decision

Allow only `/signup` requests carrying a non-empty `invite` query parameter through the authenticated-page redirect. In `apps/web/app/signup/page.tsx`, once the session hydrates, accept that invitation for the authenticated member, persist the invited workspace as active, and replace the route with its My Issues page. Ordinary authenticated visits to auth pages still redirect as before.

## Verification and next steps

Prettier and a focused middleware routing assertion passed, `pnpm --filter web exec tsc --noEmit` passed, and `pnpm --filter web build` completed successfully. A browser click-through against a running authenticated backend was not performed in this session.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
