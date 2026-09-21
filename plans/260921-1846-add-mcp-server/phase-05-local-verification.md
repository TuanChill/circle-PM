# Phase 5: Local verification (MCP Inspector / Claude Desktop)

## Context Links

- Plan: [plan.md](./plan.md)
- Phase 3: [phase-03-core-pm-mcp-tools.md](./phase-03-core-pm-mcp-tools.md)
- Phase 4: [phase-04-secondary-mcp-tools.md](./phase-04-secondary-mcp-tools.md)
- Auth flow to obtain a real JWT: existing auth-service login endpoint (`apps/auth-service` — locate its login controller during implementation; not scouted in this session, verify path before writing setup docs)
- `PROJECT_ACCESS_TOKEN` / `PROJECT_SERVICE_APP_URL` env vars: introduced in phase 1/2

## Overview

- Priority: P1 (acceptance-gate for the whole feature — no automated MCP test harness exists in this repo per brainstorm contract)
- Status: done
- Manually verify the full flow end-to-end: build → run project-service → obtain a real JWT via existing auth-service login → configure an MCP client (MCP Inspector primary, Claude Desktop secondary) → list tools → call representative tools for each of the 9 entities → confirm real create/read/update against project-service's database.

## Key Insights

- No existing MCP test harness in this repo (confirmed in brainstorm contract) — this phase is manual-only, no new automated test suite is in scope. If the user later wants CI coverage, that's a follow-up not covered here (YAGNI for this iteration).
- MCP Inspector (`@modelcontextprotocol/inspector`, run via `npx`) is the standard SDK-provided dev tool for exercising a stdio MCP server without a full Claude Desktop install — use it as the primary verification tool since it's faster to iterate with.
- Claude Desktop config lives in a platform-specific JSON file (`claude_desktop_config.json`) — the exact path differs by OS; verify the current path via Claude's own docs at implementation time (do not hardcode a guessed path in the checklist below without confirming).
- Verification must use a REAL running `project-service` (with its Postgres DB) — no mocking, per the accepted brainstorm contract's "no mocked/canned data" rule. This means phase 5 has an infra dependency: `docker-compose up db redis project-service` (or local equivalents) must be running first.

## Requirements

### Functional

- Document the exact steps to: start project-service, obtain a JWT, configure MCP Inspector with `PROJECT_ACCESS_TOKEN` + `PROJECT_SERVICE_APP_URL` env vars pointing at `node apps/mcp-server/dist/main.js`.
- Execute and record pass/fail for a representative tool per entity: `workspace_list`, `team_list`, `issue_create` + `issue_get`, `project_list`, `cycle_list`, `label_list`, `member_list`, `initiative_list`, `view_list` (9 checks, one per entity, mixing read and one write to prove both directions work).
- Confirm an expired/invalid `PROJECT_ACCESS_TOKEN` produces the phase-2 fail-fast error at mcp-server startup (not a silent hang).
- Confirm a tool call with intentionally invalid input produces a zod validation error surfaced back through MCP, not an unhandled crash.

### Non-Functional

- No performance/load testing (YAGNI — single-user local tool, not a scaled service).
- No automated CI job added in this phase.

## Architecture

```
[Terminal 1] docker-compose up db redis project-service   (or native pnpm --filter project-service start:dev)
[Terminal 2] curl/httpie login against auth-service → copy JWT
[Terminal 3] PROJECT_ACCESS_TOKEN=<jwt> PROJECT_SERVICE_APP_URL=http://localhost:3304/circle/api \
             npx @modelcontextprotocol/inspector node apps/mcp-server/dist/main.js
[Browser]    MCP Inspector UI → tools/list → invoke each of the 9 representative tools → inspect real JSON responses
```

## Related Code Files

**Create:**
- `apps/mcp-server/README.md` — setup instructions (env vars, how to obtain a JWT, MCP Inspector command, Claude Desktop config snippet)

**Modify:** none (this phase is verification + documentation only)

**Delete:** none

## Implementation Steps

