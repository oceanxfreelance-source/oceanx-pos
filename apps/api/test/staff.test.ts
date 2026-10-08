import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { syncReferenceData } from '../src/db/referenceData';
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
  biz = await setupBusiness(env, sa, 'Staff Cafe', { type: 'cafe' });
  owner = biz.owner;
});

async function grant(code: string, businessId = biz.businessId) {
  expect((await sa.post(`/api/superadmin/businesses/${businessId}/addons/${code}/grant`)).statusCode).toBe(200);
}

describe('add-on requests', () => {
  it('a business requests an add-on; Super Admin sees it; granting clears the request', async () => {
    const r = await owner.post('/api/addons/payroll/request', { note: 'We have 12 staff' });
    expect(r.json()).toEqual({ ok: true, enabled: false });
    const mine = (await owner.get('/api/addons')).json().items.find((a: { code: string }) => a.code === 'payroll');
    expect(mine.requestedAt).toBeTruthy();
    const list = (await sa.get('/api/superadmin/businesses?q=Staff')).json().items[0];
    expect(list.addonRequests).toBe(1);
    const detail = (await sa.get(`/api/superadmin/businesses/${biz.businessId}`)).json().addons.find((a: { code: string }) => a.code === 'payroll');
    expect(detail.requestNote).toBe('We have 12 staff');
    await grant('payroll');
    expect((await sa.get('/api/superadmin/businesses?q=Staff')).json().items[0].addonRequests).toBe(0);
    expect((await owner.get('/api/addons')).json().items.find((a: { code: string }) => a.code === 'payroll').enabled).toBe(true);
    expect((await owner.post('/api/addons/nope/request')).statusCode).toBe(404);
  });
});

describe('payroll (salary sheets)', () => {
  it('is hidden until Super Admin grants the add-on; managers get it too', async () => {
    expect((await owner.get('/api/payroll')).statusCode).toBe(403);
    await grant('payroll');
    expect((await owner.get('/api/payroll')).statusCode).toBe(200);
    const manager = await createStaff(env, owner, 'manager@staff.test', 'manager');
    expect((await manager.client.get('/api/payroll')).statusCode).toBe(200);
    const cashier = await createStaff(env, owner, 'cashier@staff.test', 'cashier');
    expect((await cashier.client.get('/api/payroll')).statusCode).toBe(403);
  });

  it('existing businesses: a release adding payroll permissions gives them to Manager roles, not custom roles', async () => {
    const custom = (await owner.post('/api/roles', { name: 'Helper', permissions: ['dashboard.view'] })).json();
    // Simulate the previous release, which had no payroll/rota permissions.
    await env.db.execute(sql`DELETE FROM permissions WHERE key IN ('payroll.view', 'payroll.manage', 'rota.view', 'rota.manage')`);
    await syncReferenceData(env.db);
    const rows = (await env.db.execute(sql`
      SELECT r.system_key, r.id, rp.permission_key FROM role_permissions rp JOIN roles r ON r.id = rp.role_id
      WHERE rp.permission_key = 'payroll.manage' AND r.business_id = ${biz.businessId}`)) as unknown as { rows?: { system_key: string | null; id: string }[] };
    const list = (rows.rows ?? (rows as unknown as { system_key: string | null; id: string }[])).map((r) => r.system_key);
    expect(list).toContain('manager');
    expect(list).toContain('business_admin');
    expect(list).not.toContain(null);
    expect((rows.rows ?? (rows as unknown as { id: string }[])).some((r) => r.id === custom.id)).toBe(false);
  });

  it('builds a monthly sheet from staff, computes net on the server, locks when finalized and books the expense', async () => {
    await grant('payroll');
    const ali = (await owner.post('/api/staff', { name: 'Ali', position: 'Chef', basicSalary: 8000 })).json();
    await owner.post('/api/staff', { name: 'Sara', position: 'Cashier', basicSalary: 6000 });
    await owner.post('/api/staff', { name: 'Old', isActive: false, basicSalary: 1 });
    const run = (await owner.post('/api/payroll', { period: '2026-09' })).json();
    expect(run.lines.map((l: { name: string }) => l.name)).toEqual(['Ali', 'Sara']);
    expect(run.totals.net).toBe(1_400_000);
    expect((await owner.post('/api/payroll', { period: '2026-09' })).json().error.code).toBe('payroll_period_exists');

    const line = run.lines.find((l: { staffId: string }) => l.staffId === ali.id);
    // A client-sent "net" is ignored: the server calculates it.
    const upd = (
      await owner.put(`/api/payroll/${run.id}`, {
        notes: 'September',
        lines: [{ id: line.id, basic: 8000, allowances: 500, overtime: 250.5, deductions: 100, advance: 1000, notes: 'OT 5h', net: 1 }],
      })
    ).json();
    const l2 = upd.lines.find((l: { id: string }) => l.id === line.id);
    expect(l2.net).toBe(800_000 + 50_000 + 25_050 - 10_000 - 100_000);
    expect(upd.totalNet).toBe(l2.net + 600_000);
    expect(upd.totals.advance).toBe(100_000);

    const fin = (await owner.post(`/api/payroll/${run.id}/finalize`, { addToExpenses: true, paymentMethod: 'bank_transfer' })).json();
    expect(fin.status).toBe('finalized');
    expect(fin.expenseId).toBeTruthy();
    const exp = (await owner.get('/api/expenses')).json().items.find((e: { id: string }) => e.id === fin.expenseId);
    expect(exp).toMatchObject({ category: 'salaries', amount: upd.totalNet, expenseDate: '2026-09-30' });
    expect((await owner.put(`/api/payroll/${run.id}`, { lines: [], notes: '' })).json().error.code).toBe('document_locked');

    // Reopening withdraws the booked expense so it is never counted twice.
    const re = (await owner.post(`/api/payroll/${run.id}/reopen`)).json();
    expect(re.status).toBe('draft');
    expect((await owner.get('/api/expenses')).json().items.find((e: { id: string }) => e.id === fin.expenseId)).toBeUndefined();
  });

  it('keeps salaries private: rota-only users see staff but not pay; other businesses see nothing', async () => {
    await grant('payroll');
    await grant('staff_rota');
    const s = (await owner.post('/api/staff', { name: 'Ali', basicSalary: 8000 })).json();
    const run = (await owner.post('/api/payroll', { period: '2026-10' })).json();
    const rotaRole = (await owner.post('/api/roles', { name: 'Rota keeper', permissions: ['rota.view', 'rota.manage', 'dashboard.view'] })).json();
    const keeper = await createStaff(env, owner, 'rota@staff.test', [rotaRole.id]);
    const seen = (await keeper.client.get('/api/staff')).json().items[0];
    expect(seen.basicSalary).toBeNull();
    // Editing a person from the rota side never changes their salary.
    await keeper.client.put(`/api/staff/${s.id}`, { name: 'Ali Hassan', basicSalary: 1 });
    expect((await owner.get('/api/staff')).json().items[0]).toMatchObject({ name: 'Ali Hassan', basicSalary: 800_000 });
    expect((await keeper.client.get(`/api/payroll/${run.id}`)).statusCode).toBe(403);

    const other = (await setupBusiness(env, sa, 'Other Cafe')).owner;
    const ob = (await sa.get('/api/superadmin/businesses?q=Other')).json().items[0].id;
    await grant('payroll', ob);
    expect((await other.get(`/api/payroll/${run.id}`)).statusCode).toBe(404);
    expect((await other.put(`/api/staff/${s.id}`, { name: 'x' })).statusCode).toBe(404);
    expect((await other.get('/api/staff')).json().items).toHaveLength(0);
  });
});

