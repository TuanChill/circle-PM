import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { registerJsonTool, ToolContext } from './tool-registration.util';

const CYCLE_STATUSES = ['planned', 'upcoming', 'current', 'completed'] as const;

export function registerCycleTools(server: McpServer, ctx: ToolContext): void {
  registerJsonTool(
    server,
    ctx,
    'cycle_list',
    {
      description: 'GET /cycles — list all cycles, optionally filtered by team.',
      inputSchema: { teamId: z.string().optional() },
    },
    (args, client) =>
      client.get('/cycles', args.teamId ? { teamId: args.teamId } : undefined),
  );

  registerJsonTool(
    server,
    ctx,
    'cycle_get',
    {
      description: 'GET /cycles/:id — get cycle by id.',
      inputSchema: { id: z.string().describe('Cycle id') },
    },
    (args, client) => client.get(`/cycles/${encodeURIComponent(args.id)}`),
  );

  registerJsonTool(
    server,
    ctx,
    'cycle_manage_settings',
    {
      description: 'Get or update the persisted cycle settings for a team.',
      inputSchema: z.discriminatedUnion('action', [
        z.object({ action: z.literal('get'), teamId: z.string() }),
        z.object({
          action: z.literal('update'),
          teamId: z.string(),
          enabled: z.boolean().optional(),
          durationWeeks: z.number().int().min(1).max(8).optional(),
          startDayOfWeek: z.number().int().min(0).max(6).optional(),
          timeZone: z.string().optional().describe('IANA timezone, e.g. "UTC"'),
          cooldownDays: z.number().int().min(0).max(30).optional(),
          upcomingCycleCount: z.number().int().min(0).max(15).optional(),
          autoAddActiveIssues: z.boolean().optional(),
        }),
      ]),
    },
    (args, client) => {
      if (args.action === 'get') {
        return client.get('/cycles/settings', { teamId: args.teamId });
      }
      const { action: _action, teamId, ...body } = args;
      return client.patch(`/cycles/settings?teamId=${encodeURIComponent(teamId)}`, body);
    },
  );

  registerJsonTool(
    server,
    ctx,
    'cycle_manage_calendar_subscription',
    {
      description:
        "Get, create/rotate, or revoke the authenticated member's cycle calendar subscription for a team.",
      inputSchema: z.discriminatedUnion('action', [
        z.object({ action: z.literal('get'), teamId: z.string() }),
        z.object({ action: z.literal('create'), teamId: z.string() }),
        z.object({
          action: z.literal('delete'),
          teamId: z.string(),
          confirm: z
            .literal(true)
            .describe('Must be true to execute this destructive action'),
        }),
      ]),
    },
    (args, client) => {
      const query = { teamId: args.teamId };
      if (args.action === 'get')
        return client.get('/cycles/calendar-subscription', query);
      if (args.action === 'create')
        return client.post(
          `/cycles/calendar-subscription?teamId=${encodeURIComponent(args.teamId)}`,
        );
      return client.delete(
        `/cycles/calendar-subscription?teamId=${encodeURIComponent(args.teamId)}`,
      );
    },
  );

  registerJsonTool(
    server,
    ctx,
    'cycle_start_today',
    {
      description: 'POST /cycles/:id/start-today — start an upcoming cycle today.',
      inputSchema: { id: z.string().describe('Cycle id') },
    },
    (args, client) => client.post(`/cycles/${encodeURIComponent(args.id)}/start-today`),
  );

  registerJsonTool(
    server,
    ctx,
    'cycle_get_history',
    {
      description: 'GET /cycles/:id/history — get persisted historical cycle progress.',
      inputSchema: { id: z.string().describe('Cycle id') },
    },
    (args, client) => client.get(`/cycles/${encodeURIComponent(args.id)}/history`),
  );

  registerJsonTool(
    server,
    ctx,
    'cycle_create',
    {
      description: 'POST /cycles — create a new cycle.',
      inputSchema: {
        id: z.string().optional(),
        number: z.number(),
        name: z.string(),
        teamId: z.string(),
        status: z.enum(CYCLE_STATUSES),
        startDate: z.string(),
        endDate: z.string(),
      },
    },
    (args, client) => client.post('/cycles', args),
  );

  registerJsonTool(
    server,
    ctx,
    'cycle_update',
    {
      description: 'PATCH /cycles/:id — update cycle fields.',
      inputSchema: {
        id: z.string(),
        name: z.string().optional(),
        status: z.enum(CYCLE_STATUSES).optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      },
    },
    (args, client) => {
      const { id, ...body } = args;
      return client.patch(`/cycles/${encodeURIComponent(id)}`, body);
    },
  );

  registerJsonTool(
    server,
    ctx,
    'cycle_delete',
    {
      description: 'DELETE /cycles/:id — permanently delete a cycle.',
      destructive: true,
      inputSchema: {
        id: z.string(),
        confirm: z
          .literal(true)
          .describe('Must be true to execute this destructive action'),
      },
    },
    (args, client) => client.delete(`/cycles/${encodeURIComponent(args.id)}`),
  );
}
