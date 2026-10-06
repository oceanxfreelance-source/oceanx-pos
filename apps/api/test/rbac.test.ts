import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Client, createStaff, createSuperAdmin, createTestEnv, loginSuperAdmin, planId, resetDb, roleIdByKey, setupBusiness, type TestEnv } from './helpers';

let env: TestEnv;
let sa: Client;

beforeAll(async () => {
  env = await createTestEnv();
});
afterAll(async () => env.close());
beforeEach(async () => {
  await resetDb(env.db);
  env.mailer.outbox.length = 0;
  await createSuperAdmin(env.db);
  sa = await loginSuperAdmin(env);
});

describe('role permissions (server-side enforcement)', () => {
  it('creates the six system roles with granular permissions', async () => {
    const { owner } = await setupBusiness(env, sa, 'Roles Cafe');
    const roles = (await owner.get('/api/roles')).json().items as { systemKey: string; permissions: string[] }[];
    expect(roles.map((r) => r.systemKey).sort()).toEqual(['business_admin', 'cashier', 'kitchen_staff', 'manager', 'salesperson', 'waiter']);
    const sales = roles.find((r) => r.systemKey === 'salesperson')!;
    expect(sales.permissions).toContain('quotations.convert_to_invoice');
    expect(sales.permissions).not.toContain('users.view');
  });

  it('cashier: POS-type access only; management APIs are denied', async () => {
    const { owner } = await setupBusiness(env, sa, 'Cashier Test');
    const { client: cashier } = await createStaff(env, owner, 'cashier@ct.test', 'cashier');
    const session = (await cashier.get('/api/auth/session')).json();
    expect(session.permissions).toContain('pos.access');
    expect(session.permissions).not.toContain('users.view');
    expect((await cashier.get('/api/dashboard')).statusCode).toBe(200);
    for (const [method, url] of [
      ['GET', '/api/users'],
      ['GET', '/api/roles'],
      ['GET', '/api/settings'],
      ['GET', '/api/activity-logs'],
      ['PATCH', '/api/settings/tax'],
    ] as const) {
      const res = await cashier.request(method, url, method === 'GET' ? undefined : {});
      expect(res.statusCode, `${method} ${url}`).toBe(403);
      expect(res.json().error.code).toBe('permission_denied');
    }
  });

  it('kitchen staff and salesperson get only their scoped permissions', async () => {
    const { owner } = await setupBusiness(env, sa, 'Scopes');
    const { client: kitchen } = await createStaff(env, owner, 'chef@scopes.test', 'kitchen_staff');
    const k = (await kitchen.get('/api/auth/session')).json().permissions as string[];
    expect(k.sort()).toEqual(['dashboard.view', 'kitchen.manage', 'kitchen.view']);
    const { client: sales } = await createStaff(env, owner, 'sales@scopes.test', 'salesperson');
    const s = (await sales.get('/api/auth/session')).json().permissions as string[];
    expect(s).toContain('quotations.create');
    expect(s).not.toContain('settings.view');
    expect((await sales.get('/api/settings')).statusCode).toBe(403);
  });

  it('permission removal takes effect on the very next request', async () => {
    const { owner } = await setupBusiness(env, sa, 'Revoke Now');
    const role = (await owner.post('/api/roles', { name: 'Auditor', permissions: ['dashboard.view', 'users.view'] })).json();
    const { client } = await createStaff(env, owner, 'aud@revoke.test', [role.id]);
    expect((await client.get('/api/users')).statusCode).toBe(200);
    await owner.put(`/api/roles/${role.id}`, { name: 'Auditor', permissions: ['dashboard.view'] });
    expect((await client.get('/api/users')).statusCode).toBe(403);
    const logs = (await owner.get('/api/activity-logs?action=permission.changed')).json().items;
    expect(logs[0].metadata.removed).toEqual(['users.view']);
  });

  it('unknown permission keys are rejected', async () => {
    const { owner } = await setupBusiness(env, sa, 'Unknown Perm');
    const res = await owner.post('/api/roles', { name: 'Hacker', permissions: ['superadmin.everything'] });
    expect(res.statusCode).toBe(422);
  });

  it('client-supplied permission lists in the session are ignored (server computes them)', async () => {
    const { owner } = await setupBusiness(env, sa, 'Ignore Client');
    const { client } = await createStaff(env, owner, 'w@ignore.test', 'waiter');
    const res = await client.request('GET', '/api/users', undefined, { 'x-permissions': 'users.view', 'x-business-id': 'anything' });
    expect(res.statusCode).toBe(403);
  });
});

