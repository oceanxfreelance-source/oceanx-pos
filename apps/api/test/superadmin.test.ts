import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { subscriptions } from '../src/db/schema';
import { Client, createSuperAdmin, createTestEnv, lastMailToken, loginSuperAdmin, OWNER_PASSWORD, planId, resetDb, setupBusiness, type TestEnv } from './helpers';

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

describe('super admin business management', () => {
  it('creates a fully provisioned business and invites the owner (no default password)', async () => {
    const res = await sa.post('/api/superadmin/businesses', {
      name: 'Male Coffee House',
      businessType: 'coffee_shop',
      planId: await planId(sa, 'trial'),
      owner: { name: 'Hassan', email: 'hassan@coffee.test', language: 'dv' },
    });
    expect(res.statusCode).toBe(201);
    const id = res.json().id;
    const detail = (await sa.get(`/api/superadmin/businesses/${id}`)).json();
    expect(detail.business.businessType).toBe('coffee_shop');
    expect(detail.business.status).toBe('active');
    expect(detail.subscription.status).toBe('trialing');
    expect(detail.outletCount).toBe(1);
    expect(detail.owner.hasPassword).toBe(false);
    expect(env.mailer.outbox.at(-1)!.to).toBe('hassan@coffee.test');
    // Cannot log in before accepting the invitation.
    expect((await new Client(env.app).post('/api/auth/login', { email: 'hassan@coffee.test', password: '' })).statusCode).toBe(422);
    const token = lastMailToken(env.mailer, 'hassan@coffee.test');
    await new Client(env.app).post('/api/auth/reset-password', { token, password: 'Hassan-Pass-1' });
    const login = await new Client(env.app).post('/api/auth/login', { email: 'hassan@coffee.test', password: 'Hassan-Pass-1' });
    expect(login.json().user.language).toBe('dv');
    expect(login.json().business.profile.productsLabelKey).toBe('nav.menu');
  });

  it('the team gives the owner a first password; the owner must change it; the team can reset it later', async () => {
    const mailsBefore = env.mailer.outbox.length;
    const res = await sa.post('/api/superadmin/businesses', {
      name: 'Corner Mart',
      businessType: 'supermarket',
      planId: await planId(sa, 'basic'),
      owner: { name: 'Ibrahim', email: 'ibrahim@cornermart.test', password: 'First-Pass-2026' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ ownerInviteSent: false, ownerEmail: 'ibrahim@cornermart.test' });
    expect(env.mailer.outbox.filter((m) => m.to === 'ibrahim@cornermart.test')).toHaveLength(0); // no invite email needed
    expect(env.mailer.outbox.length).toBe(mailsBefore);
    const id = res.json().id as string;

    const owner = new Client(env.app);
    const login = await owner.post('/api/auth/login', { email: 'ibrahim@cornermart.test', password: 'First-Pass-2026' });
    expect(login.statusCode).toBe(200);
    expect(login.json().user.mustChangePassword).toBe(true);
    expect((await owner.get('/api/dashboard')).json().error.code).toBe('password_change_required');
    expect((await owner.post('/api/auth/change-password', { currentPassword: 'First-Pass-2026', newPassword: 'My-Own-Pass-77' })).statusCode).toBe(200);
    expect((await owner.get('/api/dashboard')).statusCode).toBe(200);

    // Forgotten: the team sets a temporary password; the old session ends and it must be changed again.
    expect((await sa.post(`/api/superadmin/businesses/${id}/owner/password`, { password: 'short' })).statusCode).toBe(422);
    expect((await sa.post(`/api/superadmin/businesses/${id}/owner/password`, { password: 'Temp-Pass-2026' })).json()).toEqual({ ok: true, email: 'ibrahim@cornermart.test' });
    expect((await owner.get('/api/auth/session')).statusCode).toBe(401);
    const again = new Client(env.app);
    expect((await again.post('/api/auth/login', { email: 'ibrahim@cornermart.test', password: 'My-Own-Pass-77' })).statusCode).toBe(401);
    expect((await again.post('/api/auth/login', { email: 'ibrahim@cornermart.test', password: 'Temp-Pass-2026' })).json().user.mustChangePassword).toBe(true);
    // Business users cannot call it.
    expect((await again.post(`/api/superadmin/businesses/${id}/owner/password`, { password: 'Hijack-Pass-1' })).statusCode).toBe(401);
  });

  it('suspend revokes sessions and blocks login; activate restores', async () => {
    const { owner, ownerEmail, businessId } = await setupBusiness(env, sa, 'Suspend Me');
    const bad = await sa.post(`/api/superadmin/businesses/${businessId}/suspend`, { reason: '' });
    expect(bad.statusCode).toBe(422);
    expect((await sa.post(`/api/superadmin/businesses/${businessId}/suspend`, { reason: 'Unpaid invoice' })).statusCode).toBe(200);
    expect((await owner.get('/api/dashboard')).statusCode).toBe(401);
    const login = await new Client(env.app).post('/api/auth/login', { email: ownerEmail, password: OWNER_PASSWORD });
    expect(login.json().error.code).toBe('business_suspended');
    expect((await sa.post(`/api/superadmin/businesses/${businessId}/suspend`, { reason: 'again' })).json().error.code).toBe('invalid_status_transition');
    expect((await sa.post(`/api/superadmin/businesses/${businessId}/activate`)).statusCode).toBe(200);
    expect((await new Client(env.app).post('/api/auth/login', { email: ownerEmail, password: OWNER_PASSWORD })).statusCode).toBe(200);
    const actions = (await sa.get(`/api/superadmin/activity-logs?businessId=${businessId}`)).json().items.map((l: { action: string }) => l.action);
    expect(actions).toEqual(expect.arrayContaining(['superadmin.business_created', 'superadmin.business_suspended', 'superadmin.business_activated']));
  });

  it('deactivated businesses cannot log in', async () => {
    const { ownerEmail, businessId } = await setupBusiness(env, sa, 'Deactivate');
    await sa.post(`/api/superadmin/businesses/${businessId}/deactivate`);
    const login = await new Client(env.app).post('/api/auth/login', { email: ownerEmail, password: OWNER_PASSWORD });
    expect(login.json().error.code).toBe('business_deactivated');
  });

  it('expired subscription blocks operations (402) but keeps session/account access', async () => {
    const { owner, businessId } = await setupBusiness(env, sa, 'Expired Co');
    await env.db.update(subscriptions).set({ currentPeriodEnd: sql`now() - interval '1 day'` }).where(eq(subscriptions.businessId, businessId));
    const s = await owner.get('/api/auth/session');
    expect(s.statusCode).toBe(200);
    expect(s.json().state).toBe('subscription_expired');
    const res = await owner.get('/api/users');
    expect(res.statusCode).toBe(402);
    expect(res.json().error.code).toBe('subscription_expired');

    const ext = await sa.post(`/api/superadmin/businesses/${businessId}/subscription/extend`, { days: 30 });
    expect(ext.statusCode).toBe(200);
    expect((await owner.get('/api/users')).statusCode).toBe(200);
  });

  it('extend adds days on top of a future period end', async () => {
    const { businessId } = await setupBusiness(env, sa, 'Extend Co');
    const [before] = await env.db.select().from(subscriptions).where(eq(subscriptions.businessId, businessId));
    await sa.post(`/api/superadmin/businesses/${businessId}/subscription/extend`, { days: 10 });
    const [after] = await env.db.select().from(subscriptions).where(eq(subscriptions.businessId, businessId));
    expect(Math.round((after!.currentPeriodEnd.getTime() - before!.currentPeriodEnd.getTime()) / 86_400_000)).toBe(10);
  });

  it('lists, filters and paginates businesses', async () => {
    await setupBusiness(env, sa, 'Alpha Restaurant');
    await setupBusiness(env, sa, 'Beta Cafe', { type: 'cafe' });
    await setupBusiness(env, sa, 'Gamma Cafe', { type: 'cafe' });
    const cafes = (await sa.get('/api/superadmin/businesses?type=cafe')).json();
    expect(cafes.total).toBe(2);
    const page = (await sa.get('/api/superadmin/businesses?pageSize=1&page=2')).json();
    expect(page.items).toHaveLength(1);
    expect(page.total).toBe(3);
    const search = (await sa.get('/api/superadmin/businesses?q=alpha')).json();
    expect(search.items[0].name).toBe('Alpha Restaurant');
    expect((await sa.get('/api/superadmin/businesses?pageSize=1000')).statusCode).toBe(422);
  });

  it('dashboard reports real platform statistics', async () => {
    await setupBusiness(env, sa, 'Stat Restaurant', { plan: 'pro' });
    await setupBusiness(env, sa, 'Stat Cafe', { type: 'cafe', plan: 'trial' });
    const { businessId } = await setupBusiness(env, sa, 'Stat Suspended');
    await sa.post(`/api/superadmin/businesses/${businessId}/suspend`, { reason: 'test' });
    await sa.post(`/api/superadmin/businesses/${businessId}/addons/credit/grant`);
    const d = (await sa.get('/api/superadmin/dashboard')).json();
    expect(d.businesses.total).toBe(3);
    expect(d.businesses.byType.restaurant).toBe(2);
    expect(d.businesses.byType.cafe).toBe(1);
    expect(d.businesses.byStatus.suspended).toBe(1);
    expect(d.subscriptions.trialing).toBe(1);
    expect(d.subscriptions.active).toBe(2);
    expect(d.mrr.USD).toBe(59); // pro (active business); suspended business excluded
    expect(d.addonUsage.find((x: { code: string }) => x.code === 'credit').businesses).toBe(1);
    expect(d.businesses.registrationsSeries).toHaveLength(30);
  });

  it('manages plans and add-on catalog with validation', async () => {
    const plan = await sa.post('/api/superadmin/plans', {
      code: 'enterprise',
      name: 'Enterprise',
      priceMonthly: 299,
      currency: 'USD',
      trialDays: 0,
      limits: { max_users: null, max_outlets: 50 },
      modules: ['pos', 'sales', 'invoices'],
    });
    expect(plan.statusCode).toBe(201);
    const dup = await sa.post('/api/superadmin/plans', { ...(plan.json() as object), priceMonthly: 1, limits: {}, modules: [] });
    expect(dup.json().error.code).toBe('code_taken');
    const badModule = await sa.post('/api/superadmin/plans', { code: 'x1', name: 'X', priceMonthly: 1, currency: 'USD', trialDays: 0, limits: {}, modules: ['teleport'] });
    expect(badModule.statusCode).toBe(422);
    const addon = await sa.post('/api/superadmin/addons', { code: 'spa', name: 'Spa Booking', priceMonthly: 15 });
    expect(addon.statusCode).toBe(201);
    const upd = await sa.put(`/api/superadmin/addons/${addon.json().id}`, { code: 'renamed', name: 'Spa', priceMonthly: 20 });
    expect(upd.json().code).toBe('spa');
  });

  it('platform settings, languages and super admin accounts', async () => {
    const s = (await sa.patch('/api/superadmin/settings', { platformName: 'OceanX Cloud', registrationMode: 'open' })).json();
    expect(s.platformName).toBe('OceanX Cloud');
    expect((await sa.patch('/api/superadmin/settings', { defaultPlanCode: 'nope' })).statusCode).toBe(422);

    expect((await sa.patch('/api/superadmin/languages/en', { isEnabled: false })).statusCode).toBe(422);
    expect((await sa.patch('/api/superadmin/languages/dv', { isDefault: true })).statusCode).toBe(200);
    const langs = (await sa.get('/api/superadmin/languages')).json().items;
    expect(langs.find((l: { code: string }) => l.code === 'dv').isDefault).toBe(true);
    expect(langs.filter((l: { isDefault: boolean }) => l.isDefault)).toHaveLength(1);

    const invite = await sa.post('/api/superadmin/users/admins', { name: 'Second', email: 'second@platform.test' });
    expect(invite.statusCode).toBe(201);
    const me = (await sa.get('/api/superadmin/auth/session')).json().admin.id;
    expect((await sa.patch(`/api/superadmin/users/admins/${me}`, { isActive: false })).json().error.code).toBe('cannot_modify_self');
  });

  it('super admin cannot read tenant operational audit trail through business detail', async () => {
    const { owner, businessId } = await setupBusiness(env, sa, 'Private Ops');
    await owner.post('/api/roles', { name: 'Secret Role', permissions: ['dashboard.view'] });
    const detail = (await sa.get(`/api/superadmin/businesses/${businessId}`)).json();
    expect(detail.activity.every((l: { actorType: string; action: string }) => l.actorType === 'super_admin' || l.action === 'business.registered')).toBe(true);
  });
});
