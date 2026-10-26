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

  it('a shed signs up and gets in at once, on its free trial, with the island and what it has', async () => {
    const c = new Client(env.app);
    const missing = await c.post('/api/auth/register', { product: 'fuel', businessName: 'X Fuel', ownerName: 'X', email: 'x@fuel.test', password: 'Fuel-Shed-Pass-1' });
    expect(missing.statusCode).toBe(422);
    expect(Object.keys(missing.json().error.fields).sort()).toEqual(['island', 'phone']);
    const r = await c.post('/api/auth/register', { product: 'fuel', businessName: 'Island Fuel', ownerName: 'Ali', email: 'ali@islandfuel.test', password: 'Fuel-Shed-Pass-1', phone: '7771234', island: 'Thinadhoo, Gaafu Dhaalu', fuelNozzles: '2-4', fuelStock: 'drums' });
    expect(r.statusCode).toBe(201);
    expect(r.json()).toMatchObject({ state: 'ok', business: { product: 'fuel', status: 'active' }, subscription: { planCode: 'fuel', effectiveStatus: 'trialing' } });
    const list = (await sa.get('/api/superadmin/businesses?product=fuel')).json().items;
    expect(list.map((b: { name: string }) => b.name)).toEqual(['Island Fuel']);
    const detail = (await sa.get(`/api/superadmin/businesses/${list[0].id}`)).json();
    expect(detail.business.address).toBe('Thinadhoo, Gaafu Dhaalu · 2-4 nozzles · drums');
  });

  it('POS plans never include the fuel module', async () => {
    const plans = (await sa.get('/api/superadmin/plans?product=pos')).json().items as { modules: string[] }[];
    for (const p of plans) expect(p.modules).not.toContain('fuel');
  });

  it('the shed sets itself up: how it works, prices, tanks or drums, nozzles and extras; and changes it later', async () => {
    const c = new Client(env.app);
    const r = await c.post('/api/auth/register', { product: 'fuel', businessName: 'Setup Fuel', ownerName: 'Ali', email: 'ali@setupfuel.test', password: 'Fuel-Shed-Pass-1', phone: '7771234', island: 'Hulhumale' });
    expect(r.statusCode).toBe(201);
    const first = (await c.get('/api/fuel/setup')).json();
    expect(first).toMatchObject({ done: false, tanks: [], nozzles: [], config: { mode: 'shifts', credit: true, printer: 'off' } });

    const config = { ...first.config, mode: 'one', fuels: ['petrol'], prices: { petrol: 17.214, diesel: 18 }, deliveryCharge: { on: true, type: 'fixed', amount: 150 } };
    // A price is needed for each fuel it sells, and every tank needs a nozzle.
    const bad = await c.put('/api/fuel/setup', { config: { ...config, prices: {} }, tanks: [{ key: 't1', name: 'Petrol drums', fuel: 'petrol', storage: 'drums', capacityL: 1600, reorderL: 400 }], nozzles: [] });
    expect(bad.statusCode).toBe(422);
    const saved = await c.put('/api/fuel/setup', {
      config,
      tanks: [{ key: 't1', name: 'Petrol drums', fuel: 'petrol', storage: 'drums', capacityL: 1600, reorderL: 400, drumSizeL: 200 }],
      nozzles: [{ name: 'N1', tankKey: 't1', openingMeter: 58214.6 }],
    });
    expect(saved.statusCode).toBe(200);
    const s1 = saved.json();
    expect(s1).toMatchObject({ done: true, config: { mode: 'one', fuels: ['petrol'], prices: { petrol: 17.21 }, deliveryCharge: { on: true, amount: 150 } } });
    expect(s1.config.prices.diesel).toBeUndefined();
    expect(s1.tanks).toMatchObject([{ name: 'Petrol drums', storage: 'drums', capacityL: 1600 }]);
    expect(s1.nozzles).toMatchObject([{ name: 'N1', tankKey: s1.tanks[0].id, openingMeter: 58214.6 }]);

    // Later: shifts, diesel added in a tank, two more nozzles; the petrol tank and N1 keep their ids.
    const t1 = s1.tanks[0];
    const again = (
      await c.put('/api/fuel/setup', {
        config: { ...s1.config, mode: 'shifts', fuels: ['petrol', 'diesel'], prices: { petrol: 17.21, diesel: 17.54 } },
        tanks: [t1, { key: 'new-d', name: 'Diesel tank', fuel: 'diesel', storage: 'tank', capacityL: 25000, reorderL: 5000 }],
        nozzles: [{ ...s1.nozzles[0] }, { name: 'P3', tankKey: 'new-d', openingMeter: 0 }, { name: 'P4', tankKey: 'new-d', openingMeter: 0 }],
      })
    ).json();
    expect(again.tanks.map((t: { name: string }) => t.name)).toEqual(['Petrol drums', 'Diesel tank']);
    expect(again.tanks[0].id).toBe(t1.id);
    expect(again.nozzles.map((n: { name: string }) => n.name)).toEqual(['N1', 'P3', 'P4']);
    expect(again.nozzles[0].id).toBe(s1.nozzles[0].id);

    // Another shed never sees or touches this set-up.
    const other = new Client(env.app);
    await other.post('/api/auth/register', { product: 'fuel', businessName: 'Other Fuel', ownerName: 'B', email: 'b@otherfuel.test', password: 'Fuel-Shed-Pass-1', phone: '7770000', island: 'Male' });
    expect((await other.get('/api/fuel/setup')).json().tanks).toEqual([]);
    const steal = await other.put('/api/fuel/setup', { config: again.config, tanks: [{ ...again.tanks[0] }], nozzles: [{ name: 'X', tankKey: again.tanks[0].key, openingMeter: 0 }] });
    expect(steal.statusCode).toBe(422);
  });
});
