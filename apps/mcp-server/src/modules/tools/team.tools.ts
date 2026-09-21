import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { registerJsonTool, ToolContext } from './tool-registration.util';

const ESTIMATE_SCALES = ['exponential', 'fibonacci', 'linear', 't-shirt'] as const;

export function registerTeamTools(server: McpServer, ctx: ToolContext): void {
  registerJsonTool(
    server,
    ctx,
    'team_list',
    {
      description:
        'GET /teams — list teams for the authenticated user, optionally scoped to a workspace.',
      inputSchema: {
        workspaceId: z.string().optional().describe('Filter to teams in this workspace'),
      },
    },
    (args, client) =>
      client.get(
        '/teams',
        args.workspaceId ? { workspaceId: args.workspaceId } : undefined,
      ),
  );

  registerJsonTool(
    server,
    ctx,
    'team_get',
    {
      description: 'GET /teams/:id — get team details by id.',
      inputSchema: { id: z.string().describe('Team id') },
    },
    (args, client) => client.get(`/teams/${encodeURIComponent(args.id)}`),
  );

  registerJsonTool(
    server,
    ctx,
    'team_list_members',
    {
      description:
        'GET /teams/:id/members — list members of a team. Response includes member PII (name, email).',
      inputSchema: { id: z.string().describe('Team id') },
    },
    (args, client) => client.get(`/teams/${encodeURIComponent(args.id)}/members`),
  );

  registerJsonTool(
    server,
    ctx,
    'team_create',
    {
      description:
        'POST /teams — create a new team. The id is an explicit, user-chosen team key (e.g. "MOBILE") used in issue identifiers, not a generated id.',
      inputSchema: {
        id: z
          .string()
          .describe('Explicit team key used in issue identifiers, e.g. "MOBILE"'),
        name: z.string().describe('Team display name'),
        workspaceId: z.string().describe('Workspace that owns the team'),
        icon: z.string().optional(),
        color: z.string().optional().describe('Hex color, e.g. #5e6ad2'),
        joined: z.boolean().optional(),
        description: z.string().optional(),
        memberIds: z.array(z.string()).optional(),
        estimateEnabled: z.boolean().optional(),
        estimateScale: z.enum(ESTIMATE_SCALES).optional(),
        estimateExtended: z.boolean().optional(),
        estimateZero: z.boolean().optional(),
        unestimatedAsOne: z.boolean().optional(),
      },
    },
    (args, client) => client.post('/teams', args),
  );

  registerJsonTool(
    server,
    ctx,
    'team_update',
    {
      description: 'PATCH /teams/:id — update team fields.',
      inputSchema: {
        id: z.string().describe('Team id'),
        name: z.string().optional(),
        icon: z.string().optional(),
        color: z.string().optional(),
        joined: z.boolean().optional(),
        description: z.string().optional(),
        estimateEnabled: z.boolean().optional(),
        estimateScale: z.enum(ESTIMATE_SCALES).optional(),
        estimateExtended: z.boolean().optional(),
        estimateZero: z.boolean().optional(),
        unestimatedAsOne: z.boolean().optional(),
      },
    },
    (args, client) => {
      const { id, ...body } = args;
      return client.patch(`/teams/${encodeURIComponent(id)}`, body);
    },
  );

  registerJsonTool(
    server,
    ctx,
    'team_join',
    {
      description:
        "POST /teams/:id/join — toggle the authenticated user's join status for a team.",
      inputSchema: { id: z.string().describe('Team id') },
    },
    (args, client) => client.post(`/teams/${encodeURIComponent(args.id)}/join`),
  );

  registerJsonTool(
    server,
    ctx,
    'team_manage_member',
    {
      description:
        'Add or remove a team member. action="add" grants the given role (default "member") on the team — ' +
        "note this can escalate a member's privileges within the team, so confirm the intended role before calling. " +
        'action="remove" revokes membership.',
      inputSchema: z.discriminatedUnion('action', [
        z.object({
          action: z.literal('add'),
          id: z.string().describe('Team id'),
          memberId: z.string().describe('Member id to add'),
          role: z.string().optional().describe('Role to grant, default "member"'),
        }),
        z.object({
          action: z.literal('remove'),
          id: z.string().describe('Team id'),
          memberId: z.string().describe('Member id to remove'),
          confirm: z
            .literal(true)
            .describe('Must be true to execute this destructive action'),
        }),
      ]),
    },
    (args, client) => {
      if (args.action === 'add') {
        return client.post(`/teams/${encodeURIComponent(args.id)}/members`, {
          memberId: args.memberId,
          role: args.role,
        });
      }
      return client.delete(
        `/teams/${encodeURIComponent(args.id)}/members/${encodeURIComponent(args.memberId)}`,
      );
    },
  );

  registerJsonTool(
    server,
    ctx,
    'team_delete',
    {
      description: 'DELETE /teams/:id — permanently delete a team.',
      destructive: true,
      inputSchema: {
        id: z.string().describe('Team id'),
        confirm: z
          .literal(true)
          .describe('Must be true to execute this destructive action'),
      },
    },
    (args, client) => client.delete(`/teams/${encodeURIComponent(args.id)}`),
  );
}
