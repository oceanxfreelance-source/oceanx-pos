import { buildApp } from './app';
import { loadConfig } from './config';
import { createDb } from './db/client';

const config = loadConfig();
const { db, pool } = createDb(config.DATABASE_URL, 20);
const app = await buildApp({ config, db });

const shutdown = async () => {
  await app.close();
  await pool.end();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ port: config.PORT, host: config.HOST });
