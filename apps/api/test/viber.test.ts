import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { messageLog } from '../src/db/schema';
import { creditMessage, normalizeViberNumber } from '../src/services/viber/creditMessage';
import { RecordingProvider } from '../src/services/viber/provider';
import { Client, createSuperAdmin, createTestEnv, loginSuperAdmin, resetDb, setupBusiness, type TestEnv } from './helpers';

let env: TestEnv;
let sa: Client;
let owner: Client;
let businessId: string;
let productId: string;
const viber = () => env.app.deps.viber as RecordingProvider;

beforeAll(async () => {
  env = await createTestEnv();
  await resetDb(env.db);
  await createSuperAdmin(env.db);
  sa = await loginSuperAdmin(env);
  const biz = await setupBusiness(env, sa, 'Viber Cafe', { type: 'cafe' });
  owner = biz.owner;
  businessId = biz.businessId;
  expect((await sa.post(`/api/superadmin/businesses/${businessId}/addons/credit/grant`)).statusCode).toBe(200);
  productId = (await owner.post('/api/products', { name: 'Milk tea', sellingPrice: 10, costPrice: 3 })).json().id;
});
afterAll(() => env.close());

async function customer(body: Record<string, unknown>) {
  return (await owner.post('/api/customers', { name: 'Credit customer', creditLimit: 100000, ...body })).json().id as string;
}
async function sale(customerId: string | null, quantity: number, payments: { method: string; amount: number }[]) {
  const r = await owner.post('/api/pos/orders', { customerId, items: [{ productId, quantity }], payments });
  expect(r.statusCode).toBe(201);
  return r.json() as { id: string; total: number; status: string };
}
/** The message is dispatched after the response; wait briefly for it (or confirm none came). */
async function messagesFor(saleId: string, waitMs = 400) {
  const until = Date.now() + waitMs;
  for (;;) {
    const rows = await env.db.select().from(messageLog).where(and(eq(messageLog.saleId, saleId), eq(messageLog.channel, 'viber')));
    if ((rows.length && rows[0]!.status !== 'queued') || Date.now() > until) return rows;
    await new Promise((r) => setTimeout(r, 25));
  }
}

describe('message format', () => {
  it('contains only the transaction total', () => {
    expect(creditMessage(4000)).toBe('Total: 40/-');
    expect(creditMessage(2500)).toBe('Total: 25/-');
    expect(creditMessage(10000)).toBe('Total: 100/-');
    expect(creditMessage(125000)).toBe('Total: 1,250/-');
    expect(creditMessage(12550)).toBe('Total: 125.50/-');
  });
  it('normalises registered numbers to international format', () => {
    expect(normalizeViberNumber('777 1234', '960')).toBe('9607771234');
    expect(normalizeViberNumber('+960 777-1234', '960')).toBe('9607771234');
    expect(normalizeViberNumber('00960 7771234', '')).toBe('9607771234');
    expect(normalizeViberNumber('', '960')).toBeNull();
    expect(normalizeViberNumber('12', '')).toBeNull();
  });
});

