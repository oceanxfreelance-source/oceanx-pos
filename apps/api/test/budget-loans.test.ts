import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Client, createSuperAdmin, createTestEnv, resetDb, SA_PASSWORD, type TestEnv } from './helpers';

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

const TODAY = '2026-10-21';

describe('Gravity Budget loans', () => {
  it('only for accounts Super Admin turned it on for, or for everyone', async () => {
    const demo = await budgetUser('Demo Person');
    const other = await budgetUser('Other Person');
    expect((await demo.c.get('/api/auth/session')).json().features).toEqual([]);
    expect((await demo.c.get('/api/budget/loans')).statusCode).toBe(403);

    const sa = await superAdmin();
    expect((await sa.post(`/api/superadmin/businesses/${demo.id}/features`, { feature: 'loans', on: true })).json().betaFeatures).toEqual(['loans']);
    expect((await demo.c.get('/api/auth/session')).json().features).toEqual(['loans']);
    expect((await demo.c.get('/api/budget/loans')).statusCode).toBe(200);
    expect((await other.c.get('/api/budget/loans')).statusCode).toBe(403);

    // For everyone.
    await sa.patch('/api/superadmin/settings', { budgetLoansForAll: true });
    expect((await other.c.get('/api/budget/loans')).statusCode).toBe(200);
    await sa.patch('/api/superadmin/settings', { budgetLoansForAll: false });
    expect((await other.c.get('/api/budget/loans')).statusCode).toBe(403);
    // Off again for the demo account.
    await sa.post(`/api/superadmin/businesses/${demo.id}/features`, { feature: 'loans', on: false });
    expect((await demo.c.get('/api/budget/loans')).statusCode).toBe(403);

    // Not for other apps.
    const flow = new Client(env.app);
    const f = await flow.post('/api/auth/register', { product: 'flow', businessName: 'Flow Shop', ownerName: 'Flow', email: 'flow@flow.test', password: 'Flow-Pass-12345', currency: 'MVR' });
    expect((await sa.post(`/api/superadmin/businesses/${f.json().business.id}/features`, { feature: 'loans', on: true })).statusCode).toBe(422);
  });

  it('gave and took, many loans per person, paid back bit by bit, fully paid; spending is not changed', async () => {
    const { c, id } = await budgetUser('Aminath Ali');
    const sa = await superAdmin();
    await sa.post(`/api/superadmin/businesses/${id}/features`, { feature: 'loans', on: true });

    const first = await c.post('/api/budget/loans', { side: 'gave', name: 'Ali', phone: '7771234', amount: '500', occurredOn: '2026-10-05', dueOn: '2026-10-30', note: 'ferry ticket' });
    expect(first.statusCode).toBe(201);
    const ali = first.json().personId;
    // The same name again is the same person: loans add up.
    expect((await c.post('/api/budget/loans', { side: 'gave', name: 'ali', amount: '200', occurredOn: '2026-10-12' })).json().personId).toBe(ali);
    await c.post('/api/budget/loans', { side: 'took', name: 'Ibrahim', amount: '1500', occurredOn: '2026-10-01' });
    // Large amounts are fine.
    await c.post('/api/budget/loans', { side: 'gave', name: 'Hassan', amount: '25000', occurredOn: '2026-09-12' });

    let list = (await c.get('/api/budget/loans')).json();
    expect(list.owesMe).toBe(2_570_000);
    expect(list.iOwe).toBe(150_000);
    expect(list.people.find((p: { id: string }) => p.id === ali)).toMatchObject({ owesMe: 70_000, gaveCount: 2, gaveDue: '2026-10-30' });

    // Ali pays back 400; more than owed is refused.
    expect((await c.post(`/api/budget/loans/people/${ali}/payments`, { side: 'gave', amount: '400', occurredOn: '2026-10-18' })).json().left).toBe(30_000);
    expect((await c.post(`/api/budget/loans/people/${ali}/payments`, { side: 'gave', amount: '400', occurredOn: '2026-10-19' })).statusCode).toBe(422);
    const detail = (await c.get(`/api/budget/loans/people/${ali}`)).json();
    expect(detail.person.owesMe).toBe(30_000);
    expect(detail.entries.map((e: { kind: string }) => e.kind)).toEqual(['received', 'gave', 'gave']);

    // Fully paid.
    expect((await c.post(`/api/budget/loans/people/${ali}/payments`, { side: 'gave', all: true, occurredOn: '2026-10-20' })).json().left).toBe(0);
    list = (await c.get('/api/budget/loans')).json();
    expect(list.people.find((p: { id: string }) => p.id === ali)).toMatchObject({ owesMe: 0, gaveDue: null });
    expect((await c.post(`/api/budget/loans/people/${ali}/payments`, { side: 'gave', all: true, occurredOn: '2026-10-20' })).statusCode).toBe(409);

    // Loans do not change spending or income.
    const ov = (await c.get('/api/budget/overview?month=2026-10')).json();
    expect(ov.totals).toMatchObject({ spent: 0, income: 0 });
  });

  it('reminds on salary day (the 30th) and on return dates, for money to collect and to give back', async () => {
    const { c, id } = await budgetUser('Reminder Person');
    const sa = await superAdmin();
    await sa.post(`/api/superadmin/businesses/${id}/features`, { feature: 'loans', on: true });
    const today = (await c.get('/api/budget/loans')).json().today as string;
    const ahead = (d: number) => new Date(Date.parse(today) + d * 86_400_000).toISOString().slice(0, 10);
    await c.post('/api/budget/loans', { side: 'gave', name: 'Ali', amount: '300', occurredOn: today, dueOn: today });
    await c.post('/api/budget/loans', { side: 'took', name: 'Aminath', amount: '200', occurredOn: today, dueOn: ahead(40) });
    const r = (await c.get('/api/budget/loans/reminder')).json();
    expect(r.collect.map((p: { name: string }) => p.name)).toEqual(['Ali']);
    if (r.salaryDay) expect(r.giveBack.map((p: { name: string }) => p.name)).toEqual(['Aminath']);
    else expect(r.giveBack).toEqual([]);

    // Another account cannot see or change these loans.
    const other = await budgetUser('Other Person');
    await sa.post(`/api/superadmin/businesses/${other.id}/features`, { feature: 'loans', on: true });
    const aliId = (await c.get('/api/budget/loans')).json().people.find((p: { name: string }) => p.name === 'Ali').id;
    expect((await other.c.get(`/api/budget/loans/people/${aliId}`)).statusCode).toBe(404);
    expect((await other.c.post(`/api/budget/loans/people/${aliId}/payments`, { side: 'gave', all: true, occurredOn: today })).statusCode).toBe(404);
    expect(TODAY).toBeTruthy();
  });

  it('removes a mistaken entry or a whole person', async () => {
    const { c, id } = await budgetUser('Mistake Person');
    const sa = await superAdmin();
    await sa.post(`/api/superadmin/businesses/${id}/features`, { feature: 'loans', on: true });
    const a = (await c.post('/api/budget/loans', { side: 'gave', name: 'Ali', amount: '300', occurredOn: TODAY })).json();
    expect((await c.request('DELETE', `/api/budget/loans/entries/${a.id}`)).statusCode).toBe(200);
    expect((await c.get('/api/budget/loans')).json().owesMe).toBe(0);
    expect((await c.request('DELETE', `/api/budget/loans/people/${a.personId}`)).statusCode).toBe(200);
    expect((await c.get('/api/budget/loans')).json().people).toEqual([]);
    const rows = (await env.db.execute(sql`SELECT count(*)::int AS n FROM budget_loan_entries`)).rows as { n: number }[];
    expect(rows[0]?.n).toBe(0);
  });
});
