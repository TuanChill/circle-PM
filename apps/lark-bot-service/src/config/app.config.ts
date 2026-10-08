import { registerAs } from '@nestjs/config';

export const getAppConfig = () => ({
  appName: process.env.LARK_BOT_SERVICE_APP_NAME || 'Lark Bot Service',
  appPort: Number(process.env.LARK_BOT_SERVICE_APP_PORT) || 3305,
  workerPollIntervalMs: Number(process.env.LARK_BOT_POLL_INTERVAL_MS) || 5000,
});

export const appConfiguration = registerAs('app', getAppConfig);
