import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { INestApplicationContext } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { registerCycleTools } from './cycle.tools';
import { registerInitiativeTools } from './initiative.tools';
import { registerIssueTools } from './issue.tools';
import { registerLabelTools } from './label.tools';
import { registerMemberTools } from './member.tools';
import { registerProjectTools } from './project.tools';
import { registerTeamTools } from './team.tools';
import { ToolContext } from './tool-registration.util';
import { registerViewTools } from './view.tools';
import { registerWorkspaceTools } from './workspace.tools';
import { ProjectServiceHttpClient } from '../project-service-client/project-service-http.client';

export function registerAllTools(server: McpServer, app: INestApplicationContext): void {
  const ctx: ToolContext = {
    client: app.get(ProjectServiceHttpClient),
    logger: app.get<Logger>(WINSTON_MODULE_PROVIDER),
  };

  registerWorkspaceTools(server, ctx);
  registerTeamTools(server, ctx);
  registerIssueTools(server, ctx);
  registerProjectTools(server, ctx);
  registerCycleTools(server, ctx);
  registerLabelTools(server, ctx);
  registerMemberTools(server, ctx);
  registerInitiativeTools(server, ctx);
  registerViewTools(server, ctx);
}