describe('privilege escalation protection', () => {
  async function setupDelegate() {
    const ctx = await setupBusiness(env, sa, 'Escalation Inc');
    const hr = (
      await ctx.owner.post('/api/roles', {
        name: 'HR',
        permissions: ['dashboard.view', 'users.view', 'users.create', 'users.edit', 'users.delete', 'roles.view', 'roles.manage'],
      })
    ).json();
    const delegate = await createStaff(env, ctx.owner, 'hr@escalation.test', [hr.id]);
    return { ...ctx, hrRoleId: hr.id as string, delegate };
  }

  it('cannot create a role with permissions the actor lacks', async () => {
    const { delegate } = await setupDelegate();
    const res = await delegate.client.post('/api/roles', { name: 'Boss', permissions: ['settings.manage'] });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('privilege_escalation');
    const ok = await delegate.client.post('/api/roles', { name: 'Viewer', permissions: ['users.view'] });
    expect(ok.statusCode).toBe(201);
  });

  it('cannot assign a more powerful role to a new or existing user (or themselves)', async () => {
    const { owner, delegate } = await setupDelegate();
    const adminRole = await roleIdByKey(owner, 'business_admin');
    const create = await delegate.client.post('/api/users', { name: 'Evil', email: 'evil@escalation.test', password: 'Evil-Pass-123', roleIds: [adminRole] });
    expect(create.json().error.code).toBe('privilege_escalation');
    const self = await delegate.client.patch(`/api/users/${delegate.userId}`, { roleIds: [adminRole] });
    expect(self.json().error.code).toBe('cannot_modify_self');
  });

  it('cannot edit its own role to add permissions', async () => {
    const { delegate, hrRoleId } = await setupDelegate();
    const res = await delegate.client.put(`/api/roles/${hrRoleId}`, { name: 'HR', permissions: ['users.view', 'settings.manage'] });
    expect(res.json().error.code).toBe('privilege_escalation');
  });

  it('cannot modify, reset or delete the owner or more privileged users', async () => {
    const { owner, delegate } = await setupDelegate();
    const ownerId = (await owner.get('/api/auth/session')).json().user.id;
    expect((await delegate.client.patch(`/api/users/${ownerId}`, { name: 'Pwned' })).json().error.code).toBe('cannot_modify_owner');
    expect((await delegate.client.post(`/api/users/${ownerId}/password`, { password: 'Taken-Over-1' })).json().error.code).toBe('cannot_modify_owner');
    expect((await delegate.client.delete(`/api/users/${ownerId}`)).json().error.code).toBe('cannot_modify_owner');

    const manager = await createStaff(env, owner, 'mgr@escalation.test', 'manager');
    const res = await delegate.client.post(`/api/users/${manager.userId}/password`, { password: 'Taken-Over-1' });
    expect(res.json().error.code).toBe('privilege_escalation');
  });

  it('the Business Admin role and system roles are protected', async () => {
    const { owner } = await setupBusiness(env, sa, 'Protected');
    const adminRole = await roleIdByKey(owner, 'business_admin');
    expect((await owner.put(`/api/roles/${adminRole}`, { name: 'Renamed', permissions: [] })).json().error.code).toBe('role_protected');
    expect((await owner.delete(`/api/roles/${await roleIdByKey(owner, 'cashier')}`)).json().error.code).toBe('role_protected');
  });

  it('roles in use cannot be deleted', async () => {
    const { owner } = await setupBusiness(env, sa, 'In Use');
    const role = (await owner.post('/api/roles', { name: 'Temp', permissions: ['dashboard.view'] })).json();
    await createStaff(env, owner, 'temp@inuse.test', [role.id]);
    expect((await owner.delete(`/api/roles/${role.id}`)).json().error.code).toBe('role_in_use');
  });

  it('owner cannot be deactivated or stripped of Business Admin', async () => {
    const { owner } = await setupBusiness(env, sa, 'Owner Guard');
    const me = (await owner.get('/api/auth/session')).json().user.id;
    expect((await owner.patch(`/api/users/${me}`, { isActive: false })).json().error.code).toBe('cannot_modify_self');
    expect((await owner.delete(`/api/users/${me}`)).json().error.code).toBe('cannot_modify_self');
  });
});

