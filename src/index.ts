import { createApp } from './app';
import { config } from './config/env';
import { pool } from './db/pool';

async function main(): Promise<void> {
  const app = createApp();

  const server = app.listen(config.PORT, () => {
    console.log(`Auth service listening on port ${config.PORT} [${config.NODE_ENV}]`);
  });

  const shutdown = async (): Promise<void> => {
    console.log('Shutting down...');
    server.close(async () => {
      await pool.end();
      console.log('Database pool closed.');
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