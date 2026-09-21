import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { registerJsonTool, ToolContext } from './tool-registration.util';

export function registerWorkspaceTools(server: McpServer, ctx: ToolContext): void {
  registerJsonTool(
    server,
    ctx,
    'workspace_list',
    { description: 'GET /workspaces — list all workspaces for the authenticated user.' },
    (_args, client) => client.get('/workspaces'),
  );

  registerJsonTool(
    server,
    ctx,
    'workspace_get',
    {
      description: 'GET /workspaces/:idOrSlug — get workspace details by id or slug.',
      inputSchema: { idOrSlug: z.string().describe('Workspace id or slug') },
    },
    (args, client) => client.get(`/workspaces/${encodeURIComponent(args.idOrSlug)}`),
  );

  registerJsonTool(
    server,
    ctx,
    'workspace_create',
    {
      description: 'POST /workspaces — create a new workspace.',
      inputSchema: {
        name: z.string().min(2).max(50).describe('Workspace display name'),
        slug: z
          .string()
          .regex(
            /^[a-z0-9-]+$/,
            'Slug must only contain lowercase alphanumeric characters and hyphens',
          )
          .optional(),
        icon: z.string().optional().describe('Workspace icon/gradient identifier'),
        description: z.string().optional(),
      },
    },
    (args, client) => client.post('/workspaces', args),
  );

  registerJsonTool(
    server,
    ctx,
    'workspace_join',
    {
      description:
        'POST /workspaces/join — join an existing workspace by invitation token or invite code.',
      inputSchema: {
        invitationToken: z
          .string()
          .optional()
          .describe('Single-use invitation token from an invitation email'),
        inviteCode: z
          .string()
          .optional()
          .describe('Workspace invite code, e.g. CIR-8F2A'),
      },
    },
    (args, client) => client.post('/workspaces/join', args),
  );

  registerJsonTool(
    server,
    ctx,
    'workspace_generate_invite_code',
    {
      description:
        'POST /workspaces/:id/invite-code — regenerate the invite code for a workspace.',
      inputSchema: { id: z.string().describe('Workspace id') },
    },
    (args, client) =>
      client.post(`/workspaces/${encodeURIComponent(args.id)}/invite-code`),
  );
}
