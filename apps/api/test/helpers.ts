import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { sql } from 'drizzle-orm';
import { buildApp } from '../src/app';
import { loadConfig } from '../src/config';
import { createDb, type DB } from '../src/db/client';
import { superAdmins } from '../src/db/schema';
import { syncReferenceData } from '../src/db/referenceData';
import { createMailer, type Mailer } from '../src/lib/mailer';
import { hashPassword } from '../src/lib/password';

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgres://oceanx:oceanx_dev@localhost:5432/oceanx_test';

export interface TestEnv {
  app: FastifyInstance;
  db: DB;
  mailer: Mailer;
  close: () => Promise<void>;
}

export async function createTestEnv(opts: { authRateLimit?: number; storageDriver?: 'fs' | 'db' } = {}): Promise<TestEnv> {
  const config = loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: TEST_DATABASE_URL,
    MAIL_TRANSPORT: 'memory',
    APP_URL: 'http://app.test',
    STORAGE_DIR: mkdtempSync(path.join(tmpdir(), 'oceanx-test-')),
    COOKIE_SECURE: 'false',
    STORAGE_DRIVER: opts.storageDriver ?? 'fs',
  });
  const { db, pool } = createDb(TEST_DATABASE_URL, 5);
  const mailer = createMailer(config, { warn() {} } as never);
  const app = await buildApp({ config, db, mailer, logger: false, authRateLimit: opts.authRateLimit ?? 10_000 });
  await app.ready();
  return {
    app,
    db,
    mailer,
    close: async () => {
      await app.close();
      await pool.end();
    },
  };
}

/** Remove all tenant/admin data; keep reference data (plans, add-ons, permissions, languages). */
export async function resetDb(db: DB) {
  await db.execute(sql`
    TRUNCATE activity_logs, document_sequences, user_tokens, user_sessions, user_outlets, user_roles, role_permissions, roles,
      users, business_settings, outlets, business_addons, subscriptions, businesses,
      super_admin_tokens, super_admin_sessions, platform_settings, super_admins, plans, addons, platform_languages, stored_files CASCADE`);
  await syncReferenceData(db);
}

/** Minimal cookie-jar HTTP client over fastify.inject, tracking the CSRF token like the web app does. */
export class Client {
  cookies = new Map<string, string>();
  csrf: string | null = null;
  constructor(
    private readonly app: FastifyInstance,
    private readonly ip = '127.0.0.1',
  ) {}

