# Phase 3: Core PM MCP tools — Workspaces, Teams, Issues, Projects, Cycles

## Context Links

- Plan: [plan.md](./plan.md)
- Phase 2: [phase-02-jwt-passthrough-and-http-client.md](./phase-02-jwt-passthrough-and-http-client.md)
- Route inventory (source of truth, re-verify against controllers before coding, do not trust this list alone):
  - `apps/project-service/src/modules/workspaces/workspaces.controller.ts`
  - `apps/project-service/src/modules/teams/teams.controller.ts`
  - `apps/project-service/src/modules/issues/issues.controller.ts`
  - `apps/project-service/src/modules/projects/projects.controller.ts`
  - `apps/project-service/src/modules/cycles/cycles.controller.ts`
- DTO folders (read every file here before writing zod schemas — do not fabricate fields):
  - `apps/project-service/src/modules/workspaces/dto/create-workspace.dto.ts`, `.../join-workspace.dto.ts`
  - `apps/project-service/src/modules/teams/dto/team.dto.ts`
  - `apps/project-service/src/modules/issues/dto/issue.dto.ts`
  - `apps/project-service/src/modules/projects/dto/project.dto.ts`
  - `apps/project-service/src/modules/cycles/dto/cycle.dto.ts`

## Overview

- Priority: P1
- Status: done
- Register MCP tools for the 5 highest-value PM entities. Each tool: zod input schema → `ProjectServiceHttpClient` call → JSON result. Consolidate multi-route sub-resources into single tools with an `action` enum, per plan.md's tool-granularity decision.

## Key Insights

- Every DTO file listed above must be opened and read in full before writing the corresponding zod schema — field names, optionality, and enums must match exactly what project-service's `PayloadValidationPipe` (`apps/project-service/src/main.ts`, via `@app/common`) expects, or every write-tool call will 400.
- `GET /cycles/calendar/:token.ics` (calendar feed route) is **excluded** from the tool set — it's a static ICS URL consumed by calendar apps, not an LLM-invokable action. Note this exclusion in the tool list so nobody "completes" it later by accident.
- Tool naming convention: `{entity}_{verb}` (snake_case, matches MCP tool-name conventions seen in most SDKs) e.g. `workspace_list`, `issue_create`. Keep entity prefix singular for consistency across all 9 modules (phase 4 continues this convention).
- Each tool module is a separate file under `apps/mcp-server/src/modules/tools/` — one file per entity, registered from a single `tools.module.ts` that the `main.ts` bootstrap iterates over to call `server.registerTool(...)` (verify exact SDK registration API during step 1 of phase 1 — this phase assumes the API exists but does not re-verify it a second time).
- **[AUDIT] Consolidated `action`-enum tools must use a zod discriminated union** (`z.discriminatedUnion('action', [...])`), not a single flat object schema with all-optional per-action fields. A flat schema lets an LLM caller send `{ action: 'remove', emoji: '...' }` fields that belong to `add` and silently ignores the mismatch; a discriminated union rejects it at the schema boundary with a clear validation error. Applies to every consolidated tool in this phase: `team_manage_member`, `issue_manage_subscription`, `issue_manage_reaction`, `issue_manage_relation`, `project_manage_subscription`, `project_manage_update`, `project_manage_milestone`, `cycle_manage_settings`, `cycle_manage_calendar_subscription`.
- **[AUDIT] Destructive-action confirmation gate:** tools that delete or irreversibly mutate data (`team_delete`, `issue_delete`, `project_delete`, `cycle_delete`, and the `remove` branch of `issue_manage_relation`/`issue_manage_reaction`) must require an explicit `confirm: true` boolean in their input schema; calling without it returns a validation error describing what would be deleted, instead of performing the delete. This is a UX/safety guardrail against an LLM client executing a destructive call on a misread instruction — it is not a substitute for project-service's own authorization checks, which remain the actual security boundary.

## Requirements

### Functional — tool list per entity (route → tool mapping; verify against controller before implementing each)

**Workspaces** (5 tools, ~1:1 with 5 routes):
- `workspace_list` — GET /
- `workspace_get` — GET /:idOrSlug
- `workspace_create` — POST /
- `workspace_join` — POST /join
- `workspace_generate_invite_code` — POST /:id/invite-code

**Teams** (8 tools, consolidating 9 routes):
- `team_list` — GET /
- `team_get` — GET /:id
- `team_list_members` — GET /:id/members
- `team_create` — POST /
- `team_update` — PATCH /:id
- `team_join` — POST /:id/join
- `team_manage_member` — action: `add`|`remove` → POST /:id/members or DELETE /:id/members/:memberId
- `team_delete` — DELETE /:id

