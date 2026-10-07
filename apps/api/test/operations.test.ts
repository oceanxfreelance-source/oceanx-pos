import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { kitchenOrders, notifications } from '../src/db/schema';
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
  env.mailer.outbox.length = 0;
  await createSuperAdmin(env.db);
  sa = await loginSuperAdmin(env);
  biz = await setupBusiness(env, sa, 'Ops Cafe', { type: 'cafe' });
  owner = biz.owner;
});

async function grant(code: string, businessId = biz.businessId) {
  const r = await sa.post(`/api/superadmin/businesses/${businessId}/addons/${code}/grant`);
  expect(r.statusCode).toBe(200);
}

async function setTax(client: Client, tax: Partial<Record<string, unknown>> = {}) {
  const r = await client.patch('/api/settings/tax', {
    taxEnabled: true,
    taxName: 'GST',
    taxRate: 8,
    pricesIncludeTax: false,
    taxNumber: '',
    serviceChargeEnabled: true,
    serviceChargeRate: 10,
    ...tax,
  });
  expect(r.statusCode).toBe(200);
}

async function product(client: Client, body: Record<string, unknown>) {
  const r = await client.post('/api/products', { name: 'Item', sellingPrice: 10, ...body });
  expect(r.statusCode, r.body).toBe(201);
  return r.json() as { id: string; name: string };
}

async function customer(client: Client, body: Record<string, unknown> = {}) {
  const r = await client.post('/api/customers', { name: 'Ali', phone: '7771234', ...body });
  expect(r.statusCode, r.body).toBe(201);
  return r.json() as { id: string };
}

describe('catalog', () => {
  it('creates categories and products with option groups; prices stored in minor units', async () => {
    const cat = (await owner.post('/api/categories', { name: 'Hot drinks', kitchenStation: 'Bar' })).json();
    const latte = await product(owner, {
      name: 'Latte',
      sku: 'LAT-01',
      categoryId: cat.id,
      sellingPrice: 45.5,
      costPrice: 12,
      options: [{ name: 'Size', required: true, multiple: false, choices: [{ name: 'Small', price: 0 }, { name: 'Large', price: 10 }] }],
    });
    const got = (await owner.get(`/api/products/${latte.id}`)).json();
    expect(got.sellingPrice).toBe(4550);
    expect(got.options[0].choices[1].price).toBe(1000);
    expect((await owner.post('/api/products', { name: 'Dup', sku: 'lat-01' })).json().error.code).toBe('sku_taken');
    const pos = (await owner.get('/api/pos/catalog')).json();
    expect(pos.products.map((p: { name: string }) => p.name)).toContain('Latte');
    expect(pos.categories[0].name).toBe('Hot drinks');
  });

  it('enforces the plan product limit from the database', async () => {
    const plans = (await sa.get('/api/superadmin/plans')).json().items;
    const business = plans.find((p: { code: string }) => p.code === 'business');
    await sa.put(`/api/superadmin/plans/${business.id}`, { ...business, priceMonthly: Number(business.priceMonthly), limits: { ...business.limits, max_products: 2 } });
    await product(owner, { name: 'A' });
    await product(owner, { name: 'B' });
    expect((await owner.post('/api/products', { name: 'C' })).json().error.code).toBe('plan_limit_reached');
  });
});

