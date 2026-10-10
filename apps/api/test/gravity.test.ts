import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { appUrlFor } from '../src/config';
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

const signup = { product: 'gravity', businessName: 'Aisha Designs', ownerName: 'Aisha Ibrahim', email: 'aisha@gravity.test', password: 'Gravity-Pass-123', currency: 'MVR' };

describe('Gravity (quotation & invoice generator)', () => {
  it('a freelancer signs up for Gravity and gets only customers, quotations and invoices', async () => {
    const c = new Client(env.app);
    const res = await c.post('/api/auth/register', signup);
    expect(res.statusCode).toBe(201);
    const s = res.json();
    expect(s.state).toBe('ok');
    expect(s.business.product).toBe('gravity');
    expect(s.subscription.planCode).toBe('gravity_trial');
    expect([...s.modules].sort()).toEqual(['customers', 'dashboard', 'invoices', 'quotations', 'settings']);
    // One person: no team, roles or activity log.
    expect((await c.get('/api/users')).statusCode).toBe(403);
    expect(s.addons).toEqual([]);
    // No POS, product catalogue or add-ons.
    expect((await c.get('/api/products')).statusCode).toBe(403);
    expect((await c.get('/api/sales')).statusCode).toBe(403);
    // Only Gravity's paid plans can be bought.
    const billing = (await c.get('/api/billing')).json();
    expect(billing.plans.map((p: { code: string }) => p.code)).toEqual(['gravity_pro']);
    const posPlan = (await sa.get('/api/superadmin/plans?product=pos')).json().items.find((p: { code: string }) => p.code === 'pro');
    expect((await c.request('POST', `/api/billing/payments?planId=${posPlan.id}&months=1`, Buffer.from('x'), { 'content-type': 'image/png' })).json().error.code).toBe('validation_failed');

    // Super Admin: Gravity accounts are listed apart from POS businesses; plans stay within the product.
    expect((await sa.get('/api/superadmin/businesses')).json().items.some((b: { name: string }) => b.name === 'Aisha Designs')).toBe(false);
    const accounts = (await sa.get('/api/superadmin/businesses?product=gravity')).json().items;
    expect(accounts.map((b: { name: string }) => b.name)).toEqual(['Aisha Designs']);
    expect((await sa.post(`/api/superadmin/businesses/${accounts[0].id}/subscription/change-plan`, { planId: posPlan.id, status: 'active' })).json().error.code).toBe('validation_failed');
    const ventures = (await sa.get('/api/superadmin/hub/ventures')).json().items;
    expect(ventures.find((v: { kind: string }) => v.kind === 'gravity')).toMatchObject({ name: 'Gravity', accountsActive: 1 });
    expect((await sa.get('/api/superadmin/hub/overview')).json().gravityAccountsActive).toBe(1);
  });

  it('typed lines → quotation → accepted → invoice → issued; who owes how much; payment details printed', async () => {
    const c = new Client(env.app);
    await c.post('/api/auth/register', signup);
    const settings = (await c.get('/api/settings')).json();
    const pay = await c.patch('/api/settings/invoice', { ...settings.sections.invoice, paymentDetails: 'BML 7730000123456\nAisha Ibrahim' });
    expect(pay.statusCode).toBe(200);

    const cust = (await c.post('/api/customers', { name: 'Male City Council', kind: 'government', company: 'Male City Council' })).json();
    const q = (
      await c.post('/api/quotations', {
        customerId: cust.id,
        quotationDate: '2026-10-10',
        validUntil: '2099-12-31',
        language: 'dv',
        items: [
          { name: 'Logo design', quantity: 1, unitPrice: 1500 },
          { name: 'Business cards (box)', quantity: 2, unitPrice: 250 },
        ],
      })
    ).json();
    expect(q.total).toBe(200000);
    expect((await c.post(`/api/quotations/${q.id}/accept`)).statusCode).toBe(200);
    const inv = (await c.post(`/api/quotations/${q.id}/convert`)).json();
    expect((await c.post(`/api/invoices/${inv.id}/issue`)).statusCode).toBe(200);
    await c.post(`/api/invoices/${inv.id}/payments`, { method: 'bank_transfer', amount: 500 });

    const owed = (await c.get('/api/invoices/outstanding')).json();
    expect(owed.total).toBe(150000);
    expect(owed.items[0]).toMatchObject({ customerName: 'Male City Council', invoices: 1, outstanding: 150000 });
    const detail = (await c.get(`/api/invoices/${inv.id}`)).json();
    expect(detail.settings.paymentDetails).toBe('BML 7730000123456\nAisha Ibrahim');
    expect(detail.documentLanguage).toBe('dv');
  });

  it('POS businesses are unchanged and never see Gravity plans', async () => {
    const { owner } = await setupBusiness(env, sa, 'Lagoon Cafe', { type: 'cafe' });
    const s = (await owner.get('/api/auth/session')).json();
    expect(s.business.product).toBe('pos');
    expect(s.modules).toContain('pos');
    const codes = (await owner.get('/api/billing')).json().plans.map((p: { code: string }) => p.code);
    expect(codes).not.toContain('gravity_pro');
    expect((await sa.get('/api/superadmin/plans?product=gravity')).json().items.map((p: { code: string }) => p.code).sort()).toEqual(['gravity_pro', 'gravity_trial']);
  });

  it('Gravity e-mails link to Gravity\'s own address when it has one', () => {
    const cfg = { APP_URL: 'https://pos.example', GRAVITY_APP_URL: 'https://gravity.example' };
    expect(appUrlFor(cfg, 'gravity')).toBe('https://gravity.example');
    expect(appUrlFor(cfg, 'pos')).toBe('https://pos.example');
    expect(appUrlFor({ APP_URL: 'https://pos.example' }, 'gravity')).toBe('https://pos.example');
  });
});