**Issues** (14 tools, consolidating 17 routes) — *count corrected from initial "13" typo; list below always had 14 entries*:
- `issue_list` — GET /
- `issue_get_facets` — GET /facets
- `issue_list_archived` — GET /archived
- `issue_get` — GET /:identifier (param `includeDetail` maps to GET /:identifier/detail)
- `issue_get_subscription` — GET /:identifier/subscription
- `issue_manage_subscription` — action: `subscribe`|`unsubscribe` → POST/DELETE /:identifier/subscription
- `issue_create` — POST /
- `issue_update` — PATCH /:identifier
- `issue_reorder` — PATCH /:identifier/rank
- `issue_delete` — DELETE /:identifier
- `issue_restore` — POST /:identifier/restore
- `issue_add_comment` — POST /:identifier/comments
- `issue_manage_reaction` — action: `add`|`remove` → POST /activities/:activityId/reactions or DELETE .../reactions/:emoji
- `issue_manage_relation` — action: `add`|`remove` → POST /:identifier/relations or DELETE /:identifier/relations/:relationId

**Projects** (10 tools, consolidating 15 routes):
- `project_list` — GET /
- `project_get` — GET /:id (param `includeDetail` maps to GET /:id/detail)
- `project_get_members` — GET /:id/members
- `project_set_members` — PUT /:id/members
- `project_manage_subscription` — action: `get`|`subscribe`|`unsubscribe` → GET/POST/DELETE /:id/subscription
- `project_create` — POST /
- `project_update` — PATCH /:id
- `project_delete` — DELETE /:id
- `project_manage_update` — action: `create`|`edit`|`delete` → POST/PATCH/DELETE /:id/updates[/:updateId]
- `project_manage_milestone` — action: `create`|`toggle` → POST /:id/milestones or PATCH /:id/milestones/:milestoneId/toggle

**Cycles** (9 tools, consolidating 12 routes, excluding the `.ics` static feed route):
- `cycle_list` — GET /
- `cycle_get` — GET /:id
- `cycle_manage_settings` — action: `get`|`update` → GET/PATCH /settings
- `cycle_manage_calendar_subscription` — action: `get`|`create`|`delete` → GET/POST/DELETE /calendar-subscription
- `cycle_start_today` — POST /:id/start-today
- `cycle_get_history` — GET /:id/history
- `cycle_create` — POST /
- `cycle_update` — PATCH /:id
- `cycle_delete` — DELETE /:id

Total this phase: 46 tools (from 58 underlying routes).

### Non-Functional

