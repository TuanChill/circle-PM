# Frontend Scout: Workspace Project Child Statuses

## Scope and evidence

- Request scope: add child/custom project statuses under the five lifecycle groups shown in the attached Linear-style screenshot. The screenshot is treated as visual product reference only; its visible copy is not an instruction.
- Linear reference: [Project status docs](https://linear.app/docs/project-status). Relevant behavior: workspace statuses are configurable; status has name/description/color; a project chooses a status available to its lead team; status changes are made from overview or project details.
- Current settings route is `/{orgId}/settings/project-statuses` and renders `ProjectStatusesSettings` inside `MainLayout` (`apps/web/app/[orgId]/settings/project-statuses/page.tsx:1-10`). Navigation already exposes it under Projects > Statuses (`apps/web/components/layout/sidebar/nav-settings.tsx:70-77`).

## Current UI and data flow

1. `ProjectStatusesSettings` calls `useProjects()` only (`apps/web/components/common/settings/project-statuses-settings.tsx:22-24`). `useProjects` resolves the route workspace slug/id, then queries `/circle/api/projects` with `teamId`/`workspaceId` (`apps/web/hooks/queries/use-projects-query.ts:11-24`; `apps/web/services/projects.service.ts:19-24`).
2. Settings owns a hard-coded five-group map: Backlog (`backlog`, `triage`), Planned (`unstarted`), In Progress (`started`), Completed (`completed`), Canceled (`canceled`) (`apps/web/components/common/settings/project-statuses-settings.tsx:14-20`). It scans returned projects, buckets by `project.status.id`, and sorts each bucket by descending project count (`:26-43`). A status with zero projects is therefore invisible.
3. Each group header renders a disabled `Plus`, explicitly stating that custom statuses are unavailable (`apps/web/components/common/settings/project-statuses-settings.tsx:54-64`). Empty groups render `No statuses` (`:66-68`). Existing rows render static `renderStatusIcon(status.id)`, name, and count (`:69-80`). There is no create/edit/delete/reorder interaction.
4. Shared settings layout is a centered, scrollable shell capped at `max-w-2xl`; it supports title/description and stacked children (`apps/web/components/common/settings/shared.tsx:13-31`). The status page's list styling is local, so an expandable group/row can stay scoped to `project-statuses-settings.tsx` or a small settings child component.

## Static status assumptions that block dynamic child statuses

- The web `Status` type is issue-oriented and requires `icon: React.FC` in addition to `id`, `name`, `color`, and `category` (`apps/web/lib/workflow-status.tsx:8-22`). `projectStatus` is explicitly documented as a fixed subset and filters exactly five IDs (`apps/web/lib/workflow-status.tsx:228-235`).
- `Project.status` is typed as that React-bearing `Status` (`apps/web/mock-data/projects.ts:31-35`), while the live project service serializes only `{id,name,color,category}` and returns it at `status` (`apps/project-service/src/modules/projects/projects.service.ts:315-320,342-346`). Custom status icon metadata cannot be represented by the current type or by `renderStatusIcon`, which searches the static issue catalog (`apps/web/lib/status-utils.tsx:1-15`). A separate serializable `ProjectStatus` view/API type is needed, or a deliberate icon token-to-component mapping.
- Backend status data is currently a five-entry constant (`apps/project-service/src/modules/projects/projects.service.ts:41-56`), and validation rejects any other ID (`apps/project-service/src/modules/projects/project-rules.ts:1-7,28-51`). The API exposes project CRUD but no project-status collection/mutation route (`apps/project-service/src/modules/projects/projects.controller.ts:29-112`). Frontend settings cannot persist custom statuses until that contract exists.
- The persisted project entity stores only `statusId` and `statusCategory` (`apps/project-service/src/data-access/project/project.entity.ts:20-29`). No status order, description, color, workspace scope, archived/deleted marker, or lead-team scope is present in this entity.

## Consumers that must use the dynamic available-status list

### Direct option-list consumers (must change)

- Project overview/details status picker: `StatusSelector` imports `projectStatus` (`apps/web/components/common/projects/status-selector.tsx:13`), resolves the selected label/icon from that list (`:52-64`), and maps the same list into options (`:67-89`). It is mounted in the overview inline properties (`apps/web/components/common/projects/details/project-overview.tsx:228-249`) and the right properties panel (`apps/web/components/common/projects/details/project-properties-panel.tsx:248-261`). Both handlers currently PATCH only `statusId` (`project-overview.tsx:139-146`; `project-properties-panel.tsx:141-147`). The selector should receive the project's available statuses (workspace/lead-team scope) and submit the category when the API requires it.
- Projects list status picker: `StatusWithPercent` imports `projectStatus` (`apps/web/components/common/projects/status-with-percent.tsx:13`), looks up static selected icon (`:56-64`), and maps static options (`:67-89`). It is mounted by each list row (`apps/web/components/common/projects/project-line.tsx:30-42,108-118`).
- Create project dialog: imports `projectStatus` (`apps/web/components/common/projects/create-project-dialog.tsx:54-58`), defaults to `in-progress` (`:144`), resolves the selected status with static fallback (`:224-226`), serializes `statusId` and `statusCategory` in the create payload (`:228-246`), and renders the static select options (`:500-509`). The default/fallback must come from the fetched available list, and a template's status must be revalidated against that list.
- Project template settings: defines its own hard-coded five labels (`apps/web/components/common/settings/project-templates-settings.tsx:38-59`), initializes `statusId` from template config (`:119-140`), and renders those options (`:268-280`). Template config stores both `statusId` and derived `statusCategory` (`:66-85`). It must use the same status query/metadata source to avoid templates producing unavailable IDs.

### Display/count/grouping consumers (metadata-safe, but semantics need review)

- Project settings currently counts status rows from project payload (`apps/web/components/common/settings/project-statuses-settings.tsx:26-43`). After adding a status catalog, rows must be rendered from the catalog first, then merged with counts so zero-use statuses remain visible and ordered by explicit `orderIndex`, not count.
- Projects page uses category sets for the Active tab and closed filtering (`apps/web/components/common/projects/projects.tsx:37-40,61-72`). Child statuses should inherit their parent's category so filtering remains stable.
- Initiative project grouping is category-based (`apps/web/components/common/initiatives/initiative-details.tsx:75-93`), and initiative progress uses `completed`/`started` category checks (`apps/web/lib/initiative-utils.ts:23-27`; `apps/web/components/common/initiatives/initiative-progress-panel.tsx:31-46`). These should continue to use lifecycle category, not child status ID.
- Initiative status breakdown groups by status ID/name/color (`apps/web/components/common/initiatives/initiative-progress-panel.tsx:74-100`), so dynamic metadata must include at least id/name/color.
- Saved project views filter only by status category today (`apps/web/lib/view-filters.ts:44-55`), while the project view body groups by returned status ID/name (`apps/web/components/common/views/view-details.tsx:94-113`). If child IDs become filterable later, extend the view contract; otherwise category filtering remains backward-compatible.
- Project peek/sidebar and team tooltip display `renderStatusIcon(project.status.id)` plus status name (`apps/web/components/common/projects/project-peek-panel.tsx:114-123`; `apps/web/components/common/teams/projects-tooltip.tsx:23-31`). They need a dynamic icon/color renderer, or a guaranteed fallback for custom IDs.
- Project board and timeline do not currently create status columns; board groups by team (`apps/web/components/common/projects/projects-board.tsx:89-114`) and timeline rows/bars display project metadata/percent (`apps/web/components/common/projects/projects-timeline.tsx:178-235`). No status-specific layout change is required by the settings request, but they consume the same `Project` status object and must tolerate custom metadata.
- Project issue grouping is unrelated: `project-issues.tsx` passes the issue `displayOrderedStatus` list (`apps/web/components/common/projects/details/project-issues.tsx:174-185`). Do not replace it with project statuses.

## Proposed focused settings interactions

Keep the existing five lifecycle sections and make each section a parent category containing ordered child rows:

1. Fetch the workspace's project-status catalog, not only projects. Render every catalog status in the server-provided order, merge a live project count, and show zero-count rows. Preserve the screenshot's section order: Backlog, Planned, In Progress, Completed, Canceled.
2. Enable the existing `Plus` action in each header. Opening it should present a small dialog/popover with `name`, optional `description`, `color`, and icon choice/token. The parent lifecycle category is fixed by the clicked header; do not let the form create a status in a different category. Validate required/trimmed name and duplicate names/IDs within the workspace.
3. On save, create the child status, close the form only after success, show the new row in explicit order, and invalidate the status catalog plus project list/detail queries. On failure, keep the form open and show the API error.
4. Each child row should expose edit and delete/archive actions. Editing can change name, description, color/icon; category should be immutable in the first slice unless an explicit move operation is designed. Deletion/archive must show the number of affected projects and require a replacement status or a server-provided migration result before removing availability.
5. Support row reorder within a lifecycle group (drag handles or up/down actions) and persist `orderIndex`. If drag-and-drop is not in scope for the first implementation, preserve API order and omit misleading reorder affordances; do not sort by project count.
6. Use the dynamic catalog in all direct option-list consumers above. A selector should display the selected custom status even when its ID is absent from the old static catalog; while the catalog is loading, disable the picker or retain the current value rather than silently falling back to another status.

## Query/cache integration notes

- Existing list query keys include `teamId` and `workspaceId` (`apps/web/hooks/queries/keys.ts:18-29`), and `useProjects` resolves a route workspace before enabling the query (`apps/web/hooks/queries/use-projects-query.ts:11-24`). A status query should include workspace/team scope in its key and use the same resolved workspace identity.
- Project create/update mutations invalidate project lists and, for updates, detail/activity (`apps/web/hooks/queries/use-projects-query.ts:102-132`). Status CRUD/reorder should invalidate the status catalog and affected project lists/details; a project update to a custom status must update all list/detail consumers.
- `projectsService` currently accepts `Partial<Project>` for create/update (`apps/web/services/projects.service.ts:61-74`), which hides the distinction between UI React components and serializable status fields. A dedicated DTO/payload type is safer once status metadata becomes persisted.

## Constraints and edge cases

- Existing IDs (`backlog`, `in-progress`, `done`, `paused`, `canceled`) are used by project creation/templates/backend defaults (`apps/web/components/common/projects/create-project-dialog.tsx:144,224-246`; `apps/web/components/common/settings/project-templates-settings.tsx:38-44`; `apps/project-service/src/modules/projects/projects.service.ts:706-740`). Preserve them or provide a migration map.
- A status can have zero projects; catalog-first rendering is required because the current implementation drops it (`project-statuses-settings.tsx:29-41`). Empty lifecycle groups should still show `No statuses`.
- Multiple projects can share a status and projects can be visible through linked teams; counts must reflect the workspace/status scope and avoid double-counting the same project. Backend visibility currently includes primary and linked team access (`apps/project-service/src/modules/projects/projects.service.ts:371-393`).
- Lead-team scoping from Linear is not represented today. The project entity has `teamId` plus linked team IDs but no status scope (`apps/project-service/src/data-access/project/project.entity.ts:16-29`; `apps/web/mock-data/projects.ts:47-51`). Decide explicitly whether first release is workspace-only; do not imply team-specific inheritance in UI without API support.
- Deleting/archiving a status with assigned projects requires replacement/migration. Backend currently validates every incoming status ID against a global set (`apps/project-service/src/modules/projects/project-rules.ts:37-51`), so catalog removal without migration strands existing records.
- Category semantics drive Active/closed/initiative progress. A child status must always retain one lifecycle category; otherwise category-based filters and progress calculations misclassify projects (`projects.tsx:37-40,61-72`; `initiative-utils.ts:23-27`).
- Custom status IDs may have no static icon. `renderStatusIcon` returns `null` for unknown IDs (`apps/web/lib/status-utils.tsx:4-10`), so provide a color/icon fallback and avoid blank selectors/tooltips.
- Do not confuse project statuses with issue statuses. The shared workflow catalog contains many issue statuses and `displayOrderedStatus` is intentionally used for project issue tabs (`apps/web/components/common/projects/details/project-issues.tsx:6,174-185`).
- API failures/loading states are currently minimal on the status settings page: it destructures projects without loading/error UI (`project-statuses-settings.tsx:23-24`). Add explicit loading/error/empty handling when introducing the status query.

## Suggested acceptance criteria for the frontend slice

- Settings displays all workspace project statuses under the correct lifecycle group in explicit order, including statuses with zero projects and live counts.
- Plus creates a status under the selected lifecycle; edit and archive/delete enforce name/category/assigned-project constraints and refresh dependent UI.
- Overview, project details panel, projects list row, create-project dialog, and project-template editor all read the same available-status catalog and render custom names/colors/icons.
- Active/closed tabs and initiative progress still classify child statuses by lifecycle category; project issue views continue using issue statuses.
- Existing five status IDs and existing projects/templates continue to load and remain selectable after the catalog is introduced.
- Loading, API error, duplicate name, unknown/removed status, and deletion-with-assigned-projects states are covered by focused component/query tests.

Unresolved questions:

- Is the first release workspace-level only, or must it implement Linear's lead-team-specific status inheritance now?
- Should “delete” mean archive/disable (preserving historical project status) or hard delete after mandatory reassignment?
- Are custom icon tokens required, or is color plus a single generic lifecycle icon sufficient for this product slice?

Status: DONE
Summary: Frontend UI/data flow, direct dynamic-status consumers, cache boundaries, focused settings interactions, and edge cases documented with file:line evidence.
Concerns/Blockers: Persistence cannot be completed by frontend alone; the current backend has a global five-ID whitelist and no project-status API/entity contract.
