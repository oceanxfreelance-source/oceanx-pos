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

    // A shop has only two built-in roles.
    const roles = (await shop.owner.get('/api/roles')).json().items.map((r: { systemKey: string; name: string }) => [r.systemKey, r.name]);
    expect(roles.sort()).toEqual([['business_admin', 'Owner'], ['cashier', 'Cashier / Salesperson']]);
    const cafeRoles = (await cafe.owner.get('/api/roles')).json().items.map((r: { systemKey: string }) => r.systemKey).sort();
    expect(cafeRoles).toEqual(['business_admin', 'cashier', 'kitchen_staff', 'manager', 'salesperson', 'waiter']);

    // Everything a shop stocks is for sale: even if sent as an "ingredient" it is saved as an item and shows on the POS.
    const rice = (await shop.owner.post('/api/products', { name: 'Rice 5kg', sku: '111', sellingPrice: 145, type: 'ingredient', sendToKitchen: true })).json();
    expect(rice).toMatchObject({ type: 'item', sendToKitchen: false });
    const catalog = (await shop.owner.get('/api/pos/catalog')).json();
    expect(catalog.products.map((p: { name: string }) => p.name)).toContain('Rice 5kg');

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

  it('shop stock: deliveries go to the store, the rack is refilled from it, sales take from the rack, alerts and reports', async () => {
    const shop = await setupBusiness(env, sa, 'Rack Mart', { type: 'retail_shop' });
    const owner = shop.owner;
    const oil = (await owner.post('/api/products', { name: 'Coconut Oil 1L', sku: '890100', sellingPrice: 45, costPrice: 30, trackStock: true, minStock: 5, minStoreStock: 10, unit: 'pcs' })).json();

    // A delivery is received into the stock room, not onto the rack.
    const sup = (await owner.post('/api/suppliers', { name: 'Wholesale Co' })).json();
    const po = (await owner.post('/api/purchases', { supplierId: sup.id, purchaseDate: '2026-10-01', items: [{ productId: oil.id, quantity: 40, unitCost: 30 }] })).json();
    await owner.post(`/api/purchases/${po.id}/receive`);
    let inv = (await owner.get('/api/inventory')).json().items.find((i: { id: string }) => i.id === oil.id);
    expect(inv).toMatchObject({ quantity: 0, storeQuantity: 40, low: true, storeLow: false });

    // Refill the rack with 8 from the store; can't take more than the store has.
    expect((await owner.post('/api/inventory/refill', { productId: oil.id, quantity: 8 })).json()).toEqual({ shop: 8, store: 32 });
    expect((await owner.post('/api/inventory/refill', { productId: oil.id, quantity: 100 })).json().error.code).toBe('insufficient_stock');

    // Selling 3 takes them off the rack: 5 left → "low on rack" alert with the store quantity.
    await owner.post('/api/pos/orders', { orderType: 'takeaway', items: [{ productId: oil.id, quantity: 3 }], payments: [{ method: 'cash', amount: 1000 }] });
    inv = (await owner.get('/api/inventory')).json().items.find((i: { id: string }) => i.id === oil.id);
    expect(inv).toMatchObject({ quantity: 5, storeQuantity: 32, low: true });
    const notes = (await owner.get('/api/notifications')).json().items;
    expect(notes.some((n: { messageKey?: string; key?: string; params?: { store?: number } }) => JSON.stringify(n).includes('low_on_rack') && JSON.stringify(n).includes('32'))).toBe(true);

    // Counting the store sets the stock-room figure only.
    await owner.post('/api/inventory/adjust', { productId: oil.id, mode: 'set', quantity: 9, reason: 'count', location: 'store' });
    inv = (await owner.get('/api/inventory')).json().items.find((i: { id: string }) => i.id === oil.id);
    expect(inv).toMatchObject({ quantity: 5, storeQuantity: 9, storeLow: true });
    expect((await owner.get('/api/inventory?low=store')).json().items.map((i: { id: string }) => i.id)).toEqual([oil.id]);

    // Reports: low on rack (with what's in the store), and store stock.
    const range = 'from=2026-10-01&to=2026-10-09';
    const rack = (await owner.get(`/api/reports/rack-low?${range}`)).json().rows;
    expect(rack).toEqual([expect.objectContaining({ product: 'Coconut Oil 1L', on_rack: 5, rack_alert_at: 5, in_store: 9 })]);
    const store = (await owner.get(`/api/reports/store-stock?${range}`)).json();
    expect(store.rows[0]).toMatchObject({ product: 'Coconut Oil 1L', in_store: 9, store_alert_at: 10, on_rack: 5 });
    expect(store.summary.stockValue).toBe(9 * 3000);
    expect((await owner.get('/api/stock-check?q=890100')).json().items[0]).toMatchObject({ quantity: 5, storeQuantity: 9, status: 'low', storeStatus: 'low' });

    // Restaurants keep one stock figure: no refill, no shop reports, deliveries go straight to stock.
    const cafe = await setupBusiness(env, sa, 'Bean Cafe', { type: 'cafe' });
    const milk = (await cafe.owner.post('/api/products', { name: 'Milk', trackStock: true, sellingPrice: 0, type: 'ingredient' })).json();
    expect((await cafe.owner.post('/api/inventory/refill', { productId: milk.id, quantity: 1 })).statusCode).toBe(404);
    expect((await cafe.owner.get(`/api/reports/rack-low?${range}`)).statusCode).toBe(404);
    await cafe.owner.post('/api/inventory/adjust', { productId: milk.id, mode: 'add', quantity: 4, reason: '', location: 'store' });
    expect((await cafe.owner.get('/api/inventory')).json().items[0]).toMatchObject({ quantity: 4, storeQuantity: 0 });
  });

  it('store stock in cases: pieces per case, deliveries in cases, the rack refilled by opening cases', async () => {
    const shop = await setupBusiness(env, sa, 'Case Mart', { type: 'retail_shop' });
    const owner = shop.owner;
    const cola = (await owner.post('/api/products', { name: 'Cola 330ml', sku: '500100', sellingPrice: 10, costPrice: 6, trackStock: true, minStock: 6, minStoreStock: 24, packSize: 24, unit: 'pcs' })).json();
    expect(cola.packSize).toBe(24);

    // 2 cases at 120 a case arrive as 48 pieces in the store, costing 5 a piece.
    const sup = (await owner.post('/api/suppliers', { name: 'Drinks Co' })).json();
    const po = (await owner.post('/api/purchases', { supplierId: sup.id, purchaseDate: '2026-10-01', items: [{ productId: cola.id, quantity: 48, lineTotal: 240 }] })).json();
    await owner.post(`/api/purchases/${po.id}/receive`);
    let inv = (await owner.get('/api/inventory')).json().items.find((i: { id: string }) => i.id === cola.id);
    expect(inv).toMatchObject({ packSize: 24, quantity: 0, storeQuantity: 48, storeLow: false });

    // Opening one case puts 24 on the rack.
    expect((await owner.post('/api/inventory/refill', { productId: cola.id, quantity: 24 })).json()).toEqual({ shop: 24, store: 24 });
    inv = (await owner.get('/api/inventory')).json().items.find((i: { id: string }) => i.id === cola.id);
    expect(inv).toMatchObject({ quantity: 24, storeQuantity: 24, storeLow: true });

    const store = (await owner.get('/api/reports/store-stock?from=2026-10-01&to=2026-10-09')).json();
    expect(store.rows[0]).toMatchObject({ product: 'Cola 330ml', in_store: 24, cases: 1, per_case: 24 });
    expect((await owner.get('/api/stock-check?q=500100')).json().items[0]).toMatchObject({ packSize: 24, storeQuantity: 24 });
  });
});
