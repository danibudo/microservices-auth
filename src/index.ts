import { createApp } from './app';
import { config } from './config/env';
import { pool } from './db/pool';
import { initConnection, closeConnection } from './messaging/connection';
import { startConsumers } from './messaging/consumer';

async function main(): Promise<void> {
  const app = createApp();

  await initConnection(startConsumers);

  const server = app.listen(config.PORT, () => {
    console.log(`Auth service listening on port ${config.PORT} [${config.NODE_ENV}]`);
  });

  const shutdown = async (): Promise<void> => {
    console.log('Shutting down...');
    server.close(async () => {
      await closeConnection();
      await pool.end();
      console.log('Shutdown complete.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());
}

main().catch((err: unknown) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});