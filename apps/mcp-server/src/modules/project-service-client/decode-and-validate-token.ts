import { LoggerService } from '@nestjs/common';
import jwt from 'jsonwebtoken';

const EXPECTED_ISSUER = process.env.JWT_ISSUER || 'ai-agent';

interface ProjectServiceJwtPayload {
  sub?: string;
  id?: string;
  email?: string;
  exp?: number;
  iss?: string;
}

/**
 * Decode-only check (no signature verification — project-service's JwtStrategy
 * remains the sole enforcement point). Exists purely to fail fast with a clear
 * message instead of surfacing a confusing 401 on the first tool call.
 */
export function validateTokenOrExit(logger: LoggerService): string {
  const token = process.env.PROJECT_ACCESS_TOKEN;

  if (!token) {
    fail(
      logger,
      'PROJECT_ACCESS_TOKEN is not set. Configure it in your MCP client config.',
    );
  }

  const payload = jwt.decode(token) as ProjectServiceJwtPayload | null;
  if (!payload) {
    fail(logger, 'PROJECT_ACCESS_TOKEN is not a valid JWT.');
  }

  if (!payload.email || !(payload.sub || payload.id)) {
    fail(logger, 'PROJECT_ACCESS_TOKEN is missing required claims (sub/id, email).');
  }

  if (payload.iss !== EXPECTED_ISSUER) {
    fail(
      logger,
      `PROJECT_ACCESS_TOKEN has an unexpected issuer ("${payload.iss}"), expected "${EXPECTED_ISSUER}".`,
    );
  }

  if (!payload.exp || payload.exp * 1000 <= Date.now()) {
    fail(
      logger,
      'PROJECT_ACCESS_TOKEN has expired. Obtain a fresh token and restart mcp-server.',
    );
  }

  return token;
}

function fail(logger: LoggerService, message: string): never {
  // Synchronous console output guarantees the message is flushed before
  // process.exit(1) — an async Winston transport can otherwise be torn down
  // mid-write and the operator never sees why startup failed.
  // eslint-disable-next-line no-console
  console.error(`[mcp-server] Fatal startup error: ${message}`);
  logger.error({ message, context: 'ProjectAccessTokenValidation' });
  process.exit(1);
}
