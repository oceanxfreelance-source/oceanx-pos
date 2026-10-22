import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Client, createTestEnv, resetDb, type TestEnv } from './helpers';

let env: TestEnv;
beforeAll(async () => {
  env = await createTestEnv();
});
afterAll(async () => env.close());
beforeEach(async () => {
  await resetDb(env.db);
});

async function budgetUser(name: string, extra: Record<string, unknown> = {}) {
  const c = new Client(env.app);
  const r = await c.post('/api/auth/register', { product: 'budget', businessName: name, ownerName: name, email: `${name.toLowerCase().replace(/\W/g, '')}@budget.test`, password: 'Budget-Pass-1234', currency: 'MVR', ...extra });
  expect(r.statusCode).toBe(201);
  return { c, session: r.json() };
}

describe('Gravity Budget dollars and savings', () => {
  it('Rf and $ keep their own budgets and totals, never mixed', async () => {
    const { c, session } = await budgetUser('Hawwa Rf And Dollars', { usdWallet: true });
    expect(session.budgetUsdWallet).toBe(true);
    await c.post('/api/budget/setup', { categories: [{ kind: 'expense', key: 'food', name: 'Food', monthlyLimit: '1000' }, { kind: 'income', key: 'salary', name: 'Salary' }] });
    const today = (await c.get('/api/budget/overview')).json().today as string;
    const cats = (await c.get('/api/budget/categories')).json().items as { id: string; kind: string; wallet: string; key: string | null }[];
    const usdShop = cats.find((x) => x.wallet === 'usd' && x.key === 'shopping')!;
    const mainExpense = cats.find((x) => x.wallet === 'main' && x.kind === 'expense')!;
    expect(usdShop).toBeTruthy();

    const r1 = await c.post('/api/budget/entries', { kind: 'expense', wallet: 'usd', amount: 25, categoryId: usdShop.id, occurredOn: today });
    expect(r1.statusCode, r1.body).toBe(201);
    expect((await c.post('/api/budget/entries', { kind: 'expense', amount: 100, categoryId: mainExpense.id, occurredOn: today })).statusCode).toBe(201);
    // A Rf category can't be used for dollars.
    expect((await c.post('/api/budget/entries', { kind: 'expense', wallet: 'usd', amount: 100, categoryId: mainExpense.id, occurredOn: today })).statusCode).toBe(422);

    const rf = (await c.get('/api/budget/overview')).json();
    const usd = (await c.get('/api/budget/overview?wallet=usd')).json();
    expect(rf.totals.spent).toBe(10000);
    expect(usd.totals.spent).toBe(2500);
    expect(usd.currency).toBe('USD');
    expect((await c.get('/api/budget/entries?wallet=usd')).json().items).toHaveLength(1);
    expect((await c.get('/api/budget/entries')).json().items).toHaveLength(1);
  });

  it('dollars only when turned on; turning on adds dollar categories once', async () => {
    const { c, session } = await budgetUser('Rf Only Person');
    expect(session.budgetUsdWallet).toBe(false);
    expect((await c.get('/api/budget/overview?wallet=usd')).statusCode).toBe(422);
    expect((await c.post('/api/budget/entries', { kind: 'expense', wallet: 'usd', amount: 100, occurredOn: '2026-10-01' })).statusCode).toBe(422);
    expect((await c.post('/api/budget/wallets', { usd: true })).json()).toEqual({ usd: true });
    await c.post('/api/budget/wallets', { usd: false });
    await c.post('/api/budget/wallets', { usd: true });
    const usdCats = (await c.get('/api/budget/categories')).json().items.filter((x: { wallet: string }) => x.wallet === 'usd');
    expect(usdCats).toHaveLength(6);
    expect((await c.get('/api/auth/session')).json().budgetUsdWallet).toBe(true);
    expect((await c.get('/api/budget/overview?wallet=usd')).statusCode).toBe(200);
  });

  it('My savings: no goal needed, one per money, can not take out more than saved', async () => {
    const { c } = await budgetUser('Saver Person', { usdWallet: true });
    expect((await c.post('/api/budget/savings/moves', { wallet: 'main', direction: 'add', amount: 500 })).statusCode).toBe(201);
    expect((await c.post('/api/budget/savings/moves', { wallet: 'main', direction: 'add', amount: 200 })).statusCode).toBe(201);
    expect((await c.post('/api/budget/savings/moves', { wallet: 'usd', direction: 'add', amount: 100 })).statusCode).toBe(201);
    expect((await c.post('/api/budget/savings/moves', { wallet: 'main', direction: 'take', amount: 800 })).statusCode).toBe(422);
    expect((await c.post('/api/budget/savings/moves', { wallet: 'main', direction: 'take', amount: 100 })).statusCode).toBe(201);

    const goals = (await c.get('/api/budget/goals')).json().items as { kind: string; wallet: string; saved: number; target: number | null; percent: number | null }[];
    const pots = goals.filter((g) => g.kind === 'savings');
    expect(pots).toHaveLength(2);
    expect(pots.find((g) => g.wallet === 'main')).toMatchObject({ saved: 60000, target: null, percent: null });
    expect(pots.find((g) => g.wallet === 'usd')).toMatchObject({ saved: 10000 });
    // Saved this month shows on each money's home.
    expect((await c.get('/api/budget/overview')).json().totals.saved).toBe(60000);
    expect((await c.get('/api/budget/overview?wallet=usd')).json().totals.saved).toBe(10000);
  });

  it('$ only: the whole app is in dollars', async () => {
    const { c, session } = await budgetUser('Dollar Only', { currency: 'USD' });
    expect(session.business.currency).toBe('USD');
    expect(session.budgetUsdWallet).toBe(false);
    expect((await c.get('/api/budget/overview')).json().currency).toBe('USD');
  });
});
