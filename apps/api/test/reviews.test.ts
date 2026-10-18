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
  return c;
}

async function flowUser(name: string) {
  const c = new Client(env.app);
  const r = await c.post('/api/auth/register', { product: 'flow', businessName: name, ownerName: name, email: `${name.toLowerCase().replace(/\W/g, '')}@flow.test`, password: 'Flow-Pass-12345', currency: 'MVR' });
  expect(r.statusCode).toBe(201);
  return c;
}

describe('Reviews', () => {
  it('Super Admin asks Budget users: the popup shows, "later" hides it for days, answering ends it', async () => {
    const aisha = await budgetUser('Aisha Ali');
    const flow = await flowUser('Flow Shop');
    const sa = await superAdmin();
    expect((await aisha.get('/api/reviews/prompt')).json().request).toBeNull();

    const sent = await sa.post('/api/superadmin/review-requests', { product: 'budget', message: 'How is Gravity Budget for you?' });
    expect(sent.statusCode).toBe(201);
    const requestId = sent.json().id;

    // Budget users see it; Flow users do not.
    const prompt = (await aisha.get('/api/reviews/prompt')).json().request;
    expect(prompt).toMatchObject({ id: requestId, message: 'How is Gravity Budget for you?' });
    expect((await flow.get('/api/reviews/prompt')).json().request).toBeNull();

    // Later: gone for now, back after three days.
    expect((await aisha.post(`/api/reviews/prompt/${requestId}/later`)).statusCode).toBe(200);
    expect((await aisha.get('/api/reviews/prompt')).json().request).toBeNull();
    await env.db.execute(sql`UPDATE review_prompt_states SET remind_at = now() - interval '1 minute'`);
    expect((await aisha.get('/api/reviews/prompt')).json().request?.id).toBe(requestId);

    // Answer: five stars and words. The popup does not come back; a second answer is refused.
    expect((await aisha.post('/api/reviews', { rating: 5, comment: 'Very easy to use', requestId })).statusCode).toBe(201);
    expect((await aisha.get('/api/reviews/prompt')).json().request).toBeNull();
    expect((await aisha.post('/api/reviews', { rating: 4, requestId })).statusCode).toBe(409);
    // "Later" after answering does not reopen it.
    await aisha.post(`/api/reviews/prompt/${requestId}/later`);
    await env.db.execute(sql`UPDATE review_prompt_states SET remind_at = now() - interval '1 minute' WHERE remind_at IS NOT NULL`);
    expect((await aisha.get('/api/reviews/prompt')).json().request).toBeNull();

    const reqs = (await sa.get('/api/superadmin/review-requests')).json().items;
    expect(reqs[0]).toMatchObject({ id: requestId, product: 'budget', answered: 1, later: 0 });
  });

  it('a user writes a review on their own; Super Admin reads all reviews with the average', async () => {
    const aisha = await budgetUser('Aisha Ali');
    const flow = await flowUser('Flow Shop');
    expect((await aisha.post('/api/reviews', { rating: 4, comment: 'Good app' })).statusCode).toBe(201);
    expect((await flow.post('/api/reviews', { rating: 2 })).statusCode).toBe(201);
    expect((await flow.post('/api/reviews', { rating: 6 })).statusCode).toBe(422);
    expect((await aisha.get('/api/reviews/mine')).json().items).toHaveLength(1);

    const sa = await superAdmin();
    const all = (await sa.get('/api/superadmin/reviews')).json();
    expect(all.total).toBe(2);
    expect(all.summary).toMatchObject({ count: 2, average: 3 });
    expect(all.items.find((r: { product: string }) => r.product === 'budget')).toMatchObject({ businessName: 'Aisha Ali', userName: 'Aisha Ali', rating: 4, comment: 'Good app', asked: false });
    const budget = (await sa.get('/api/superadmin/reviews?product=budget')).json();
    expect(budget.total).toBe(1);
    expect(budget.summary.average).toBe(4);
    // Business users cannot read the reviews list.
    expect((await aisha.get('/api/superadmin/reviews')).statusCode).toBe(401);
  });

  it('a stopped request no longer pops up; accounts that started after the request are not asked', async () => {
    const sa = await superAdmin();
    const early = await budgetUser('Early User');
    const id = (await sa.post('/api/superadmin/review-requests', { product: null })).json().id;
    const late = await budgetUser('Late User');
    expect((await early.get('/api/reviews/prompt')).json().request?.id).toBe(id);
    expect((await late.get('/api/reviews/prompt')).json().request).toBeNull();
    expect((await sa.post(`/api/superadmin/review-requests/${id}/stop`)).statusCode).toBe(200);
    expect((await early.get('/api/reviews/prompt')).json().request).toBeNull();
    expect((await sa.post(`/api/superadmin/review-requests/${id}/stop`)).statusCode).toBe(404);
  });
});
