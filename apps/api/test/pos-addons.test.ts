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
  biz = await setupBusiness(env, sa, 'Addon Cafe', { type: 'cafe' });
  owner = biz.owner;
});

async function grant(code: string) {
  expect((await sa.post(`/api/superadmin/businesses/${biz.businessId}/addons/${code}/grant`)).statusCode).toBe(200);
}

/** GST 8% added on top, 10% service charge (taxed too). */
async function setTax() {
  const r = await owner.patch('/api/settings/tax', { taxEnabled: true, taxName: 'GST', taxRate: 8, pricesIncludeTax: false, taxNumber: 'GST-1', serviceChargeEnabled: true, serviceChargeRate: 10 });
  expect(r.statusCode).toBe(200);
}

async function product(body: Record<string, unknown>) {
  const r = await owner.post('/api/products', { name: 'Item', sellingPrice: 10, ...body });
  expect(r.statusCode, r.body).toBe(201);
  return r.json() as { id: string };
}

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const range = `from=${day(-2)}&to=${day(2)}`;

/** A paid bill: 2 × 100 + 8% GST, + 10% service charge (+ its GST) = 237.60. */
async function paidSale(productId: string) {
  const r = await owner.post('/api/pos/orders', { orderType: 'takeaway', items: [{ productId, quantity: 2 }], payments: [{ method: 'cash', amount: 237.6 }] });
  expect(r.statusCode, r.body).toBe(201);
  const sale = r.json() as { id: string; total: number; tax: number };
  expect(sale.total).toBe(23760);
  expect(sale.tax).toBe(1760);
  const detail = (await owner.get(`/api/sales/${sale.id}`)).json();
  return { ...sale, itemId: detail.items[0].id as string };
}

describe('add-ons are off until Super Admin turns them on', () => {
  it('refunds, GST report and import are blocked without the add-on', async () => {
    const p = await product({ name: 'Cake', sellingPrice: 100 });
    await setTax();
    const sale = await paidSale(p.id);
    expect((await owner.post(`/api/sales/${sale.id}/refunds`, { items: [{ saleItemId: sale.itemId, quantity: 1 }], method: 'cash', reason: 'stale' })).statusCode).toBe(403);
    expect((await owner.get(`/api/reports/gst?${range}`)).statusCode).toBe(403);
    expect((await owner.post('/api/import/products', { rows: [{ name: 'X' }] })).statusCode).toBe(403);
    // GST on an expense is ignored without the GST add-on.
    const e = (await owner.post('/api/expenses', { category: 'rent', amount: 108, tax: 8, expenseDate: day(0) })).json();
    expect(e.tax).toBe(0);
  });
});

describe('refunds & returns', () => {
  it('refunds part of a bill, then the rest; restocks; blocks over-refunds and voids; cashiers cannot refund', async () => {
    await grant('refunds');
    await setTax();
    const p = await product({ name: 'Cake', sellingPrice: 100, trackStock: true });
    await owner.post('/api/inventory/adjust', { productId: p.id, mode: 'add', quantity: 5, reason: 'opening' });
    const sale = await paidSale(p.id);
    const stock = async () => (await owner.get('/api/inventory')).json().items.find((i: { id: string }) => i.id === p.id).quantity;
    expect(await stock()).toBe(3);

    const cashier = await createStaff(env, owner, 'cashier@addon.test', 'cashier');
    expect((await cashier.client.post(`/api/sales/${sale.id}/refunds`, { items: [{ saleItemId: sale.itemId, quantity: 1 }], method: 'cash', reason: 'stale' })).statusCode).toBe(403);

    const r1 = await owner.post(`/api/sales/${sale.id}/refunds`, { items: [{ saleItemId: sale.itemId, quantity: 1 }], method: 'cash', reason: 'stale cake' });
    expect(r1.statusCode, r1.body).toBe(201);
    expect(r1.json()).toMatchObject({ total: 11880, tax: 880, number: expect.stringMatching(/^RF-\d{4}-00001$/) });
    expect(await stock()).toBe(4);

    const tooMuch = await owner.post(`/api/sales/${sale.id}/refunds`, { items: [{ saleItemId: sale.itemId, quantity: 2 }], method: 'cash', reason: 'again' });
    expect(tooMuch.statusCode).toBe(422);

    const r2 = await owner.post(`/api/sales/${sale.id}/refunds`, { items: [{ saleItemId: sale.itemId, quantity: 1 }], method: 'card', reason: 'second one', restock: false });
    expect(r2.json()).toMatchObject({ total: 11880, tax: 880 });
    expect(await stock()).toBe(4);

    const detail = (await owner.get(`/api/sales/${sale.id}`)).json();
    expect(detail.sale.refundedTotal).toBe(23760);
    expect(detail.refunds).toHaveLength(2);
    expect(detail.payments.filter((x: { kind: string }) => x.kind === 'refund').map((x: { amount: number }) => x.amount)).toEqual([-11880, -11880]);
    expect((await owner.post(`/api/sales/${sale.id}/void`, { reason: 'mistake' })).json().error.code).toBe('invalid_status_transition');

    const report = (await owner.get(`/api/reports/refunds?${range}`)).json();
    expect(report.summary.refunds).toBe(23760);
    const daily = (await owner.get(`/api/reports/sales-summary?${range}`)).json();
    expect(daily.rows[0]).toMatchObject({ total: 23760, refunds: 23760, net_sales: 0 });
  });
});

