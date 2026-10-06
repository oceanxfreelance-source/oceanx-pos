import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';

export type DB = NodePgDatabase<typeof schema>;
/** A database handle or an open transaction. */
export type Tx = Parameters<Parameters<DB['transaction']>[0]>[0];
export type Executor = DB | Tx;

export function createDb(url: string, max = 10): { db: DB; pool: pg.Pool } {
  const pool = new pg.Pool({ connectionString: url, max });
  const db = drizzle(pool, { schema });
  return { db, pool };
}
