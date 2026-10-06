# Workspace Project Statuses

Project statuses are workspace-level child statuses grouped under the existing lifecycle categories. Workspace Owners and Admins can create them from **Settings → Project statuses**; workspace members can view and assign them. A status stores a name, optional description, color, category, and append position.

The user-facing groups map to the persisted categories as follows:

| Group | Category |
|---|---|
| Backlog | `backlog` |
| Planned | `unstarted` |
| In Progress | `started` |
| Completed | `completed` |
| Canceled | `canceled` |

## API

The project service exposes these authenticated workspace-scoped endpoints:

| Method | Route | Access |
|---|---|---|
| `GET` | `/circle/api/workspaces/:workspaceId/project-statuses` | Workspace members who can access the workspace |
| `POST` | `/circle/api/workspaces/:workspaceId/project-statuses` | Workspace Owners and Admins |

Create request body:

```json
{
  "name": "Ready for QA",
  "description": "Optional status description",
  "color": "#22c55e",
  "category": "started"
}
```

The server trims names/descriptions, rejects duplicate workspace status names, validates the color/category, and assigns the next position within the selected category. Project create/update resolves custom status IDs against the workspace of the project's primary team and derives `statusCategory` from the stored status. Built-in project status IDs remain valid; issue status workflows are separate.

## Migration Safety

The `project_statuses` migration is additive and does not rewrite existing projects or seed custom rows. Production deployment creates a custom-format PostgreSQL dump under `/opt/circle/db-backups/` before running any new project-service migration, validates it with `pg_restore --list`, and stops before migration if backup creation or validation fails. The dump and schema-only companion are stored outside the application checkout with owner-only access. The migration rollback drops the catalog table, so first reassign any projects using custom IDs; otherwise their status names/colors would no longer resolve. Migration execution is an operator-controlled deployment step, not part of application startup.
