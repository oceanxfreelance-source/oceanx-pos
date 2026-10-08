import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Client, createStaff, createSuperAdmin, createTestEnv, loginSuperAdmin, resetDb, setupBusiness, type TestEnv } from './helpers';

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da6364f8ff1f0003030200efa6c8f00000000049454e44ae426082', 'hex');
const png = { 'content-type': 'image/png' };

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
  biz = await setupBusiness(env, sa, 'Stamp Cafe', { type: 'cafe' });
  owner = biz.owner;
});

describe('stamp and signatures on documents', () => {
  it('managers upload the stamp, each user their own signature; documents carry them; switches turn them off', async () => {
    const manager = await createStaff(env, owner, 'manager@stamp.test', 'manager');
    const cashier = await createStaff(env, owner, 'cashier@stamp.test', 'cashier');
    expect((await cashier.client.request('PUT', '/api/settings/stamp', PNG, png)).statusCode).toBe(403);
    expect((await manager.client.request('PUT', '/api/settings/stamp', PNG, png)).statusCode).toBe(200);
    expect((await manager.client.request('PUT', '/api/me/signature', PNG, png)).statusCode).toBe(200);
    expect((await manager.client.request('PUT', '/api/me/signature', Buffer.from('<svg/>'), png)).statusCode).toBe(422);
    const session = (await manager.client.get('/api/auth/session')).json();
    expect(session.user.hasSignature).toBe(true);
    expect(session.business.hasStamp).toBe(true);

    // The manager prepares an invoice: it shows the stamp and the manager's signature.
    const c = (await manager.client.post('/api/customers', { name: 'Ali' })).json();
    const inv = (await manager.client.post('/api/invoices', { customerId: c.id, invoiceDate: '2026-10-01', dueDate: '2026-10-31', items: [{ name: 'x', quantity: 1, unitPrice: 10 }] })).json();
    const doc = (await owner.get(`/api/invoices/${inv.id}`)).json();
    expect(doc.branding).toEqual({ stamp: true, signer: { id: manager.userId, name: expect.any(String), hasSignature: true } });
    const img = await cashier.client.get(`/api/users/${manager.userId}/signature`);
    expect(img.statusCode).toBe(200);
    expect(img.headers['content-type']).toBe('image/png');
    expect((await owner.get('/api/settings/stamp')).statusCode).toBe(200);

    // A quotation by the owner (no signature yet): stamp only.
    const q = (await owner.post('/api/quotations', { customerId: c.id, quotationDate: '2026-10-01', validUntil: '2026-10-31', items: [{ name: 'x', quantity: 1, unitPrice: 10 }] })).json();
    expect((await owner.get(`/api/quotations/${q.id}`)).json().branding.signer.hasSignature).toBe(false);

    // Switches in Settings.
    expect((await manager.client.patch('/api/settings/branding', { showStamp: false, showSignature: true })).statusCode).toBe(200);
    expect((await owner.get(`/api/invoices/${inv.id}`)).json().branding.stamp).toBe(false);
    await owner.patch('/api/settings/branding', { showStamp: true, showSignature: false });
    expect((await owner.get(`/api/invoices/${inv.id}`)).json().branding.signer.hasSignature).toBe(false);

    // Removing.
    await manager.client.request('DELETE', '/api/me/signature');
    expect((await owner.get(`/api/users/${manager.userId}/signature`)).statusCode).toBe(404);
    await manager.client.request('DELETE', '/api/settings/stamp');
    expect((await owner.get('/api/settings/stamp')).statusCode).toBe(404);
  });

  it('other businesses cannot read a signature or stamp', async () => {
    await owner.request('PUT', '/api/me/signature', PNG, png);
    await owner.request('PUT', '/api/settings/stamp', PNG, png);
    const ownerId = (await owner.get('/api/auth/session')).json().user.id;
    const other = (await setupBusiness(env, sa, 'Other Cafe')).owner;
    expect((await other.get(`/api/users/${ownerId}/signature`)).statusCode).toBe(404);
    // Each business only ever gets its own stamp.
    expect((await other.get('/api/settings/stamp')).statusCode).toBe(404);
  });
});
