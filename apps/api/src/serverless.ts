/**
 * Serverless entry (e.g. Vercel Node functions). The Fastify app is built once per instance and
 * receives raw Node requests. Optional cold-start tasks, all idempotent:
 *  - AUTO_MIGRATE=true: apply migrations + sync reference data under a PostgreSQL advisory lock
 *    (uses MIGRATION_DATABASE_URL — a direct, non-pooled connection — when set).
 *  - BOOTSTRAP_SUPERADMIN_EMAIL / BOOTSTRAP_SUPERADMIN_PASSWORD: create the first Super Admin only
 *    when no Super Admin exists yet. Remove these variables after the first sign-in.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { count } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { FastifyInstance } from 'fastify';
import { emailSchema, superAdminPasswordSchema } from '@oceanx/shared';
import { buildApp } from './app';
import { loadConfig } from './config';
import { createDb } from './db/client';
import * as schema from './db/schema';
import { syncReferenceData } from './db/referenceData';
import { hashPassword } from './lib/password';

const MIGRATION_LOCK = 727_001;

function migrationsFolder(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [path.resolve(process.cwd(), 'drizzle'), path.resolve(here, '../drizzle'), path.resolve(here, 'drizzle')];
  const found = candidates.find((c) => existsSync(path.join(c, 'meta', '_journal.json')));
  if (!found) throw new Error('Migrations folder not found');
  return found;
}

async function prepareDatabase(url: string) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK]);
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: migrationsFolder() });
    await syncReferenceData(db as never);
    const email = process.env.BOOTSTRAP_SUPERADMIN_EMAIL;
    const password = process.env.BOOTSTRAP_SUPERADMIN_PASSWORD;
    if (email && password) {
      const [existing] = await db.select({ n: count() }).from(schema.superAdmins);
      if (Number(existing?.n ?? 0) === 0) {
        await db.insert(schema.superAdmins).values({
          email: emailSchema.parse(email),
          name: 'Platform Admin',
          passwordHash: await hashPassword(superAdminPasswordSchema.parse(password)),
          passwordChangedAt: new Date(),
        });
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK]).catch(() => undefined);
    await client.end();
  }
}

async function init(): Promise<FastifyInstance> {
  const config = loadConfig();
  if (process.env.AUTO_MIGRATE === 'true') await prepareDatabase(process.env.MIGRATION_DATABASE_URL || config.DATABASE_URL);
  const { db } = createDb(config.DATABASE_URL, 3);
  const app = await buildApp({ config, db });
  await app.ready();
  return app;
}

let ready: Promise<FastifyInstance> | null = null;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  ready ??= init().catch((err) => {
    ready = null; // retry on the next request
    throw err;
  });
  try {
    const app = await ready;
    app.server.emit('request', req, res);
  } catch (err) {
    console.error(err);
    res.statusCode = 503;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: { code: 'internal_error', message: 'Service starting, please retry' } }));
  }
}
