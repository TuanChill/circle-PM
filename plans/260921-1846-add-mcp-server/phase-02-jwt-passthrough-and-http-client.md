# Phase 2: JWT pass-through + project-service HTTP client

## Context Links

- Plan: [plan.md](./plan.md)
- Phase 1: [phase-01-scaffold-mcp-server-app.md](./phase-01-scaffold-mcp-server-app.md)
- JWT validation reference (do not duplicate logic, only fail-fast decode): `apps/project-service/src/modules/auth/strategies/jwt.strategy.ts:20-46`
- Guard reference (actual enforcement stays here): `apps/project-service/src/modules/auth/guards/jwt-auth.guard.ts`
- Existing HTTP wrapper (evaluated, not reused as-is): `libs/core/src/http/http.service.ts`, `libs/core/src/http/http.module.ts`
- Route inventory for base paths: project-service `@Controller(...)` decorators in `apps/project-service/src/modules/{workspaces,teams,issues,projects,cycles,labels,members,initiatives,views}/*.controller.ts`
- Global prefix: `apps/project-service/src/main.ts:35` (`app.setGlobalPrefix('circle/api')`)

## Overview

- Priority: P0 (blocks phases 3, 4 — every tool handler needs this client)
- Status: done
- Build a single reusable `ProjectServiceHttpClient` provider that (a) reads the caller's JWT from MCP tool-call context, (b) does a local decode-only check for expiry/malformed shape, (c) issues the REST call to `project-service` with `Authorization: Bearer <token>`, and (d) normalizes errors into MCP-tool-friendly messages.

## Key Insights