describe('GST report (MIRA)', () => {
  it('output tax by rate incl. service charge, less refunds; input tax from expenses; statements', async () => {
    await grant('gst_report');
    await grant('refunds');
    await setTax();
    const p = await product({ name: 'Cake', sellingPrice: 100 });
    const sale = await paidSale(p.id);
    await owner.post(`/api/sales/${sale.id}/refunds`, { items: [{ saleItemId: sale.itemId, quantity: 1 }], method: 'cash', reason: 'stale cake' });
    const e = await owner.post('/api/expenses', { category: 'other', amount: 108, tax: 8, supplierTin: '1001234GST501', expenseDate: day(0), payee: 'Office Supplies Pvt Ltd', reference: 'BILL-9' });
    expect(e.json().tax).toBe(800);

    const r = (await owner.get(`/api/reports/gst?${range}`)).json();
    expect(r.summary).toEqual({ taxableSupplies: 11000, zeroRatedSupplies: 0, exemptSupplies: 0, outputTax: 880, inputTax: 800, gstPayable: 80 });
    const row = (source: string) => r.rows.find((x: { source: string }) => x.source === source);
    expect(row('pos')).toMatchObject({ gst_type: 'output', supply: 'standard', rate: 8, taxable: 20000, tax: 1600, including_gst: 21600 });
    expect(row('service_charge')).toMatchObject({ rate: 8, taxable: 2000, tax: 160 });
    expect(row('refunds')).toMatchObject({ rate: 8, taxable: -11000, tax: -880 });
    expect(row('expenses')).toMatchObject({ gst_type: 'input', taxable: 10000, tax: 800 });

    const sales = (await owner.get(`/api/reports/gst-sales?${range}`)).json();
    expect(sales.rows.map((x: { source: string; tax: number }) => [x.source, x.tax])).toEqual(expect.arrayContaining([['pos', 1760], ['refunds', -880]]));
    const buys = (await owner.get(`/api/reports/gst-purchases?${range}`)).json();
    expect(buys.rows).toEqual([expect.objectContaining({ payee: 'Office Supplies Pvt Ltd', tax_number: '1001234GST501', reference: 'BILL-9', tax: 800, total: 10800 })]);
    const csv = await owner.get(`/api/reports/gst-sales?${range}&format=csv`);
    expect(csv.statusCode).toBe(200);
    expect(csv.body).toContain('tax_number');
  });
});

