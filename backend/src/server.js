'use strict';

const createApp = require('./app');
const env = require('./config/env');
const logger = require('./utils/logger');
const adminsRepo = require('./repositories/admins.repository');

async function main() {
  await adminsRepo.ensureSeedAdmin();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`[backend] listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = (signal) => {
    logger.info(`[backend] Received ${signal}, shutting down gracefully...`);
    server.close(() => {
      logger.info('[backend] Closed all connections.');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error({ err }, '[backend] Failed to start');
  process.exit(1);
});
