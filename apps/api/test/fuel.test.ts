import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Client, createSuperAdmin, createTestEnv, loginSuperAdmin, planId, resetDb, type TestEnv } from './helpers';

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

describe('Theyo Fihaara (fuel sheds) in Super Admin', () => {
  it('is its own project with one plan Super Admin sets (MVR 599, 14-day trial to start)', async () => {
    const fuel = (await sa.get('/api/superadmin/hub/ventures')).json().items.find((v: { kind: string }) => v.kind === 'fuel');
    expect(fuel).toMatchObject({ name: 'Theyo Fihaara', accountsActive: 0 });
    expect((await sa.get('/api/superadmin/fuel/plan')).json()).toMatchObject({ name: 'Theyo Fihaara', priceMonthly: '599.00', currency: 'MVR', trialMinutes: 14 * 1440, accounts: 0 });
    expect((await sa.put('/api/superadmin/fuel/plan', { priceMonthly: 699, trialMinutes: 7 * 1440 })).statusCode).toBe(200);
    expect((await sa.get('/api/superadmin/fuel/plan')).json()).toMatchObject({ priceMonthly: '699.00', trialMinutes: 7 * 1440 });
    expect((await sa.get('/api/superadmin/hub/overview')).json().fuelAccountsActive).toBe(0);
  });

  it('Super Admin opens a shed; the owner gets the fuel shed only (team, no POS or add-ons)', async () => {
    const res = await sa.post('/api/superadmin/businesses', {
      product: 'fuel',
      name: 'Sample Harbour Fuel',
      businessType: 'other',
      currency: 'MVR',
      planId: await planId(sa, 'fuel'),
      owner: { name: 'Shed Owner', email: 'owner@harbourfuel.test', language: 'dv', password: 'Fuel-Shed-Pass-1' },
    });
    expect(res.statusCode).toBe(201);
    expect((await sa.get('/api/superadmin/businesses?product=fuel')).json().items.map((b: { name: string }) => b.name)).toEqual(['Sample Harbour Fuel']);
    expect((await sa.get('/api/superadmin/businesses?product=pos')).json().items).toHaveLength(0);
    expect((await sa.get('/api/superadmin/hub/overview')).json().fuelAccountsActive).toBe(1);

    const owner = new Client(env.app);
    const login = await owner.post('/api/auth/login', { email: 'owner@harbourfuel.test', password: 'Fuel-Shed-Pass-1' });
    expect(login.statusCode).toBe(200);
    const s = login.json();
    expect(s.business.product).toBe('fuel');
    expect(s.subscription).toMatchObject({ planCode: 'fuel', effectiveStatus: 'trialing' });
    expect([...s.modules].sort()).toEqual(['audit', 'dashboard', 'fuel', 'roles', 'settings', 'users']);
    expect(s.addons).toEqual([]);
    expect((await owner.get('/api/products')).statusCode).toBe(403);
  });

  it('a shed asks for an account: it waits for Super Admin, with the island and what it has', async () => {
    const c = new Client(env.app);
    const missing = await c.post('/api/auth/register', { product: 'fuel', businessName: 'X Fuel', ownerName: 'X', email: 'x@fuel.test', password: 'Fuel-Shed-Pass-1' });
    expect(missing.statusCode).toBe(422);
    expect(Object.keys(missing.json().error.fields).sort()).toEqual(['island', 'phone']);
    const r = await c.post('/api/auth/register', { product: 'fuel', businessName: 'Island Fuel', ownerName: 'Ali', email: 'ali@islandfuel.test', password: 'Fuel-Shed-Pass-1', phone: '7771234', island: 'Thinadhoo, Gaafu Dhaalu', fuelNozzles: '2-4', fuelStock: 'drums' });
    expect(r.statusCode).toBe(201);
    expect(r.json()).toMatchObject({ state: 'business_pending', business: { product: 'fuel', status: 'pending' } });
    const list = (await sa.get('/api/superadmin/businesses?product=fuel&status=pending')).json().items;
    expect(list.map((b: { name: string }) => b.name)).toEqual(['Island Fuel']);
    const detail = (await sa.get(`/api/superadmin/businesses/${list[0].id}`)).json();
    expect(detail.business.address).toBe('Thinadhoo, Gaafu Dhaalu · 2-4 nozzles · drums');
  });

  it('POS plans never include the fuel module', async () => {
    const plans = (await sa.get('/api/superadmin/plans?product=pos')).json().items as { modules: string[] }[];
    for (const p of plans) expect(p.modules).not.toContain('fuel');
  });
});