describe('duty rota', () => {
  it('assigns shifts, days off and leave per day; copies a week; rejects other businesses', async () => {
    expect((await owner.get('/api/rota?start=2026-10-05')).statusCode).toBe(403);
    await grant('staff_rota');
    const ali = (await owner.post('/api/staff', { name: 'Ali' })).json();
    const sara = (await owner.post('/api/staff', { name: 'Sara' })).json();
    const morning = (await owner.post('/api/rota/shifts', { name: 'Morning', startTime: '08:00', endTime: '16:00', color: 'amber' })).json();
    expect((await owner.post('/api/rota/shifts', { name: 'Bad', startTime: '25:00', endTime: '16:00' })).statusCode).toBe(422);

    expect((await owner.put('/api/rota/entries', { staffId: ali.id, date: '2026-10-05', kind: 'shift', shiftId: morning.id })).statusCode).toBe(200);
    await owner.put('/api/rota/entries', { staffId: sara.id, date: '2026-10-05', kind: 'off' });
    await owner.put('/api/rota/entries', { staffId: sara.id, date: '2026-10-06', kind: 'leave', note: 'Sick' });
    expect((await owner.put('/api/rota/entries', { staffId: ali.id, date: '2026-10-06', kind: 'shift' })).statusCode).toBe(422);
    // Changing a cell replaces it.
    await owner.put('/api/rota/entries', { staffId: sara.id, date: '2026-10-05', kind: 'shift', shiftId: morning.id });

    const week = (await owner.get('/api/rota?start=2026-10-05')).json();
    expect(week.days).toHaveLength(7);
    expect(week.days[6]).toBe('2026-10-11');
    expect(week.staff.map((s: { name: string }) => s.name)).toEqual(['Ali', 'Sara']);
    expect(week.entries).toHaveLength(3);

    expect((await owner.post('/api/rota/copy', { from: '2026-10-05', to: '2026-10-12' })).json().copied).toBe(3);
    const next = (await owner.get('/api/rota?start=2026-10-12')).json();
    expect(next.entries.find((e: { staffId: string; date: string }) => e.staffId === sara.id && e.date === '2026-10-13')).toMatchObject({ kind: 'leave', note: 'Sick' });

    await owner.put('/api/rota/entries', { staffId: ali.id, date: '2026-10-05', kind: 'none' });
    expect((await owner.get('/api/rota?start=2026-10-05')).json().entries).toHaveLength(2);

    const other = (await setupBusiness(env, sa, 'Rota Thief')).owner;
    const ob = (await sa.get('/api/superadmin/businesses?q=Rota%20Thief')).json().items[0].id;
    await grant('staff_rota', ob);
    expect((await other.put('/api/rota/entries', { staffId: ali.id, date: '2026-10-07', kind: 'off' })).statusCode).toBe(404);
    expect((await other.get('/api/rota?start=2026-10-05')).json().entries).toHaveLength(0);
    expect((await other.delete(`/api/rota/shifts/${morning.id}`)).statusCode).toBe(404);
  });
});
