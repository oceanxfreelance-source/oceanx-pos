import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Client, createSuperAdmin, createTestEnv, resetDb, SA_PASSWORD, type TestEnv } from './helpers';

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da6364f8ff1f0003030200efa6c8f00000000049454e44ae426082', 'hex');
const APP = { 'user-agent': 'Mozilla/5.0 (Linux; Android 14) OceanXAndroid/1.0.0' };

let env: TestEnv;
beforeAll(async () => {
  env = await createTestEnv();
});
afterAll(async () => env.close());
beforeEach(async () => {
  await resetDb(env.db);
  await createSuperAdmin(env.db);
});

async function phoneLogin() {
  const c = new Client(env.app);
  const res = await c.request('POST', '/api/superadmin/auth/login', { email: 'root@platform.test', password: SA_PASSWORD }, APP);
  expect(res.statusCode).toBe(200);
  expect(res.json().phoneApp).toBe(true);
  return c;
}

/** A Gravity Budget person whose trial ended and who uploaded a transfer slip. */
async function slipWaiting(name: string) {
  const c = new Client(env.app);
  const r = await c.post('/api/auth/register', { product: 'budget', businessName: name, ownerName: name, email: `${name.toLowerCase().replace(/\W/g, '')}@budget.test`, password: 'Budget-Pass-1234', currency: 'MVR' });
  await env.db.execute(sql`UPDATE subscriptions SET current_period_end = now() - interval '1 minute' WHERE business_id = ${r.json().business.id}`);
  const plan = (await c.get('/api/billing')).json().plans[0];
  expect((await c.request('POST', `/api/billing/payments?planId=${plan.id}&months=1&reference=BML1`, PNG, { 'content-type': 'image/png' })).statusCode).toBe(201);
}

describe('OceanX Admin phone app (Super Admin, payments only)', () => {
  it('signs in once: the phone sign-in lasts and renews, but only reaches payments and the phone screen', async () => {
    const c = await phoneLogin();
    const [s] = (await env.db.execute(sql`SELECT phone_app, expires_at FROM super_admin_sessions WHERE revoked_at IS NULL`)).rows as { phone_app: boolean; expires_at: Date }[];
    expect(s!.phone_app).toBe(true);
    expect(new Date(s!.expires_at).getTime()).toBeGreaterThan(Date.now() + 80 * 86_400_000);
    // Allowed: the phone screen and payments.
    expect((await c.get('/api/superadmin/phone/summary')).statusCode).toBe(200);
    expect((await c.get('/api/superadmin/billing/payments?status=pending')).statusCode).toBe(200);
    // Not allowed: the rest of Super Admin.
    expect((await c.get('/api/superadmin/businesses')).statusCode).toBe(403);
    expect((await c.get('/api/superadmin/hub/overview')).statusCode).toBe(403);
    expect((await c.post('/api/superadmin/auth/change-password', { currentPassword: SA_PASSWORD, newPassword: 'Another-Pass-12345' })).statusCode).toBe(403);
    // Weeks later (within a month unused) it still works, and the end moves ahead again.
    await env.db.execute(sql`UPDATE super_admin_sessions SET last_seen_at = now() - interval '20 days', expires_at = now() + interval '1 day'`);
    expect((await c.get('/api/superadmin/phone/summary')).statusCode).toBe(200);
    const [s2] = (await env.db.execute(sql`SELECT expires_at FROM super_admin_sessions WHERE revoked_at IS NULL`)).rows as { expires_at: Date }[];
    expect(new Date(s2!.expires_at).getTime()).toBeGreaterThan(Date.now() + 80 * 86_400_000);
    // A browser sign-in keeps the normal Super Admin limits.
    const web = new Client(env.app);
    expect((await web.post('/api/superadmin/auth/login', { email: 'root@platform.test', password: SA_PASSWORD })).json().phoneApp).toBe(false);
    expect((await web.get('/api/superadmin/businesses')).statusCode).toBe(200);
  });

  it('approves a slip from the phone and shows active accounts per project', async () => {
    await slipWaiting('Mariyam Ali');
    const c = await phoneLogin();
    const sum = (await c.get('/api/superadmin/phone/summary')).json();
    expect(sum.pending).toBe(1);
    expect(sum.activeAccounts).toEqual(expect.arrayContaining([{ product: 'budget', active: 1 }, { product: 'pos', active: 0 }]));
    const p = (await c.get('/api/superadmin/billing/payments?status=pending')).json().items[0];
    expect(p).toMatchObject({ businessName: 'Mariyam Ali', product: 'budget', slipIsImage: true });
    expect((await c.get(`/api/superadmin/billing/payments/${p.id}/slip`)).statusCode).toBe(200);
    expect((await c.post(`/api/superadmin/billing/payments/${p.id}/approve`, {})).json().status).toBe('approved');
    expect((await c.get('/api/superadmin/phone/summary')).json().pending).toBe(0);
  });

  it('notifications: the phone key reads only what is waiting, and stops working once removed', async () => {
    const c = await phoneLogin();
    const k = await c.post('/api/superadmin/alerts/keys', { device: 'Pixel' });
    expect(k.statusCode).toBe(201);
    const key = k.json().key as string;
    const check = () => new Client(env.app).request('GET', '/api/superadmin/alerts/pending', undefined, { 'x-alert-key': key });
    expect((await check()).json()).toEqual({ pending: 0, newest: null });
    await slipWaiting('Hassan Ibrahim');
    const r = (await check()).json();
    expect(r.pending).toBe(1);
    expect(r.newest).toMatchObject({ businessName: 'Hassan Ibrahim', product: 'budget', amount: 5000, currency: 'MVR' });
    // The key does nothing else, and a wrong key gets nothing.
    expect((await new Client(env.app).request('GET', '/api/superadmin/billing/payments', undefined, { 'x-alert-key': key })).statusCode).toBe(401);
    expect((await new Client(env.app).request('GET', '/api/superadmin/alerts/pending', undefined, { 'x-alert-key': 'x'.repeat(43) })).statusCode).toBe(401);
    // Turned off: stops at once.
    expect((await c.request('DELETE', `/api/superadmin/alerts/keys/${k.json().id}`)).statusCode).toBe(200);
    expect((await check()).statusCode).toBe(401);
  });
});