  async request(method: string, url: string, body?: unknown, headers: Record<string, string> = {}): Promise<LightMyRequestResponse> {
    const cookieHeader = [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    const isBuffer = Buffer.isBuffer(body);
    const res = await this.app.inject({
      method: method as 'GET',
      url,
      remoteAddress: this.ip,
      headers: {
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
        ...(this.csrf ? { 'x-csrf-token': this.csrf } : {}),
        ...(body !== undefined && !isBuffer ? { 'content-type': 'application/json' } : {}),
        ...headers,
      },
      payload: body === undefined ? undefined : isBuffer ? (body as Buffer) : JSON.stringify(body),
    });
    for (const c of res.cookies) {
      if (c.value === '' || (c.maxAge !== undefined && c.maxAge <= 0) || (c.expires && new Date(c.expires).getTime() < Date.now())) this.cookies.delete(c.name);
      else this.cookies.set(c.name, c.value);
    }
    try {
      const json = res.json() as { csrfToken?: string };
      if (json && typeof json.csrfToken === 'string') this.csrf = json.csrfToken;
    } catch {
      /* non-JSON */
    }
    return res;
  }
  get(url: string) {
    return this.request('GET', url);
  }
  post(url: string, body: unknown = {}) {
    return this.request('POST', url, body);
  }
  patch(url: string, body: unknown = {}) {
    return this.request('PATCH', url, body);
  }
  put(url: string, body: unknown = {}) {
    return this.request('PUT', url, body);
  }
  delete(url: string) {
    return this.request('DELETE', url);
  }
}

export const SA_PASSWORD = 'Sup3r-Admin-Password!';
export const OWNER_PASSWORD = 'Owner-Pass-123';

export async function createSuperAdmin(db: DB, email = 'root@platform.test', password = SA_PASSWORD) {
  const [a] = await db.insert(superAdmins).values({ email, name: 'Root Admin', passwordHash: await hashPassword(password) }).returning();
  return a!;
}

export async function loginSuperAdmin(env: TestEnv, email = 'root@platform.test', password = SA_PASSWORD) {
  const c = new Client(env.app);
  const res = await c.post('/api/superadmin/auth/login', { email, password });
  if (res.statusCode !== 200) throw new Error(`SA login failed: ${res.body}`);
  return c;
}

export function lastMailToken(mailer: Mailer, to: string): string {
  const mail = [...mailer.outbox].reverse().find((m) => m.to === to);
  const match = mail?.text.match(/token=([A-Za-z0-9_-]+)/);
  if (!match?.[1]) throw new Error(`No token mail for ${to}`);
  return match[1];
}

export async function planId(sa: Client, code: string): Promise<string> {
  const res = await sa.get('/api/superadmin/plans');
  const plan = (res.json().items as { id: string; code: string }[]).find((p) => p.code === code);
  if (!plan) throw new Error(`plan ${code} missing`);
  return plan.id;
}

/** Super Admin creates a business; owner accepts the invitation and logs in. */
export async function setupBusiness(env: TestEnv, sa: Client, name: string, opts: { plan?: string; type?: string } = {}) {
  const ownerEmail = `owner@${name.toLowerCase().replace(/[^a-z0-9]/g, '')}.test`;
  const res = await sa.post('/api/superadmin/businesses', {
    name,
    businessType: opts.type ?? 'restaurant',
    currency: 'MVR',
    planId: await planId(sa, opts.plan ?? 'business'),
    owner: { name: `${name} Owner`, email: ownerEmail, language: 'en' },
  });
  if (res.statusCode !== 201) throw new Error(`create business failed: ${res.body}`);
  const businessId = res.json().id as string;
  const token = lastMailToken(env.mailer, ownerEmail);
  const reset = await new Client(env.app).post('/api/auth/reset-password', { token, password: OWNER_PASSWORD });
  if (reset.statusCode !== 200) throw new Error(`accept invite failed: ${reset.body}`);
  const owner = new Client(env.app);
  const login = await owner.post('/api/auth/login', { email: ownerEmail, password: OWNER_PASSWORD });
  if (login.statusCode !== 200) throw new Error(`owner login failed: ${login.body}`);
  return { businessId, owner, ownerEmail, session: login.json() };
}

export async function roleIdByKey(client: Client, key: string): Promise<string> {
  const res = await client.get('/api/roles');
  const role = (res.json().items as { id: string; systemKey: string | null }[]).find((r) => r.systemKey === key);
  if (!role) throw new Error(`role ${key} missing`);
  return role.id;
}

/** Owner creates a staff user with the given system role and returns a logged-in client. */
export async function createStaff(env: TestEnv, owner: Client, email: string, roleKeyOrIds: string | string[]) {
  const roleIds = Array.isArray(roleKeyOrIds) ? roleKeyOrIds : [await roleIdByKey(owner, roleKeyOrIds)];
  const password = 'Staff-Pass-123';
  const res = await owner.post('/api/users', { name: email.split('@')[0], email, password, roleIds, mustChangePassword: false });
  if (res.statusCode !== 201) throw new Error(`create staff failed: ${res.body}`);
  const c = new Client(env.app);
  const login = await c.post('/api/auth/login', { email, password });
  if (login.statusCode !== 200) throw new Error(`staff login failed: ${login.body}`);
  return { client: c, userId: res.json().id as string, password };
}
