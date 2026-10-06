/** Re-sync platform reference data (permissions, languages, add-on registry, default plans). No demo data. */
import { createDb } from './client';
import { syncReferenceData } from './referenceData';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');
const { db, pool } = createDb(url, 1);
syncReferenceData(db)
  .then(() => console.log('Reference data synced.'))
  .finally(() => pool.end());
