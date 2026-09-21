import { getAppCommonConfig } from '@app/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { NestFactory } from '@nestjs/core';
import { WinstonModule } from 'nest-winston';
import { getStdioSafeWinstonConfig } from './config/stdio-safe-winston.config';
import { AppModule } from './modules/app.module';
import { validateTokenOrExit } from './modules/project-service-client/decode-and-validate-token';
import { registerAllTools } from './modules/tools/tools.module';

async function bootstrap() {
  const { nodeEnv } = getAppCommonConfig();
  const logger = WinstonModule.createLogger(
    getStdioSafeWinstonConfig('mcp-server', nodeEnv),
  );

  // Fail fast before building the DI graph — a bad token should never leave
  // ProjectServiceClientModule half-wired.
  validateTokenOrExit(logger);

  // No HTTP listener: mcp-server is a stdio child process spawned directly by
  // the MCP client (Claude Desktop/Code/Cursor `command`/`args`), not by Docker
  // or an HTTP-facing gateway.
  const app = await NestFactory.createApplicationContext(AppModule, { logger });

  const mcpServer = new McpServer({ name: 'mcp-server', version: '1.0.0' });
  registerAllTools(mcpServer, app);

  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);

  logger.log({ message: 'mcp-server ready on stdio', context: 'Application' });
}

bootstrap().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error(
    `[mcp-server] Fatal startup error: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
