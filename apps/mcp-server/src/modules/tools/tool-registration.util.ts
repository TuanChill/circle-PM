import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type {
  AnySchema,
  ZodRawShapeCompat,
} from '@modelcontextprotocol/sdk/server/zod-compat.js';
import { Logger } from 'winston';
import { ProjectServiceHttpClient } from '../project-service-client/project-service-http.client';

export interface ToolContext {
  client: ProjectServiceHttpClient;
  logger: Logger;
}

interface ToolConfig {
  description: string;
  inputSchema?: ZodRawShapeCompat | AnySchema;
  /** Requires `confirm: true` in the input before the handler runs. */
  destructive?: boolean;
}

const AUDIT_KEY_PATTERN = /(^id$|Id$|identifier|action|emoji|^role$)/i;

/** Extracts only id/action-like fields for the audit trail — never full bodies (may carry PII/free text). */
function summarizeForAudit(args: unknown): Record<string, unknown> {
  if (!args || typeof args !== 'object') return {};
  return Object.fromEntries(
    Object.entries(args as Record<string, unknown>).filter(([key]) =>
      AUDIT_KEY_PATTERN.test(key),
    ),
  );
}

/**
 * Registers an MCP tool that: audit-logs the call (id/action fields only, never
 * the token or full request/response bodies), gates destructive actions behind
 * `confirm: true`, and converts thrown errors into MCP tool-error content
 * instead of an unhandled exception that would kill the stdio process.
 */
export function registerJsonTool(
  server: McpServer,
  ctx: ToolContext,
  name: string,
  config: ToolConfig,
  handler: (args: any, client: ProjectServiceHttpClient) => Promise<unknown>,
): void {
  server.registerTool(
    name,
    {
      description: config.description,
      inputSchema: config.inputSchema,
      annotations: config.destructive ? { destructiveHint: true } : undefined,
    },
    async (args: any) => {
      if (config.destructive && args?.confirm !== true) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `This action is destructive and requires confirmation. Re-call ${name} with confirm: true to proceed.`,
            },
          ],
          isError: true,
        };
      }

      ctx.logger.info({
        message: 'mcp tool invoked',
        context: 'ToolInvocation',
        tool: name,
        args: summarizeForAudit(args),
      });

      try {
        const result = await handler(args, ctx.client);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const message = (error as { message?: string })?.message || 'Unexpected error';
        ctx.logger.error({
          message: 'mcp tool failed',
          context: 'ToolInvocation',
          tool: name,
          error: message,
        });
        return { content: [{ type: 'text' as const, text: message }], isError: true };
      }
    },
  );
}
