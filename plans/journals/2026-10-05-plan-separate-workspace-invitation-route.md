---
title: Plan separate workspace invitation route
date: 2026-10-05
summary: Planned a dedicated /invite token route so external invitation links no longer share the signup URL.
---

# Plan separate workspace invitation route

## What happened

The current invitation email and API response use `/signup?org=...&email=...&invite=...`. A supplied `/signup?org=test-tesst` link showed that the signup route is being used as an invitation entry point even without a secure invitation token.

## Decision

Create a canonical external `/invite?token=...&email=...` route. It will accept a valid invitation for a signed-in user, or pass an anonymous user to signup with the token and email preserved. The plan retains secure legacy `/signup?invite=...` support during rollout but never permits `org` alone to grant access.

## Next steps

Execute the three phases: update invitation URL producers, add the public invite route and session-aware handoff, then run backend/web checks and authenticated production validation.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
