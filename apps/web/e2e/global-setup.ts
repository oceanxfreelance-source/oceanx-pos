import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SA_EMAIL = 'root@e2e-platform.test';
export const SA_PASSWORD = 'E2E-Super-Admin-Pass!';
const DB = process.env.E2E_DATABASE_URL ?? 'postgres://oceanx:oceanx_dev@localhost:5432/oceanx_e2e';

/** Fresh e2e database: migrate, wipe tenant data, create a Super Admin through the real CLI. */
export default async function globalSetup() {
  const api = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../api');
  const env = { ...process.env, DATABASE_URL: DB };
  execSync('npx tsx src/db/migrate.ts', { cwd: api, env, stdio: 'inherit' });
  execSync(
    `psql "${DB}" -q -c "TRUNCATE activity_logs, document_sequences, user_tokens, user_sessions, user_outlets, user_roles, role_permissions, roles, users, business_settings, outlets, business_addons, subscriptions, businesses, super_admin_tokens, super_admin_sessions, platform_settings, super_admins CASCADE; INSERT INTO platform_settings(key, value) VALUES ('registrationMode', '\\"open\\"');"`,
    { stdio: 'inherit' },
  );
  execSync(`npx tsx src/cli/create-superadmin.ts --email ${SA_EMAIL} --name "E2E Root"`, { cwd: api, env: { ...env, SUPERADMIN_PASSWORD: SA_PASSWORD }, stdio: 'inherit' });
}