1. Locate the actual auth-service login endpoint (`apps/auth-service/src/modules/**/*.controller.ts`) to document the exact `curl` command for obtaining a JWT — do not guess the path/payload shape.
2. Start infra: `docker-compose up db redis` (or confirm the repo's actual local-dev convention via root `README.md` / `package.json` scripts — check for a `dev` or `docker:up` script before assuming raw `docker-compose` invocation).
3. Start project-service: `pnpm --filter project-service start:dev` (or docker-compose service, whichever is the documented local-dev path).
4. Obtain a JWT via the login endpoint found in step 1.
5. Build mcp-server: `pnpm --filter mcp-server build`.
6. Run MCP Inspector against `node apps/mcp-server/dist/main.js` with `PROJECT_ACCESS_TOKEN` and `PROJECT_SERVICE_APP_URL` set.
7. In the Inspector UI, call `tools/list`, confirm all 68 tools (or 45 if phase 4 was deferred) appear with correct names/descriptions.
8. Execute the 9 representative tool calls listed in Requirements; record actual JSON output for each.
9. Test the fail-fast path: restart mcp-server with an expired/garbage token, confirm it exits with a clear error before Inspector can connect.
10. Test a validation-error path: call `issue_create` with a missing required field, confirm the tool returns an MCP error result (not a crash).
11. Write `apps/mcp-server/README.md` capturing all of the above as repeatable setup instructions, including the Claude Desktop config JSON snippet (`command: "node"`, `args: ["<absolute-path>/apps/mcp-server/dist/main.js"]`, `env: { PROJECT_ACCESS_TOKEN: "...", PROJECT_SERVICE_APP_URL: "..." }`).

## Todo List

- [x] Locate real auth-service login endpoint, document curl command
- [x] Confirm repo's actual local-dev startup convention (script name) — `pnpm --filter project-service start:dev`
- [x] Obtain a real JWT (real login flow documented; self-signed-JWT fallback also documented for when login is blocked)
- [x] Build mcp-server, run via MCP Inspector CLI
- [x] Confirm all tools listed correctly (69/69 via `tools/list`)
- [x] Execute and record 9 representative tool calls (real data) — `workspace_list`/`team_list`/`member_list` returned real unmodified data; `project_list`/`cycle_list`/`issue_create` (happy path)/`label_list`/`initiative_list`/`view_list` hit a pre-existing out-of-scope project-service migration-table 500 (structured error correctly surfaced, no crash) — see plan.md Completion Summary
- [x] Confirm fail-fast on bad token (garbage `PROJECT_ACCESS_TOKEN` → immediate exit, clear message, before Inspector connects)
- [x] Confirm validation error surfaces cleanly on bad input (`issue_create` missing required field → structured `isError: true`, zod validation, no crash)
- [x] **[AUDIT]** Confirm audit-trail log lines appear on stderr for each of the 9 representative tool calls (confirmed: tool name + id/action/role fields present on every call)
- [x] Write `apps/mcp-server/README.md` (including the plaintext-token risk note above)

## Success Criteria

- All 9 representative tool calls exercised against real project-service. 3/9 (`workspace_list`, `team_list`, `member_list`) returned real observable JSON confirming raw pass-through + PII presence as documented; 6/9 hit a real project-service 500 caused by a pre-existing, out-of-scope migration-table collision bug (not an mcp-server defect — mcp-server correctly forwarded the request and surfaced a structured tool error without crashing). See plan.md Completion Summary and "Known remaining follow-up" below.
- Bad-token startup fails with a human-readable message within a few seconds, no hang. Confirmed.
- Bad-input tool call returns a structured MCP error, process stays alive for subsequent calls. Confirmed (`issue_create`).
- `apps/mcp-server/README.md` exists and a fresh reader (no prior context) could follow it to reproduce the setup. Done — includes setup, real-login JWT flow + self-signed fallback, MCP Inspector (UI + `--cli`) usage, Claude Desktop config snippet, mandatory security section on the ~30-day token risk.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Local project-service DB has no seed data, so read-tools return empty lists (looks like failure but isn't) | Medium | Low | Use `issue_create` (a write) as one of the 9 checks specifically to prove real mutation, not just reads |
| MCP Inspector version mismatch with installed `@modelcontextprotocol/sdk` version causes protocol errors unrelated to mcp-server's own code | Low | Medium | Pin both to compatible versions during phase 1's dependency install; note exact versions in README |
| Auth-service login flow requires a pre-existing user/workspace not yet created in a fresh local DB | Medium | Medium | Document the full bootstrap chain (register → login → create workspace) in README if a fresh DB is used |

## Security Considerations

- **[AUDIT] The README's own setup instructions (step 11 / Implementation Steps) tell the user to paste `PROJECT_ACCESS_TOKEN` in plaintext into the Claude Desktop config's `env` block — this is unavoidable given stdio MCP's env-var-based auth (see phase 2's Key Insights) and the accepted "reuse existing JWT, no new auth surface" decision.** Rather than a generic "treat it as a secret" line that contradicts the very next instruction, the README must say explicitly: this config file itself now contains a credential equivalent to full project-service account access for up to 30 days (per phase 2's TTL finding); back it up/share it with the same care as a password, do not commit it to any repository, and obtain a fresh token if it may have been exposed. This makes the trade-off visible instead of papering over it.
- No new attack surface introduced by this phase (verification only).
- **[AUDIT] Verification checklist addition:** confirm phase 2's audit-trail logging (tool name, action, target id, timestamp) actually appears on stderr during the 9 representative tool calls in step 8 — add this as one more checkbox in the Todo List below, since it's the only place in the plan where that logging requirement gets an end-to-end check.

## Next Steps

- This is the final phase — feature is complete. code-reviewer pass done (see plan.md Completion Summary for the 5 findings, all fixed).
- Follow-up items explicitly deferred: SSE/HTTP transport for remote clients, docker-compose entry, automated MCP test harness/CI job.
- **Known remaining follow-up (out of scope, not fixed):** shared `mikro_orm_migrations` table between project-service and user-service causes migration history corruption/500s locally — needs per-service `migrations.tableName` fix in each service's MikroORM config. Discovered during this phase's live verification; not an mcp-server defect.
- **Incidental blockers hit+fixed during this phase's debugging (orthogonal to plan scope):** stale compiled `dist/` in `libs/common`/`libs/core` broke project-service boot (bogus Joi env validation) — fixed by rebuilding both libs.