describe('POS sales', () => {
  it('prices on the server: options, tax, service charge, change; ignores client totals', async () => {
    await setTax(owner);
    const latte = await product(owner, { name: 'Latte', sellingPrice: 40, options: [{ name: 'Size', required: true, choices: [{ name: 'Small', price: 0 }, { name: 'Large', price: 10 }] }] });
    const missing = await owner.post('/api/pos/quote', { items: [{ productId: latte.id, quantity: 1 }] });
    expect(missing.json().error.fields['items.0.options'].code).toBe('option_required');
    const quote = (await owner.post('/api/pos/quote', { items: [{ productId: latte.id, quantity: 2, options: [{ group: 'Size', choice: 'Large' }] }] })).json();
    // 2 × 50.00 = 100.00; SC 10% = 10.00; GST 8% on 100 + 8% on SC = 8.80 → 118.80
    expect(quote.subtotal).toBe(10000);
    expect(quote.serviceCharge).toBe(1000);
    expect(quote.tax).toBe(880);
    expect(quote.total).toBe(11880);

    const sale = await owner.post('/api/pos/orders', {
      items: [{ productId: latte.id, quantity: 2, options: [{ group: 'Size', choice: 'Large' }], unitPrice: 0.01 }],
      total: 1,
      payments: [{ method: 'cash', amount: 120 }],
    });
    expect(sale.statusCode, sale.body).toBe(201);
    const s = sale.json();
    expect(s.status).toBe('completed');
    expect(s.total).toBe(11880);
    expect(s.changeAmount).toBe(120);
    expect(s.number).toMatch(/^RCP-\d{4}-000001$/);
  });

  it('rejects underpayment, card overpayment and discounts without permission', async () => {
    const p = await product(owner, { sellingPrice: 10 });
    expect((await owner.post('/api/pos/orders', { items: [{ productId: p.id, quantity: 1 }], payments: [{ method: 'cash', amount: 5 }] })).json().error.code).toBe('payment_insufficient');
    expect((await owner.post('/api/pos/orders', { items: [{ productId: p.id, quantity: 1 }], payments: [{ method: 'card', amount: 15 }] })).json().error.code).toBe('payment_exceeds_balance');
    const { client: cashier } = await createStaff(env, owner, 'cashier@ops.test', 'cashier');
    const r = await cashier.post('/api/pos/orders', { items: [{ productId: p.id, quantity: 1 }], discount: 2, payments: [{ method: 'cash', amount: 10 }] });
    expect(r.json().error.code).toBe('discount_not_allowed');
    const ok = await cashier.post('/api/pos/orders', { items: [{ productId: p.id, quantity: 1 }], payments: [{ method: 'cash', amount: 10 }] });
    expect(ok.statusCode).toBe(201);
  });

  it('decrements tracked stock, notifies low stock, sends kitchen tickets per order, void reverses stock', async () => {
    const cake = await product(owner, { name: 'Cake', sellingPrice: 25, trackStock: true, minStock: 3 });
    await owner.post('/api/inventory/adjust', { productId: cake.id, mode: 'add', quantity: 5, reason: 'opening' });
    const sale = (await owner.post('/api/pos/orders', { items: [{ productId: cake.id, quantity: 2 }], payments: [{ method: 'card', amount: 25 * 2 }] })).json();
    const inv = (await owner.get('/api/inventory')).json();
    expect(inv.items.find((i: { id: string }) => i.id === cake.id).quantity).toBe(3);
    const notes = await env.db.select().from(notifications);
    expect(notes.some((n) => n.key === 'notify.low_stock')).toBe(true);
    const tickets = await env.db.select().from(kitchenOrders).where(eq(kitchenOrders.saleId, sale.id));
    expect(tickets).toHaveLength(1);
    expect(tickets[0]!.items[0]!.quantity).toBe(2);

    const v = await owner.post(`/api/sales/${sale.id}/void`, { reason: 'customer left' });
    expect(v.json().status).toBe('void');
    const after = (await owner.get('/api/inventory')).json();
    expect(after.items.find((i: { id: string }) => i.id === cake.id).quantity).toBe(5);
    const history = (await owner.get(`/api/inventory/history?productId=${cake.id}`)).json();
    expect(history.items.map((h: { type: string }) => h.type)).toEqual(expect.arrayContaining(['adjustment', 'sale', 'sale_void']));
  });

  it('blocks overselling when negative stock is disallowed', async () => {
    const s = (await owner.get('/api/settings')).json().sections.pos;
    await owner.patch('/api/settings/pos', { ...s, allowNegativeStock: false });
    const p = await product(owner, { trackStock: true });
    const r = await owner.post('/api/pos/orders', { items: [{ productId: p.id, quantity: 1 }], payments: [{ method: 'cash', amount: 10 }] });
    expect(r.json().error.code).toBe('insufficient_stock');
  });

  it('holds a table order, adds items (kitchen gets only the delta), then pays', async () => {
    const table = (await owner.post('/api/tables', { name: 'T1', capacity: 4 })).json();
    const p = await product(owner, { name: 'Burger', sellingPrice: 60 });
    const held = (await owner.post('/api/pos/orders', { tableId: table.id, items: [{ productId: p.id, quantity: 1 }] })).json();
    expect(held.status).toBe('open');
    expect((await owner.get('/api/tables')).json().items[0].status).toBe('occupied');
    await owner.put(`/api/pos/orders/${held.id}`, { tableId: table.id, items: [{ productId: p.id, quantity: 3 }] });
    const tickets = await env.db.select().from(kitchenOrders).where(eq(kitchenOrders.saleId, held.id));
    expect(tickets.map((t) => t.items[0]!.quantity).sort()).toEqual([1, 2]);
    const paid = await owner.post(`/api/pos/orders/${held.id}/pay`, { payments: [{ method: 'cash', amount: 180 }] });
    expect(paid.json().status).toBe('completed');
    expect((await owner.put(`/api/pos/orders/${held.id}`, { items: [{ productId: p.id, quantity: 1 }] })).json().error.code).toBe('document_locked');
  });

  it('kitchen display: list and status flow', async () => {
    const p = await product(owner, { name: 'Pasta' });
    await owner.post('/api/pos/orders', { orderType: 'takeaway', items: [{ productId: p.id, quantity: 1 }], payments: [{ method: 'cash', amount: 10 }] });
    const { client: chef } = await createStaff(env, owner, 'chef@ops.test', 'kitchen_staff');
    const list = (await chef.get('/api/kitchen/orders')).json();
    expect(list.items).toHaveLength(1);
    const id = list.items[0].id;
    expect((await chef.patch(`/api/kitchen/orders/${id}`, { status: 'preparing' })).json().startedAt).toBeTruthy();
    expect((await chef.patch(`/api/kitchen/orders/${id}`, { status: 'ready' })).json().readyAt).toBeTruthy();
    await chef.patch(`/api/kitchen/orders/${id}`, { status: 'completed' });
    expect((await chef.get('/api/kitchen/orders')).json().items).toHaveLength(0);
    expect((await chef.get('/api/sales')).statusCode).toBe(403);
  });
});

