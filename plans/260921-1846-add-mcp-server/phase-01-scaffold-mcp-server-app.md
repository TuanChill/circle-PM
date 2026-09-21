# Phase 1: Scaffold apps/mcp-server

## Context Links

- Plan: [plan.md](./plan.md)
- Template app: `apps/notification-service/package.json`, `apps/notification-service/src/main.ts`, `apps/notification-service/nest-cli.json`, `apps/notification-service/tsconfig.json`
- Workspace glob: `pnpm-workspace.yaml:1-3` (`apps/*`, `libs/*` — no change needed)
- Env/turbo wiring: `.env.example:33-40,75-78`, `turbo.json:56-96` (`globalEnv` array)
- Docker template (reference only, not used this phase): `.docker/compose/nodejs/Dockerfile:1-70`, `docker-compose.yml:142-177`

## Overview

- Priority: P0 (blocks all other phases)
- Status: done
- Create the `apps/mcp-server` directory with package.json, tsconfig, nest-cli.json, and a minimal `main.ts` that boots a Nest application context (no HTTP server) and starts an MCP stdio transport with zero tools registered. Wire new env vars into `turbo.json` and `.env.example`.

## Key Insights

- `apps/notification-service/src/main.ts:27` calls `NestFactory.create(AppModule, { logger })` then `app.listen(appPort)` — mcp-server must NOT do this. Use `NestFactory.createApplicationContext(AppModule, { logger })` instead: gives full Nest DI/module/config/logging without opening a port, matching "stdio process, no HTTP listener" decision in plan.md.
- `apps/notification-service/tsconfig.json:23-27` deliberately empties `paths` so the SWC-built app resolves `@app/common`/`@app/core` through the pnpm symlink, not raw TS source — mcp-server's tsconfig must copy this exact pattern (comment included) or workspace-lib resolution breaks at runtime.
- `apps/notification-service/nest-cli.json` uses `builder: "swc"`, `typeCheck: false` — mirror this; do not introduce a different builder.
- No `docker-compose.yml` entry and no `.docker/compose/nodejs/Dockerfile` change in this phase — stdio processes are spawned directly by the MCP client (Claude Desktop config `command`/`args`), not by Docker. Document this decision inline in a comment in `main.ts` so it isn't "fixed" by a future contributor assuming parity with other apps.
- `turbo.json:56` `globalEnv` is a flat array of env var names that must be listed explicitly for turbo to pass them into tasks (confirmed: `JWT_SECRET` already listed at line 70). New vars for this app (`PROJECT_SERVICE_APP_URL`) must be added or `pnpm --filter mcp-server build`/`dev` won't see them.
- `.env.example:39` has `PROJECT_SERVICE_APP_PORT=3304` (project-service's own listen port) but there is no existing `PROJECT_SERVICE_APP_URL` (base URL for a REST caller) anywhere in the repo (confirmed via grep) — must be added fresh.
- No `MCP_SERVER_APP_PORT` needed since there is no HTTP listener.

## Requirements

### Functional

- `pnpm --filter mcp-server build` succeeds and produces `apps/mcp-server/dist/main.js`.
- `node apps/mcp-server/dist/main.js` starts, logs a startup line via Winston, opens a stdio MCP server with the official SDK, and stays running listening on stdin/stdout (does not crash, does not open a network port).
- `turbo run dev --filter=mcp-server` works via `nest start --watch` for local iteration (client reconnect not required for dev — note in phase 5 that MCP Inspector must be restarted after code changes during dev).

### Non-Functional

- Match sibling app conventions exactly (helmet/cors/global-prefix are HTTP-only concerns — do not add them since there's no HTTP server; but DO keep Winston logging and `getAppCommonConfig()` for `NODE_ENV`/`TZ` consistency).
- New dependency footprint stays minimal: `@modelcontextprotocol/sdk`, `zod`, `@nestjs/axios`, `axios` (peer of `@nestjs/axios`), `jsonwebtoken`, `@types/jsonwebtoken` (dev). No bullmq/kafka/rabbitmq/mail/aws/grpc deps (those are notification-service-specific, not needed here — confirmed project-service has no gRPC per `docs/service-communication.md` per brainstorm fact #2).

## Architecture

```
apps/mcp-server/
├── package.json
├── tsconfig.json
├── nest-cli.json
├── src/
│   ├── main.ts                  # createApplicationContext + stdio MCP bootstrap
│   ├── config/
│   │   └── app.config.ts        # appName, projectServiceBaseUrl from env
│   └── modules/
│       └── app.module.ts        # root module (empty providers until phase 2/3)
└── test/                        # jest-e2e.json copied from notification-service, empty for now
```

Data flow (end state, informational — later phases fill it in): `MCP client (stdin/stdout JSON-RPC)` → `McpServer` (SDK) tool handler → `ProjectServiceClient` (phase 2) → `HTTP GET/POST/PATCH/DELETE http://localhost:3304/circle/api/...` with `Authorization: Bearer <jwt>` → response JSON → returned as MCP tool result content.

## Related Code Files

**Create:**
- `apps/mcp-server/package.json`
- `apps/mcp-server/tsconfig.json`
- `apps/mcp-server/nest-cli.json`
- `apps/mcp-server/src/main.ts`
- `apps/mcp-server/src/config/app.config.ts`
- `apps/mcp-server/src/modules/app.module.ts`
- `apps/mcp-server/test/jest-e2e.json` (copy pattern from `apps/notification-service/test/jest-e2e.json` if it exists — verify path first)

**Modify:**
- `turbo.json` — add `PROJECT_SERVICE_APP_URL` to `globalEnv` array (near line 70, alongside existing `JWT_SECRET` block)
- `.env.example` — add `PROJECT_SERVICE_APP_URL=http://localhost:3304/circle/api` near line 39, plus a comment explaining it's the outbound target for mcp-server (JWT_SECRET/JWT_ISSUER already present at lines 75-78, reused as-is, no changes needed there)

**Delete:** none

## Implementation Steps

1. Verify `apps/notification-service/test/jest-e2e.json` exists; read it to copy exact shape (or skip test dir if sibling apps don't have one — check `apps/project-service/test/` too for the repo's actual e2e convention before assuming).
2. Create `apps/mcp-server/package.json`: copy `apps/notification-service/package.json` structure, strip bullmq/kafka/rabbitmq/aws-ses/handlebars/nodemailer/@grpc/@nestjs/microservices deps, keep `@app/common`, `@app/core`, `@nestjs/common`, `@nestjs/config`, `@nestjs/core`, `@nestjs/passport`, `passport`, `passport-jwt`, `class-transformer`, `class-validator`, `helmet` (unused directly but harmless — actually drop helmet/cors-related deps since no HTTP server; keep only what's used), `nest-winston`, `winston`, `reflect-metadata`, `rimraf`, `rxjs`. Add new: `@modelcontextprotocol/sdk`, `zod`, `@nestjs/axios`, `axios`, `jsonwebtoken`. Add dev: `@types/jsonwebtoken`.
3. Create `apps/mcp-server/tsconfig.json` — copy `apps/notification-service/tsconfig.json` verbatim (including the empty-`paths` comment), update `references` to same `../../libs/common` and `../../libs/core` paths.
4. Create `apps/mcp-server/nest-cli.json` — copy `apps/notification-service/nest-cli.json` verbatim (swc builder, swagger plugin config — swagger plugin is harmless even unused, but if no DTOs need swagger decoration in this app, consider dropping the plugin block; keep it simple and copy as-is per YAGNI-of-effort, note as acceptable dead config).
5. Create `apps/mcp-server/src/config/app.config.ts`: export `getAppConfig()` returning `{ appName: 'mcp-server', projectServiceBaseUrl: process.env.PROJECT_SERVICE_APP_URL }`, throwing at startup if `PROJECT_SERVICE_APP_URL` or `JWT_SECRET` is unset (fail fast, matches `apps/project-service/src/modules/auth/strategies/jwt.strategy.ts:26-28` pattern of throwing on missing secret).
6. Create `apps/mcp-server/src/modules/app.module.ts`: minimal `@Module({ imports: [ConfigModule.forRoot()] })` root module — no controllers (no HTTP), providers added in phase 2/3.
7. Create `apps/mcp-server/src/main.ts`:
   - `const app = await NestFactory.createApplicationContext(AppModule, { logger: WinstonModule.createLogger(getWinstonConfig(appName, nodeEnv)) })`
   - **[AUDIT] Pin an exact `@modelcontextprotocol/sdk` version in `package.json` (no `^`/`~` range) before writing any code against it.** Instantiate `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js` with `{ name: 'mcp-server', version: '1.0.0' }`, verifying the exact import path/API against that pinned version. **This step's output must be a working single-tool spike (e.g. a dummy `ping` tool) round-tripped through MCP Inspector (`npx @modelcontextprotocol/inspector node apps/mcp-server/dist/main.js`) before phase 1 is marked done.** Phases 3/4 register 68 tools against this same API with no further re-verification, so a wrong guess here is not a phase-1-only fix — it invalidates every tool file written afterward. Do not treat "it compiles" as sufficient; the spike must actually list and successfully call the dummy tool via Inspector.
   - Connect a `StdioServerTransport` from `@modelcontextprotocol/sdk/server/stdio.js`.
   - **[AUDIT] Route ALL logging to stderr, unconditionally — do not make this conditional on "if it collides."** stdout is reserved exclusively for MCP JSON-RPC framing; a single stray byte (a Nest startup banner, a transitive dependency's `console.log`, an uncaught exception's default stack-trace print) corrupts every client's stdio parser. Configure the Winston logger with a `Console` transport pinned to `stderr: true` (or equivalent) and verify during the step-11 spike that `node apps/mcp-server/dist/main.js 1>/tmp/stdout.txt` produces a file containing ONLY valid MCP JSON-RPC lines (empty is fine before tools are registered) — this check becomes part of Success Criteria below, not an optional afterthought.
   - No tools registered yet beyond the spike's dummy tool — phases 3/4 add tools via `app.get(...)`-injected providers.
8. Add `PROJECT_SERVICE_APP_URL` to `turbo.json` `globalEnv` array.
9. Add `PROJECT_SERVICE_APP_URL=http://localhost:3304/circle/api` to `.env.example` with a one-line comment.
10. Run `pnpm install` at repo root to link the new app into the workspace and install new deps.
11. Run `pnpm --filter mcp-server build` — verify it compiles with zero errors.
12. Run `node apps/mcp-server/dist/main.js 1>/tmp/stdout.txt`, confirm it starts and stays alive without crashing (Ctrl+C to stop); inspect `/tmp/stdout.txt` and confirm it contains ONLY valid MCP JSON-RPC content (empty is acceptable pre-tool-registration) — any Nest/Winston banner line in that file is a failing result, not a warning.
13. **[AUDIT]** Run `npx @modelcontextprotocol/inspector node apps/mcp-server/dist/main.js`, confirm the dummy `ping` tool from step 7 lists and calls successfully — this is the phase-1 exit gate for the SDK API assumption before phases 3/4 build 68 more tools on top of it.

## Todo List

- [x] Confirm `apps/notification-service/test/jest-e2e.json` or `apps/project-service/test/` pattern before copying test scaffolding
- [x] Create package.json, tsconfig.json, nest-cli.json
- [x] Create app.config.ts, app.module.ts, main.ts
- [x] Add `PROJECT_SERVICE_APP_URL` to turbo.json globalEnv
- [x] Add `PROJECT_SERVICE_APP_URL` to .env.example
- [x] `pnpm install` at repo root
- [x] `pnpm --filter mcp-server build` passes
- [x] `node apps/mcp-server/dist/main.js` runs without crashing, logs go to stderr (not stdout)
- [x] **[AUDIT]** `@modelcontextprotocol/sdk` version pinned exactly in package.json
- [x] **[AUDIT]** stdout redirect test: `1>/tmp/stdout.txt` capture contains only valid MCP framing, no Nest/Winston banners
- [x] **[AUDIT]** Dummy `ping` tool spike verified end-to-end via MCP Inspector

## Success Criteria

- `pnpm --filter mcp-server build` exits 0.
- `node apps/mcp-server/dist/main.js` process stays running (observable: process doesn't exit within 3s of start) and does not throw on missing/malformed input.
- `git diff turbo.json .env.example` shows only the additive `PROJECT_SERVICE_APP_URL` lines — no unrelated changes.
- **[AUDIT] Hard gate (not optional):** redirecting stdout to a file while the process runs (`1>/tmp/stdout.txt`) produces a file with zero non-MCP-framing bytes.
- **[AUDIT] Hard gate (not optional):** MCP Inspector successfully lists and calls the dummy `ping` tool against the pinned SDK version before phase 3 begins.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Nest's default console logger writes to stdout and corrupts MCP stdio JSON-RPC framing | Medium | High | **[AUDIT]** Unconditionally route the Winston transport to stderr (not "only if needed" — see step 7); verified by the stdout-redirect hard gate in Success Criteria |
| SWC builder + `emitDecoratorMetadata` interacts poorly with `@modelcontextprotocol/sdk`'s zod-based schemas (no decorators involved, likely fine) | Low | Low | Build succeeds in step 11 is the gate; no decorator usage expected in MCP tool registration |
| Copying notification-service's swagger nest-cli plugin config is dead weight | Low | Low | Accept as harmless; do not spend time stripping it (YAGNI on cleanup effort) |

## Security Considerations

- No secrets in this phase's new files — `PROJECT_SERVICE_APP_URL` is not sensitive (a hostname/port), `JWT_SECRET` already exists in `.env.example` as a placeholder and is reused, not duplicated.
- `main.ts` must not log the JWT or full request/response bodies at info level (defer to phase 2 for actual JWT handling; this phase has no JWT logic yet).

## Next Steps

- Blocks Phase 2 (HTTP client + JWT decode needs `AppModule`/`app.config.ts` to exist).
- Follow-up (explicitly out of scope, documented for later): SSE/HTTP transport + docker-compose entry, if remote/Dockerized MCP clients become a requirement.
