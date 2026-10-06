---
title: Keep checklist wrapping aligned with text
date: 2026-10-06
summary: Checklist text now occupies the remaining flex row width so wrapped lines align beneath the text instead of the checkbox.
---

# Keep checklist wrapping aligned with text

## What happened

The activity-feed checklist renderer placed checkbox and text in a flex row, but its text span did not take the available width or allow shrinking. Long todo text could wrap incorrectly relative to the checkbox.

## Decision

Give the checklist text span `min-w-0 flex-1`, matching the task-list editor's existing flexible text column.

## Next steps

The web TypeScript check and `git diff --check` passed. Browser visual verification was unavailable because no local dev server was running.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