describe('credit / customer due', () => {
  it('requires the add-on, a customer and respects the credit limit; balances are shared and paid FIFO', async () => {
    const p = await product(owner, { sellingPrice: 100 });
    const c = await customer(owner);
    const noAddon = await owner.post('/api/pos/orders', { customerId: c.id, items: [{ productId: p.id, quantity: 1 }], payments: [{ method: 'credit', amount: 100 }] });
    expect(noAddon.json().error.code).toBe('addon_not_enabled');

    await grant('credit');
    await owner.put(`/api/customers/${c.id}`, { name: 'Ali', creditLimit: 250 });
    expect((await owner.post('/api/pos/orders', { items: [{ productId: p.id, quantity: 1 }], payments: [{ method: 'credit', amount: 100 }] })).json().error.code).toBe('customer_required');

    const s1 = (await owner.post('/api/pos/orders', { customerId: c.id, items: [{ productId: p.id, quantity: 1 }], payments: [{ method: 'cash', amount: 40 }, { method: 'credit', amount: 60 }] })).json();
    expect(s1.balanceDue).toBe(6000);
    await owner.post('/api/pos/orders', { customerId: c.id, items: [{ productId: p.id, quantity: 1 }], payments: [{ method: 'credit', amount: 100 }] });
    const over = await owner.post('/api/pos/orders', { customerId: c.id, items: [{ productId: p.id, quantity: 1 }], payments: [{ method: 'credit', amount: 100 }] });
    expect(over.json().error.code).toBe('credit_limit_exceeded');

    const profile = (await owner.get(`/api/customers/${c.id}`)).json();
    expect(profile.outstanding).toBe(16000);
    expect(profile.availableCredit).toBe(9000);

    expect((await owner.post(`/api/customers/${c.id}/credit-payments`, { method: 'cash', amount: 500 })).json().error.code).toBe('payment_exceeds_balance');
    const pay = (await owner.post(`/api/customers/${c.id}/credit-payments`, { method: 'cash', amount: 80 })).json();
    expect(pay.remainingDue).toBe(8000);
    const sales = (await owner.get(`/api/sales?customerId=${c.id}`)).json().items;
    expect(sales.find((s: { id: string }) => s.id === s1.id).balanceDue).toBe(0); // oldest paid first
    const statement = (await owner.get(`/api/customers/${c.id}/statement`)).json();
    expect(statement.balance).toBe(8000);
    expect(statement.closingBalance).toBe(8000);
    expect(statement.totals).toEqual({ debit: 16000, credit: 8000 });
    // Open items: the second credit sale still owes 80.00 (the first was paid off FIFO).
    expect(statement.openItems).toHaveLength(1);
    expect(statement.openItems[0].due).toBe(8000);
    expect(statement.outstanding).toBe(8000);
    // Date range: a period starting tomorrow carries everything as the opening balance.
    const tomorrow = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
    const later = (await owner.get(`/api/customers/${c.id}/statement?from=${tomorrow}`)).json();
    expect(later.openingBalance).toBe(8000);
    expect(later.entries).toHaveLength(0);
    expect(later.closingBalance).toBe(8000);
    // A period that ended before any activity is empty.
    const before = (await owner.get(`/api/customers/${c.id}/statement?from=2020-01-01&to=2020-01-31`)).json();
    expect(before.openingBalance).toBe(0);
    expect(before.entries).toHaveLength(0);
    expect(before.closingBalance).toBe(0);
    expect((await owner.get(`/api/customers/${c.id}/statement?from=2024-02-01&to=2024-01-01`)).json().error.code).toBe('validation_failed');
    // A sale with collected credit payments cannot be voided silently.
    expect((await owner.post(`/api/sales/${s1.id}/void`, { reason: 'test reason' })).json().error.code).toBe('invalid_status_transition');
  });

  it('credit limits can only be changed by credit managers', async () => {
    await grant('credit');
    const role = (await owner.post('/api/roles', { name: 'Front desk', permissions: ['customers.view', 'customers.create', 'customers.edit'] })).json();
    const { client } = await createStaff(env, owner, 'desk@ops.test', [role.id]);
    const c = (await client.post('/api/customers', { name: 'Big spender', creditLimit: 99999 })).json();
    expect(c.creditLimit).toBeNull();
  });
});

