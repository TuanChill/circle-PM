# mcp-server

Standalone MCP (Model Context Protocol) server exposing `project-service`'s
project-management data (Workspaces, Teams, Issues, Projects, Cycles, Labels,
Members, Initiatives, Views — 69 tools total) to MCP clients such as Claude
Desktop, Claude Code, and Cursor. It is a stdio process spawned directly by
the client; it holds no HTTP listener and adds no new auth surface — every
call is forwarded to `project-service` with the same JWT `project-service`
already accepts.

## ⚠️ Security: `PROJECT_ACCESS_TOKEN` is a credential, not a config value

The `PROJECT_ACCESS_TOKEN` you put in your MCP client's config is a bearer
JWT good for up to 30 days of full access to your `project-service` account
(everything this token's owner can do via the API, including destructive
actions the tools guard with `confirm: true`). Once it's in your client's
config file, **that config file is as sensitive as a password**:

- Never commit it to any repository (including private ones).
- Don't paste it into chat, issues, or screen-shares.
- If it may have leaked, obtain a fresh token (log in again) — the old one
  stays valid until it expires; there is no server-side revocation endpoint
  in `project-service` today.

## Prerequisites

- `project-service` running and reachable (its Postgres DB must actually be
  migrated — see the note below if you hit `relation "..." does not exist`
  errors).
- Node 22.x, pnpm (repo standard).

## 1. Start project-service

```bash
docker compose up -d db redis
pnpm --filter project-service start:dev
```

`project-service` logs its Swagger URL and listens on
`PROJECT_SERVICE_APP_PORT` (default `3304`) under the `/circle/api` prefix,
so the base URL for mcp-server is `http://localhost:3304/circle/api`.

> **Known local-dev gotcha:** if `project-service` fails to boot with a
> `Config validation error` listing many unrelated required vars
> (`DB_HOST`, `AWS_S3_*`, `ZOOM_*`, ...), the shared `libs/common`/`libs/core`
> packages have a stale `dist/` build (they resolve at runtime via their
> `package.json` `main: dist/index.js`, not live TypeScript). Rebuild them:
> `pnpm --filter @app/common build && pnpm --filter @app/core build`, then
> restart. If a tool call fails with `relation "<table>" does not exist`,
> your local DB has pending migrations relative to current entity code
> (`pnpm --filter project-service migration:pending`) — this repo's local
> Postgres volume can drift from source over time; consult whoever owns the
> seed data before running `migration:up` against a shared/seeded DB, since
> migration history here has been observed to get out of sync.

## 2. Obtain a JWT

**Documented flow (`auth-service`):**

```bash
curl -X POST http://localhost:3301/api/login \
  -H 'Content-Type: application/json' \
  -d '{"email": "<your-email>", "password": "<your-password>"}'
```

This returns `{ accessToken, refreshToken, email, success }` — use
`accessToken` as `PROJECT_ACCESS_TOKEN`. `auth-service`'s `AUTH_SERVICE_APP_PORT`
defaults to `3301`.

**If that flow is unavailable in your environment** (e.g. no password set on
your seed user, or `user-service`'s own migrations haven't run), you can
mint a token directly for local testing only, using the shared `JWT_SECRET`
from the repo's root `.env` and any real member record already in your
`project-service` DB:

```bash
JWT_SECRET_INPUT="$(grep -m1 '^JWT_SECRET=' .env | cut -d= -f2-)" \
pnpm --filter mcp-server exec node -e "
  const jwt = require('jsonwebtoken');
  const token = jwt.sign(
    { sub: '<member-id>', email: '<member-email>', name: '<name>', role: 'Admin' },
    process.env.JWT_SECRET_INPUT,
    { expiresIn: '2h', issuer: 'ai-agent' }
  );
  console.log(token);
"
```

This is a real, validly-signed token verified by `project-service`'s actual
`JwtStrategy` against real data — it substitutes only for the login *call*,
not for any part of `project-service`'s own auth enforcement. Treat it with
the same care as a token obtained via login (see security note above). Note
the `issuer: 'ai-agent'` claim — mcp-server's own startup check
(`decode-and-validate-token.ts`) rejects tokens without it.

## 3. Build mcp-server

```bash
pnpm --filter mcp-server build
```

## 4. Run with MCP Inspector

```bash
PROJECT_ACCESS_TOKEN=<jwt> PROJECT_SERVICE_APP_URL=http://localhost:3304/circle/api \
npx @modelcontextprotocol/inspector node apps/mcp-server/dist/main.js
```

Open the Inspector UI, run `tools/list` (69 tools should appear), then call
any tool with real arguments to see project-service's actual JSON response.

For scripted/non-interactive checks, the Inspector's `--cli` mode works too
(env vars must be passed via a config file's `env` block or `-e KEY=value`,
not just inherited from your shell):

```bash
npx @modelcontextprotocol/inspector --cli \
  -e PROJECT_ACCESS_TOKEN=<jwt> -e PROJECT_SERVICE_APP_URL=http://localhost:3304/circle/api \
  node apps/mcp-server/dist/main.js -- --method tools/list
```

## 5. Configure Claude Desktop / Claude Code / Cursor

```json
{
  "mcpServers": {
    "circle-project": {
      "command": "node",
      "args": ["<absolute-path>/apps/mcp-server/dist/main.js"],
      "env": {
        "PROJECT_ACCESS_TOKEN": "<jwt>",
        "PROJECT_SERVICE_APP_URL": "http://localhost:3304/circle/api"
      }
    }
  }
}
```

Restart the client after editing its config. If `PROJECT_ACCESS_TOKEN` is
missing, malformed, wrong-issuer, or expired, mcp-server exits immediately
with a clear stderr message instead of hanging or silently failing later.

## Behavior notes

- Every tool returns `project-service`'s exact JSON response — no reshaping.
- Destructive tools (deletes, and destructive branches of consolidated
  tools) require `confirm: true` in the call arguments.
- Tools whose response includes personal data (member name/email) say so in
  their description.
- Tools whose input can grant an elevated role (up to Admin) say so in their
  description — `project-service`'s own guard is still the actual
  authorization boundary; this is a visibility note, not a new control.
- Every tool call is audit-logged to stderr (tool name + id/action fields)
  via Winston.
