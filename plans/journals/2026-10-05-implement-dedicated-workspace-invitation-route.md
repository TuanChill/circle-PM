---
title: Implement dedicated workspace invitation route
date: 2026-10-05
summary: Separated invite URLs from signup and preserved secure legacy handoff.
---

# Implement dedicated workspace invitation route

## What happened

Implemented the planned separation of workspace invitation links from signup. New invitations are now generated as `/invite?token=...&email=...`, while legacy secure `/signup?invite=...` links continue to work.

## Decision

A public client `/invite` route waits for auth session initialization. It accepts the invite exactly once for authenticated recipients; otherwise it hands the token and email to signup. Email/password and Google signup/login paths join the invited workspace before considering a saved workspace.

## Verification

- Focused project-service invitation Jest suites passed.
- project-service and web TypeScript checks passed.
- Production web build passed and includes `/invite`.

## Next steps

Commit and deploy the owned changes, then validate authenticated and anonymous production flows with designated test accounts.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
