---
name: mcp-server-plan-accepted-scope-decisions
description: Explicit accepted scope decisions in the apps/mcp-server plan that should not be re-flagged as oversights
metadata:
  type: project
---

`apps/mcp-server` (plan at `plans/260921-1846-add-mcp-server/`) has these decisions locked via an
accepted audit + validation log — do not re-raise them as fresh findings without new evidence:

- **Zero automated tests is intentional**, not an oversight. Phase 5 explicitly states "no automated
  MCP test harness exists in this repo per brainstorm contract" and defers CI/automated coverage as
  a follow-up. Verification is manual via MCP Inspector against a live `project-service`. Confirmed
  during review: `pnpm --filter mcp-server test` has zero `.spec.ts` files, this matches the plan.
- **No new auth surface is intentional.** The JWT is reused at full account-privilege scope by
  design (audit findings #2, #7, #12 accepted as doc-only/visibility requirements, not new
  authz controls) — mcp-server only decodes (never verifies) the token locally to fail fast;
  `project-service`'s `JwtAuthGuard`/`JwtStrategy` remains the sole enforcement point.
- Per-call `confirm: true` is the only destructive-action safety net accepted — a global
  `MCP_READ_ONLY` kill switch was explicitly considered and rejected as unrequested scope (Validation
  Log Q4).
- Tool count is 69 (68 in the plan's own count was later corrected by the actual implementation —
  workspace 5 + team 8 + issue 14 + project 10 + cycle 9 + label 6 + member 5 + initiative 7 + view 5
  = 69, verified via `grep -c registerJsonTool`).

See [[mcp-server-destructive-confirm-pattern]] for the confirm-gating mechanism itself.
