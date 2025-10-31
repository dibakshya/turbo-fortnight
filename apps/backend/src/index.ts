import { createServer } from 'http';

import { createApp } from './app';
import { env } from './env';
import { logger } from './logger';
import { prisma } from './prisma';

const bootstrap = async () => {
  await prisma.$connect();

  const app = createApp();
  const server = createServer(app);

  server.listen(env.port, () => {
    logger.info(`API listening on port ${env.port}`);
  });
};

bootstrap().catch((error) => {
  logger.error(error, 'Failed to start server');
  process.exit(1);
});
