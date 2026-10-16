import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Client, createSuperAdmin, createTestEnv, loginSuperAdmin, resetDb, type TestEnv } from './helpers';

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
});

async function budgetAccount(name: string) {
  const c = new Client(env.app);
  const res = await c.post('/api/auth/register', { product: 'budget', businessName: name, ownerName: name, email: `${name.toLowerCase().replace(/\W/g, '')}@budget.test`, password: 'Budget-Pass-1234', currency: 'MVR' });
  expect(res.statusCode).toBe(201);
  return { c, session: res.json() };
}

const today = () => new Date().toISOString().slice(0, 10);
const month = () => today().slice(0, 7);

async function setUp(c: Client) {
  const res = await c.post('/api/budget/setup', {
    categories: [
      { kind: 'income', name: 'Salary', emoji: '💼' },
      { kind: 'expense', name: 'Food', emoji: '🛒', monthlyLimit: '3000' },
      { kind: 'expense', name: 'Eating out', emoji: '☕', monthlyLimit: '500' },
      { kind: 'expense', name: 'Rent', emoji: '🏠' },
    ],
  });
  expect(res.statusCode).toBe(200);
  const cats = (await c.get('/api/budget/categories')).json().items as { id: string; name: string; kind: string }[];
  return Object.fromEntries(cats.map((x) => [x.name, x.id])) as Record<string, string>;
}

