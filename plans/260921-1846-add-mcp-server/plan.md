---
title: "Add apps/mcp-server MCP tool gateway to project-service"
description: "New standalone NestJS app exposing MCP tools (stdio) that forward JWT-authenticated REST calls to project-service for 9 PM entities"
status: completed
priority: P2
effort: 14h
branch: main
tags: [mcp-server, project-service, nestjs, new-app, integration]
created: 2026-09-21
completed: 2026-09-21
---

# Add MCP Server for project-service

## Outcome

`apps/mcp-server` is a new standalone NestJS app, scaffolded like `apps/notification-service`, that runs as a **stdio MCP process** (spawned by Claude Desktop/Code/Cursor). It exposes MCP tools for Workspaces, Teams, Issues, Projects, Cycles, Labels, Members, Initiatives, Views. Every tool call forwards the caller's bearer JWT to `project-service`'s REST API (`http://localhost:3304/circle/api/...`) — no business logic duplicated, no mocked data. `project-service`'s existing `JwtAuthGuard` (`apps/project-service/src/modules/auth/guards/jwt-auth.guard.ts`) remains the sole enforcement point; mcp-server does a local decode only to fail fast.

## Key Decisions (locked, see phase files for rationale)

- **Transport: stdio only** (no SSE/HTTP listener in this plan). Matches all 3 named clients (Claude Desktop, Claude Code, Cursor) and needs zero docker-compose/networking work. Bootstrap uses `NestFactory.createApplicationContext(AppModule)`, not `NestFactory.create` — no HTTP server exists.
- **Auth: pass-through only.** mcp-server decodes (not verifies) the JWT locally with `jsonwebtoken` to give a clear "token invalid/expired" error before making a network call; project-service still verifies signature via `JwtStrategy` (`apps/project-service/src/modules/auth/strategies/jwt.strategy.ts:20`).
- **HTTP client: `@nestjs/axios`** (new dep) — repo has no existing outbound HTTP client convention for calling sibling REST services (`libs/core/src/http/http.service.ts` wraps `axios` for a different purpose — see phase 2 for why it's not reused as-is).
- **Tool granularity:** consolidate multi-route sub-resources (subscriptions, reactions, relations, updates, milestones, label groups) into one tool per resource with an `action` enum param, per YAGNI. **[AUDIT] 68 tools total across 9 entities** (45 in phase 3 + 23 in phase 4, from 86 underlying routes — corrected from an earlier "~60" estimate; see phase 3/4 for the exact per-entity list). Flagged as an open risk — see Unresolved Questions.

## Phases

| # | Phase | Status | File |
|---|-------|--------|------|
| 1 | Scaffold apps/mcp-server | done | [phase-01-scaffold-mcp-server-app.md](./phase-01-scaffold-mcp-server-app.md) |
| 2 | JWT pass-through + project-service HTTP client | done | [phase-02-jwt-passthrough-and-http-client.md](./phase-02-jwt-passthrough-and-http-client.md) |
| 3 | Core PM tools: Workspaces, Teams, Issues, Projects, Cycles | done | [phase-03-core-pm-mcp-tools.md](./phase-03-core-pm-mcp-tools.md) |
| 4 | Secondary tools: Labels, Members, Initiatives, Views | done | [phase-04-secondary-mcp-tools.md](./phase-04-secondary-mcp-tools.md) |
| 5 | Local verification (MCP Inspector / Claude Desktop) | done | [phase-05-local-verification.md](./phase-05-local-verification.md) |

**Overall: 69 tools registered across 9 entities, live-verified via MCP Inspector CLI against a real running project-service. Feature functionally complete.**

## Dependency Graph

Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 (strictly sequential; each phase's tools depend on the HTTP client from phase 2, and phase 3/4 tool registration depends on the MCP server bootstrap from phase 1).

## Non-Goals (explicit, from accepted brainstorm)

- No changes to `apps/project-service/src/modules/agent/agent.service.ts`.
- No MCP tools for documents/reviews/onboarding/inbox/uploads/issue-templates/project-templates.
- No new gRPC service, no changes to project-service REST contracts.
- No SSE/HTTP transport, no docker-compose entry (documented as follow-up in phase 1).

## Unresolved Questions (confirm before implementation)

All 4 items below were resolved in the Validation Log session — kept here for historical traceability only, no longer blocking.

1. ~~**68-tool count across 9 entities**~~ — **Resolved:** ship all 68 now (see Validation Log Q1).
2. ~~**`PROJECT_SERVICE_APP_URL` env var does not exist yet**~~ — **Resolved:** default to `http://localhost:3304/circle/api` (see Validation Log Q2).
3. ~~Should mcp-server ship as its own npm-publishable package...~~ — **Resolved:** run via `node apps/mcp-server/dist/main.js` from the monorepo checkout, no publishing (see Validation Log Q3).
4. SSE/HTTP transport for remote/Dockerized clients is out of scope — confirm this is genuinely a "later" concern and not needed for this iteration's acceptance. *(Not re-asked in validation — already a settled Non-Goal.)*

## Validation Log

### Session 1 — 2026-09-21
**Trigger:** Post-audit plan validation (Hard mode, user-confirmed after applying all 15 audit findings)
**Questions asked:** 4

#### Questions & Answers

1. **[Scope]** Plan.md's Unresolved Questions flags the 68-tool count (up from 86 underlying routes) as a risk for MCP clients with tool-list limits. Ship all 68 now, or defer phase 4?
   - Options: Ship all 68 now (Recommended) | Defer phase 4
   - **Answer:** Ship all 68 now (Recommended)
   - **Rationale:** Matches the original "full parity" brainstorm decision; no scope change needed.

2. **[Assumptions]** `PROJECT_SERVICE_APP_URL` has no existing default in `.env.example`. Should the plan add a committed default pointing at local project-service?
   - Options: Default to `http://localhost:3304/circle/api` (Recommended) | No default — require explicit config
   - **Answer:** Default to `http://localhost:3304/circle/api` (Recommended)
   - **Rationale:** Matches project-service's own local-dev port; works out of the box for local Claude Desktop/Inspector setups — no phase change needed, phase 1 already implements this.

3. **[Architecture]** How should users run mcp-server from an MCP client config (Claude Desktop's command/args)?
   - Options: `node apps/mcp-server/dist/main.js` from the monorepo checkout (Recommended) | Publish as an npm package for `npx` usage
   - **Answer:** `node apps/mcp-server/dist/main.js` from the monorepo checkout (Recommended)
   - **Rationale:** No publishing pipeline needed; matches phase 5's existing README/setup plan — no phase change needed.

4. **[Risks]** Finding #1 added a per-call `confirm: true` requirement on destructive tools. Is that sufficient, or should there also be a global kill switch?
   - Options: Per-call `confirm: true` only (Recommended) | Also add `MCP_READ_ONLY` env var
   - **Answer:** Per-call `confirm: true` only (Recommended)
   - **Rationale:** Matches the already-applied audit finding #1; a global read-only flag is additional config surface not requested — noted as a possible future follow-up, not built now.

#### Confirmed Decisions
- Tool count: ship all 68 tools in this iteration — no deferral.
- `PROJECT_SERVICE_APP_URL` default: `http://localhost:3304/circle/api` (already in phase 1 as written).
- Distribution: local monorepo `node` execution, no npm publishing.
- Destructive-tool safety: per-call `confirm: true` only, no global read-only mode.

#### Action Items
- None — all four answers confirm the plan's existing design as written; no phase file edits required.

#### Impact on Phases
- None. All answers matched the "(Recommended)" option already reflected in phase-01 through phase-05 and the accepted audit findings.

## Audit Review

### Session — 2026-09-21
**Findings:** 15 (15 accepted, 0 rejected)
**Severity breakdown:** 6 Critical, 6 High, 3 Medium
**Method:** 3 hostile reviewer personas (Security Adversary, Assumption Destroyer, Failure Mode Analyst / Scope & Complexity Critic) per `references/audit-personas.md`, 26 raw findings deduplicated to 15.

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | No confirmation gate on destructive tools (delete/remove actions) | Critical | Accept | phase-03, phase-04 |
| 2 | JWT reused at full account privilege scope, undocumented | Critical | Accept (doc-only — respects prior JWT-reuse decision) | phase-02 |
| 3 | SDK API assumed without a version-pinned, verified spike | Critical | Accept | phase-01 |
| 4 | stdout/stderr collision risk treated as optional, not a hard gate | Critical | Accept | phase-01 |
| 5 | 30-day JWT TTL sitting in a long-lived MCP client process, not surfaced | Critical | Accept | phase-02 |
| 6 | No HTTP timeout on outbound project-service calls | Critical | Accept | phase-02 |
| 7 | README security note self-contradicts its own plaintext-token setup instructions | High | Accept (doc-only — respects prior JWT-reuse decision) | phase-05 |
| 8 | No pagination on list tools; PII fields pass through unflagged | High | Accept | phase-03, phase-04 |
| 9 | No audit-trail logging of tool invocations | High | Accept | phase-02, phase-05 |
| 10 | `process.exit(1)` immediately after an async Winston log call can drop the error message | High | Accept | phase-02 |
| 11 | Consolidated `action`-enum tools use flat optional-field schemas instead of discriminated unions | High | Accept | phase-03, phase-04 |
| 12 | Role/permission fields on member-add routes could allow privilege escalation via `team_manage_member`/`member_create` | High | Accept (description/visibility requirement, not new auth control) | phase-03, phase-04 |
| 13 | Error normalization has no structured taxonomy (retryable vs. terminal) and could leak raw response bodies | Medium | Accept | phase-02 |
| 14 | `jwt.decode()` result not null-guarded; no `iss`/`aud` claim check | Medium | Accept | phase-02 |
| 15 | Tool count inconsistent: plan.md says "~60", phase 3+4 sum to 68 | Medium | Accept | plan.md |

**Note on findings #2, #7, #12:** these respect the user's explicit prior decision to reuse the existing JWT with no new auth surface (per `review-audit-self-decision.md` — audits must not silently reverse a user decision). They are applied as documentation/visibility requirements (make the trade-off explicit to the end user) rather than as new authentication/authorization infrastructure.

## Completion Summary — 2026-09-21

All 5 phases done. Live-verified via MCP Inspector CLI against a real running project-service (native `pnpm --filter project-service start:dev`, real Postgres, real seed data).

- **Tool count correction:** actual final count is **69 tools** (not 68/~60 as earlier estimated) — phase 3's issue tools list has 14 entries, not the 13 stated in its summary line (arithmetic typo in phase-03, tool list itself was always correct). Phase 3 = 46 tools, phase 4 = 23 tools, total = 69. Confirmed live via `tools/list`.
- **Post-review fixes:** code-reviewer found 2 critical gaps (missing `confirm: z.literal(true)` on `team_manage_member` remove branch and `cycle_manage_calendar_subscription` delete branch) + 3 high issues (4 oxlint unused-`action`-destructure errors, `main.ts` bootstrap() missing `.catch()`, audit-log allowlist regex missing `role` field). All 5 fixed; re-verified clean (`check-types` 0 errors, `build` success, `lint` 0 warnings/errors).
- **Incidental bugs found+fixed (orthogonal to plan scope):** (a) stale compiled `dist/` in `libs/common`/`libs/core` caused project-service boot failure (bogus Joi env validation) — fixed by rebuilding both libs; (b) circular import between `project-service-client.module.ts` and `project-service-http.client.ts` (shared DI token) caused SWC `ReferenceError` — fixed by extracting the token to `project-access-token.constant.ts`.
- **Known follow-up, out of scope, not fixed:** `project-service` and `user-service` share one `mikro_orm_migrations` table with no distinct `tableName`, causing corrupted/out-of-sync migration history (e.g. `TableExistsException: relation "cycles" already exists`). This caused real 500s from project-service during live testing on `project_list`, `cycle_list`, `issue_create` (happy path), `label_list`, `initiative_list`, `view_list` — mcp-server correctly forwarded the request and surfaced the error as a structured tool error without crashing; this is a pre-existing infra bug in local dev setup, not an mcp-server defect. Real fix needed: per-service `migrations.tableName` in each service's MikroORM config.
