# Phase 4: Secondary MCP tools — Labels, Members, Initiatives, Views

## Context Links

- Plan: [plan.md](./plan.md)
- Phase 3: [phase-03-core-pm-mcp-tools.md](./phase-03-core-pm-mcp-tools.md)
- Route inventory (re-verify against controllers before coding):
  - `apps/project-service/src/modules/labels/labels.controller.ts`
  - `apps/project-service/src/modules/members/members.controller.ts`
  - `apps/project-service/src/modules/initiatives/initiatives.controller.ts`
  - `apps/project-service/src/modules/views/views.controller.ts`
- DTO folders (read every file before writing zod schemas):
  - `apps/project-service/src/modules/labels/dto/label.dto.ts`
  - `apps/project-service/src/modules/members/dto/member.dto.ts`
  - `apps/project-service/src/modules/initiatives/dto/initiative.dto.ts`, `initiative.dto.spec.ts` (spec file shows expected validation behavior — read for edge cases)
  - `apps/project-service/src/modules/views/dto/view.dto.ts`

## Overview

- Priority: P2 (lower-traffic entities than phase 3's core PM loop)
- Status: done
- Same pattern as phase 3: one `*.tools.ts` file per entity, consolidated `action`-enum tools for multi-route sub-resources, registered via `tools.module.ts`.

## Key Insights

- Same naming convention as phase 3: `{entity}_{verb}`, singular entity prefix.
- `initiative.dto.spec.ts` exists (unlike other modules) — read it, it documents validation edge cases (likely required/optional field combinations) that the zod schema should mirror to avoid a tool accepting input project-service will reject.
- **[AUDIT] Same guardrails as phase 3, extended to this phase's entities:**
  - Consolidated `action`-enum tools (`label_manage_group`, `initiative_manage_update`, `initiative_manage_update_reaction`) use zod discriminated unions, not flat optional-field schemas.
  - Destructive tools (`label_delete`, `initiative_delete`, `view_delete`, and the `delete` branch of `label_manage_group`/`initiative_manage_update`) require `confirm: true` before executing.
  - `*_list` tools (`label_list`, `member_list`, `initiative_list`, `view_list`) expose the underlying route's pagination params rather than always fetching an unbounded page.
  - `member_list`/`member_get`/`member_list_teams` responses carry member PII (email, name) as raw pass-through — note this in tool descriptions per the phase-3 rationale (accepted trade-off of the JWT-reuse decision, not a new issue introduced here).
- This phase is where the "~60 tools total" count in plan.md's Unresolved Questions becomes concrete — if the user decides during review to defer this phase, phases 1-3 + 5 already deliver a working (if partial) MCP server. Structure the PR/commit for phase 4 so it can be reverted independently without touching phase 3 files (separate tool files, separate registration calls — already true by construction).

## Requirements

### Functional — tool list per entity

**Labels** (6 tools, consolidating 9 routes):
- `label_list` — GET /
- `label_get` — GET /:id
- `label_create` — POST /
- `label_update` — PATCH /:id
- `label_delete` — DELETE /:id
- `label_manage_group` — action: `list`|`create`|`update`|`delete` → GET/POST /groups, PATCH/DELETE /groups/:id

**Members** (5 tools, 1:1 with 5 routes):
- `member_list` — GET /
- `member_get` — GET /:id
- `member_create` — POST /
- `member_update` — PATCH /:id
- `member_list_teams` — GET /:id/teams

**Initiatives** (7 tools, consolidating 9 routes):
- `initiative_list` — GET /
- `initiative_get` — GET /:id
- `initiative_create` — POST /
- `initiative_update` — PATCH /:id
- `initiative_delete` — DELETE /:id
- `initiative_manage_update` — action: `create`|`edit`|`delete` → POST/PATCH/DELETE /:id/updates[/:updateId]
- `initiative_manage_update_reaction` — action: `add`|`remove` → POST/DELETE /:id/updates/:updateId/reactions[/:emoji]

**Views** (5 tools, 1:1 with 5 routes):
- `view_list` — GET /
- `view_get` — GET /:id
- `view_create` — POST /
- `view_update` — PATCH /:id
- `view_delete` — DELETE /:id

Total this phase: 23 tools (from 28 underlying routes). Combined with phase 3: 69 tools (from 86 underlying routes) — corrected from earlier "68" after fixing phase 3's issue-tool count typo (13→14). Confirmed live via `tools/list`.

### Non-Functional

- Identical standards to phase 3: schemas from real DTOs, raw JSON pass-through, descriptive tool descriptions with method+path.

## Architecture

```
apps/mcp-server/src/modules/tools/
├── label.tools.ts        # 6 tools
├── member.tools.ts       # 5 tools
├── initiative.tools.ts   # 7 tools
└── view.tools.ts         # 5 tools
```

Registered from the same `tools.module.ts` created in phase 3 (extend, don't recreate).

## Related Code Files

**Create:**
- `apps/mcp-server/src/modules/tools/label.tools.ts`
- `apps/mcp-server/src/modules/tools/member.tools.ts`
- `apps/mcp-server/src/modules/tools/initiative.tools.ts`
- `apps/mcp-server/src/modules/tools/view.tools.ts`

**Modify:**
- `apps/mcp-server/src/modules/tools/tools.module.ts` (from phase 3) — add 4 more `register{Entity}Tools` calls

**Read only (do not modify):**
- All controller + dto files listed in Context Links

**Delete:** none

## Implementation Steps

1. Re-read `apps/project-service/src/modules/labels/labels.controller.ts` and `label.dto.ts`; implement `label.tools.ts` (6 tools).
2. Re-read `apps/project-service/src/modules/members/members.controller.ts` and `member.dto.ts`; implement `member.tools.ts` (5 tools). Note: `POST /members` likely represents an invite flow — confirm exact semantics from the DTO/controller before naming/documenting `member_create`'s tool description (don't assume "invite" vs "direct create" without reading). **[AUDIT] Also confirm during this read whether the DTO allows the caller to set an elevated role (admin/owner) on the created/invited member.** If so, state this plainly in `member_create`'s tool description (same visibility requirement as phase 3's `team_manage_member` finding — this is a description/documentation requirement, not a new authorization control, since project-service's own guard is the actual enforcement boundary).
3. Re-read `apps/project-service/src/modules/initiatives/initiatives.controller.ts`, `initiative.dto.ts`, and `initiative.dto.spec.ts`; implement `initiative.tools.ts` (7 tools).
4. Re-read `apps/project-service/src/modules/views/views.controller.ts` and `view.dto.ts`; implement `view.tools.ts` (5 tools).
5. Extend `tools.module.ts` to register all 4 new entity tool sets.
6. Build (`pnpm --filter mcp-server build`) and confirm all 68 tools (phase 3 + 4) appear in `tools/list`.

## Todo List

- [x] `label.tools.ts` (6 tools) + DTOs read
- [x] `member.tools.ts` (5 tools) + DTOs read, `member_create` semantics confirmed
- [x] `initiative.tools.ts` (7 tools) + DTOs + spec file read
- [x] `view.tools.ts` (5 tools) + DTOs read
- [x] `tools.module.ts` extended with all 4 registrars
- [x] Build passes, all 69 tools visible via MCP Inspector

## Success Criteria

- All 23 tools in this phase registered and listed correctly. Confirmed live.
- Combined tool count (69) confirmed via MCP Inspector's tool list.
- `pnpm --filter mcp-server build` passes with zero type errors.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Total 68-tool list overwhelms some MCP clients' tool-selection UX | Medium | Medium | Flagged in plan.md's Unresolved Questions — confirm with user whether to ship this phase now or defer; no code change needed to defer, just skip this phase |
| `member_create` semantics misread (invite vs. direct add) | Low | Medium | Step 2 explicitly calls out reading the controller/DTO before naming the tool |

## Security Considerations

- Same as phase 3 — no new auth logic, all calls flow through the phase-2 `ProjectServiceHttpClient`.

## Next Steps

- Blocks Phase 5's full verification pass (phase 5 can partially proceed after phase 3 alone if phase 4 is deferred per the Unresolved Questions decision).