describe('quotations and invoices', () => {
  async function quote(client: Client, customerId: string, productId: string) {
    const r = await client.post('/api/quotations', {
      customerId,
      quotationDate: '2026-10-01',
      validUntil: '2099-12-31',
      items: [{ productId, name: 'Catering tray', quantity: 3, unitPrice: 200, discount: 0 }],
      discount: 50,
      notes: 'Thanks',
      terms: '50% advance',
    });
    expect(r.statusCode, r.body).toBe(201);
    return r.json();
  }

  it('creates numbered quotations with snapshots, converts once (even concurrently) to a new invoice', async () => {
    await setTax(owner, { serviceChargeEnabled: false, taxRate: 6 });
    const c = await customer(owner, { email: 'ali@customer.test' });
    const p = await product(owner, { name: 'Tray', sellingPrice: 200 });
    const q = await quote(owner, c.id, p.id);
    expect(q.number).toMatch(/^QT-2026-00001$/);
    // (600 - 50) = 550 + 6% = 33 → 583.00
    expect(q.total).toBe(58300);

    // Price change later must not alter the quotation.
    await owner.put(`/api/products/${p.id}`, { name: 'Tray renamed', sellingPrice: 999 });
    const detail = (await owner.get(`/api/quotations/${q.id}`)).json();
    expect(detail.items[0].itemNameSnapshot).toBe('Catering tray');
    expect(detail.items[0].unitPrice).toBe(20000);

    expect((await owner.post(`/api/quotations/${q.id}/convert`)).json().error.code).toBe('invalid_status_transition');
    const sent = await owner.post(`/api/quotations/${q.id}/send`);
    expect(sent.json().emailed).toBe(true);
    expect(env.mailer.outbox.at(-1)!.to).toBe('ali@customer.test');
    await owner.post(`/api/quotations/${q.id}/accept`);

    const results = await Promise.all([1, 2, 3].map(() => owner.post(`/api/quotations/${q.id}/convert`)));
    const created = results.filter((r) => r.statusCode === 201);
    expect(created).toHaveLength(1);
    expect(results.filter((r) => r.statusCode === 409).every((r) => ['already_converted', 'invalid_status_transition'].includes(r.json().error.code))).toBe(true);
    const inv = created[0]!.json();
    expect(inv.number).toMatch(/^INV-\d{4}-00001$/);
    expect(inv.sourceQuotationId).toBe(q.id);
    expect(inv.total).toBe(58300);
    expect((await owner.get(`/api/quotations/${q.id}`)).json().quotation.status).toBe('converted');
    expect((await owner.put(`/api/quotations/${q.id}`, { ...detail.quotation, customerId: c.id, items: [{ name: 'x', quantity: 1, unitPrice: 1 }] })).json().error.code).toBe('document_locked');
  });

  it('invoice lifecycle: issue, partial and full payments, overpay rejected, void rules, overdue', async () => {
    const c = await customer(owner);
    const r = await owner.post('/api/invoices', {
      customerId: c.id,
      invoiceDate: '2026-01-01',
      dueDate: '2026-01-15',
      items: [{ name: 'Event buffet', quantity: 1, unitPrice: 5000 }],
    });
    const inv = r.json();
    expect(inv.status).toBe('draft');
    expect((await owner.post(`/api/invoices/${inv.id}/payments`, { method: 'cash', amount: 100 })).json().error.code).toBe('invalid_status_transition');
    await owner.post(`/api/invoices/${inv.id}/issue`);
    expect((await owner.get(`/api/invoices/${inv.id}`)).json().invoice.status).toBe('overdue');
    expect((await owner.put(`/api/invoices/${inv.id}`, { customerId: c.id, invoiceDate: '2026-01-01', dueDate: '2026-01-15', items: [{ name: 'x', quantity: 1, unitPrice: 1 }] })).json().error.code).toBe('document_locked');

    const p1 = (await owner.post(`/api/invoices/${inv.id}/payments`, { method: 'bank_transfer', amount: 2000, reference: 'TT-1' })).json();
    expect(p1.status).toBe('partially_paid');
    expect(p1.balanceDue).toBe(300000);
    expect((await owner.post(`/api/invoices/${inv.id}/payments`, { method: 'cash', amount: 3000.01 })).json().error.code).toBe('payment_exceeds_balance');
    expect((await owner.post(`/api/invoices/${inv.id}/void`, { reason: 'mistake' })).json().error.code).toBe('invalid_status_transition');
    const p2 = (await owner.post(`/api/invoices/${inv.id}/payments`, { method: 'cash', amount: 3000 })).json();
    expect(p2.status).toBe('paid');
    expect(p2.balanceDue).toBe(0);
    const full = (await owner.get(`/api/invoices/${inv.id}`)).json();
    expect(full.payments).toHaveLength(2);
    expect(full.documentLanguage).toBe('en');
    expect((await owner.get(`/api/customers/${c.id}`)).json().outstanding).toBe(0);
    const notes = await env.db.select().from(notifications);
    expect(notes.some((n) => n.key === 'notify.invoice_paid')).toBe(true);
  });

  it('salesperson can quote/convert but not void invoices or see settings', async () => {
    const c = await customer(owner);
    const p = await product(owner, {});
    const { client: sales } = await createStaff(env, owner, 'sales@ops.test', 'salesperson');
    const q = await quote(sales, c.id, p.id);
    expect((await sales.post(`/api/quotations/${q.id}/accept`)).statusCode).toBe(200);
    const inv = (await sales.post(`/api/quotations/${q.id}/convert`)).json();
    expect((await sales.post(`/api/invoices/${inv.id}/void`, { reason: 'nope nope' })).statusCode).toBe(403);
    expect((await sales.get('/api/expenses')).statusCode).toBe(403);
  });
});

