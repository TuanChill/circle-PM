import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { registerJsonTool, ToolContext } from './tool-registration.util';

const UPDATE_HEALTH = ['on-track', 'at-risk', 'off-track'] as const;

export function registerProjectTools(server: McpServer, ctx: ToolContext): void {
  registerJsonTool(
    server,
    ctx,
    'project_list',
    {
      description:
        'GET /projects — list all projects, optionally filtered by team, health, or workspace.',
      inputSchema: {
        teamId: z.string().optional(),
        health: z.string().optional(),
        workspaceId: z.string().optional(),
      },
    },
    (args, client) => client.get('/projects', args),
  );

  registerJsonTool(
    server,
    ctx,
    'project_get',
    {
      description:
        'GET /projects/:id — get a project by id. Set includeDetail=true to fetch GET /projects/:id/detail ' +
        'instead (summary, milestones, updates, activity).',
      inputSchema: {
        id: z.string().describe('Project id'),
        includeDetail: z.boolean().optional(),
      },
    },
    (args, client) =>
      client.get(
        `/projects/${encodeURIComponent(args.id)}${args.includeDetail ? '/detail' : ''}`,
      ),
  );

  registerJsonTool(
    server,
    ctx,
    'project_get_members',
    {
      description:
        'GET /projects/:id/members — list project members. Response includes member PII (name, email).',
      inputSchema: { id: z.string().describe('Project id') },
    },
    (args, client) => client.get(`/projects/${encodeURIComponent(args.id)}/members`),
  );

  registerJsonTool(
    server,
    ctx,
    'project_set_members',
    {
      description:
        'PUT /projects/:id/members — replace the full project member set with the given member ids.',
      inputSchema: {
        id: z.string().describe('Project id'),
        memberIds: z.array(z.string()),
      },
    },
    (args, client) =>
      client.put(`/projects/${encodeURIComponent(args.id)}/members`, {
        memberIds: args.memberIds,
      }),
  );

  registerJsonTool(
    server,
    ctx,
    'project_manage_subscription',
    {
      description:
        'Get, subscribe, or unsubscribe the authenticated member to/from a project.',
      inputSchema: z.discriminatedUnion('action', [
        z.object({ action: z.literal('get'), id: z.string() }),
        z.object({ action: z.literal('subscribe'), id: z.string() }),
        z.object({ action: z.literal('unsubscribe'), id: z.string() }),
      ]),
    },
    (args, client) => {
      const path = `/projects/${encodeURIComponent(args.id)}/subscription`;
      if (args.action === 'get') return client.get(path);
      return args.action === 'subscribe' ? client.post(path) : client.delete(path);
    },
  );

  registerJsonTool(
    server,
    ctx,
    'project_create',
    {
      description: 'POST /projects — create a new project.',
      inputSchema: {
        id: z.string().optional(),
        name: z.string(),
        teamId: z.string().describe('Primary team owning the project'),
        teamIds: z
          .array(z.string())
          .optional()
          .describe('Additional teams sharing this project'),
        leadId: z.string().optional(),
        statusId: z.string().optional(),
        statusCategory: z.string().optional(),
        priorityId: z.string().optional(),
        healthId: z.string().optional(),
        percentComplete: z.number().optional(),
        icon: z.string().optional(),
        startDate: z.string().optional(),
        targetDate: z.string().optional(),
        initiativeId: z.string().optional(),
        labelIds: z.array(z.string()).optional(),
        memberIds: z.array(z.string()).optional(),
        summary: z.string().optional(),
        description: z.array(z.unknown()).optional(),
        resources: z.array(z.unknown()).optional(),
      },
    },
    (args, client) => client.post('/projects', args),
  );

  registerJsonTool(
    server,
    ctx,
    'project_update',
    {
      description: 'PATCH /projects/:id — update project fields.',
      inputSchema: {
        id: z.string(),
        name: z.string().optional(),
        teamId: z.string().optional(),
        teamIds: z.array(z.string()).optional(),
        leadId: z.string().optional(),
        statusId: z.string().optional(),
        statusCategory: z.string().optional(),
        priorityId: z.string().optional(),
        healthId: z.string().optional(),
        percentComplete: z.number().optional(),
        icon: z.string().optional(),
        startDate: z.string().optional(),
        targetDate: z.string().optional(),
        initiativeId: z.string().optional(),
        labelIds: z.array(z.string()).optional(),
        memberIds: z.array(z.string()).optional(),
        summary: z.string().optional(),
        description: z.array(z.unknown()).optional(),
        resources: z.array(z.unknown()).optional(),
      },
    },
    (args, client) => {
      const { id, ...body } = args;
      return client.patch(`/projects/${encodeURIComponent(id)}`, body);
    },
  );

  registerJsonTool(
    server,
    ctx,
    'project_delete',
    {
      description: 'DELETE /projects/:id — permanently delete a project.',
      destructive: true,
      inputSchema: {
        id: z.string(),
        confirm: z
          .literal(true)
          .describe('Must be true to execute this destructive action'),
      },
    },
    (args, client) => client.delete(`/projects/${encodeURIComponent(args.id)}`),
  );

  registerJsonTool(
    server,
    ctx,
    'project_manage_update',
    {
      description: 'Create, edit, or delete a project health-update post.',
      inputSchema: z.discriminatedUnion('action', [
        z.object({
          action: z.literal('create'),
          id: z.string().describe('Project id'),
          health: z.enum(UPDATE_HEALTH),
          blocks: z.array(z.unknown()).describe('Rich-text content blocks'),
        }),
        z.object({
          action: z.literal('edit'),
          id: z.string().describe('Project id'),
          updateId: z.string(),
          health: z.enum(UPDATE_HEALTH).optional(),
          blocks: z.array(z.unknown()).optional(),
        }),
        z.object({
          action: z.literal('delete'),
          id: z.string().describe('Project id'),
          updateId: z.string(),
          confirm: z
            .literal(true)
            .describe('Must be true to execute this destructive action'),
        }),
      ]),
    },
    (args, client) => {
      const base = `/projects/${encodeURIComponent(args.id)}/updates`;
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
    'project_manage_milestone',
    {
      description: "Create a milestone, or toggle a milestone's completion status.",
      inputSchema: z.discriminatedUnion('action', [
        z.object({
          action: z.literal('create'),
          id: z.string().describe('Project id'),
          name: z.string(),
          targetDate: z.string().optional(),
        }),
        z.object({
          action: z.literal('toggle'),
          id: z.string().describe('Project id'),
          milestoneId: z.string(),
        }),
      ]),
    },
    (args, client) => {
      if (args.action === 'create') {
        return client.post(`/projects/${encodeURIComponent(args.id)}/milestones`, {
          name: args.name,
          targetDate: args.targetDate,
        });
      }
      return client.patch(
        `/projects/${encodeURIComponent(args.id)}/milestones/${encodeURIComponent(args.milestoneId)}/toggle`,
      );
    },
  );
}
