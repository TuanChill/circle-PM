---
title: Plan workspace project child statuses
date: 2026-10-06
summary: Scoped a plan to add workspace-level child project statuses in lifecycle groups.
---

# Plan workspace project child statuses

## What happened
Reviewed the Linear project status reference and the current project status flow. The settings page has five lifecycle groups with disabled plus buttons; project status choices and backend validation currently use a fixed five-status list.

## Decision
Plan a workspace-scoped custom status registry and a create-only flow under the existing groups. Keep the current built-in status IDs and stored categories, with Planned mapped to `unstarted`. Require workspace Owner/Admin to create; keep issue statuses out of scope. Require a verified database backup before applying the additive migration.

## Next steps
Implement the plan in `plans/261006-0749-workspace-project-child-statuses/` after review. The plan covers persistence/API, settings creation, and dynamic project selectors/templates.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