describe('purchasing, inventory, expenses', () => {
  it('receiving a purchase adds stock and updates weighted cost; payments tracked', async () => {
    const p = await product(owner, { name: 'Milk', type: 'ingredient', trackStock: true, costPrice: 10, unit: 'L' });
    await owner.post('/api/inventory/adjust', { productId: p.id, mode: 'add', quantity: 10, reason: 'opening' });
    const sup = (await owner.post('/api/suppliers', { name: 'Dairy Co', phone: '3001122' })).json();
    const po = (await owner.post('/api/purchases', { supplierId: sup.id, purchaseDate: '2026-10-01', items: [{ productId: p.id, quantity: 10, unitCost: 20 }] })).json();
    expect(po.number).toMatch(/^PO-\d{4}-00001$/);
    expect(po.total).toBe(20000);
    const rec = await owner.post(`/api/purchases/${po.id}/receive`);
    expect(rec.json().status).toBe('received');
    expect((await owner.post(`/api/purchases/${po.id}/receive`)).json().error.code).toBe('invalid_status_transition');
    const prod = (await owner.get(`/api/products/${p.id}`)).json();
    expect(prod.costPrice).toBe(1500); // (10×10 + 10×20) / 20
    const inv = (await owner.get('/api/inventory')).json();
    expect(inv.items.find((i: { id: string }) => i.id === p.id).quantity).toBe(20);
    expect((await owner.post(`/api/purchases/${po.id}/payments`, { amount: 250 })).json().error.code).toBe('payment_exceeds_balance');
    expect((await owner.post(`/api/purchases/${po.id}/payments`, { amount: 200 })).json().paymentStatus).toBe('paid');
    const supplier = (await owner.get(`/api/suppliers/${sup.id}`)).json();
    expect(supplier.purchases).toHaveLength(1);
  });

  it('records wastage and stock counts', async () => {
    const p = await product(owner, { trackStock: true });
    await owner.post('/api/inventory/adjust', { productId: p.id, mode: 'add', quantity: 10, reason: '' });
    await owner.post('/api/inventory/adjust', { productId: p.id, mode: 'wastage', quantity: 2, reason: 'expired' });
    expect((await owner.post('/api/inventory/adjust', { productId: p.id, mode: 'set', quantity: 5, reason: 'count' })).json().balance).toBe(5);
    expect((await owner.post('/api/inventory/adjust', { productId: p.id, mode: 'remove', quantity: 6, reason: '' })).json().error.code).toBe('insufficient_stock');
  });

  it('expenses with validated attachments', async () => {
    const e = (await owner.post('/api/expenses', { category: 'electricity', amount: 1234.5, expenseDate: '2026-10-02', payee: 'STELCO' })).json();
    expect(e.amount).toBe(123450);
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n');
    expect((await owner.request('PUT', `/api/expenses/${e.id}/attachment`, pdf, { 'content-type': 'application/pdf' })).statusCode).toBe(200);
    expect((await owner.request('PUT', `/api/expenses/${e.id}/attachment`, Buffer.from('MZ evil'), { 'content-type': 'application/pdf' })).statusCode).toBe(422);
    const got = await owner.get(`/api/expenses/${e.id}/attachment`);
    expect(got.headers['content-type']).toBe('application/pdf');
    const list = (await owner.get('/api/expenses?category=electricity')).json();
    expect(list.sum).toBe(123450);
  });
});

