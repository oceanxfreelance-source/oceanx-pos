import { migrate } from 'drizzle-orm/node-postgres/migrator';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDb } from './client';
import { syncReferenceData } from './referenceData';

export async function runMigrations(url: string): Promise<void> {
  const { db, pool } = createDb(url, 1);
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    // Works from src/db (tsx) and from dist (bundled).
    const candidates = [path.resolve(here, '../../drizzle'), path.resolve(here, '../drizzle'), path.resolve(process.cwd(), 'drizzle')];
    const fs = await import('node:fs');
    const folder = candidates.find((c) => fs.existsSync(path.join(c, 'meta', '_journal.json')));
    if (!folder) throw new Error('Migrations folder not found');
    await migrate(db, { migrationsFolder: folder });
    await syncReferenceData(db);
  } finally {
    await pool.end();
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  runMigrations(url)
    .then(() => console.log('Migrations applied and reference data synced.'))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
