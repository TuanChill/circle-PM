import { NodeEnv } from '@app/common';
import { registerAs } from '@nestjs/config';

export const getAppConfig = () => {
  const projectServiceBaseUrl = process.env.PROJECT_SERVICE_APP_URL;
  if (!projectServiceBaseUrl) {
    throw new Error('PROJECT_SERVICE_APP_URL is not configured');
  }

  return {
    nodeEnv: (process.env.NODE_ENV as NodeEnv) || NodeEnv.Local,
    appName: 'mcp-server',
    projectServiceBaseUrl,
  };
};

export const appConfiguration = registerAs('app', getAppConfig);
