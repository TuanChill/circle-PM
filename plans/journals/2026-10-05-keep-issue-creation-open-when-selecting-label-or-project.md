---
title: Keep issue creation open when selecting label or project
date: 2026-10-05
summary: Prevented the create-issue dialog from dismissing when interacting with portaled picker popovers.
---

# Keep issue creation open when selecting label or project

## What happened

Selecting an issue label or project in the create-issue dialog could dismiss the whole dialog. The label and project pickers render their Radix popover content in a portal outside `DialogContent`, so the dialog treated clicks in those menus as outside interactions and called its close handler.

## Decision

In `apps/web/components/layout/sidebar/create-new-issue/index.tsx`, prevent dialog outside-interaction dismissal only when the interaction target is inside `[data-slot="popover-content"]`. This keeps picker selections inside the form while preserving dismissal from the rest of the page.

## Verification and next steps

`git diff --check`, Prettier, and Oxlint passed for the changed file. TypeScript checking reported existing errors in the forgot-password, login, and signup pages and the global CSS import; no errors pointed to the changed file. ESLint could not run because its executable is unavailable in the workspace. Manual interactive reproduction remains to be confirmed in the running app.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
