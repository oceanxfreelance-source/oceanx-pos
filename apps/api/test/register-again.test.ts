import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Client, createSuperAdmin, createTestEnv, resetDb, SA_PASSWORD, type TestEnv } from './helpers';
import { deleteBusinessCompletely } from '../src/services/trialCleanup';

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

const register = (product: 'budget' | 'gravity' | 'flow', email: string) => {
  const c = new Client(env.app);
  return c.post('/api/auth/register', { product, businessName: 'Aisha', ownerName: 'Aisha', email, password: 'Budget-Pass-1234', currency: 'MVR' }).then((r) => ({ c, r }));
};
const endTrial = (id: string) => env.db.execute(sql`UPDATE subscriptions SET current_period_end = now() - interval '1 minute' WHERE business_id = ${id}`);

describe('Signing up again with the same email', () => {
  it('one active account per email: in its trial, the email cannot sign up again', async () => {
    const first = await register('budget', 'aisha@test.mv');
    expect(first.r.statusCode).toBe(201);
    const again = await register('budget', 'Aisha@Test.mv');
    expect(again.r.statusCode).toBe(409);
    expect(again.r.json().error.code).toBe('email_taken');
  });

  it('trial ended without paying: signing up again replaces the old account, with no new free trial', async () => {
    const first = await register('budget', 'aisha@test.mv');
    const oldId = first.r.json().business.id;
    expect(first.r.json().state).toBe('ok');
    await endTrial(oldId);
    const again = await register('budget', 'aisha@test.mv');
    expect(again.r.statusCode).toBe(201);
    expect(again.r.json().business.id).not.toBe(oldId);
    // No new trial: straight to paying.
    expect(again.r.json().state).toBe('subscription_expired');
    const rows = (await env.db.execute(sql`SELECT count(*)::int AS n FROM businesses WHERE id = ${oldId}`)).rows as { n: number }[];
    expect(rows[0]?.n).toBe(0);
    // They can pay and use it.
    const plan = (await again.c.get('/api/billing')).json().plans[0];
    expect((await again.c.request('POST', `/api/billing/payments?planId=${plan.id}&months=1&reference=BML1`, PNG, { 'content-type': 'image/png' })).statusCode).toBe(201);
  });

  it('account deleted after its trial: signing up again works, with no new free trial', async () => {
    const first = await register('gravity', 'ali@test.mv');
    await deleteBusinessCompletely(env.db, first.r.json().business.id, 'trial_not_renewed');
    const again = await register('gravity', 'ali@test.mv');
    expect(again.r.statusCode).toBe(201);
    expect(again.r.json().state).toBe('subscription_expired');
  });

  it('a paying account is never replaced, even after its paid month ends', async () => {
    const first = await register('flow', 'shop@test.mv');
    const id = first.r.json().business.id;
    const plan = (await first.c.get('/api/billing')).json().plans[0];
    await first.c.request('POST', `/api/billing/payments?planId=${plan.id}&months=1&reference=BML1`, PNG, { 'content-type': 'image/png' });
    const sa = new Client(env.app);
    await sa.post('/api/superadmin/auth/login', { email: 'root@platform.test', password: SA_PASSWORD });
    const pay = (await sa.get('/api/superadmin/billing/payments?status=pending')).json().items[0];
    await sa.post(`/api/superadmin/billing/payments/${pay.id}/approve`, {});
    await env.db.execute(sql`UPDATE subscriptions SET current_period_end = now() - interval '1 day' WHERE business_id = ${id}`);
    const again = await register('flow', 'shop@test.mv');
    expect(again.r.statusCode).toBe(409);
  });

  it('a new email gets the normal free trial; another app with the same email is separate', async () => {
    const r = await register('budget', 'new@test.mv');
    expect(r.r.json().state).toBe('ok');
    // The email is used by an active Budget account, so another app cannot use it (one login per email).
    expect((await register('flow', 'new@test.mv')).r.statusCode).toBe(409);
  });
});
