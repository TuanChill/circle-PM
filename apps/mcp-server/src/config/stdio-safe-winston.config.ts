import * as winston from 'winston';
import { getWinstonConfig } from '@app/common';
import { NodeEnv } from '@app/common';
import { WinstonModuleOptions } from 'nest-winston';

/**
 * MCP stdio transport reserves stdout exclusively for JSON-RPC framing.
 * `getWinstonConfig`'s Console transport defaults to stdout, which would
 * corrupt every client's stdio parser, so every level is forced to stderr here.
 */
export function getStdioSafeWinstonConfig(
  appName: string,
  nodeEnv: NodeEnv,
): WinstonModuleOptions {
  const baseConfig = getWinstonConfig(appName, nodeEnv);
  const [consoleTransport] = baseConfig.transports as winston.transport[];

  return {
    ...baseConfig,
    transports: [
      new winston.transports.Console({
        level: consoleTransport.level,
        format: consoleTransport.format,
        handleExceptions: true,
        stderrLevels: Object.keys(winston.config.npm.levels),
      }),
    ],
  };
}
