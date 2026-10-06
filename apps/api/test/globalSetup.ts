import { runMigrations } from '../src/db/migrate';

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgres://oceanx:oceanx_dev@localhost:5432/oceanx_test';

export default async function setup() {
  await runMigrations(TEST_DATABASE_URL);
}
