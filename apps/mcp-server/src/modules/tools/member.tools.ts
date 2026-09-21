import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { registerJsonTool, ToolContext } from './tool-registration.util';

export function registerMemberTools(server: McpServer, ctx: ToolContext): void {
  registerJsonTool(
    server,
    ctx,
    'member_list',
    {
      description:
        'GET /members — list workspace members. Response includes member PII (name, email).',
      inputSchema: { workspaceId: z.string().optional() },
    },
    (args, client) =>
      client.get(
        '/members',
        args.workspaceId ? { workspaceId: args.workspaceId } : undefined,
      ),
  );

  registerJsonTool(
    server,
    ctx,
    'member_get',
    {
      description:
        'GET /members/:id — get a workspace member by id. Response includes member PII (name, email).',
      inputSchema: { id: z.string().describe('Member id') },
    },
    (args, client) => client.get(`/members/${encodeURIComponent(args.id)}`),
  );

  registerJsonTool(
    server,
    ctx,
    'member_create',
    {
      description:
        'POST /members — create a pending workspace invitation for a new member. ' +
        'The role field can grant an elevated role up to "Admin"; confirm the intended role before calling.',
      inputSchema: {
        id: z.string().optional(),
        name: z.string(),
        email: z.string().email(),
        avatarUrl: z.string().optional(),
        status: z.enum(['online', 'offline', 'away']).optional(),
        role: z
          .enum(['Member', 'Admin', 'Guest', 'Application'])
          .optional()
          .describe('Default "Member"'),
        timezone: z.string().optional(),
        teamIds: z.array(z.string()).optional(),
        workspaceId: z.string().optional(),
      },
    },
    (args, client) => client.post('/members', args),
  );

  registerJsonTool(
    server,
    ctx,
    'member_update',
    {
      description:
        'PATCH /members/:id — update member fields. The role field can grant an elevated role up to "Admin"; ' +
        'confirm the intended role before calling.',
      inputSchema: {
        id: z.string(),
        name: z.string().optional(),
        avatarUrl: z.string().optional(),
        status: z.enum(['online', 'offline', 'away']).optional(),
        role: z.enum(['Member', 'Admin', 'Guest']).optional(),
        workspaceId: z
          .string()
          .optional()
          .describe('Workspace whose membership role is changed'),
        timezone: z.string().optional(),
      },
    },
    (args, client) => {
      const { id, ...body } = args;
      return client.patch(`/members/${encodeURIComponent(id)}`, body);
    },
  );

  registerJsonTool(
    server,
    ctx,
    'member_list_teams',
    {
      description: 'GET /members/:id/teams — list teams a member belongs to.',
      inputSchema: { id: z.string().describe('Member id') },
    },
    (args, client) => client.get(`/members/${encodeURIComponent(args.id)}/teams`),
  );
}
