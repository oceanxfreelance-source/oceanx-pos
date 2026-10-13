import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { Client, createSuperAdmin, createTestEnv, loginSuperAdmin, resetDb, setupBusiness, type TestEnv } from './helpers';

let env: TestEnv;
let sa: Client;

beforeAll(async () => {
  env = await createTestEnv();
});
afterAll(async () => env.close());
beforeEach(async () => {
  await resetDb(env.db);
  await createSuperAdmin(env.db);
  sa = await loginSuperAdmin(env);
  await sa.patch('/api/superadmin/settings', { registrationMode: 'open' });
});

async function flowAccount(name: string) {
  const c = new Client(env.app);
  const res = await c.post('/api/auth/register', { product: 'flow', businessName: name, ownerName: `Owner ${name}`, email: `${name.toLowerCase().replace(/\W/g, '')}@flow.test`, password: 'Flow-Pass-1234', currency: 'MVR' });
  expect(res.statusCode).toBe(201);
  return { c, session: res.json() };
}
const add = (c: Client, kind: 'income' | 'expense', amount: string | number, occurredOn: string, extra: Record<string, unknown> = {}) => c.post('/api/finance/transactions', { kind, amount, occurredOn, ...extra });

describe('Gravity Flow (income, expenses, profit)', () => {
  it('a Flow account gets income & expenses only, on its own plan with a free trial', async () => {
    const { c, session } = await flowAccount('Ali Fishing');
    expect(session.business.product).toBe('flow');
    expect(session.subscription).toMatchObject({ planCode: 'flow', effectiveStatus: 'trialing' });
    expect([...session.modules].sort()).toEqual(['dashboard', 'finance', 'settings']);
    expect((await c.get('/api/quotations')).statusCode).toBe(403);
    expect((await c.get('/api/products')).statusCode).toBe(403);
    // Starter categories for both kinds.
    const cats = (await c.get('/api/finance/categories')).json().items;
    expect(cats.filter((x: { kind: string }) => x.kind === 'income').length).toBeGreaterThan(0);
    expect(cats.filter((x: { kind: string }) => x.kind === 'expense').length).toBeGreaterThan(0);
    // Super Admin sees it as a Flow account, and its one plan.
    expect((await sa.get('/api/superadmin/businesses?product=flow')).json().items.map((b: { name: string }) => b.name)).toEqual(['Ali Fishing']);
    expect((await sa.get('/api/superadmin/flow/plan')).json()).toMatchObject({ name: 'Gravity Flow', currency: 'MVR', trialMinutes: 14 * 1440, accounts: 1 });
    expect((await sa.put('/api/superadmin/flow/plan', { priceMonthly: 99, trialMinutes: 60 })).statusCode).toBe(200);
    expect((await sa.get('/api/superadmin/flow/plan')).json()).toMatchObject({ priceMonthly: '99.00', trialMinutes: 60 });
  });

  it('amounts are exact decimals; bad amounts and dates are refused', async () => {
    const { c } = await flowAccount('Exact');
    expect((await add(c, 'income', '1,250.50', '2026-03-02')).statusCode).toBe(201);
    expect((await add(c, 'expense', '0.10', '2026-03-02')).statusCode).toBe(201);
    expect((await add(c, 'expense', '0.20', '2026-03-02')).statusCode).toBe(201);
    const s = (await c.get('/api/finance/summary?month=2026-03')).json();
    expect(s.totals).toEqual({ income: 125050, expense: 30, net: 125020, margin: 100 });
    for (const bad of ['12.345', '-5', '0', '0.00', 'abc', '1e5', '']) expect((await add(c, 'expense', bad, '2026-03-02')).statusCode).toBe(422);
    expect((await add(c, 'income', '10', '2026-02-30')).statusCode).toBe(422);
    expect((await c.post('/api/finance/transactions', { kind: 'gift', amount: '10', occurredOn: '2026-03-02' })).statusCode).toBe(422);
  });

  it('every calendar day is shown; daily profit and the running monthly profit go below zero and back', async () => {
    const { c } = await flowAccount('Days');
    // February 2028 has 29 days.
    await add(c, 'expense', '500', '2028-02-01');
    await add(c, 'income', '200', '2028-02-03');
    await add(c, 'income', '450.25', '2028-02-29');
    await add(c, 'expense', '50.25', '2028-02-29');
    // Other months stay out of February.
    await add(c, 'income', '999', '2028-01-31');
    await add(c, 'income', '999', '2028-03-01');
    const s = (await c.get('/api/finance/summary?month=2028-02')).json();
    expect(s.days).toHaveLength(29);
    expect(s.days[0]).toEqual({ date: '2028-02-01', income: 0, expense: 50000, profit: -50000, cumulative: -50000 });
    expect(s.days[1]).toEqual({ date: '2028-02-02', income: 0, expense: 0, profit: 0, cumulative: -50000 });
    expect(s.days[2]).toMatchObject({ date: '2028-02-03', profit: 20000, cumulative: -30000 });
    expect(s.days[28]).toMatchObject({ date: '2028-02-29', income: 45025, expense: 5025, profit: 40000, cumulative: 10000 });
    expect(s.totals).toEqual({ income: 65025, expense: 55025, net: 10000, margin: 15.4 });
    expect(s.previous).toMatchObject({ income: 99900, net: 99900 });
    // The cumulative is exactly the running sum of daily profits.
    let run = 0;
    for (const d of s.days) {
      run += d.income - d.expense;
      expect(d.profit).toBe(d.income - d.expense);
      expect(d.cumulative).toBe(run);
    }
    // A loss month: negative margin.
    const jan = (await c.get('/api/finance/summary?month=2027-12')).json();
    expect(jan.days).toHaveLength(31);
    expect(jan.totals).toEqual({ income: 0, expense: 0, net: 0, margin: null });
  });

  it('home: today only (income, expenses, profit) against yesterday, and today\'s records', async () => {
    const { c } = await flowAccount('Today Only');
    const empty = (await c.get('/api/finance/today')).json();
    expect(empty.totals).toMatchObject({ date: empty.today, income: 0, expense: 0, net: 0 });
    const today: string = empty.today;
    const yesterday: string = empty.yesterday.date;
    expect(Date.parse(today) - Date.parse(yesterday)).toBe(86_400_000);
    await add(c, 'income', '500', today);
    await add(c, 'expense', '120.25', today);
    await add(c, 'income', '900', yesterday);
    await add(c, 'income', '7000', '2025-01-05');
    const s = (await c.get('/api/finance/today')).json();
    expect(s.totals).toEqual({ date: today, income: 50000, expense: 12025, net: 37975, margin: 76 });
    expect(s.yesterday).toMatchObject({ income: 90000, expense: 0, net: 90000 });
    const list = (await c.get(`/api/finance/transactions?day=${today}`)).json();
    expect(list.total).toBe(2);
    expect(list.items.every((x: { occurredOn: string }) => x.occurredOn === today)).toBe(true);
    expect((await c.get('/api/finance/transactions?day=2026-13-01')).statusCode).toBe(422);
  });

  it('no month asked: this month in the account time zone; months and full history', async () => {
    const { c } = await flowAccount('History');
    const now = (await c.get('/api/finance/summary')).json();
    expect(now.month).toBe(now.currentMonth);
    expect(now.today.slice(0, 7)).toBe(now.month);
    await add(c, 'income', '100', '2026-01-15');
    await add(c, 'expense', '40', '2026-01-20');
    await add(c, 'expense', '10', '2025-11-02');
    const months = (await c.get('/api/finance/months?to=2026-02&count=4')).json().items;
    expect(months).toEqual([
      { month: '2025-11', income: 0, expense: 1000, net: -1000, margin: null },
      { month: '2025-12', income: 0, expense: 0, net: 0, margin: null },
      { month: '2026-01', income: 10000, expense: 4000, net: 6000, margin: 60 },
      { month: '2026-02', income: 0, expense: 0, net: 0, margin: null },
    ]);
    const history = (await c.get('/api/finance/history')).json().items;
    expect(history[0].month).toBe(now.currentMonth);
    expect(history.find((h: { month: string }) => h.month === '2026-01')).toMatchObject({ income: 10000, expense: 4000, net: 6000, count: 2 });
    expect(history.find((h: { month: string }) => h.month === '2025-11')).toMatchObject({ net: -1000, count: 1 });
  });

  it('search, filter, sort and pages; edit and delete change the totals', async () => {
    const { c } = await flowAccount('List');
    const cats = (await c.get('/api/finance/categories')).json().items;
    const rent = cats.find((x: { name: string }) => x.name === 'Rent');
    const sales = cats.find((x: { name: string }) => x.name === 'Sales');
    await add(c, 'expense', '3000', '2026-05-01', { categoryId: rent.id, description: 'Shop rent May' });
    for (let i = 1; i <= 30; i++) await add(c, 'income', String(i), `2026-05-${String((i % 28) + 1).padStart(2, '0')}`, { categoryId: sales.id, description: `Sale ${i}` });
    const page1 = (await c.get('/api/finance/transactions?month=2026-05&pageSize=10')).json();
    expect(page1.total).toBe(31);
    expect(page1.items).toHaveLength(10);
    expect((await c.get('/api/finance/transactions?month=2026-05&q=rent')).json().items.map((t: { description: string }) => t.description)).toEqual(['Shop rent May']);
    expect((await c.get('/api/finance/transactions?month=2026-05&kind=expense')).json().total).toBe(1);
    expect((await c.get(`/api/finance/transactions?month=2026-05&categoryId=${sales.id}`)).json().total).toBe(30);
    expect((await c.get('/api/finance/transactions?month=2026-05&sort=largest&pageSize=1')).json().items[0]).toMatchObject({ amount: 300000, categoryName: 'Rent' });
    // A category of the other kind is refused.
    expect((await add(c, 'income', '5', '2026-05-02', { categoryId: rent.id })).statusCode).toBe(422);

    const rentTx = (await c.get('/api/finance/transactions?month=2026-05&kind=expense')).json().items[0];
    expect((await c.put(`/api/finance/transactions/${rentTx.id}`, { kind: 'expense', amount: '2500', occurredOn: '2026-05-01', categoryId: rent.id, description: 'Shop rent May' })).statusCode).toBe(200);
    expect((await c.get('/api/finance/summary?month=2026-05')).json().totals.expense).toBe(250000);
    expect((await c.delete(`/api/finance/transactions/${rentTx.id}`)).statusCode).toBe(200);
    expect((await c.get('/api/finance/summary?month=2026-05')).json().totals.expense).toBe(0);
    expect((await c.get('/api/finance/transactions?month=2026-05')).json().total).toBe(30);
  });

  it('categories: add, rename, no duplicates; removing one keeps its transactions in the totals', async () => {
    const { c } = await flowAccount('Cats');
    const made = await c.post('/api/finance/categories', { kind: 'expense', name: 'Boat fuel' });
    expect(made.statusCode).toBe(201);
    expect((await c.post('/api/finance/categories', { kind: 'expense', name: 'boat FUEL' })).statusCode).toBe(422);
    expect((await c.post('/api/finance/categories', { kind: 'income', name: 'Boat fuel' })).statusCode).toBe(201);
    const id = made.json().id;
    expect((await c.patch(`/api/finance/categories/${id}`, { name: 'Fuel' })).json().name).toBe('Fuel');
    await add(c, 'expense', '80', '2026-06-03', { categoryId: id });
    expect((await c.delete(`/api/finance/categories/${id}`)).statusCode).toBe(200);
    expect((await c.get('/api/finance/categories')).json().items.some((x: { id: string }) => x.id === id)).toBe(false);
    expect((await c.get('/api/finance/summary?month=2026-06')).json().totals.expense).toBe(8000);
    expect((await c.get('/api/finance/transactions?month=2026-06')).json().items[0].categoryName).toBe('Fuel');
  });

  it("one account can never see or change another account's money", async () => {
    const a = await flowAccount('Account A');
    const b = await flowAccount('Account B');
    const t = (await add(a.c, 'income', '700', '2026-07-07')).json();
    const aCat = (await a.c.get('/api/finance/categories')).json().items[0];
    expect((await b.c.get('/api/finance/transactions?month=2026-07')).json().total).toBe(0);
    expect((await b.c.get('/api/finance/summary?month=2026-07')).json().totals.income).toBe(0);
    expect((await b.c.put(`/api/finance/transactions/${t.id}`, { kind: 'income', amount: '1', occurredOn: '2026-07-07' })).statusCode).toBe(404);
    expect((await b.c.delete(`/api/finance/transactions/${t.id}`)).statusCode).toBe(404);
    expect((await b.c.patch(`/api/finance/categories/${aCat.id}`, { name: 'Hacked' })).statusCode).toBe(404);
    expect((await add(b.c, aCat.kind, '1', '2026-07-07', { categoryId: aCat.id })).statusCode).toBe(422);
    expect((await a.c.get('/api/finance/summary?month=2026-07')).json().totals.income).toBe(70000);
    // Signed out: nothing.
    expect((await new Client(env.app).get('/api/finance/summary')).statusCode).toBe(401);
  });

  it('POS businesses and Gravity accounts do not have it', async () => {
    const { owner } = await setupBusiness(env, sa, 'Lagoon Cafe', { type: 'cafe' });
    expect((await owner.get('/api/finance/summary')).json().error.code).toBe('module_not_enabled');
    // Not in any POS plan either.
    const posPlans = (await sa.get('/api/superadmin/plans?product=pos')).json().items;
    expect(posPlans.some((p: { modules: string[] }) => p.modules.includes('finance'))).toBe(false);
    const g = new Client(env.app);
    await g.post('/api/auth/register', { product: 'gravity', businessName: 'Aisha Designs', ownerName: 'Aisha', email: 'aisha@gravity.test', password: 'Gravity-Pass-123', currency: 'MVR' });
    expect((await g.get('/api/finance/summary')).statusCode).toBe(403);
  });

  it('phone app: sign in once (long sign-in); browsers and the POS keep the normal limits', async () => {
    await flowAccount('Phone');
    const { ownerEmail } = await setupBusiness(env, sa, 'Lagoon Cafe', { type: 'cafe' });
    const APP = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36 OceanXAndroid/1.0.0';
    const login = (email: string, password: string, ua: string) => env.app.inject({ method: 'POST', url: '/api/auth/login', headers: { 'user-agent': ua }, payload: { email, password } });
    const maxAge = (r: Awaited<ReturnType<typeof login>>) => Number(/Max-Age=(\d+)/.exec(String(r.headers['set-cookie']))?.[1]);
    const app = await login('phone@flow.test', 'Flow-Pass-1234', APP);
    expect(app.statusCode).toBe(200);
    expect(maxAge(app)).toBe(365 * 86_400);
    const web = await login('phone@flow.test', 'Flow-Pass-1234', 'Mozilla/5.0 Chrome/126');
    expect(maxAge(web)).toBe(168 * 3_600);
    const pos = await login(ownerEmail, 'Owner-Pass-123', APP);
    expect(pos.statusCode).toBe(200);
    expect(maxAge(pos)).toBe(168 * 3_600);
    // A month without opening the app: still signed in. The same month in a browser: signed out.
    await env.db.execute(sql`UPDATE user_sessions SET last_seen_at = now() - interval '30 days'`);
    const cookie = (r: Awaited<ReturnType<typeof login>>) => String(r.headers['set-cookie']).split(';')[0]!;
    expect((await env.app.inject({ method: 'GET', url: '/api/auth/session', headers: { cookie: cookie(app) } })).statusCode).toBe(200);
    expect((await env.app.inject({ method: 'GET', url: '/api/auth/session', headers: { cookie: cookie(web) } })).statusCode).toBe(401);
  });

  it('a Flow owner can start at once, even when sign-ups need approval (POS and Gravity still wait)', async () => {
    await sa.patch('/api/superadmin/settings', { registrationMode: 'approval' });
    const flow = await new Client(env.app).post('/api/auth/register', { product: 'flow', businessName: 'Quick Start', ownerName: 'Owner', email: 'quick@flow.test', password: 'Flow-Pass-1234', currency: 'MVR' });
    expect(flow.json().state).toBe('ok');
    const gravity = await new Client(env.app).post('/api/auth/register', { product: 'gravity', businessName: 'Waits', ownerName: 'Owner', email: 'waits@gravity.test', password: 'Gravity-Pass-123', currency: 'MVR' });
    expect(gravity.json().state).toBe('business_pending');
    await sa.patch('/api/superadmin/settings', { registrationMode: 'closed' });
    expect((await new Client(env.app).post('/api/auth/register', { product: 'flow', businessName: 'Closed', ownerName: 'Owner', email: 'closed@flow.test', password: 'Flow-Pass-1234', currency: 'MVR' })).json().error.code).toBe('registration_closed');
  });
});
