import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { registerJsonTool, ToolContext } from './tool-registration.util';

const RELATION_TYPES = ['blocks', 'blocked_by', 'relates_to', 'duplicate_of'] as const;

export function registerIssueTools(server: McpServer, ctx: ToolContext): void {
  registerJsonTool(
    server,
    ctx,
    'issue_list',
    {
      description:
        'GET /issues — list issues with multi-dimensional filtering and pagination.',
      inputSchema: {
        teamId: z.string().optional(),
        workspaceId: z.string().optional(),
        cycleId: z.string().optional(),
        projectId: z.string().optional(),
        statusCategories: z
          .string()
          .optional()
          .describe('Comma-separated status categories'),
        statusIds: z.string().optional().describe('Comma-separated status ids'),
        priorityIds: z.string().optional().describe('Comma-separated priority ids'),
        assigneeId: z.string().optional(),
        labelIds: z.string().optional().describe('Comma-separated label ids'),
        search: z.string().optional(),
        advancedFilters: z
          .string()
          .optional()
          .describe('JSON array of validated issue filter conditions/groups'),
        limit: z.number().int().min(1).optional(),
        offset: z.number().int().min(0).optional(),
      },
    },
    (args, client) => client.get('/issues', args),
  );

  registerJsonTool(
    server,
    ctx,
    'issue_get_facets',
    {
      description: 'GET /issues/facets — get scoped issue filter facet counts.',
      inputSchema: {
        teamId: z.string().optional(),
        workspaceId: z.string().optional(),
        cycleId: z.string().optional(),
        projectId: z.string().optional(),
      },
    },
    (args, client) => client.get('/issues/facets', args),
  );

  registerJsonTool(
    server,
    ctx,
    'issue_list_archived',
    {
      description:
        'GET /issues/archived — list recently deleted issues in accessible teams.',
      inputSchema: { teamId: z.string().optional() },
    },
    (args, client) =>
      client.get('/issues/archived', args.teamId ? { teamId: args.teamId } : undefined),
  );

  registerJsonTool(
    server,
    ctx,
    'issue_get',
    {
      description:
        'GET /issues/:identifier — get an issue by identifier or id. Set includeDetail=true to fetch ' +
        'GET /issues/:identifier/detail instead (description blocks, activity feed, relations, PRs).',
      inputSchema: {
        identifier: z.string().describe('Issue identifier (e.g. LNUI-701) or id'),
        workspaceId: z.string().optional(),
        includeDetail: z.boolean().optional(),
      },
    },
    (args, client) => {
      const suffix = args.includeDetail ? '/detail' : '';
      return client.get(
        `/issues/${encodeURIComponent(args.identifier)}${suffix}`,
        args.workspaceId ? { workspaceId: args.workspaceId } : undefined,
      );
    },
  );

  registerJsonTool(
    server,
    ctx,
    'issue_get_subscription',
    {
      description:
        'GET /issues/:identifier/subscription — get the authenticated member subscription state for an issue.',
      inputSchema: { identifier: z.string() },
    },
    (args, client) =>
      client.get(`/issues/${encodeURIComponent(args.identifier)}/subscription`),
  );

  registerJsonTool(
    server,
    ctx,
    'issue_manage_subscription',
    {
      description: 'Subscribe or unsubscribe the authenticated member to/from an issue.',
      inputSchema: z.discriminatedUnion('action', [
        z.object({ action: z.literal('subscribe'), identifier: z.string() }),
        z.object({ action: z.literal('unsubscribe'), identifier: z.string() }),
      ]),
    },
    (args, client) => {
      const path = `/issues/${encodeURIComponent(args.identifier)}/subscription`;
      return args.action === 'subscribe' ? client.post(path) : client.delete(path);
    },
  );

  registerJsonTool(
    server,
    ctx,
    'issue_create',
    {
      description: 'POST /issues — create a new issue.',
      inputSchema: {
        identifier: z.string().optional().describe('Explicit identifier, e.g. LNUI-701'),
        title: z.string(),
        description: z.string().optional(),
        descriptionBlocks: z.array(z.unknown()).optional(),
        statusId: z.string().optional(),
        statusCategory: z.string().optional(),
        priorityId: z.string().optional(),
        estimate: z.number().int().min(0).nullable().optional(),
        assigneeId: z.string().optional(),
        teamId: z.string().optional(),
        projectId: z.string().optional(),
        cycleId: z.string().optional(),
        parentIssueId: z.string().optional(),
        labelIds: z.array(z.string()).optional(),
        rank: z.string().optional().describe('LexoRank position, e.g. "0|hzzzzz:"'),
        dueDate: z.string().optional(),
        milestone: z.string().optional(),
      },
    },
    (args, client) => client.post('/issues', args),
  );

  registerJsonTool(
    server,
    ctx,
    'issue_update',
    {
      description: 'PATCH /issues/:identifier — update issue fields.',
      inputSchema: {
        identifier: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        descriptionBlocks: z.array(z.unknown()).optional(),
        statusId: z.string().optional(),
        statusCategory: z.string().optional(),
        priorityId: z.string().optional(),
        estimate: z.number().int().min(0).nullable().optional(),
        assigneeId: z.string().nullable().optional(),
        teamId: z.string().optional(),
        projectId: z.string().nullable().optional(),
        cycleId: z.string().optional(),
        parentIssueId: z.string().optional(),
        labelIds: z.array(z.string()).optional(),
        rank: z.string().optional(),
        dueDate: z.string().optional(),
        milestone: z.string().optional(),
      },
    },
    (args, client) => {
      const { identifier, ...body } = args;
      return client.patch(`/issues/${encodeURIComponent(identifier)}`, body);
    },
  );

  registerJsonTool(
    server,
    ctx,
    'issue_reorder',
    {
      description:
        'PATCH /issues/:identifier/rank — update issue rank for LexoRank-based drag reordering.',
      inputSchema: {
        identifier: z.string(),
        rank: z.string().describe('New LexoRank position, e.g. "0|hzzzzz:"'),
      },
    },
    (args, client) =>
      client.patch(`/issues/${encodeURIComponent(args.identifier)}/rank`, {
        rank: args.rank,
      }),
  );

  registerJsonTool(
    server,
    ctx,
    'issue_delete',
    {
      description: 'DELETE /issues/:identifier — delete an issue.',
      destructive: true,
      inputSchema: {
        identifier: z.string(),
        confirm: z
          .literal(true)
          .describe('Must be true to execute this destructive action'),
      },
    },
    (args, client) => client.delete(`/issues/${encodeURIComponent(args.identifier)}`),
  );

  registerJsonTool(
    server,
    ctx,
    'issue_restore',
    {
      description: 'POST /issues/:identifier/restore — restore a recently deleted issue.',
      inputSchema: { identifier: z.string() },
    },
    (args, client) =>
      client.post(`/issues/${encodeURIComponent(args.identifier)}/restore`),
  );

  registerJsonTool(
    server,
    ctx,
    'issue_add_comment',
    {
      description: 'POST /issues/:identifier/comments — add a comment to an issue.',
      inputSchema: {
        identifier: z.string(),
        textContent: z.string().optional(),
        commentBlocks: z.array(z.unknown()).optional(),
      },
    },
    (args, client) => {
      const { identifier, ...body } = args;
      return client.post(`/issues/${encodeURIComponent(identifier)}/comments`, body);
    },
  );

  registerJsonTool(
    server,
    ctx,
    'issue_manage_reaction',
    {
      description: 'Add or remove an emoji reaction on an issue activity/comment.',
      inputSchema: z.discriminatedUnion('action', [
        z.object({ action: z.literal('add'), activityId: z.string(), emoji: z.string() }),
        z.object({
          action: z.literal('remove'),
          activityId: z.string(),
          emoji: z.string(),
          confirm: z
            .literal(true)
            .describe('Must be true to execute this destructive action'),
        }),
      ]),
    },
    (args, client) => {
      if (args.action === 'add') {
        return client.post(
          `/issues/activities/${encodeURIComponent(args.activityId)}/reactions`,
          {
            emoji: args.emoji,
          },
        );
      }
      return client.delete(
        `/issues/activities/${encodeURIComponent(args.activityId)}/reactions/${encodeURIComponent(args.emoji)}`,
      );
    },
  );

  registerJsonTool(
    server,
    ctx,
    'issue_manage_relation',
    {
      description:
        'Add or remove a relation between two issues (blocks, relates_to, etc).',
      inputSchema: z.discriminatedUnion('action', [
        z.object({
          action: z.literal('add'),
          identifier: z.string(),
          targetIdentifier: z.string(),
          relationType: z.enum(RELATION_TYPES),
        }),
        z.object({
          action: z.literal('remove'),
          identifier: z.string(),
          relationId: z.string(),
          confirm: z
            .literal(true)
            .describe('Must be true to execute this destructive action'),
        }),
      ]),
    },
    (args, client) => {
      if (args.action === 'add') {
        return client.post(`/issues/${encodeURIComponent(args.identifier)}/relations`, {
          targetIdentifier: args.targetIdentifier,
          relationType: args.relationType,
        });
      }
      return client.delete(
        `/issues/${encodeURIComponent(args.identifier)}/relations/${encodeURIComponent(args.relationId)}`,
      );
    },
  );
}
