# MCP Server / Shared Libs Regression Check — 2026-09-21

Scope: verify `libs/common`/`libs/core` dist rebuild + mcp-server circular-import fix don't break any consumer. No new tests written (per accepted plan: no automated MCP test harness, manual/live verification already done via MCP Inspector).

## Results

| Command | Result | Note |
|---|---|---|
| `pnpm --filter @app/common build` | PASS | tsc + proto copy clean (no `check-types` script exists on libs, used `build`) |
| `pnpm --filter @app/core build` | PASS | tsc clean |
| `pnpm --filter mcp-server check-types` | PASS | tsc --noEmit clean |
| `pnpm --filter mcp-server build` | PASS | nest build (SWC), 20 files compiled, no circular-import error |
| `pnpm --filter auth-service check-types` | PASS | clean |
| `pnpm --filter user-service check-types` | PASS | clean |
| `pnpm --filter notification-service check-types` | PASS | clean |
| `pnpm --filter project-service check-types` | PASS | clean (the Joi config-validation boot error was runtime/dist-based, not a type error — not expected here, and none found) |
| mcp-server `*.spec.ts` under `apps/mcp-server/src` | NONE FOUND | expected — no automated test harness in scope for this feature |

## Verdict

**Safe to proceed to code review.** All 8 build/typecheck commands green. Dist rebuild of `libs/common`/`libs/core` exposed no drift in any of the 4 downstream services (auth, user, notification, project) or mcp-server. Circular-import fix in `apps/mcp-server/src/modules/project-service-client/` compiles and builds without the prior `ReferenceError`.

## Unresolved questions
- None. project-service's original boot-time Joi error was a stale-dist runtime issue, not a compile-time one — confirmed no corresponding compile-time symptom exists now that dist is rebuilt.