describe('Gravity Budget (personal budgets, bills, goals)', () => {
  it('signs up at once on its own plan: MVR 50 a month, 24-hour trial, budget only', async () => {
    const { c, session } = await budgetAccount('Aishath Ali');
    expect(session.business.product).toBe('budget');
    expect(session.business.status).toBe('active');
    expect(session.subscription).toMatchObject({ planCode: 'budget', effectiveStatus: 'trialing' });
    const left = new Date(session.subscription.currentPeriodEnd).getTime() - Date.now();
    expect(left).toBeGreaterThan(23 * 3600_000);
    expect(left).toBeLessThanOrEqual(24 * 3600_000 + 60_000);
    expect([...session.modules].sort()).toEqual(['budget', 'dashboard', 'settings']);
    expect((await c.get('/api/finance/categories')).statusCode).toBe(403);
    expect((await c.get('/api/quotations')).statusCode).toBe(403);
    const plan = (await sa.get('/api/superadmin/budget/plan')).json();
    expect(plan).toMatchObject({ name: 'Gravity Budget', priceMonthly: '50.00', currency: 'MVR', trialMinutes: 1440, accounts: 1 });
    // Super Admin can change the price.
    expect((await sa.put('/api/superadmin/budget/plan', { priceMonthly: 45, trialMinutes: 1440 })).statusCode).toBe(200);
    expect((await sa.get('/api/superadmin/budget/plan')).json().priceMonthly).toBe('45.00');
    expect((await sa.get('/api/superadmin/businesses?product=budget')).json().items.map((b: { name: string }) => b.name)).toEqual(['Aishath Ali']);
  });

  it('a POS business never gets the budget module', async () => {
    const c = new Client(env.app);
    await sa.patch('/api/superadmin/settings', { registrationMode: 'open' });
    const res = await c.post('/api/auth/register', { businessName: 'Cafe', ownerName: 'Owner', email: 'cafe@budget.test', password: 'Cafe-Pass-1234', businessType: 'cafe', currency: 'MVR' });
    expect(res.statusCode).toBe(201);
    expect(res.json().modules).not.toContain('budget');
    expect((await c.get('/api/budget/overview')).statusCode).toBe(403);
  });

  it('set-up once, then where the money went: limits, left, safe per day and advice', async () => {
    const { c } = await budgetAccount('Hassan');
    expect((await c.get('/api/budget/overview')).json().setUp).toBe(false);
    const cat = await setUp(c);
    // A second set-up does nothing.
    expect((await c.post('/api/budget/setup', { categories: [{ kind: 'expense', name: 'X' }] })).json().created).toBe(0);
    const d = today();
    await c.post('/api/budget/entries', { kind: 'income', amount: '10000', occurredOn: d, categoryId: cat.Salary });
    await c.post('/api/budget/entries', { kind: 'expense', amount: '2600.50', occurredOn: d, categoryId: cat.Food, paidWith: 'card' });
    await c.post('/api/budget/entries', { kind: 'expense', amount: '650', occurredOn: d, categoryId: cat['Eating out'] });
    await c.post('/api/budget/entries', { kind: 'expense', amount: '100', occurredOn: d, note: 'Gift' });
    const o = (await c.get('/api/budget/overview')).json();
    expect(o.setUp).toBe(true);
    expect(o.totals).toMatchObject({ income: 1_000_000, spent: 335_050, saved: 0, left: 664_950, budgeted: 350_000 });
    const food = o.categories.find((x: { name: string }) => x.name === 'Food');
    expect(food).toMatchObject({ limit: 300_000, spent: 260_050, left: 39_950 });
    expect(o.other.spent).toBe(10_000);
    expect(o.paidWith).toEqual(expect.arrayContaining([{ paidWith: 'card', total: 260_050 }]));
    const codes = o.insights.map((i: { code: string }) => i.code);
    expect(codes).toContain('over_limit'); // eating out 650 of 500
    expect(codes).toContain('near_limit'); // food 87%
    expect(o.insights.find((i: { code: string }) => i.code === 'over_limit').params).toMatchObject({ name: 'Eating out', amount: 15_000 });
    expect(o.safePerDay).toBe(Math.floor(664_950 / o.daysLeft));
    // Wrong kind of category is refused.
    expect((await c.post('/api/budget/entries', { kind: 'income', amount: '1', occurredOn: d, categoryId: cat.Food })).statusCode).toBe(422);
    // Limit can be changed or removed.
    expect((await c.patch(`/api/budget/categories/${cat['Eating out']}`, { monthlyLimit: '' })).json().monthlyLimit).toBeNull();
    expect((await c.patch(`/api/budget/categories/${cat.Food}`, { name: 'Groceries' })).json().monthlyLimit).toBe(300_000);
  });

  it('bills: due this month, paid once (as spending), and counted before the safe daily amount', async () => {
    const { c } = await budgetAccount('Mariyam');
    const cat = await setUp(c);
    await c.post('/api/budget/entries', { kind: 'income', amount: '9000', occurredOn: today(), categoryId: cat.Salary });
    const bill = (await c.post('/api/budget/bills', { name: 'Rent', amount: '6000', dueDay: 31, categoryId: cat.Rent })).json();
    let o = (await c.get('/api/budget/overview')).json();
    expect(o.bills[0]).toMatchObject({ name: 'Rent', paid: false });
    expect(o.totals.billsUnpaid).toBe(600_000);
    expect(o.safePerDay).toBe(Math.floor(300_000 / o.daysLeft));
    // Pay it (this month's amount was different).
    expect((await c.post(`/api/budget/bills/${bill.id}/pay`, { amount: '5800' })).statusCode).toBe(201);
    expect((await c.post(`/api/budget/bills/${bill.id}/pay`, {})).statusCode).toBe(409);
    o = (await c.get('/api/budget/overview')).json();
    expect(o.bills[0]).toMatchObject({ paid: true, paidAmount: 580_000 });
    expect(o.totals).toMatchObject({ spent: 580_000, billsUnpaid: 0 });
    expect(o.categories.find((x: { name: string }) => x.name === 'Rent').spent).toBe(580_000);
    // Undo: delete the spending record and the bill is unpaid again.
    await c.delete(`/api/budget/entries/${o.bills[0].entryId}`);
    expect((await c.get('/api/budget/overview')).json().bills[0].paid).toBe(false);
  });

  it('goals: put money in and take it out; monthly saving needed; saved money is not money left', async () => {
    const { c } = await budgetAccount('Ibrahim');
    const cat = await setUp(c);
    await c.post('/api/budget/entries', { kind: 'income', amount: '12000', occurredOn: today(), categoryId: cat.Salary });
    const [y, m] = month().split('-').map(Number) as [number, number];
    const due = new Date(Date.UTC(y, m - 1 + 5, 28)).toISOString().slice(0, 10); // within the 6th month from now
    const goal = (await c.post('/api/budget/goals', { name: 'New phone', emoji: '📱', target: '12000', targetDate: due })).json();
    expect((await c.post(`/api/budget/goals/${goal.id}/moves`, { direction: 'add', amount: '2500' })).statusCode).toBe(201);
    expect((await c.post(`/api/budget/goals/${goal.id}/moves`, { direction: 'take', amount: '500' })).statusCode).toBe(201);
    expect((await c.post(`/api/budget/goals/${goal.id}/moves`, { direction: 'take', amount: '5000' })).statusCode).toBe(422);
    const g = (await c.get('/api/budget/goals')).json().items[0];
    expect(g).toMatchObject({ saved: 200_000, remaining: 1_000_000, percent: 16, done: false, thisMonth: 200_000, monthsLeft: 6 });
    expect(g.perMonth).toBe(Math.ceil((1_000_000 + 200_000) / 6));
    const o = (await c.get('/api/budget/overview')).json();
    expect(o.totals).toMatchObject({ income: 1_200_000, saved: 200_000, left: 1_000_000 });
    expect(o.insights.map((i: { code: string }) => i.code)).toContain('saved');
    const months = (await c.get('/api/budget/months?count=3')).json().items;
    expect(months[2]).toMatchObject({ month: month(), income: 1_200_000, saved: 200_000, left: 1_000_000 });
    // The printable month has everything in it.
    const r = (await c.get('/api/budget/report')).json();
    expect(r.entries).toHaveLength(1);
    expect(r.goals).toHaveLength(1);
    expect(r.person.name).toBe('Ibrahim');
  });

  it('accounts never see each other', async () => {
    const a = await budgetAccount('Person A');
    const b = await budgetAccount('Person B');
    const catA = await setUp(a.c);
    const e = (await a.c.post('/api/budget/entries', { kind: 'expense', amount: '10', occurredOn: today(), categoryId: catA.Food })).json();
    const goal = (await a.c.post('/api/budget/goals', { name: 'Trip', target: '1000' })).json();
    expect((await b.c.get('/api/budget/entries')).json().total).toBe(0);
    expect((await b.c.put(`/api/budget/entries/${e.id}`, { kind: 'expense', amount: '1', occurredOn: today() })).statusCode).toBe(404);
    expect((await b.c.post(`/api/budget/goals/${goal.id}/moves`, { direction: 'add', amount: '1' })).statusCode).toBe(404);
    expect((await b.c.post('/api/budget/entries', { kind: 'expense', amount: '1', occurredOn: today(), categoryId: catA.Food })).statusCode).toBe(422);
  });
  it('set-up categories keep their key (shown in any language) until renamed', async () => {
    const { c } = await budgetAccount('Key Person');
    await c.post('/api/budget/setup', { categories: [{ kind: 'expense', key: 'food', name: 'Food & groceries', monthlyLimit: '100' }, { kind: 'income', key: 'salary', name: 'Salary' }] });
    let cats = (await c.get('/api/budget/categories')).json().items as { id: string; key: string | null; name: string }[];
    const food = cats.find((x) => x.name === 'Food & groceries')!;
    expect(food.key).toBe('food');
    await c.post('/api/budget/entries', { kind: 'expense', amount: '150', occurredOn: today(), categoryId: food.id });
    const o = (await c.get('/api/budget/overview')).json();
    expect(o.categories[0]).toMatchObject({ key: 'food' });
    expect(o.insights.find((i: { code: string }) => i.code === 'over_limit').params).toMatchObject({ nameKey: 'food' });
    expect((await c.get('/api/budget/entries')).json().items[0].categoryKey).toBe('food');
    // Changing only the limit keeps the key; a new name drops it.
    await c.patch(`/api/budget/categories/${food.id}`, { monthlyLimit: '200' });
    await c.patch(`/api/budget/categories/${food.id}`, { name: 'Food & groceries' });
    expect((await c.get('/api/budget/categories')).json().items.find((x: { id: string }) => x.id === food.id).key).toBe('food');
    await c.patch(`/api/budget/categories/${food.id}`, { name: 'Groceries' });
    cats = (await c.get('/api/budget/categories')).json().items;
    expect(cats.find((x) => x.id === food.id)).toMatchObject({ name: 'Groceries', key: null });
  });
});