describe('import (Excel / CSV)', () => {
  it('previews, creates products with categories and stock, skips or updates existing', async () => {
    await grant('data_import');
    const rows = [
      { name: 'Cappuccino', sku: 'CAP 01', category: 'Drinks', sellingPrice: 40, costPrice: 12 },
      { name: 'Muffin', category: 'Bakery', sellingPrice: 25, stock: 12 },
      { name: 'Latte', sku: 'cap 01', sellingPrice: 45 },
    ];
    const preview = (await owner.post('/api/import/products', { rows, dryRun: true })).json();
    expect(preview).toMatchObject({ dryRun: true, created: 2, categoriesCreated: 2, errors: [{ row: 3, code: 'duplicate_in_file' }] });
    expect((await owner.get('/api/products')).json().items).toHaveLength(0);

    const done = (await owner.post('/api/import/products', { rows: rows.slice(0, 2) })).json();
    expect(done).toMatchObject({ dryRun: false, created: 2, updated: 0, skipped: 0, categoriesCreated: 2 });
    const items = (await owner.get('/api/products')).json().items as { name: string; sku: string; sellingPrice: number; trackStock: boolean; id: string }[];
    const cap = items.find((i) => i.name === 'Cappuccino')!;
    expect(cap).toMatchObject({ sku: 'CAP-01', sellingPrice: 4000 });
    const muffin = items.find((i) => i.name === 'Muffin')!;
    expect(muffin.trackStock).toBe(true);
    expect((await owner.get('/api/inventory')).json().items.find((i: { id: string }) => i.id === muffin.id).quantity).toBe(12);

    expect((await owner.post('/api/import/products', { rows: [{ name: 'Cappuccino', sku: 'CAP-01', sellingPrice: 42 }] })).json()).toMatchObject({ skipped: 1, created: 0 });
    expect((await owner.post('/api/import/products', { rows: [{ name: 'Cappuccino', sku: 'CAP-01', sellingPrice: 42 }], updateExisting: true })).json()).toMatchObject({ updated: 1 });
    expect((await owner.get('/api/products')).json().items.find((i: { name: string }) => i.name === 'Cappuccino').sellingPrice).toBe(4200);
  });

  it('imports customers, matching existing ones by phone', async () => {
    await grant('data_import');
    await owner.post('/api/customers', { name: 'Ali', phone: '7771234' });
    const r = (await owner.post('/api/import/customers', { rows: [{ name: 'Ali Ahmed', phone: '777 1234' }, { name: 'Sara', phone: '9601111', company: 'Sara Trading', email: 'SARA@x.mv' }] })).json();
    expect(r).toMatchObject({ created: 1, skipped: 1 });
    const sara = (await owner.get('/api/customers?q=Sara')).json().items[0];
    expect(sara).toMatchObject({ kind: 'company', email: 'sara@x.mv' });
  });
});

describe('GST types and credit notes', () => {
  it('zero-rated and exempt items are sold without GST and reported apart; a refund prints as a credit note', async () => {
    await grant('gst_report');
    await grant('refunds');
    await setTax();
    const tea = await product({ name: 'Tea', sellingPrice: 20 });
    const rice = await product({ name: 'Rice 1kg', sellingPrice: 30, gstType: 'zero_rated', taxRate: 8 });
    const lesson = await product({ name: 'Cooking class', sellingPrice: 100, gstType: 'exempt' });
    expect((await owner.get('/api/products')).json().items.find((p: { id: string }) => p.id === rice.id)).toMatchObject({ gstType: 'zero_rated', taxRate: 0 });
    const r = await owner.post('/api/pos/orders', {
      orderType: 'takeaway',
      items: [
        { productId: tea.id, quantity: 1 },
        { productId: rice.id, quantity: 1 },
        { productId: lesson.id, quantity: 1 },
      ],
      payments: [{ method: 'cash', amount: 500 }],
    });
    expect(r.statusCode, r.body).toBe(201);
    const sale = (await owner.get(`/api/sales/${r.json().id}`)).json();
    const line = (name: string) => sale.items.find((i: { nameSnapshot: string }) => i.nameSnapshot === name);
    expect(line('Rice 1kg')).toMatchObject({ gstType: 'zero_rated', tax: 0 });
    expect(line('Cooking class')).toMatchObject({ gstType: 'exempt', tax: 0 });
    expect(line('Tea').tax).toBe(160);

    const gst = (await owner.get(`/api/reports/gst?${range}`)).json();
    expect(gst.summary).toMatchObject({ taxableSupplies: 2000 + 1500, zeroRatedSupplies: 3000, exemptSupplies: 10000 });
    expect(gst.meta).toMatchObject({ taxNumber: 'GST-1', taxRate: 8 });

    const ref = (await owner.post(`/api/sales/${sale.sale.id}/refunds`, { items: [{ saleItemId: line('Tea').id, quantity: 1 }], method: 'cash', reason: 'cold tea' })).json();
    const note = (await owner.get(`/api/refunds/${ref.id}`)).json();
    expect(note).toMatchObject({ refund: { number: ref.number, total: ref.total, tax: ref.tax }, sale: { number: sale.sale.number }, settings: { tax: { taxNumber: 'GST-1' } } });
    expect(note.items).toEqual([expect.objectContaining({ nameSnapshot: 'Tea', tax: 160 })]);
  });

  it('suppliers keep a TIN', async () => {
    const s = (await owner.post('/api/suppliers', { name: 'Island Coffee Traders', taxNumber: '1012345GST501' })).json();
    expect(s.taxNumber).toBe('1012345GST501');
  });
});
