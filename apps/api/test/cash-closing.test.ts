import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Client, createStaff, createSuperAdmin, createTestEnv, loginSuperAdmin, resetDb, setupBusiness, type TestEnv } from './helpers';

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
  biz = await setupBusiness(env, sa, 'Burger Box', { type: 'takeaway' });
  owner = biz.owner;
});

async function sell(client: Client, productId: string, qty: number, payments: { method: string; amount: number }[]) {
  const r = await client.post('/api/pos/orders', { orderType: 'takeaway', items: [{ productId, quantity: qty }], payments });
  expect(r.statusCode, r.body).toBe(201);
  return r.json() as { id: string };
}

describe('end-of-day cash closing', () => {
  it('cash expected = float + cash taken − change − cash refunds; counted vs expected; the float starts the next day', async () => {
    const burger = (await owner.post('/api/products', { name: 'Burger', sellingPrice: 45 })).json();
    const cashier = await createStaff(env, owner, 'till@burgerbox.test', 'cashier');
    // Cashier: 2 burgers (90) paid with 100 cash → 10 change; 1 burger by card; 3 burgers by transfer.
    const s1 = await sell(cashier.client, burger.id, 2, [{ method: 'cash', amount: 100 }]);
    await sell(cashier.client, burger.id, 1, [{ method: 'card', amount: 45 }]);
    await sell(cashier.client, burger.id, 3, [{ method: 'bank_transfer', amount: 135 }]);
    // A cash refund of one burger (Refunds add-on).
    expect((await sa.post(`/api/superadmin/businesses/${biz.businessId}/addons/refunds/grant`)).statusCode).toBe(200);
    const item = (await owner.get(`/api/sales/${s1.id}`)).json().items[0].id;
    expect((await owner.post(`/api/sales/${s1.id}/refunds`, { items: [{ saleItemId: item, quantity: 1 }], method: 'cash', reason: 'cold food' })).statusCode).toBe(201);

    const f = (await cashier.client.get('/api/pos/closing')).json();
    expect(f).toMatchObject({ number: 1, salesCount: 3, salesTotal: 27000, openingFloat: 0, cashIn: 10000, changeGiven: 1000, cashRefunds: 4500, expectedCash: 4500 });
    expect(f.byMethod).toEqual({ cash: 10000, card: 4500, bank_transfer: 13500 });

    // Counted 40 (5 short); 20 stays in the drawer as tomorrow's float.
    expect((await cashier.client.post('/api/pos/closing', { countedCash: 40, keptFloat: 50 })).statusCode).toBe(422);
    const c1 = await cashier.client.post('/api/pos/closing', { countedCash: 40, keptFloat: 20, note: 'Coins short' });
    expect(c1.statusCode, c1.body).toBe(201);
    expect(c1.json()).toMatchObject({ number: 1, expectedCash: 4500, countedCash: 4000, difference: -500, keptFloat: 2000 });

    // Next day starts from the float and only counts new sales.
    const next = (await cashier.client.get('/api/pos/closing')).json();
    expect(next).toMatchObject({ number: 2, salesCount: 0, openingFloat: 2000, cashIn: 0, expectedCash: 2000 });
    await sell(cashier.client, burger.id, 1, [{ method: 'cash', amount: 50 }]);
    expect((await cashier.client.get('/api/pos/closing')).json()).toMatchObject({ salesCount: 1, cashIn: 5000, changeGiven: 500, expectedCash: 6500 });
    const c2 = (await cashier.client.post('/api/pos/closing', { countedCash: 65 })).json();
    expect(c2).toMatchObject({ number: 2, difference: 0 });

    // The owner sees every closing with who closed it; one can be printed.
    const list = (await owner.get('/api/pos/closings')).json();
    expect(list.items.map((x: { number: number }) => x.number)).toEqual([2, 1]);
    expect(list.items[1]).toMatchObject({ difference: -500, closedByName: 'till' });
    expect((await owner.get(`/api/pos/closings/${c1.json().id}`)).json()).toMatchObject({ number: 1, business: { name: 'Burger Box' } });
    // Recorded in the activity log.
    const [a] = (await env.db.execute(sql`SELECT count(*)::int AS n FROM activity_logs WHERE action = 'pos.day_closed'`)).rows as { n: number }[];
    expect(a!.n).toBe(2);
  });

  it('a voided bill does not count; staff without the permission cannot close; another business sees nothing', async () => {
    const burger = (await owner.post('/api/products', { name: 'Burger', sellingPrice: 45 })).json();
    const s = await sell(owner, burger.id, 1, [{ method: 'cash', amount: 45 }]);
    expect((await owner.post(`/api/sales/${s.id}/void`, { reason: 'wrong order' })).statusCode).toBe(200);
    expect((await owner.get('/api/pos/closing')).json()).toMatchObject({ salesCount: 0, cashIn: 0, expectedCash: 0 });
    const cook = await createStaff(env, owner, 'cook@burgerbox.test', 'kitchen_staff');
    expect((await cook.client.get('/api/pos/closing')).statusCode).toBe(403);
    const c = (await owner.post('/api/pos/closing', { countedCash: 0 })).json();
    const other = await setupBusiness(env, sa, 'Other Shop', { type: 'takeaway' });
    expect((await other.owner.get(`/api/pos/closings/${c.id}`)).statusCode).toBe(404);
    expect((await other.owner.get('/api/pos/closings')).json().items).toHaveLength(0);
  });
});

describe('business Viber number', () => {
  it('is saved in the business profile and given to quotations and invoices for printing', async () => {
    const profile = (await owner.get('/api/settings')).json().profile;
    expect((await owner.patch('/api/settings/profile', { ...profile, viberPhone: 'abc' })).statusCode).toBe(422);
    expect((await owner.patch('/api/settings/profile', { name: profile.name, businessType: profile.businessType, email: profile.email, phone: profile.phone, address: profile.address, viberPhone: '+960 777 1234' })).statusCode).toBe(200);
    expect((await owner.get('/api/settings')).json().profile.viberPhone).toBe('+960 777 1234');
    const c = (await owner.post('/api/customers', { name: 'Ali', phone: '7771234' })).json();
    const q = (await owner.post('/api/quotations', { customerId: c.id, quotationDate: '2026-10-01', validUntil: '2026-10-31', items: [{ name: 'Juice for event', quantity: 20, unitPrice: 25 }] })).json();
    expect((await owner.get(`/api/quotations/${q.id}`)).json().business.viberPhone).toBe('+960 777 1234');
  });
});
