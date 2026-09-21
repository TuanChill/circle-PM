import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { registerJsonTool, ToolContext } from './tool-registration.util';

const INITIATIVE_STATUSES = ['active', 'planned', 'completed'] as const;
const UPDATE_HEALTH = ['no-update', 'on-track', 'at-risk', 'off-track'] as const;

export function registerInitiativeTools(server: McpServer, ctx: ToolContext): void {
  registerJsonTool(
    server,
    ctx,
    'initiative_list',
    {
      description:
        'GET /initiatives — list all initiatives, optionally filtered by workspace.',
      inputSchema: { workspaceId: z.string().optional() },
    },
    (args, client) =>
      client.get(
        '/initiatives',
        args.workspaceId ? { workspaceId: args.workspaceId } : undefined,
      ),
  );

  registerJsonTool(
    server,
    ctx,
    'initiative_get',
    {
      description: 'GET /initiatives/:id — get initiative by id.',
      inputSchema: { id: z.string().describe('Initiative id') },
    },
    (args, client) => client.get(`/initiatives/${encodeURIComponent(args.id)}`),
  );

  registerJsonTool(
    server,
    ctx,
    'initiative_create',
    {
      description: 'POST /initiatives — create a new initiative.',
      inputSchema: {
        workspaceId: z.string().optional(),
        id: z.string().optional(),
        name: z.string(),
        description: z.string().optional(),
        icon: z.string().optional(),
        status: z.enum(INITIATIVE_STATUSES),
        priorityId: z.string().optional(),
        ownerId: z.string().optional(),
        target: z.string().optional(),
        healthId: z.string().optional(),
        projectIds: z.array(z.string()).optional(),
        labelIds: z.array(z.string()).optional(),
        resources: z.array(z.unknown()).optional(),
      },
    },
    (args, client) => client.post('/initiatives', args),
  );

  registerJsonTool(
    server,
    ctx,
    'initiative_update',
    {
      description: 'PATCH /initiatives/:id — update initiative fields.',
      inputSchema: {
        id: z.string(),
        name: z.string().optional(),
        description: z.string().nullable().optional(),
        icon: z.string().nullable().optional(),
        status: z.enum(INITIATIVE_STATUSES).optional(),
        priorityId: z.string().optional(),
        ownerId: z.string().nullable().optional(),
        target: z.string().nullable().optional(),
        healthId: z.string().optional(),
        projectIds: z.array(z.string()).optional(),
        labelIds: z.array(z.string()).optional(),
        resources: z.array(z.unknown()).optional(),
      },
    },
    (args, client) => {
      const { id, ...body } = args;
      return client.patch(`/initiatives/${encodeURIComponent(id)}`, body);
    },
  );

  registerJsonTool(
    server,
    ctx,
    'initiative_delete',
    {
      description: 'DELETE /initiatives/:id — permanently delete an initiative.',
      destructive: true,
      inputSchema: {
        id: z.string(),
        confirm: z
          .literal(true)
          .describe('Must be true to execute this destructive action'),
      },
    },
    (args, client) => client.delete(`/initiatives/${encodeURIComponent(args.id)}`),
  );

  registerJsonTool(
    server,
    ctx,
    'initiative_manage_update',
    {
      description: 'Create, edit, or delete a health-update post on an initiative.',
      inputSchema: z.discriminatedUnion('action', [
        z.object({
          action: z.literal('create'),
          id: z.string().describe('Initiative id'),
          health: z.enum(UPDATE_HEALTH),
          blocks: z.array(z.unknown()).optional().describe('Rich-text content blocks'),
        }),
        z.object({
          action: z.literal('edit'),
          id: z.string().describe('Initiative id'),
          updateId: z.string(),
          health: z.enum(UPDATE_HEALTH).optional(),
          blocks: z.array(z.unknown()).optional(),
        }),
        z.object({
          action: z.literal('delete'),
          id: z.string().describe('Initiative id'),
          updateId: z.string(),
          confirm: z
            .literal(true)
            .describe('Must be true to execute this destructive action'),
        }),
      ]),
    },
    (args, client) => {
      const base = `/initiatives/${encodeURIComponent(args.id)}/updates`;
      if (args.action === 'create') {
        return client.post(base, { health: args.health, blocks: args.blocks });
      }
      if (args.action === 'edit') {
        return client.patch(`${base}/${encodeURIComponent(args.updateId)}`, {
          health: args.health,
          blocks: args.blocks,
        });
      }
      return client.delete(`${base}/${encodeURIComponent(args.updateId)}`);
    },
  );

  registerJsonTool(
    server,
    ctx,
    'initiative_manage_update_reaction',
    {
      description: 'Add or remove an emoji reaction on an initiative update.',
      inputSchema: z.discriminatedUnion('action', [
        z.object({
          action: z.literal('add'),
          id: z.string().describe('Initiative id'),
          updateId: z.string(),
          emoji: z.string(),
        }),
        z.object({
          action: z.literal('remove'),
          id: z.string().describe('Initiative id'),
          updateId: z.string(),
          emoji: z.string(),
          confirm: z
            .literal(true)
            .describe('Must be true to execute this destructive action'),
        }),
      ]),
    },
    (args, client) => {
      const base = `/initiatives/${encodeURIComponent(args.id)}/updates/${encodeURIComponent(args.updateId)}/reactions`;
      if (args.action === 'add') {
        return client.post(base, { emoji: args.emoji });
      }
      return client.delete(`${base}/${encodeURIComponent(args.emoji)}`);
    },
  );
}
