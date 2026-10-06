import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { users } from '../src/db/schema';
import { Client, createStaff, createSuperAdmin, createTestEnv, loginSuperAdmin, resetDb, roleIdByKey, setupBusiness, type TestEnv } from './helpers';

let env: TestEnv;
let a: Awaited<ReturnType<typeof setupBusiness>>;
let b: Awaited<ReturnType<typeof setupBusiness>>;
let bUserId: string;
let bRoleId: string;
let bOutletId: string;

const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');

beforeAll(async () => {
  env = await createTestEnv();
});
afterAll(async () => env.close());
beforeEach(async () => {
  await resetDb(env.db);
  env.mailer.outbox.length = 0;
  await createSuperAdmin(env.db);
  const sa = await loginSuperAdmin(env);
  a = await setupBusiness(env, sa, 'Business A');
  b = await setupBusiness(env, sa, 'Business B');
  bUserId = (await createStaff(env, b.owner, 'cashier@b.test', 'cashier')).userId;
  bRoleId = await roleIdByKey(b.owner, 'manager');
  bOutletId = (await b.owner.get('/api/auth/session')).json().outlet.id;
  await b.owner.request('PUT', '/api/settings/logo', PNG, { 'content-type': 'image/png' });
});

describe('tenant isolation: Business A can never reach Business B', () => {
  it('lists only its own users, roles and activity', async () => {
    const usersA = (await a.owner.get('/api/users')).json();
    expect(usersA.items.every((u: { email: string }) => u.email.endsWith('@businessa.test'))).toBe(true);
    expect(usersA.items.some((u: { id: string }) => u.id === bUserId)).toBe(false);
    const rolesA = (await a.owner.get('/api/roles')).json().items;
    expect(rolesA.some((r: { id: string }) => r.id === bRoleId)).toBe(false);
    const logs = (await a.owner.get('/api/activity-logs?pageSize=100')).json().items;
    expect(logs.some((l: { entityId: string }) => l.entityId === bUserId)).toBe(false);
  });

  it('direct ID access (IDOR) to B resources returns 404', async () => {
    expect((await a.owner.get(`/api/users/${bUserId}`)).statusCode).toBe(404);
    expect((await a.owner.patch(`/api/users/${bUserId}`, { name: 'hijacked' })).statusCode).toBe(404);
    expect((await a.owner.post(`/api/users/${bUserId}/password`, { password: 'Hijack-Pass-1' })).statusCode).toBe(404);
    expect((await a.owner.delete(`/api/users/${bUserId}`)).statusCode).toBe(404);
    expect((await a.owner.get(`/api/roles/${bRoleId}`)).statusCode).toBe(404);
    expect((await a.owner.put(`/api/roles/${bRoleId}`, { name: 'Renamed', permissions: [] })).statusCode).toBe(404);
    expect((await a.owner.delete(`/api/roles/${bRoleId}`)).statusCode).toBe(404);
    const [stillThere] = await env.db.select().from(users).where(eq(users.id, bUserId));
    expect(stillThere!.name).not.toBe('hijacked');
    expect(stillThere!.deletedAt).toBeNull();
  });

  it('cannot attach B roles or B outlets to A users', async () => {
    const res = await a.owner.post('/api/users', { name: 'Mix', email: 'mix@a.test', password: 'Mixed-Pass-1', roleIds: [bRoleId] });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.fields.roleIds.code).toBe('invalid_option');
    const waiter = await roleIdByKey(a.owner, 'waiter');
    const res2 = await a.owner.post('/api/users', { name: 'Mix', email: 'mix@a.test', password: 'Mixed-Pass-1', roleIds: [waiter], outletIds: [bOutletId] });
    expect(res2.statusCode).toBe(422);
  });

  it('cannot switch into a B outlet', async () => {
    expect((await a.owner.post('/api/me/outlet', { outletId: bOutletId })).statusCode).toBe(404);
  });

  it('client-supplied business_id / outlet_id / user ids are ignored', async () => {
    const waiter = await roleIdByKey(a.owner, 'waiter');
    const res = await a.owner.post('/api/users', {
      name: 'Sneaky',
      email: 'sneaky@a.test',
      password: 'Sneaky-Pass-1',
      roleIds: [waiter],
      businessId: b.businessId,
      business_id: b.businessId,
      outlet_id: bOutletId,
      isOwner: true,
    });
    expect(res.statusCode).toBe(201);
    const [row] = await env.db.select().from(users).where(eq(users.id, res.json().id));
    expect(row!.businessId).toBe(a.businessId);
    expect(row!.isOwner).toBe(false);

    await a.owner.patch('/api/settings/profile', { name: 'A Renamed', businessType: 'cafe', businessId: b.businessId });
    expect((await b.owner.get('/api/auth/session')).json().business.name).toBe('Business B');
  });

  it("files are served only from the requester's own business", async () => {
    expect((await b.owner.get('/api/settings/logo')).statusCode).toBe(200);
    // A has no logo; there is no URL parameter that could point at B's file.
    expect((await a.owner.get('/api/settings/logo')).statusCode).toBe(404);
    expect((await a.owner.get(`/api/settings/logo?businessId=${b.businessId}`)).statusCode).toBe(404);
  });

  it('malformed ids are 404 (no information leak)', async () => {
    expect((await a.owner.get('/api/users/1 OR 1=1')).statusCode).toBe(404);
    expect((await a.owner.get('/api/users/not-a-uuid')).statusCode).toBe(404);
  });

  it('dashboard and settings data are tenant-scoped', async () => {
    await a.owner.patch('/api/settings/tax', {
      taxEnabled: true,
      taxName: 'GST',
      taxRate: 8,
      pricesIncludeTax: false,
      taxNumber: 'A-123',
      serviceChargeEnabled: true,
      serviceChargeRate: 10,
    });
    const bSettings = (await b.owner.get('/api/settings')).json();
    expect(bSettings.sections.tax.taxRate).toBe(0);
    const dashA = (await a.owner.get('/api/dashboard')).json();
    expect(dashA.widgets.team.activeUsers).toBe(1);
  });

  it('unauthenticated requests get nothing', async () => {
    const anon = new Client(env.app);
    for (const url of ['/api/users', '/api/roles', '/api/settings', '/api/dashboard', '/api/settings/logo', `/api/users/${bUserId}`]) {
      expect((await anon.get(url)).statusCode, url).toBe(401);
    }
  });
});
