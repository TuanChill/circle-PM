---
title: "Separate invitation links from signup"
description: "Publish secure workspace invitations at /invite and keep signup focused on account creation."
status: in-progress
priority: P1
effort: "6h"
branch: "main"
tags: [bugfix, frontend, backend, auth]
blockedBy: []
blocks: []
created: 2026-10-05
---

# Separate invitation links from signup

## Overview

Move the externally shared workspace-invitation URL from `/signup?...` to a
dedicated `/invite?token=...&email=...` entry point. The new entry point will
accept the invitation immediately for a signed-in invitee, or hand an anonymous
invitee to signup while preserving the token and prefilled email.

`/signup` remains an account-creation route; it must never use `org` alone to
grant workspace access. Existing secure `/signup?invite=...` links remain
temporarily supported so outstanding invitations do not break.

## Design decision

Use a client-side `/invite` route rather than a new backend lookup endpoint.
The invitation token already authorizes `POST /circle/api/workspaces/join`, and
the invitation email is already included in generated links for signup prefill.
This keeps invitation acceptance centralized in the existing join contract and
does not expose invitation metadata through a new unauthenticated API.

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Generate canonical, token-bearing `/invite` URLs in email and member-invite responses. | P1 |
| 2 | Let invited members reach the correct workspace whether they are signed in or must create an account. | P1 |
| 3 | Preserve secure legacy token links without permitting `org`-only workspace joins. | P1 |

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Canonical invitation URL contract](./phase-01-start.md) | Pending |
| 2 | [Dedicated invitation entry route](./phase-02-invite-entry-route.md) | Pending |
| 3 | [Regression coverage and production validation](./phase-03-regression-coverage-and-production-validation.md) | Pending |

## Non-goals

- Do not reintroduce joining by workspace slug or `org` query parameter.
- Do not add a public invitation-preview API or change invitation expiration,
  email matching, role, or team-membership rules.
- Do not remove support for already-issued secure signup links in this change.

## Success Criteria

- [ ] New invitation emails and copied invite URLs use `/invite` with a secure token.
- [ ] An authenticated invitee opens `/invite` and lands in the invited workspace,
  not their saved workspace.
- [ ] An anonymous invitee opens `/invite`, signs up or signs in, and is then
  joined to the invited workspace.
- [ ] `/signup?org=<slug>` alone cannot join or route a user into that workspace.
- [ ] Existing service invitation tests, web type checking, web build, and a
  production browser flow pass.

## Dependencies

- Existing `WorkspaceInvitation` token validation in `WorkspacesService.join`.
- Current React Query `useJoinWorkspace` mutation and workspace persistence helper.

<!-- slug: invite-route-separated-from-signup -->
