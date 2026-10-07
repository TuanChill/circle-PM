---
title: Keep issue dialog open while selecting fields
date: 2026-10-07
summary: Protected the issue-creation dialog from Radix popover portal interactions.
---

# Keep issue dialog open while selecting fields

## What happened
Selecting a status, priority, assignee, project, cycle, label, or estimate in the issue-creation dialog could close the entire dialog.

## Decision
Treat events whose composed DOM path includes a picker popover as interactions inside the dialog. This supports portalled popovers without blocking genuine clicks outside the dialog.

## Verification
Ran `npx tsc --noEmit --pretty false` in `apps/web` successfully and checked the diff for whitespace errors.

## Next steps
No follow-up required.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
