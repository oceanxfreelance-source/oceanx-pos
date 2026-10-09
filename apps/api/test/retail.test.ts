import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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
});

describe('retail shops', () => {
  it('a shop has no food-service features, even when granted; restaurants keep theirs', async () => {
    const shop = await setupBusiness(env, sa, 'Corner Mart', { type: 'supermarket' });
    for (const a of ['qr_menu', 'reservations', 'multi_outlet']) await sa.post(`/api/superadmin/businesses/${shop.businessId}/addons/${a}/grant`);
    const s = (await shop.owner.get('/api/auth/session')).json();
    expect(s.business.profile.retail).toBe(true);
    expect(s.modules).not.toContain('kitchen');
    expect(s.modules).not.toContain('tables');
    expect(s.modules).toContain('inventory');
    expect(s.addons).toEqual(['multi_outlet']);
    expect((await shop.owner.get('/api/kitchen/orders')).json().error.code).toBe('module_not_enabled');
    const offered = (await shop.owner.get('/api/addons')).json().items.map((a: { code: string }) => a.code);
    expect(offered).toContain('multi_outlet');
    expect(offered).toContain('advanced_inventory');
    expect(offered).not.toContain('qr_menu');
    expect(offered).not.toContain('karaoke');
    expect((await shop.owner.post('/api/addons/karaoke/request', {})).statusCode).toBe(404);

    const cafe = await setupBusiness(env, sa, 'Harbour Cafe', { type: 'cafe' });
    const cs = (await cafe.owner.get('/api/auth/session')).json();
    expect(cs.business.profile.retail).toBeFalsy();
    expect(cs.modules).toContain('kitchen');
    expect(cs.modules).toContain('tables');
    expect((await cafe.owner.get('/api/stock-check?q=milk')).statusCode).toBe(404); // shop feature only

    // Super Admin can list all shops together.
    const list = (await sa.get('/api/superadmin/businesses?type=retail')).json();
    expect(list.items.map((b: { name: string }) => b.name)).toEqual(['Corner Mart']);
  });

  it('stock check: scan a barcode or type a name, see in stock / low / out here and at other outlets', async () => {
    const shop = await setupBusiness(env, sa, 'Island Mart', { type: 'retail_shop' });
    const owner = shop.owner;
    await sa.post(`/api/superadmin/businesses/${shop.businessId}/addons/multi_outlet/grant`);
    const mk = async (name: string, sku: string, qty: number) => {
      const p = (await owner.post('/api/products', { name, sku, sellingPrice: 12, trackStock: true, minStock: 5, unit: 'pcs' })).json();
      if (qty) await owner.post('/api/inventory/adjust', { productId: p.id, mode: 'add', quantity: qty, reason: 'opening' });
      return p as { id: string };
    };
    await mk('Coconut Milk 400ml', '8901234567890', 24);
    await mk('Coconut Oil 1L', '8901234567891', 3);
    await mk('Coconut Water', '8901234567892', 0);

    // Second outlet with its own stock of the oil.
    const branch = (await owner.post('/api/outlets', { name: 'Hulhumale Branch', code: 'HLM' })).json();
    const main = (await owner.get('/api/auth/session')).json().outlet.id as string;
    await owner.post('/api/me/outlet', { outletId: branch.id });
    const oil = (await owner.get('/api/stock-check?q=8901234567891')).json().items[0];
    await owner.post('/api/inventory/adjust', { productId: oil.id, mode: 'add', quantity: 40, reason: 'opening' });
    await owner.post('/api/me/outlet', { outletId: main });

    // Scanning a barcode puts the exact product first.
    const scan = (await owner.get('/api/stock-check?q=8901234567891')).json();
    expect(scan.items[0]).toMatchObject({ name: 'Coconut Oil 1L', exact: true, quantity: 3, status: 'low' });
    expect(scan.items[0].outlets.find((o: { outletName: string }) => o.outletName === 'Hulhumale Branch')).toMatchObject({ quantity: 40, status: 'in_stock' });

    // Typing a name finds all matches with their status.
    const byName = (await owner.get('/api/stock-check?q=coconut')).json().items;
    const status = Object.fromEntries(byName.map((i: { name: string; status: string }) => [i.name, i.status]));
    expect(status).toEqual({ 'Coconut Milk 400ml': 'in_stock', 'Coconut Oil 1L': 'low', 'Coconut Water': 'out' });

    // Another business cannot see this shop's products.
    const other = await setupBusiness(env, sa, 'Other Mart', { type: 'retail_shop' });
    expect((await other.owner.get('/api/stock-check?q=coconut')).json().items).toHaveLength(0);
  });
});
