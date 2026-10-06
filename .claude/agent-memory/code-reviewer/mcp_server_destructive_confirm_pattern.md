---
name: mcp-server-destructive-confirm-pattern
description: How apps/mcp-server gates destructive MCP tool actions, and where the pattern was found inconsistently applied
metadata:
  type: project
---

`apps/mcp-server` (NestJS stdio MCP tool gateway forwarding to `apps/project-service`) gates
destructive actions two different ways depending on tool shape:

- Flat single-action delete tools (`team_delete`, `issue_delete`, `project_delete`, `cycle_delete`,
  `label_delete`, `initiative_delete`, `view_delete`): set `destructive: true` in the `registerJsonTool`
  config AND declare `confirm: z.literal(true)` in the flat zod schema. `tool-registration.util.ts`'s
  runtime check (`config.destructive && args?.confirm !== true`) gives these a friendly re-call message.
- Multi-action tools using `z.discriminatedUnion('action', [...])` (e.g. `issue_manage_reaction`,
  `issue_manage_relation`, `project_manage_update`, `label_manage_group`, `initiative_manage_update`,
  `initiative_manage_update_reaction`): do NOT set `destructive: true` at the tool level (that would
  wrongly gate the non-destructive branches too). Instead each destructive *branch* individually
  declares `confirm: z.literal(true)`, enforced purely by zod schema validation — there is no runtime
  double-check for these, so a missing `confirm` field in a destructive branch is a silent gap (SDK
  validation is the *only* enforcement).

**Found via review (2026-09-21, first mcp-server review):** two destructive branches were missing
`confirm: z.literal(true)` — `team_manage_member` action `"remove"` (`team.tools.ts`) and
`cycle_manage_calendar_subscription` action `"delete"` (`cycle.tools.ts`). Both silently execute
without confirmation. All other discriminated-union delete/remove branches across the 9 tool files
correctly had the literal. This is the exact failure mode to grep for in future passes:
`grep -n "action: z.literal" *.ts | grep -iE "remove|delete|revoke"` then check each match's sibling
lines for `confirm: z.literal(true)`.

See [[mcp-server-plan-accepted-scope-decisions]] for what audit findings were already applied vs.
what the plan's own destructive-tool enumeration omitted (team_manage_member's remove branch was
never in the plan's explicit list either — a plan gap, not just an implementation gap).
