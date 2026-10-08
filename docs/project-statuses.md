# Workspace Project Statuses

Project statuses are workspace-level child statuses grouped under the existing lifecycle categories. Workspace Owners and Admins can create them from **Settings → Project statuses**; workspace members can view and assign them. A status stores a name, optional description, color, category, and append position.

The user-facing groups map to the persisted categories as follows:

| Group       | Category    |
| ----------- | ----------- |
| Backlog     | `backlog`   |
| Planned     | `unstarted` |
| In Progress | `started`   |
| Completed   | `completed` |
| Canceled    | `canceled`  |

## API

The project service exposes these authenticated workspace-scoped endpoints:

| Method | Route                                                  | Access                                         |
| ------ | ------------------------------------------------------ | ---------------------------------------------- |
| `GET`  | `/circle/api/workspaces/:workspaceId/project-statuses` | Workspace members who can access the workspace |
| `POST` | `/circle/api/workspaces/:workspaceId/project-statuses` | Workspace Owners and Admins                    |

Create request body:

```json
{
  "name": "Ready for QA",
  "description": "Optional status description",
  "color": "#22c55e",
  "category": "started"
}
```

The server trims names/descriptions, rejects duplicate workspace status names, validates the color/category, and assigns the next position within the selected category. Project create/update resolves custom status IDs against the workspace of the project's primary team and derives `statusCategory` from the stored status. Built-in project status IDs remain valid; issue status workflows are separate and configured per team in **Team settings → Issue statuses**. See [Team issue workflows](#team-issue-workflows).

## Migration Safety

The `project_statuses` migration is additive and does not rewrite existing projects or seed custom rows. Production deployment creates a custom-format PostgreSQL dump under `/opt/circle/db-backups/` before running any newly added project-service migration, validates it with `pg_restore --list`, and stops before migration if backup creation or validation fails. The dump and schema-only companion are stored outside the application checkout with owner-only access. The deploy script stores the last successfully deployed revision under `/opt/circle/deploy-state/`; a missing or invalid marker stops deployment because the safe migration range cannot be inferred. When the deployed revision includes a project-service migration, deployment creates and verifies a fresh backup, then runs only migration files newly added since that revision. Existing migration files are immutable; editing or removing one stops deployment so it can be handled explicitly instead of replaying the whole pending migration history.

The migration rollback drops the catalog table, so first reassign any projects using custom IDs; otherwise their status names/colors would no longer resolve. Migration execution is an operator-controlled deployment step, not part of application startup.

## Team Issue Workflows

Issue statuses are configured independently for each team from **Settings → Teams → [team] → Issue statuses**. A workflow has a fixed lifecycle order, while statuses can be added, renamed, recolored, reordered within their lifecycle group, and deleted when unused.

The required lifecycle groups are Backlog, Todo, In Progress, Done, and Canceled. Each required group must keep at least one status. Triage is optional and can be added when the team needs an incoming-issues queue. Duplicate is a system status and is not configurable.

New teams start with Backlog, Todo, In Progress, Done, and Canceled. Todo is the default for newly created issues. To remove a status currently used by issues or issue templates, first move the issues and update the templates. Statuses used by other teams are unaffected.

The authenticated team-scoped API provides `GET` and `POST /circle/api/teams/:teamId/issue-statuses`, `PATCH /circle/api/teams/:teamId/issue-statuses/order`, `PATCH /circle/api/teams/:teamId/issue-statuses/:statusId`, and `DELETE /circle/api/teams/:teamId/issue-statuses/:statusId`.

The schema migration creates the per-team status catalog. A separate data migration creates the five defaults for existing teams and maps retired statuses to a status in the same lifecycle group: Idea and Triage to Backlog, Paused to Todo, In Review, Technical Review, and Product Feedback to In Progress, and Shipped to Done. It also updates issue-template status references. This data migration is lossy; back up and verify the production database before running migrations. The migration is an operator-controlled deployment step and is not run automatically when the application starts.