describe('plan modules, add-ons and limits', () => {
  it('modules outside the plan are not effective even if the role grants them', async () => {
    const { owner } = await setupBusiness(env, sa, 'Basic Plan Co', { plan: 'basic' });
    const session = (await owner.get('/api/auth/session')).json();
    expect(session.modules).not.toContain('invoices');
    expect(session.permissions).not.toContain('invoice_settings.manage');
    const res = await owner.patch('/api/settings/invoice', {});
    expect(res.json().error.code).toBe('module_not_enabled');
    const settings = (await owner.get('/api/settings')).json();
    expect(settings.sections.invoice).toBeUndefined();
    expect(settings.sections.tax).toBeDefined();
  });

  it('add-on features require a Super Admin grant and stop on revoke', async () => {
    const { owner, businessId } = await setupBusiness(env, sa, 'Addon Co');
    const denied = await owner.get('/api/outlets');
    expect(denied.json().error.code).toBe('addon_not_enabled');
    expect((await sa.post(`/api/superadmin/businesses/${businessId}/addons/multi_outlet/grant`)).statusCode).toBe(200);
    expect((await owner.get('/api/outlets')).statusCode).toBe(200);
    const created = await owner.post('/api/outlets', { name: 'Hulhumale Branch', code: 'HLM' });
    expect(created.statusCode).toBe(201);
    await sa.post(`/api/superadmin/businesses/${businessId}/addons/multi_outlet/revoke`);
    expect((await owner.get('/api/outlets')).json().error.code).toBe('addon_not_enabled');
  });

  it('enforces plan user and outlet limits from the database (not code)', async () => {
    const { owner, businessId } = await setupBusiness(env, sa, 'Limit Co', { plan: 'trial' });
    // trial plan: max_users 5 (owner + 4)
    for (let i = 0; i < 4; i++) await createStaff(env, owner, `s${i}@limit.test`, 'waiter');
    const res = await owner.post('/api/users', { name: 'Sixth', email: 's6@limit.test', password: 'Pass-word-123', roleIds: [await roleIdByKey(owner, 'waiter')] });
    expect(res.statusCode).toBe(402);
    expect(res.json().error.code).toBe('plan_limit_reached');

    // Super Admin edits the plan limit -> immediately effective.
    const plans = (await sa.get('/api/superadmin/plans')).json().items;
    const trial = plans.find((p: { code: string }) => p.code === 'trial');
    await sa.put(`/api/superadmin/plans/${trial.id}`, { ...trial, priceMonthly: Number(trial.priceMonthly), limits: { ...trial.limits, max_users: 10 } });
    expect((await owner.post('/api/users', { name: 'Sixth', email: 's6@limit.test', password: 'Pass-word-123', roleIds: [await roleIdByKey(owner, 'waiter')] })).statusCode).toBe(201);

    // Outlet limit (trial: 1)
    await sa.post(`/api/superadmin/businesses/${businessId}/addons/multi_outlet/grant`);
    expect((await owner.post('/api/outlets', { name: 'Second' })).json().error.code).toBe('plan_limit_reached');
  });

  it('concurrent user creation cannot exceed the plan limit', async () => {
    const { owner } = await setupBusiness(env, sa, 'Race Co', { plan: 'trial' });
    const role = await roleIdByKey(owner, 'waiter');
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) => owner.post('/api/users', { name: `R${i}`, email: `r${i}@race.test`, password: 'Pass-word-123', roleIds: [role] })),
    );
    expect(results.filter((r) => r.statusCode === 201)).toHaveLength(4);
    expect(results.filter((r) => r.statusCode === 402)).toHaveLength(4);
  });

  it('changing plan changes effective modules immediately', async () => {
    const { owner, businessId } = await setupBusiness(env, sa, 'Upgrade Co', { plan: 'basic' });
    expect((await owner.get('/api/auth/session')).json().modules).not.toContain('quotations');
    await sa.post(`/api/superadmin/businesses/${businessId}/subscription/change-plan`, { planId: await planId(sa, 'pro'), status: 'active' });
    expect((await owner.get('/api/auth/session')).json().modules).toContain('quotations');
  });
});
