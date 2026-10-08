import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Client, createStaff, createSuperAdmin, createTestEnv, loginSuperAdmin, planId, resetDb, setupBusiness, type TestEnv } from './helpers';

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da6364f8ff1f0003030200efa6c8f00000000049454e44ae426082', 'hex');
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');

let env: TestEnv;
let sa: Client;
let biz: Awaited<ReturnType<typeof setupBusiness>>;
let owner: Client;

beforeAll(async () => {
  env = await createTestEnv();
});
afterAll(async () => env.close());
beforeEach(async () => {
  await resetDb(env.db);
  await createSuperAdmin(env.db);
  sa = await loginSuperAdmin(env);
  biz = await setupBusiness(env, sa, 'Billing Cafe', { plan: 'trial', type: 'cafe' });
  owner = biz.owner;
});

const endTrial = () => env.db.execute(sql`UPDATE subscriptions SET current_period_end = now() - interval '1 day' WHERE business_id = ${biz.businessId}`);
const slip = (c: Client, plan: string, months: number, body: Buffer = PNG, type = 'image/png') =>
  c.request('POST', `/api/billing/payments?planId=${plan}&months=${months}&reference=FT123`, body, { 'content-type': type });

describe('subscription billing: slip upload and review', () => {
  it('after the trial the business is blocked, pays by slip, the team rejects then approves, and the business is active again', async () => {
    await env.db.execute(sql`INSERT INTO platform_settings (key, value) VALUES ('billingBankDetails', '"BML 7730000012345 — OceanX Pvt Ltd"')`);
    const basic = await planId(sa, 'basic');
    const before = (await owner.get('/api/billing')).json();
    expect(before.subscription.effectiveStatus).toBe('trialing');
    expect(before.plans.map((p: { code: string }) => p.code)).toContain('basic');
    expect(before.plans.some((p: { code: string }) => p.code === 'trial')).toBe(false);

    const cashier = await createStaff(env, owner, 'cashier@billing.test', 'cashier');
    await endTrial();
    expect((await owner.get('/api/products')).statusCode).toBe(402);
    const blocked = (await owner.get('/api/billing')).json();
    expect(blocked.state).toBe('subscription_expired');
    expect(blocked.bankDetails).toContain('7730000012345');
    expect(blocked.canPay).toBe(true);

    // Staff cannot pay; the owner uploads the slip for 3 months of Basic.
    expect((await slip(cashier.client, basic, 3)).statusCode).toBe(403);
    expect((await slip(owner, basic, 2)).statusCode).toBe(422); // only 1, 3, 6 or 12 months
    expect((await slip(owner, basic, 3, Buffer.from('not a file'), 'image/png')).statusCode).toBe(422);
    const first = await slip(owner, basic, 3);
    expect(first.statusCode).toBe(201);
    expect((await slip(owner, basic, 3)).statusCode).toBe(409); // one pending at a time
    const mine = (await owner.get('/api/billing')).json().payments[0];
    expect(mine).toMatchObject({ status: 'pending', months: 3, currency: 'USD', hasSlip: true, reference: 'FT123' });
    expect(mine.amount).toBe(3 * 2900);

    // The team sees it, opens the slip, and rejects it with a reason.
    const pending = (await sa.get('/api/superadmin/billing/payments?status=pending')).json().items;
    expect(pending).toHaveLength(1);
    expect(pending[0].businessName).toBe('Billing Cafe');
    const file = await sa.get(`/api/superadmin/billing/payments/${pending[0].id}/slip`);
    expect(file.statusCode).toBe(200);
    expect(file.headers['content-type']).toContain('image/png');
    expect((await sa.post(`/api/superadmin/billing/payments/${pending[0].id}/reject`, { note: '' })).statusCode).toBe(422);
    expect((await sa.post(`/api/superadmin/billing/payments/${pending[0].id}/reject`, { note: 'Amount not received yet' })).json().status).toBe('rejected');
    expect((await owner.get('/api/products')).statusCode).toBe(402);
    expect((await owner.get('/api/billing')).json().payments[0]).toMatchObject({ status: 'rejected', reviewNote: 'Amount not received yet' });

    // A new slip (PDF this time) is approved: the business is active on Basic for 3 more months.
    const second = (await slip(owner, basic, 3, PDF, 'application/pdf')).json();
    const approved = (await sa.post(`/api/superadmin/billing/payments/${second.id}/approve`, {})).json();
    expect(approved.status).toBe('approved');
    expect(approved.receiptNumber).toMatch(/^OXR-\d{4}-00001$/);
    expect((await sa.post(`/api/superadmin/billing/payments/${second.id}/approve`, {})).json().error.code).toBe('invalid_status_transition');
    expect((await owner.get('/api/products')).statusCode).toBe(200);
    const after = (await owner.get('/api/billing')).json();
    expect(after.subscription).toMatchObject({ planCode: 'basic', effectiveStatus: 'active' });
    expect(after.subscription.daysLeft).toBeGreaterThanOrEqual(88);
    expect(after.subscription.daysLeft).toBeLessThanOrEqual(93);
    const summary = (await sa.get('/api/superadmin/billing/summary')).json();
    expect(summary.pending).toBe(0);
    expect(summary.receivedThisMonth).toEqual([{ currency: 'USD', total: 8700, count: 1 }]);
  });

  it('the team records a cash payment directly; paying before the end adds to the remaining time', async () => {
    const pro = await planId(sa, 'pro');
    const end0 = new Date((await owner.get('/api/billing')).json().subscription.currentPeriodEnd);
    const r = await sa.post(`/api/superadmin/businesses/${biz.businessId}/billing/payments`, { planId: pro, months: 1, method: 'cash', reference: 'Collected by Ali' });
    expect(r.statusCode).toBe(201);
    expect(r.json()).toMatchObject({ status: 'approved', method: 'cash', amount: 5900 });
    const sub = (await owner.get('/api/billing')).json().subscription;
    expect(sub.planCode).toBe('pro');
    // Starts from the end of the trial, not from today.
    expect(new Date(sub.currentPeriodEnd).getTime()).toBeGreaterThan(end0.getTime() + 27 * 86_400_000);
    // The free trial plan cannot be "bought".
    const trial = await planId(sa, 'trial');
    expect((await sa.post(`/api/superadmin/businesses/${biz.businessId}/billing/payments`, { planId: trial, months: 1, method: 'cash' })).statusCode).toBe(422);
  });

  it('a business cannot see another business slip; staff cannot see billing slips of others', async () => {
    const basic = await planId(sa, 'basic');
    const id = (await slip(owner, basic, 1)).json().id;
    const other = await setupBusiness(env, sa, 'Other Cafe');
    expect((await other.owner.get(`/api/billing/payments/${id}/slip`)).statusCode).toBe(404);
    expect((await other.owner.get('/api/billing')).json().payments).toHaveLength(0);
    expect((await owner.get(`/api/billing/payments/${id}/slip`)).statusCode).toBe(200);
    expect((await owner.get(`/api/superadmin/billing/payments`)).statusCode).toBe(401);
  });
});
