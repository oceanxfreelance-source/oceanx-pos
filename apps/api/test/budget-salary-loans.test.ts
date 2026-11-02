import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Client, createTestEnv, resetDb, type TestEnv } from './helpers';

let env: TestEnv;
beforeAll(async () => {
  env = await createTestEnv();
});
afterAll(async () => env.close());
beforeEach(async () => resetDb(env.db));

async function account(email: string) {
  const c = new Client(env.app);
  const r = await c.post('/api/auth/register', { product: 'budget', businessName: 'Me', ownerName: 'Aminath', email, password: 'Budget-Pass-1234', currency: 'MVR' });
  expect(r.statusCode).toBe(201);
  await c.post('/api/budget/setup', {
    categories: [
      { kind: 'income', key: 'salary', name: 'Salary', emoji: '💼' },
      { kind: 'income', key: 'side_income', name: 'Side income', emoji: '🧰' },
      { kind: 'expense', key: 'food', name: 'Food', emoji: '🛒', monthlyLimit: '3000' },
      { kind: 'expense', key: 'loans', name: 'Loans & card payments', emoji: '💳' },
    ],
  });
  const cats = (await c.get('/api/budget/categories')).json().items as { id: string; key: string }[];
  return { c, cat: Object.fromEntries(cats.map((x) => [x.key, x.id])) as Record<string, string>, session: r.json() };
}

describe('Gravity Budget: loan repayment cut from the salary', () => {
  it('is off until the person turns it on; then each salary cuts the monthly repayment, once a month, until paid', async () => {
    const { c, cat, session } = await account('loanpay@budget.test');
    expect(session.budgetSalaryLoans).toBe(false);
    // Off: salary is just income.
    const before = (await c.post('/api/budget/entries', { kind: 'income', amount: '15000', occurredOn: '2026-09-28', categoryId: cat.salary })).json();
    expect(before.loanCuts).toEqual([]);

    expect((await c.post('/api/budget/salary-loans/switch', { on: true })).json()).toEqual({ on: true });
    expect((await c.get('/api/auth/session')).json().budgetSalaryLoans).toBe(true);
    // Amounts must be positive.
    expect((await c.post('/api/budget/salary-loans', { name: 'BML loan', owed: '0', monthly: '3000' })).statusCode).toBe(422);
    const loan = (await c.post('/api/budget/salary-loans', { name: 'BML loan', owed: '7000', monthly: '3000' })).json();
    expect(loan).toMatchObject({ name: 'BML loan', amountDue: 700000, monthlyAmount: 300000, remaining: 700000, monthsLeft: 3 });

    // October salary: 3,000 cut, written as loan spending linked to the salary.
    const oct = (await c.post('/api/budget/entries', { kind: 'income', amount: '15000', occurredOn: '2026-10-28', categoryId: cat.salary })).json();
    expect(oct.loanCuts).toEqual([{ loanId: loan.id, name: 'BML loan', amount: 300000, remaining: 400000 }]);
    const octOut = (await c.get('/api/budget/entries?month=2026-10&kind=expense')).json().items;
    expect(octOut).toHaveLength(1);
    expect(octOut[0]).toMatchObject({ amount: 300000, categoryId: cat.loans, note: 'BML loan' });
    // A second income the same month (side job) cuts nothing; nor does a second salary.
    expect((await c.post('/api/budget/entries', { kind: 'income', amount: '2000', occurredOn: '2026-10-29', categoryId: cat.side_income })).json().loanCuts).toEqual([]);
    expect((await c.post('/api/budget/entries', { kind: 'income', amount: '500', occurredOn: '2026-10-30', categoryId: cat.salary })).json().loanCuts).toEqual([]);

    // November: another 3,000; December: only the 1,000 still owed; then nothing.
    expect((await c.post('/api/budget/entries', { kind: 'income', amount: '15000', occurredOn: '2026-11-28', categoryId: cat.salary })).json().loanCuts[0]).toMatchObject({ amount: 300000, remaining: 100000 });
    const dec = (await c.post('/api/budget/entries', { kind: 'income', amount: '15000', occurredOn: '2026-12-28', categoryId: cat.salary })).json();
    expect(dec.loanCuts[0]).toMatchObject({ amount: 100000, remaining: 0 });
    expect((await c.post('/api/budget/entries', { kind: 'income', amount: '15000', occurredOn: '2027-01-28', categoryId: cat.salary })).json().loanCuts).toEqual([]);
    expect((await c.get('/api/budget/salary-loans')).json().items[0]).toMatchObject({ paid: 700000, remaining: 0, monthsLeft: 0 });

    // Deleting December's salary takes its repayment away: 1,000 is owed again.
    expect((await c.delete(`/api/budget/entries/${dec.id}`)).statusCode).toBe(200);
    expect((await c.get('/api/budget/salary-loans')).json().items[0]).toMatchObject({ remaining: 100000 });
  });

  it('changes what is owed, stops when turned off, can be asked for any income, and is private to the account', async () => {
    const { c, cat } = await account('loanpay2@budget.test');
    await c.post('/api/budget/salary-loans/switch', { on: true });
    const card = (await c.post('/api/budget/salary-loans', { name: 'Credit card', owed: '5000', monthly: '1000' })).json();
    const car = (await c.post('/api/budget/salary-loans', { name: 'Car loan', owed: '60000', monthly: '4500' })).json();
    expect((await c.get('/api/budget/salary-loans')).json()).toMatchObject({ on: true, monthlyTotal: 550000 });
    // Two loans: two repayments.
    const s1 = (await c.post('/api/budget/entries', { kind: 'income', amount: '20000', occurredOn: '2026-10-28', categoryId: cat.salary })).json();
    expect(s1.loanCuts.map((x: { amount: number }) => x.amount).sort()).toEqual([100000, 450000]);
    // "Still owed now" is set to 2,000 for the card: past repayments stay counted.
    expect((await c.put(`/api/budget/salary-loans/${card.id}`, { name: 'Credit card', owed: '2000', monthly: '1000' })).json()).toMatchObject({ remaining: 200000, paid: 100000 });
    // A paused loan is skipped.
    await c.put(`/api/budget/salary-loans/${car.id}`, { name: 'Car loan', owed: '55500', monthly: '4500', isActive: false });
    // Income without the Salary category cuts only when asked.
    expect((await c.post('/api/budget/entries', { kind: 'income', amount: '9000', occurredOn: '2026-11-05', categoryId: cat.side_income })).json().loanCuts).toEqual([]);
    expect((await c.post('/api/budget/entries', { kind: 'income', amount: '9000', occurredOn: '2026-11-06', categoryId: cat.side_income, cutLoans: true })).json().loanCuts).toEqual([
      { loanId: card.id, name: 'Credit card', amount: 100000, remaining: 100000 },
    ]);
    // Turned off: salary is just income again.
    await c.post('/api/budget/salary-loans/switch', { on: false });
    expect((await c.post('/api/budget/entries', { kind: 'income', amount: '20000', occurredOn: '2026-12-28', categoryId: cat.salary })).json().loanCuts).toEqual([]);

    const other = await account('other-loan@budget.test');
    expect((await other.c.get('/api/budget/salary-loans')).json().items).toEqual([]);
    expect((await other.c.put(`/api/budget/salary-loans/${card.id}`, { name: 'x', owed: '1', monthly: '1' })).statusCode).toBe(404);
    expect((await other.c.delete(`/api/budget/salary-loans/${card.id}`)).statusCode).toBe(404);
  });
});