describe('reports', () => {
  it('computes sales, profit and payment reports server-side; CSV needs export permission', async () => {
    const p = await product(owner, { sellingPrice: 50, costPrice: 20 });
    await owner.post('/api/pos/orders', { items: [{ productId: p.id, quantity: 2 }], payments: [{ method: 'cash', amount: 100 }] });
    await owner.post('/api/expenses', { category: 'rent', amount: 30, expenseDate: new Date().toISOString().slice(0, 10) });
    const today = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const summary = (await owner.get(`/api/reports/sales-summary?from=${from}&to=${tomorrow}`)).json();
    expect(summary.rows.reduce((a: number, r: { total: number }) => a + r.total, 0)).toBe(10000);
    const profit = (await owner.get(`/api/reports/profit?from=${from}&to=${tomorrow}`)).json().summary;
    expect(profit.revenue).toBe(10000);
    expect(profit.cogs).toBe(4000);
    expect(profit.netProfit).toBe(10000 - 4000 - 3000);
    const csv = await owner.get(`/api/reports/products?from=${from}&to=${tomorrow}&format=csv`);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.body).toContain('product,quantity,revenue');
    const mgrRole = (await owner.post('/api/roles', { name: 'Viewer', permissions: ['dashboard.view', 'reports.view'] })).json();
    const { client } = await createStaff(env, owner, 'viewer@ops.test', [mgrRole.id]);
    expect((await client.get(`/api/reports/products?from=${from}&to=${today}&format=csv`)).statusCode).toBe(403);
    expect((await client.get(`/api/reports/expenses?from=${from}&to=${today}`)).statusCode).toBe(403);
    expect((await client.get(`/api/reports/nonsense?from=${from}&to=${today}`)).statusCode).toBe(404);
    const dash = (await owner.get('/api/dashboard/sales')).json();
    expect(dash.today.total).toBe(10000);
    expect(dash.trend).toHaveLength(14);
  });

  it('respects plan report history limits', async () => {
    const b = await setupBusiness(env, sa, 'Basic Reports', { plan: 'basic' });
    const r = await b.owner.get('/api/reports/sales-summary?from=2020-01-01&to=2020-02-01');
    expect(r.json().error.code).toBe('plan_limit_reached');
  });
});