describe('Viber Credit (Pay Later) messaging', () => {
  it('is off by default: no message, and the manager cannot switch it on before Super Admin enables it', async () => {
    const c = await customer({ viberPhone: '7771234' });
    const s = await sale(c, 4, [{ method: 'credit', amount: 40 }]);
    expect(await messagesFor(s.id)).toHaveLength(0);
    const on = await owner.put('/api/viber-credit', { enabled: true, countryCode: '960' });
    expect(on.statusCode).toBe(403);
    expect(on.json().error.code).toBe('feature_not_enabled');
  });

  it('business requests → Super Admin enables → manager turns it on', async () => {
    const req = (await owner.post('/api/viber-credit/request')).json();
    expect(req.requestedAt).toBeTruthy();
    const detail = (await sa.get(`/api/superadmin/businesses/${businessId}`)).json();
    expect(detail.business.viberCreditRequestedAt).toBeTruthy();
    expect(detail.business.superadminViberCreditEnabled).toBe(false);

    const enabled = (await sa.post(`/api/superadmin/businesses/${businessId}/features/viber-credit`, { enabled: true })).json();
    expect(enabled).toMatchObject({ superadminEnabled: true, managerEnabled: false, active: false });
    const st = (await owner.put('/api/viber-credit', { enabled: true, countryCode: '960' })).json();
    expect(st).toMatchObject({ available: true, enabled: true, active: true, countryCode: '960' });
    expect((await owner.get('/api/auth/session')).json().viberCredit).toEqual({ available: true, active: true });
  });

  it('sends "Total: 40/-" to the registered Viber number for a Credit (Pay Later) sale', async () => {
    const c = await customer({ phone: '9999999', viberPhone: '777 1234' });
    const before = viber().sent.length;
    const s = await sale(c, 4, [{ method: 'credit', amount: 40 }]);
    const rows = await messagesFor(s.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: 'sent', recipient: '9607771234', body: 'Total: 40/-' });
    expect(viber().sent.slice(before)).toEqual([{ to: '9607771234', text: 'Total: 40/-' }]);
  });

  it('uses the full transaction total when part is paid now and the rest on credit; falls back to phone', async () => {
    const c = await customer({ phone: '+960 7654321' });
    const s = await sale(c, 125, [
      { method: 'cash', amount: 500 },
      { method: 'credit', amount: 750 },
    ]);
    const rows = await messagesFor(s.id);
    expect(rows[0]).toMatchObject({ recipient: '9607654321', body: 'Total: 1,250/-' });
  });

  it('never sends for cash, card, bank transfer or other payments', async () => {
    const c = await customer({ viberPhone: '7771234' });
    for (const method of ['cash', 'card', 'bank_transfer', 'other']) {
      const s = await sale(c, 1, [{ method, amount: 10 }]);
      expect(await messagesFor(s.id, 150)).toHaveLength(0);
    }
  });

  it('completes the credit sale normally when the customer has no number', async () => {
    const c = await customer({ phone: '', viberPhone: '' });
    const s = await sale(c, 2, [{ method: 'credit', amount: 20 }]);
    expect(s.status).toBe('completed');
    expect(await messagesFor(s.id, 150)).toHaveLength(0);
  });

  it('a provider outage never affects checkout; the attempt is logged as failed', async () => {
    const real = env.app.deps.viber;
    env.app.deps.viber = { name: 'down', send: async () => Promise.reject(new Error('gateway timeout')) };
    try {
      const c = await customer({ viberPhone: '7771234' });
      const s = await sale(c, 3, [{ method: 'credit', amount: 30 }]);
      expect(s.status).toBe('completed');
      const rows = await messagesFor(s.id);
      expect(rows[0]).toMatchObject({ status: 'failed', body: 'Total: 30/-' });
      expect(rows[0]!.error).toContain('gateway timeout');
    } finally {
      env.app.deps.viber = real;
    }
  });

  it('manager OFF or Super Admin disabled → no messages', async () => {
    const c = await customer({ viberPhone: '7771234' });
    await owner.put('/api/viber-credit', { enabled: false, countryCode: '960' });
    const s1 = await sale(c, 1, [{ method: 'credit', amount: 10 }]);
    expect(await messagesFor(s1.id, 150)).toHaveLength(0);

    await owner.put('/api/viber-credit', { enabled: true, countryCode: '960' });
    await sa.post(`/api/superadmin/businesses/${businessId}/features/viber-credit`, { enabled: false });
    const s2 = await sale(c, 1, [{ method: 'credit', amount: 10 }]);
    expect(await messagesFor(s2.id, 150)).toHaveLength(0);
    expect((await owner.get('/api/viber-credit')).json()).toMatchObject({ available: false, enabled: true, active: false });
  });

  it('credit overview lists credit customers with their dues and the grand total', async () => {
    const res = await owner.get('/api/credit/overview');
    expect(res.statusCode, res.body).toBe(200);
    const o = res.json();
    const sum = o.customers.reduce((a: number, c: { due: number }) => a + c.due, 0);
    expect(o.totals.due).toBe(sum);
    expect(o.totals.due).toBeGreaterThan(0);
    expect(o.customers[0].due).toBeGreaterThanOrEqual(o.customers.at(-1).due);
    expect(o.customers.every((c: { creditLimit: number | null; due: number }) => c.creditLimit !== null || c.due > 0)).toBe(true);
  });
});