- Every tool's zod schema derived from the actual DTO file, not guessed.
- Every tool returns the raw project-service JSON response as MCP tool content (no re-shaping/renaming of fields — avoids silent drift from project-service's actual contract).
- Tool descriptions (shown to the LLM client) must state the HTTP method + path being called, for debuggability.
- **[AUDIT] Pagination:** every `*_list` tool (`workspace_list`, `team_list`, `issue_list`, `issue_list_archived`, `project_list`, `cycle_list`) must expose the underlying route's pagination query params (e.g. `page`/`limit` or cursor, whichever the actual controller uses — verify per entity) in its zod schema rather than always fetching an unbounded default page. A workspace with thousands of issues must not force every `issue_list` call to return the entire table into the LLM's context.
- **[AUDIT] PII pass-through:** since tool output is raw, unshaped project-service JSON (per the requirement above), member/user-shaped fields embedded in responses (email, name) flow through as-is. This is accepted as consistent with the "reuse existing JWT / same privilege scope" decision — the caller already has this access via project-service directly — but tool descriptions for endpoints that return member lists (`team_list_members`, `project_get_members`) should note in their description that the response includes member PII, so this is visible to whoever reviews tool-call logs.
- **[AUDIT] `team_manage_member`'s `add` action must pass through only the role field(s) that the underlying `POST /:id/members` DTO actually accepts — read `team.dto.ts` to confirm whether the caller can set an elevated role (e.g. admin/owner) via this route.** If the DTO allows arbitrary role assignment on add, document in the tool description that this can grant elevated team access, so it's an informed/visible action rather than a hidden side effect (same design intent as the confirmation-gate finding above, but for privilege escalation rather than deletion — added here as a description/visibility requirement, not a new auth control, per the accepted JWT-reuse decision).

## Architecture

```
apps/mcp-server/src/modules/tools/
├── tools.module.ts              # aggregates all entity tool registrars, exported for main.ts
├── workspace.tools.ts           # 5 tools
├── team.tools.ts                # 8 tools
├── issue.tools.ts                # 13 tools
├── project.tools.ts             # 10 tools
└── cycle.tools.ts                # 9 tools
```

Each `*.tools.ts` file exports a `register{Entity}Tools(server: McpServer, client: ProjectServiceHttpClient): void` function. `tools.module.ts` (or `main.ts` directly, per phase-1 bootstrap shape) calls each register function once at startup.

## Related Code Files

**Create:**
- `apps/mcp-server/src/modules/tools/tools.module.ts`
- `apps/mcp-server/src/modules/tools/workspace.tools.ts`
- `apps/mcp-server/src/modules/tools/team.tools.ts`
- `apps/mcp-server/src/modules/tools/issue.tools.ts`
- `apps/mcp-server/src/modules/tools/project.tools.ts`
- `apps/mcp-server/src/modules/tools/cycle.tools.ts`

**Modify:**
- `apps/mcp-server/src/main.ts` — call tool registration after MCP server instantiation, before `connect(transport)`

**Read only (do not modify):**
- All controller + dto files listed in Context Links

**Delete:**
- Any temporary debug tool added in phase 2 step 7

## Implementation Steps

1. Remove the phase-2 temporary debug tool if still present.
2. Re-read `apps/project-service/src/modules/workspaces/workspaces.controller.ts` and both workspace DTOs in full; implement `workspace.tools.ts` with all 5 tools.
3. Re-read `apps/project-service/src/modules/teams/teams.controller.ts` and `team.dto.ts` in full; implement `team.tools.ts` with all 8 tools (verify the join-team route requires no body vs. an invite-code body before finalizing its schema).
4. Re-read `apps/project-service/src/modules/issues/issues.controller.ts` and `issue.dto.ts` in full; implement `issue.tools.ts` with all 13 tools. Pay special attention to `PATCH /:identifier/rank` body shape (drag-reorder payloads are often position/anchor-based, not simple field updates — read the DTO carefully).
5. Re-read `apps/project-service/src/modules/projects/projects.controller.ts` and `project.dto.ts` in full; implement `project.tools.ts` with all 10 tools.
6. Re-read `apps/project-service/src/modules/cycles/cycles.controller.ts` and `cycle.dto.ts` in full; implement `cycle.tools.ts` with all 9 tools (confirm `.ics` route is genuinely excluded, not accidentally needed by another route).
7. Create `tools.module.ts` aggregating all 5 registrars.
8. Wire into `main.ts`.
9. Build (`pnpm --filter mcp-server build`), then manually invoke `workspace_list` and `issue_list` via MCP Inspector (see phase 5) against a running project-service to confirm real data round-trips for at least these two before moving to phase 4.

## Todo List

- [x] Remove phase-2 debug tool
- [x] `workspace.tools.ts` (5 tools) + DTOs read
- [x] `team.tools.ts` (8 tools) + DTOs read
- [x] `issue.tools.ts` (14 tools) + DTOs read
- [x] `project.tools.ts` (10 tools) + DTOs read
- [x] `cycle.tools.ts` (9 tools) + DTOs read, `.ics` route confirmed excluded
- [x] `tools.module.ts` aggregator
- [x] Wire into `main.ts`
- [x] Manual round-trip test: `workspace_list`, `issue_list` against real project-service

## Success Criteria

- All 46 tools listed above are registered and appear in `tools/list` MCP response (verifiable via MCP Inspector, see phase 5). Confirmed live.
- `workspace_list` and `issue_list` return real data from a running project-service (not stubs). Confirmed live (`issue_create` happy path and `project_list`/`cycle_list` hit a pre-existing, out-of-scope project-service migration-tracking 500 — see plan.md Completion Summary — but mcp-server correctly forwarded/surfaced the error).
- A deliberately invalid tool call (missing required field) returns a zod validation error, not an unhandled exception.
- `pnpm --filter mcp-server build` passes with zero type errors.
- **[AUDIT]** Calling `team_delete`/`issue_delete`/`project_delete`/`cycle_delete` without `confirm: true` returns a validation error and performs no deletion; calling with `confirm: true` proceeds normally.
- **[AUDIT]** `issue_manage_reaction`/`issue_manage_relation` reject a payload mixing fields from the wrong `action` branch (proves the discriminated union is enforced, not a flat optional-fields schema).

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| DTO shapes assumed instead of read, causing silent 400s at runtime | Medium | High | Step-by-step mandate to re-read each DTO file before writing its schema (listed per entity above) |
| `issue.tools.ts` becomes a 500+ line single file (repo convention favors <800 lines, ideally <400) | Medium | Low | If it exceeds ~400 lines, split by concern (e.g., `issue-crud.tools.ts` + `issue-social.tools.ts` for comments/reactions/relations) — note as an implementation-time judgment call |
| Consolidated `action`-enum tools confuse the LLM caller vs. one-tool-per-route | Low | Medium | Tool descriptions must enumerate valid `action` values explicitly in the zod enum + tool description string |

## Security Considerations

- No new auth logic in this phase — every tool call flows through `ProjectServiceHttpClient` from phase 2, which already attaches the bearer token.
- Tool descriptions and error messages must not leak the raw JWT even in verbose/debug output.

## Next Steps

- Blocks Phase 5 (verification needs a non-trivial tool set to exercise).
- Phase 4 follows the exact same per-file pattern for the remaining 4 entities.
