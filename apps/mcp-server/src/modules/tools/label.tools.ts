import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { registerJsonTool, ToolContext } from './tool-registration.util';

const LABEL_SCOPES = ['issue', 'project', 'both'] as const;

export function registerLabelTools(server: McpServer, ctx: ToolContext): void {
  registerJsonTool(
    server,
    ctx,
    'label_list',
    {
      description:
        'GET /labels — list labels, optionally filtered by scope/workspace/team, and archived state.',
      inputSchema: {
        scope: z.enum(['issue', 'project']).optional(),
        workspaceId: z.string().optional(),
        teamId: z.string().optional(),
        includeArchived: z.boolean().optional(),
      },
    },
    (args, client) => client.get('/labels', args),
  );

  registerJsonTool(
    server,
    ctx,
    'label_get',
    {
      description: 'GET /labels/:id — get label by id.',
      inputSchema: { id: z.string().describe('Label id') },
    },
    (args, client) => client.get(`/labels/${encodeURIComponent(args.id)}`),
  );

  registerJsonTool(
    server,
    ctx,
    'label_create',
    {
      description: 'POST /labels — create a new label.',
      inputSchema: {
        workspaceId: z.string().optional(),
        teamId: z.string().optional().describe('Omit for a workspace-wide label'),
        id: z
          .string()
          .optional()
          .describe(
            'Optional legacy label id; new labels receive an opaque UUID if omitted',
          ),
        name: z.string(),
        color: z.string(),
        description: z.string().optional(),
        groupId: z.string().uuid().optional(),
        scope: z.enum(LABEL_SCOPES).optional(),
      },
    },
    (args, client) => client.post('/labels', args),
  );

  registerJsonTool(
    server,
    ctx,
    'label_update',
    {
      description:
        'PATCH /labels/:id — update label fields, including archiving/restoring it.',
      inputSchema: {
        id: z.string(),
        archived: z
          .boolean()
          .optional()
          .describe('Archive (true) or restore (false) the label'),
        teamId: z.string().nullable().optional(),
        name: z.string().optional(),
        color: z.string().optional(),
        description: z.string().optional(),
        groupId: z.string().uuid().optional(),
        scope: z.enum(LABEL_SCOPES).optional(),
      },
    },
    (args, client) => {
      const { id, ...body } = args;
      return client.patch(`/labels/${encodeURIComponent(id)}`, body);
    },
  );

  registerJsonTool(
    server,
    ctx,
    'label_delete',
    {
      description: 'DELETE /labels/:id — permanently delete a label.',
      destructive: true,
      inputSchema: {
        id: z.string(),
        confirm: z
          .literal(true)
          .describe('Must be true to execute this destructive action'),
      },
    },
    (args, client) => client.delete(`/labels/${encodeURIComponent(args.id)}`),
  );

  registerJsonTool(
    server,
    ctx,
    'label_manage_group',
    {
      description: 'List, create, update, or delete label groups.',
      inputSchema: z.discriminatedUnion('action', [
        z.object({
          action: z.literal('list'),
          scope: z.enum(['issue', 'project']).optional(),
          workspaceId: z.string().optional(),
        }),
        z.object({
          action: z.literal('create'),
          workspaceId: z.string().optional(),
          name: z.string(),
          scope: z.enum(LABEL_SCOPES).optional(),
          mutuallyExclusive: z.boolean().optional(),
        }),
        z.object({
          action: z.literal('update'),
          id: z.string().describe('Label group id'),
          name: z.string().optional(),
          scope: z.enum(LABEL_SCOPES).optional(),
          mutuallyExclusive: z.boolean().optional(),
        }),
        z.object({
          action: z.literal('delete'),
          id: z.string().describe('Label group id'),
          confirm: z
            .literal(true)
            .describe('Must be true to execute this destructive action'),
        }),
      ]),
    },
    (args, client) => {
      if (args.action === 'list') {
        const { action: _action, ...query } = args;
        return client.get('/labels/groups', query);
      }
      if (args.action === 'create') {
        const { action: _action, ...body } = args;
        return client.post('/labels/groups', body);
      }
      if (args.action === 'update') {
        const { action: _action, id, ...body } = args;
        return client.patch(`/labels/groups/${encodeURIComponent(id)}`, body);
      }
      return client.delete(`/labels/groups/${encodeURIComponent(args.id)}`);
    },
  );
}