describe('add-on modules', () => {
  it('karaoke: server price from hourly rate, overlap prevention, payments', async () => {
    expect((await owner.get('/api/karaoke/rooms')).json().error.code).toBe('addon_not_enabled');
    await grant('karaoke');
    const room = (await owner.post('/api/karaoke/rooms', { name: 'Room 01', capacity: 6, hourlyRate: 500 })).json();
    const b = await owner.post('/api/karaoke/bookings', { roomId: room.id, customerName: 'Party', startAt: '2026-11-01T14:00:00Z', endAt: '2026-11-01T16:30:00Z', deposit: 200, total: 1 });
    expect(b.statusCode, b.body).toBe(201);
    expect(b.json().total).toBe(125000);
    expect(b.json().paidAmount).toBe(20000);
    const clash = await owner.post('/api/karaoke/bookings', { roomId: room.id, customerName: 'Other', startAt: '2026-11-01T16:00:00Z', endAt: '2026-11-01T17:00:00Z' });
    expect(clash.json().error.code).toBe('booking_conflict');
    const pay = await owner.post(`/api/karaoke/bookings/${b.json().id}/payments`, { method: 'card', amount: 1050 });
    expect(pay.json().paidAmount).toBe(125000);
  });

  it('reservations prevent double-booking a table', async () => {
    await grant('reservations');
    const t = (await owner.post('/api/tables', { name: 'Window', capacity: 2 })).json();
    const r1 = await owner.post('/api/reservations', { tableId: t.id, customerName: 'Aisha', partySize: 2, reservedAt: '2026-11-02T18:00:00Z', durationMinutes: 90 });
    expect(r1.statusCode).toBe(201);
    const r2 = await owner.post('/api/reservations', { tableId: t.id, customerName: 'Hassan', partySize: 2, reservedAt: '2026-11-02T19:00:00Z' });
    expect(r2.json().error.code).toBe('booking_conflict');
  });

  it('recipes consume ingredients on sale; costing report shows margins', async () => {
    await grant('recipes');
    await grant('ingredient_costing');
    const beans = await product(owner, { name: 'Beans', type: 'ingredient', trackStock: true, unit: 'g', costPrice: 0.05 });
    const milk = await product(owner, { name: 'Milk', type: 'ingredient', trackStock: true, unit: 'ml', costPrice: 0.01 });
    await owner.post('/api/inventory/adjust', { productId: beans.id, mode: 'add', quantity: 1000, reason: '' });
    await owner.post('/api/inventory/adjust', { productId: milk.id, mode: 'add', quantity: 2000, reason: '' });
    const latte = await product(owner, { name: 'Latte', sellingPrice: 40 });
    expect((await owner.put(`/api/products/${latte.id}/recipe`, { items: [{ ingredientId: beans.id, quantity: 18 }, { ingredientId: milk.id, quantity: 200 }] })).statusCode).toBe(200);
    await owner.post('/api/pos/orders', { items: [{ productId: latte.id, quantity: 2 }], payments: [{ method: 'cash', amount: 40 * 2 }] });
    const inv = (await owner.get('/api/inventory')).json().items;
    expect(inv.find((i: { id: string }) => i.id === beans.id).quantity).toBe(964);
    expect(inv.find((i: { id: string }) => i.id === milk.id).quantity).toBe(1600);
    const today = new Date().toISOString().slice(0, 10);
    const costing = (await owner.get(`/api/reports/costing?from=${today}&to=${today}`)).json();
    expect(costing.rows[0]).toMatchObject({ product: 'Latte', price: 4000, recipe_cost: 290 });
  });

  it('loyalty: earn on purchase, redeem as discount, adjust', async () => {
    await grant('loyalty');
    const c = await customer(owner);
    const p = await product(owner, { sellingPrice: 150 });
    await owner.post('/api/pos/orders', { customerId: c.id, items: [{ productId: p.id, quantity: 1 }], payments: [{ method: 'cash', amount: 150 }] });
    expect((await owner.get(`/api/customers/${c.id}/loyalty`)).json().points).toBe(150);
    const settings = (await owner.get('/api/settings')).json().sections.loyalty;
    await owner.patch('/api/settings/loyalty', { ...settings, pointValue: 10, minRedeemPoints: 100 });
    const q = (await owner.post('/api/pos/quote', { customerId: c.id, redeemPoints: 100, items: [{ productId: p.id, quantity: 1 }] })).json();
    expect(q.total).toBe(15000 - 1000);
    const s = (await owner.post('/api/pos/orders', { customerId: c.id, redeemPoints: 100, items: [{ productId: p.id, quantity: 1 }], payments: [{ method: 'cash', amount: 140 }] })).json();
    expect(s.status).toBe('completed');
    expect((await owner.get(`/api/customers/${c.id}/loyalty`)).json().points).toBe(150 - 100 + 140);
    expect((await owner.post('/api/pos/orders', { customerId: c.id, redeemPoints: 5000, items: [{ productId: p.id, quantity: 1 }], payments: [{ method: 'cash', amount: 150 }] })).json().error.code).toBe('points_insufficient');
  });

  it('public QR menu + online ordering: hidden without add-on, server prices only, staff accept sends to kitchen', async () => {
    const slug = (await owner.get('/api/auth/session')).json().business.slug;
    const anon = new Client(env.app);
    expect((await anon.get(`/api/public/menu/${slug}`)).statusCode).toBe(404);
    await grant('qr_menu');
    const p = await product(owner, { name: 'Iced tea', sellingPrice: 30 });
    await product(owner, { name: 'Secret stock', type: 'ingredient' });
    const menu = (await anon.get(`/api/public/menu/${slug}`)).json();
    expect(menu.products.map((x: { name: string }) => x.name)).toEqual(['Iced tea']);
    expect(menu.ordersEnabled).toBe(false);
    expect((await anon.post(`/api/public/menu/${slug}/orders`, { customerName: 'Guest', phone: '7700000', items: [{ productId: p.id, quantity: 1 }] })).json().error.code).toBe('online_ordering_closed');

    await grant('online_ordering');
    const online = (await owner.get('/api/settings')).json().sections.online;
    await owner.patch('/api/settings/online', { ...online, ordersEnabled: true });
    const order = await anon.post(`/api/public/menu/${slug}/orders`, { customerName: 'Guest', phone: '7700000', items: [{ productId: p.id, quantity: 2, price: 0.01 }], total: 0 });
    expect(order.statusCode, order.body).toBe(201);
    expect(order.json().total).toBe(6000);
    const queue = (await owner.get('/api/online-orders')).json().items;
    expect(queue).toHaveLength(1);
    await owner.post(`/api/online-orders/${queue[0].id}/accept`);
    expect((await env.db.select().from(kitchenOrders).where(eq(kitchenOrders.saleId, queue[0].id))).length).toBe(1);
    // Staff then takes payment through the normal POS flow.
    expect((await owner.post(`/api/pos/orders/${queue[0].id}/pay`, { payments: [{ method: 'cash', amount: 60 }] })).json().status).toBe('completed');
  });
  it('QR menu shows item, category and welcome-message names in the customer language; edits without them keep them', async () => {
    const slug = (await owner.get('/api/auth/session')).json().business.slug;
    const anon = new Client(env.app);
    await grant('qr_menu');
    const cat = (await owner.post('/api/categories', { name: 'Drinks', translations: { dv: { name: 'ބުއިން' }, hi: { name: '' } } })).json();
    expect(cat.translations).toEqual({ dv: { name: 'ބުއިން', description: '' } });
    const p = await product(owner, { name: 'Iced tea', categoryId: cat.id, sellingPrice: 30, translations: { dv: { name: 'ފިނި ސައި', description: 'ލުމޯ އާއެކު' } } });
    // An older client that sends no translations must not erase them.
    const full = (await owner.get(`/api/products/${p.id}`)).json();
    const { translations: _omit, recipe: _r, stock: _s, ...rest } = full;
    await owner.put(`/api/products/${p.id}`, { ...rest, categoryId: cat.id, costPrice: 0, sellingPrice: 35, options: [], sku: '' });
    await owner.patch(`/api/categories/${cat.id}`, { sortOrder: 2 });
    const online = (await owner.get('/api/settings')).json().sections.online;
    expect(online.messageTranslations).toEqual({});
    await owner.patch('/api/settings/online', { ...online, message: 'Welcome', messageTranslations: { dv: 'މަރުޙަބާ' } });
    const menu = (await anon.get(`/api/public/menu/${slug}`)).json();
    const item = menu.products.find((x: { id: string }) => x.id === p.id);
    expect(item.translations.dv).toEqual({ name: 'ފިނި ސައި', description: 'ލުމޯ އާއެކު' });
    expect(item.price).toBe(3500);
    expect(menu.categories.find((c: { id: string }) => c.id === cat.id).translations.dv.name).toBe('ބުއިން');
    expect(menu.messageTranslations).toEqual({ dv: 'މަރުޙަބާ' });
    expect((await owner.post('/api/categories', { name: 'Bad', translations: { xx: { name: 'nope' } } })).statusCode).toBe(422);
  });
});

