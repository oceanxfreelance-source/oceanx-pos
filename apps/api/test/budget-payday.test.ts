import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Client, createSuperAdmin, createTestEnv, resetDb, SA_PASSWORD, type TestEnv } from './helpers';

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da6364f8ff1f0003030200efa6c8f00000000049454e44ae426082', 'hex');

let env: TestEnv;
beforeAll(async () => {
  env = await createTestEnv();
});
afterAll(async () => env.close());
beforeEach(async () => {
  await resetDb(env.db);
  await createSuperAdmin(env.db);
});

async function superAdmin() {
  const c = new Client(env.app);
  expect((await c.post('/api/superadmin/auth/login', { email: 'root@platform.test', password: SA_PASSWORD })).statusCode).toBe(200);
  return c;
}

async function budgetUser(name: string) {
  const c = new Client(env.app);
  const r = await c.post('/api/auth/register', { product: 'budget', businessName: name, ownerName: name, email: `${name.toLowerCase().replace(/\W/g, '')}@budget.test`, password: 'Budget-Pass-1234', currency: 'MVR' });
  expect(r.statusCode).toBe(201);
  return { c, id: r.json().business.id as string };
}

const endTrial = (id: string) => env.db.execute(sql`UPDATE subscriptions SET current_period_end = now() - interval '1 minute' WHERE business_id = ${id}`);

/** The salary day the server should pick from "today": the 30th, or the month's last day; after it, next month's. */
function expectedPayday(today: string) {
  const [y, m, d] = today.split('-').map(Number) as [number, number, number];
  const pd = (yy: number, mm: number) => `${yy}-${String(mm).padStart(2, '0')}-${String(Math.min(30, new Date(Date.UTC(yy, mm, 0)).getUTCDate())).padStart(2, '0')}`;
  return d <= Math.min(30, new Date(Date.UTC(y, m, 0)).getUTCDate()) ? pd(y, m) : m === 12 ? pd(y + 1, 1) : pd(y, m + 1);
}

describe('Gravity Budget: pay on salary day (the 30th)', () => {
  it('only while Super Admin has it on; the customer chooses it once and keeps using the app until salary day', async () => {
    const { c, id } = await budgetUser('Aisha Ali');
    await endTrial(id);
    expect((await c.get('/api/billing')).json().payday.available).toBe(false);
    expect((await c.post('/api/billing/payday')).statusCode).toBe(403);
    expect((await c.get('/api/budget/months')).statusCode).toBe(402);

    const sa = await superAdmin();
    expect((await sa.patch('/api/superadmin/settings', { budgetPaydayOn: true })).statusCode).toBe(200);
    const info = (await c.get('/api/billing')).json().payday;
    expect(info.available).toBe(true);
    expect(info.date).toBe(expectedPayday(info.today));

    const ok = await c.post('/api/billing/payday');
    expect(ok.statusCode).toBe(200);
    expect(ok.json().date).toBe(info.date);
    expect((await c.get('/api/budget/months')).statusCode).toBe(200);
    expect((await c.get('/api/billing')).json().payday).toMatchObject({ available: false, chosen: info.date });
    // Only once.
    expect((await c.post('/api/billing/payday')).statusCode).toBe(403);

    const list = (await sa.get('/api/superadmin/billing/payday')).json().items;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ businessName: 'Aisha Ali', email: 'aishaali@budget.test', paydayDate: info.date, paid: false, slipWaiting: false });

    // Paying: the paid month starts the day it is approved.
    const plan = (await c.get('/api/billing')).json().plans[0];
    expect((await c.request('POST', `/api/billing/payments?planId=${plan.id}&months=1&reference=BML1`, PNG, { 'content-type': 'image/png' })).statusCode).toBe(201);
    const pay = (await sa.get('/api/superadmin/billing/payments?status=pending')).json().items[0];
    expect((await sa.post(`/api/superadmin/billing/payments/${pay.id}/approve`, {})).statusCode).toBe(200);
    const [sub] = (await env.db.execute(sql`SELECT current_period_end FROM subscriptions WHERE business_id = ${id}`)).rows as { current_period_end: Date }[];
    const end = new Date(sub!.current_period_end).getTime();
    expect(end).toBeLessThan(Date.now() + 32 * 86_400_000);
    expect(end).toBeGreaterThan(Date.now() + 27 * 86_400_000);
    expect((await sa.get('/api/superadmin/billing/payday')).json().items[0].paid).toBe(true);
    expect((await c.get('/api/billing')).json().payday.chosen).toBeNull();
  });

  it('is not offered when switched off, or in other apps; a chosen date stays after it is switched off', async () => {
    const sa = await superAdmin();
    await sa.patch('/api/superadmin/settings', { budgetPaydayOn: true });
    const { c } = await budgetUser('Early Person');
    expect((await c.post('/api/billing/payday')).statusCode).toBe(200);
    const flow = new Client(env.app);
    await flow.post('/api/auth/register', { product: 'flow', businessName: 'Flow Shop', ownerName: 'Flow', email: 'flow@flow.test', password: 'Flow-Pass-12345', currency: 'MVR' });
    expect((await flow.get('/api/billing')).json().payday.available).toBe(false);

    await sa.patch('/api/superadmin/settings', { budgetPaydayOn: false });
    const { c: late } = await budgetUser('Late Person');
    expect((await late.get('/api/billing')).json().payday.available).toBe(false);
    expect((await late.post('/api/billing/payday')).statusCode).toBe(403);
    expect((await c.get('/api/billing')).json().payday.chosen).toBeTruthy();
  });

  it('a paying customer can choose it too; their paid time is not shortened', async () => {
    const sa = await superAdmin();
    await sa.patch('/api/superadmin/settings', { budgetPaydayOn: true });
    const { c, id } = await budgetUser('Paid Person');
    await env.db.execute(sql`UPDATE subscriptions SET status = 'active', current_period_end = now() + interval '40 days' WHERE business_id = ${id}`);
    expect((await c.post('/api/billing/payday')).statusCode).toBe(200);
    const [sub] = (await env.db.execute(sql`SELECT current_period_end FROM subscriptions WHERE business_id = ${id}`)).rows as { current_period_end: Date }[];
    expect(new Date(sub!.current_period_end).getTime()).toBeGreaterThan(Date.now() + 39 * 86_400_000);
  });
});