- **Why not reuse `libs/core/src/http/http.service.ts`:** read it during implementation to confirm, but based on its module shape (`libs/core/src/http/http.module.ts` — plain provider export, no interceptors visible) it's a generic wrapper likely built for a different call pattern (e.g., internal service-to-service without end-user bearer forwarding). Verify its method signatures before deciding; if it already supports passing an arbitrary `Authorization` header per-call, reuse it instead of adding `@nestjs/axios` as a new dependency (DRY beats the earlier default choice — confirm in step 1 below before proceeding).
- **JWT pass-through mechanism:** MCP tool calls don't have an HTTP request/header context — the token must come from the MCP client's process environment (e.g., `env: { PROJECT_JWT: "..." }` in Claude Desktop's server config) since stdio transport has no per-call auth header concept. This means the JWT is read ONCE at process startup from `process.env.PROJECT_JWT` (or similar), not per-call. Document this clearly: **one mcp-server process = one authenticated user for its lifetime.** If the user's token expires mid-session, they must restart the MCP server process with a fresh token (no refresh-token flow in scope, per brainstorm contract's "no login surface" decision).
- **Local decode, not verify:** use `jsonwebtoken`'s `jwt.decode(token)` (no secret needed, no signature check) purely to read `exp` and give an immediate "token expired, please restart with a fresh token" error instead of waiting for a 401 from project-service. This is NOT a security boundary — `project-service`'s `JwtStrategy` (`apps/project-service/src/modules/auth/strategies/jwt.strategy.ts:33-46`) remains the only place that verifies the HS256 signature. Do not import `JWT_SECRET` into mcp-server for verification purposes (would duplicate trust logic per the accepted contract).
- **[AUDIT] JWT TTL is 30 days (`JWT_ACCESS_TOKEN_EXPIRES_IN=30d` in `.env.example`).** A long-lived, full-scope user token sitting in a plaintext MCP client config (Claude Desktop's `env` block) for a month is a materially larger exposure window than the same token in a browser session. This is a direct consequence of the user's accepted "reuse existing JWT" decision, not something this plan can change — document it plainly instead of re-litigating the decision: README (phase 5) must tell users this token is long-lived and equivalent to full account access for its lifetime, and recommend obtaining a fresh token / rotating it periodically. If the user wants a shorter-lived token specifically for MCP use, that requires a new auth surface on auth-service, which is out of scope per the original decision — flag it as a follow-up, don't build it here.
- **[AUDIT] HTTP timeout:** every outbound call from `ProjectServiceHttpClient` must set an explicit timeout (15s) so a hung project-service doesn't hang the MCP tool call (and the calling LLM client) indefinitely.
- **Base URL:** `PROJECT_SERVICE_APP_URL` (added in phase 1) already includes the `/circle/api` prefix, so client code appends only the resource path (e.g., `/workspaces`, not `/circle/api/workspaces`).
- **Error normalization:** project-service's error responses shape must be inspected (check `apps/project-service/src/modules/**/*.controller.ts` + any global exception filter, e.g. search for `@Catch` in `libs/common/src/exceptions/`) before writing the normalizer — do not assume a shape.

## Requirements

### Functional

- A single `ProjectServiceHttpClient` service with methods `get(path, query?)`, `post(path, body?)`, `patch(path, body?)`, `delete(path)` — all automatically attach `Authorization: Bearer <token>` from the module-scoped token.
- Read the JWT once from `process.env.PROJECT_ACCESS_TOKEN` (new env var, MCP-client-supplied, not committed to `.env.example` defaults since it's per-user secret — document in README/phase 5 instead).
- On startup (in `main.ts`, after phase 1's bootstrap), decode the token and log a clear error + exit(1) if: env var missing, token malformed, or `exp` already in the past. This is the "fail fast" behavior from the brainstorm contract.
- **[AUDIT] Startup decode must null-guard every field access** (`payload?.exp`, `payload?.email`) since `jwt.decode()` returns `null` for a structurally invalid (non-JWT) string, and must also check `payload.iss === 'ai-agent'` (matches `.env.example`'s `JWT_ISSUER`) so an obviously wrong-audience token is rejected at startup with a clear message rather than surfacing as a confusing 401 on the first tool call.
- On any project-service HTTP error response, surface `{ status, message }` back to the MCP client as a tool error result (not a thrown unhandled exception that kills the process).
- **[AUDIT] Structured error taxonomy:** `project-service-http-error.ts` must classify every error into one of `AUTH_EXPIRED` (401), `VALIDATION_ERROR` (400/422), `NOT_FOUND` (404), `TRANSIENT_ERROR` (5xx/network/timeout) so MCP clients (and the LLMs driving them) can decide whether to retry. Each classified error includes a `retryable: boolean` hint. `message` must pass through only a whitelisted set of fields from project-service's response (e.g. `message`, `error`) — never forward the full raw response body, which may contain internal fields not meant for the end client.
- **[AUDIT] Audit-trail logging:** every tool invocation (tool name, action taken, target resource id, timestamp — never the token or request/response bodies) must be logged to stderr via the Winston logger, so a destructive or unexpected call can be traced after the fact. This is the minimum accountability trail for a service that can mutate real project data on the caller's behalf.

### Non-Functional

- No signature verification, no `JWT_SECRET` import into mcp-server.
- No retry/backoff logic (YAGNI — a single external REST call per tool invocation, let the MCP client re-invoke on failure).
- No connection pooling config beyond `@nestjs/axios` (or `libs/core` client's) defaults.
- **[AUDIT] Explicit 15s request timeout** configured on the HTTP client (axios `timeout: 15000` or equivalent) — see Key Insights.

## Architecture

```
process.env.PROJECT_ACCESS_TOKEN (set by MCP client config)
        │  (read once at startup)
        ▼
main.ts → decode-and-validate-token.ts (fail fast) → token held in memory
        │
        ▼
ProjectServiceHttpClient (Injectable, module-scoped)
  .get/.post/.patch/.delete(path, ...)
        │  axios call with baseURL=PROJECT_SERVICE_APP_URL, header Authorization: Bearer <token>
        ▼
project-service REST API (JwtAuthGuard verifies signature independently)
        │
        ▼
JSON response ──▶ tool handler maps to MCP tool result content
error response ──▶ tool handler maps to MCP tool error content (isError: true)
```

## Related Code Files

**Create:**
- `apps/mcp-server/src/modules/project-service-client/project-service-http.client.ts` — the injectable client
- `apps/mcp-server/src/modules/project-service-client/project-service-client.module.ts`
- `apps/mcp-server/src/modules/project-service-client/decode-and-validate-token.ts` — startup fail-fast check
- `apps/mcp-server/src/modules/project-service-client/project-service-http-error.ts` — normalized error type/mapper

**Modify:**
- `apps/mcp-server/src/modules/app.module.ts` — import `ProjectServiceClientModule` and `HttpModule.register(...)` (either `@nestjs/axios`'s or `libs/core`'s, per step 1 decision)
- `apps/mcp-server/src/main.ts` — call `decode-and-validate-token.ts` before starting the MCP transport
- `apps/mcp-server/package.json` — add `@nestjs/axios`, `axios`, `jsonwebtoken` (only if libs/core's HttpService is NOT reused; drop `@nestjs/axios`/`axios` from this list if it is)

**Delete:** none

## Implementation Steps

1. Read `libs/core/src/http/http.service.ts` in full. Determine: does it accept a per-call custom header (specifically `Authorization`)? Does it support `baseURL` configuration? If yes to both, reuse it — skip adding `@nestjs/axios` and use `HttpModule` from `libs/core` instead, update phase 1's package.json plan accordingly. If no, proceed with `@nestjs/axios` as originally planned.
2. Read project-service's global exception handling (search `libs/common/src/exceptions/` and `apps/project-service/src/main.ts` for any `useGlobalFilters`) to learn the actual error response shape before writing `project-service-http-error.ts`.
3. Create `decode-and-validate-token.ts`: exports `validateTokenOrExit(): string` — reads `process.env.PROJECT_ACCESS_TOKEN`, calls `jwt.decode(token)`, null-guards the result (invalid JWT structure → `null`), checks `payload.exp` against `Date.now()/1000`, checks `payload.email` exists (matches `apps/project-service/src/modules/auth/strategies/jwt.strategy.ts:34-38` shape expectations), checks `payload.iss` matches the configured issuer, logs a clear message and calls `process.exit(1)` on any failure, otherwise returns the raw token string. **[AUDIT]** Since logging goes through Winston (async transports), call `logger.error(...)` and give it a chance to flush (e.g. await the Winston logger's `end()`/flush or use a synchronous `console.error` for this specific fatal-startup message) before `process.exit(1)` — an immediate `process.exit(1)` right after an async log call can truncate or drop the very error message the user needs to see.
4. Create `project-service-http.client.ts`: `@Injectable()` class wrapping the chosen HTTP module, constructed with the token from step 3 (inject via a `PROJECT_ACCESS_TOKEN` provider token set in `project-service-client.module.ts`, not read from `process.env` again inside the client — single source of truth).
5. Create `project-service-client.module.ts`: registers the HTTP module with `baseURL: getAppConfig().projectServiceBaseUrl`, provides `PROJECT_ACCESS_TOKEN` value provider, exports `ProjectServiceHttpClient`.
6. Wire into `app.module.ts` and `main.ts` per "Modify" list above.
7. Write a manual smoke check (documented in phase 5, not automated here): start project-service locally, start mcp-server with a valid `PROJECT_ACCESS_TOKEN`, add a temporary debug tool (removed before phase 3 ships) that calls `GET /workspaces` and prints the result, confirm 200 response round-trips.
8. Add a unit test for `decode-and-validate-token.ts` covering: valid token, missing env var, expired token, malformed token (jest, colocated `*.spec.ts` per repo convention seen in `apps/project-service/src/config/*.spec.ts`).

## Todo List

- [x] Decide: reuse `libs/core` HttpService or add `@nestjs/axios` (read `libs/core/src/http/http.service.ts` first)
- [x] Inspect project-service global exception filter shape
- [x] Create `decode-and-validate-token.ts` + unit test
- [x] Create `project-service-http.client.ts`
- [x] Create `project-service-client.module.ts`
- [x] Create `project-service-http-error.ts`
- [x] Wire into `app.module.ts`, `main.ts`
- [x] Manual smoke test: real `GET /workspaces` round-trip against running project-service (live-verified via MCP Inspector CLI, see phase 5)

## Success Criteria

- Unit tests for token decode pass (valid/missing/expired/malformed cases).
- Manual smoke test in step 7 returns real workspace data (not mocked) from a running project-service instance, or a clear auth error if the token is invalid — never a silent crash or hang.
- `pnpm --filter mcp-server build` and `pnpm --filter mcp-server test` both pass.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `libs/core` HttpService doesn't support per-instance dynamic `Authorization` header, forcing a second HTTP client into the repo | Medium | Low | Acceptable either way — `@nestjs/axios` is a well-known, small addition; document the decision inline in `project-service-client.module.ts` |
| Single-token-per-process model surprises users expecting per-call auth (e.g., multi-user MCP gateway) | Low | Medium | Explicitly out of scope per brainstorm contract ("no login surface"); document limitation in phase 5's README/setup instructions |
| project-service error response shape assumption wrong | Medium | Medium | Step 2 mandates reading actual filter code before writing the mapper — no fabricated shape |

## Security Considerations

- `PROJECT_ACCESS_TOKEN` must never be logged (not even at debug level) — audit `project-service-http.client.ts` and `decode-and-validate-token.ts` for any `console.log`/logger call that includes the raw token.
- No signature verification in mcp-server is intentional and documented — this is not a security gap because project-service independently verifies every request; mcp-server's decode is UX-only.
- `PROJECT_ACCESS_TOKEN` is a per-user secret and must NOT be added to `.env.example` with a real-looking default — only document the env var name in phase 5's setup guide.
- **[AUDIT] Documentation-only, respecting the accepted "reuse existing JWT" decision (no new auth surface is being built here):** the token carries the caller's full project-service privilege scope, not an MCP-limited subset, and is valid for up to 30 days. Phase 5's README must state this plainly as a known trade-off of the JWT-reuse decision, not silently gloss over it.

## Next Steps

- Blocks Phase 3 and Phase 4 (all MCP tools call through `ProjectServiceHttpClient`).
- Any temporary debug tool added in step 7 must be removed before phase 3 tools are registered (avoid orphaned dead code).

**Post-implementation fix (incidental, found during phase 5 debugging):** circular import between `project-service-client.module.ts` and `project-service-http.client.ts` (both imported a DI token constant from each other) caused SWC-compiled `ReferenceError: Cannot access before initialization`. Fixed by extracting the constant to `project-access-token.constant.ts`.