describe('tenant isolation for operational data', () => {
  it('Business B cannot read or modify Business A products, customers, sales, documents, purchases', async () => {
    const p = await product(owner, { name: 'Secret recipe' });
    const c = await customer(owner);
    const sale = (await owner.post('/api/pos/orders', { items: [{ productId: p.id, quantity: 1 }], payments: [{ method: 'cash', amount: 10 }] })).json();
    const inv = (await owner.post('/api/invoices', { customerId: c.id, invoiceDate: '2026-10-01', dueDate: '2026-10-31', items: [{ name: 'x', quantity: 1, unitPrice: 10 }] })).json();
    const sup = (await owner.post('/api/suppliers', { name: 'S' })).json();
    const b = await setupBusiness(env, sa, 'Other Biz');
    const other = b.owner;
    for (const url of [`/api/products/${p.id}`, `/api/customers/${c.id}`, `/api/sales/${sale.id}`, `/api/invoices/${inv.id}`, `/api/suppliers/${sup.id}`]) {
      expect((await other.get(url)).statusCode, url).toBe(404);
    }
    expect((await other.post(`/api/sales/${sale.id}/void`, { reason: 'hijack!' })).statusCode).toBe(404);
    expect((await other.post(`/api/invoices/${inv.id}/payments`, { method: 'cash', amount: 1 })).statusCode).toBe(404);
    // Using A's product / customer in B's own documents is rejected.
    expect((await other.post('/api/pos/orders', { items: [{ productId: p.id, quantity: 1 }], payments: [{ method: 'cash', amount: 10 }] })).json().error.code).toBe('product_unavailable');
    expect((await other.post('/api/invoices', { customerId: c.id, invoiceDate: '2026-10-01', dueDate: '2026-10-31', items: [{ name: 'x', quantity: 1, unitPrice: 1 }] })).statusCode).toBe(422);
    expect((await other.get('/api/sales')).json().total).toBe(0);
    const today = new Date().toISOString().slice(0, 10);
    expect((await other.get(`/api/reports/sales-summary?from=${today}&to=${today}`)).json().rows).toHaveLength(0);
    // Receipt numbers are per business.
    const p2 = await product(other, { name: 'Other item' });
    expect((await other.post('/api/pos/orders', { items: [{ productId: p2.id, quantity: 1 }], payments: [{ method: 'cash', amount: 10 }] })).json().number).toMatch(/-000001$/);
  });
});
