import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { registerJsonTool, ToolContext } from './tool-registration.util';

export function registerViewTools(server: McpServer, ctx: ToolContext): void {
  registerJsonTool(
    server,
    ctx,
    'view_list',
    {
      description:
        'GET /views — list saved views, optionally filtered by team, type, project, or workspace.',
      inputSchema: {
        teamId: z.string().optional(),
        type: z.enum(['issue', 'project']).optional(),
        projectId: z.string().optional(),
        workspaceId: z.string().optional(),
      },
    },
    (args, client) => client.get('/views', args),
  );

  registerJsonTool(
    server,
    ctx,
    'view_get',
    {
      description: 'GET /views/:id — get saved view by id.',
      inputSchema: { id: z.string().describe('View id') },
    },
    (args, client) => client.get(`/views/${encodeURIComponent(args.id)}`),
  );

  registerJsonTool(
    server,
    ctx,
    'view_create',
    {
      description: 'POST /views — create a new saved view.',
      inputSchema: {
        workspaceId: z.string().optional(),
        id: z.string().optional(),
        name: z.string(),
        description: z.string().optional(),
        icon: z.string().optional(),
        type: z.enum(['issue', 'project']).optional().describe('Default "issue"'),
        teamId: z.string().optional(),
        projectId: z.string().optional(),
        layout: z.enum(['list', 'grid']).optional().describe('Default "list"'),
        filter: z.record(z.string(), z.unknown()).optional(),
      },
    },
    (args, client) => client.post('/views', args),
  );

  registerJsonTool(
    server,
    ctx,
    'view_update',
    {
      description: 'PATCH /views/:id — update saved view fields.',
      inputSchema: {
        id: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        icon: z.string().optional(),
        type: z.enum(['issue', 'project']).optional(),
        teamId: z.string().optional(),
        projectId: z.string().optional(),
        layout: z.enum(['list', 'grid']).optional(),
        filter: z.record(z.string(), z.unknown()).optional(),
      },
    },
    (args, client) => {
      const { id, ...body } = args;
      return client.patch(`/views/${encodeURIComponent(id)}`, body);
    },
  );

  registerJsonTool(
    server,
    ctx,
    'view_delete',
    {
      description: 'DELETE /views/:id — permanently delete a saved view.',
      destructive: true,
      inputSchema: {
        id: z.string(),
        confirm: z
          .literal(true)
          .describe('Must be true to execute this destructive action'),
      },
    },
    (args, client) => client.delete(`/views/${encodeURIComponent(args.id)}`),
  );
}
