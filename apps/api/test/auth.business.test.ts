import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { userSessions, users } from '../src/db/schema';
import { Client, createStaff, createSuperAdmin, createTestEnv, lastMailToken, loginSuperAdmin, OWNER_PASSWORD, resetDb, setupBusiness, type TestEnv } from './helpers';

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

describe('business authentication', () => {
  it('logs in, returns session with tenant context, and logs out', async () => {
    const { owner, session, businessId } = await setupBusiness(env, sa, 'Blue Lagoon Cafe', { type: 'cafe' });
    expect(session.business.id).toBe(businessId);
    expect(session.business.businessType).toBe('cafe');
    expect(session.user.isOwner).toBe(true);
    expect(session.permissions).toContain('users.create');
    expect(session.state).toBe('ok');
    expect(session.outlet?.name).toBe('Main');
    expect(owner.cookies.has('ox_session')).toBe(true);

    const me = await owner.get('/api/auth/session');
    expect(me.statusCode).toBe(200);

    const out = await owner.post('/api/auth/logout');
    expect(out.statusCode).toBe(200);
    expect((await owner.get('/api/auth/session')).statusCode).toBe(401);
  });

  it('sets an httpOnly, SameSite cookie scoped to /api', async () => {
    const { ownerEmail } = await setupBusiness(env, sa, 'Cookie Test');
    const res = await env.app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: ownerEmail, password: OWNER_PASSWORD } });
    const cookie = res.cookies.find((c) => c.name === 'ox_session')!;
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.path).toBe('/api');
    expect(String(cookie.sameSite).toLowerCase()).toBe('lax');
  });

  it('rejects wrong passwords with a generic error and unknown emails identically', async () => {
    const { ownerEmail } = await setupBusiness(env, sa, 'Generic Error');
    const c = new Client(env.app);
    const wrong = await c.post('/api/auth/login', { email: ownerEmail, password: 'nope-nope-nope' });
    const unknown = await c.post('/api/auth/login', { email: 'ghost@nowhere.test', password: 'nope-nope-nope' });
    expect(wrong.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(wrong.json().error.code).toBe('invalid_credentials');
    expect(unknown.json().error.code).toBe('invalid_credentials');
  });

  it('locks the account after repeated failures (brute-force protection)', async () => {
    const { ownerEmail } = await setupBusiness(env, sa, 'Lockout Bistro');
    const c = new Client(env.app);
    for (let i = 0; i < 5; i++) await c.post('/api/auth/login', { email: ownerEmail, password: 'wrong-password' });
    const locked = await c.post('/api/auth/login', { email: ownerEmail, password: OWNER_PASSWORD });
    expect(locked.statusCode).toBe(429);
    expect(locked.json().error.code).toBe('too_many_attempts');
  });

  it('requires a CSRF token for state-changing requests', async () => {
    const { owner } = await setupBusiness(env, sa, 'Csrf Diner');
    const saved = owner.csrf;
    owner.csrf = null;
    const res = await owner.post('/api/auth/logout');
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('csrf_invalid');
    owner.csrf = 'forged-token';
    expect((await owner.post('/api/auth/logout')).json().error.code).toBe('csrf_invalid');
    owner.csrf = saved;
    expect((await owner.post('/api/auth/logout')).statusCode).toBe(200);
  });

  it('expires idle sessions server-side', async () => {
    const { owner, businessId } = await setupBusiness(env, sa, 'Idle Grill');
    await env.db
      .update(userSessions)
      .set({ lastSeenAt: sql`now() - interval '2 days'` })
      .where(eq(userSessions.businessId, businessId));
    const res = await owner.get('/api/auth/session');
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('session_expired');
  });

  it('expires sessions at the absolute lifetime', async () => {
    const { owner, businessId } = await setupBusiness(env, sa, 'Absolute Expiry');
    await env.db.update(userSessions).set({ expiresAt: sql`now() - interval '1 minute'` }).where(eq(userSessions.businessId, businessId));
    expect((await owner.get('/api/auth/session')).json().error.code).toBe('session_expired');
  });

  it('password reset: single-use token, revokes other sessions', async () => {
    const { owner, ownerEmail } = await setupBusiness(env, sa, 'Reset Kitchen');
    const anon = new Client(env.app);
    const unknown = await anon.post('/api/auth/forgot-password', { email: 'nobody@x.test' });
    expect(unknown.statusCode).toBe(200);
    await anon.post('/api/auth/forgot-password', { email: ownerEmail });
    const token = lastMailToken(env.mailer, ownerEmail);
    expect(env.mailer.outbox.at(-1)!.text).toContain('http://app.test/reset-password?token=');

    const res = await anon.post('/api/auth/reset-password', { token, password: 'Brand-New-Pass-1' });
    expect(res.statusCode).toBe(200);
    const reuse = await anon.post('/api/auth/reset-password', { token, password: 'Another-Pass-22' });
    expect(reuse.json().error.code).toBe('invalid_token');

    expect((await owner.get('/api/auth/session')).statusCode).toBe(401);
    expect((await anon.post('/api/auth/login', { email: ownerEmail, password: OWNER_PASSWORD })).statusCode).toBe(401);
    expect((await anon.post('/api/auth/login', { email: ownerEmail, password: 'Brand-New-Pass-1' })).statusCode).toBe(200);
  });

  it('change password keeps the current session and revokes others', async () => {
    const { owner, ownerEmail } = await setupBusiness(env, sa, 'Change Pw');
    const second = new Client(env.app);
    await second.post('/api/auth/login', { email: ownerEmail, password: OWNER_PASSWORD });
    const bad = await owner.post('/api/auth/change-password', { currentPassword: 'wrong', newPassword: 'New-Password-99' });
    expect(bad.json().error.code).toBe('password_incorrect');
    const ok = await owner.post('/api/auth/change-password', { currentPassword: OWNER_PASSWORD, newPassword: 'New-Password-99' });
    expect(ok.statusCode).toBe(200);
    expect((await owner.get('/api/auth/session')).statusCode).toBe(200);
    expect((await second.get('/api/auth/session')).statusCode).toBe(401);
  });

  it('forces a password change when required', async () => {
    const { owner } = await setupBusiness(env, sa, 'Must Change');
    const res = await owner.post('/api/users', {
      name: 'New Cashier',
      email: 'cashier@mustchange.test',
      password: 'Temp-Pass-123',
      roleIds: [(await owner.get('/api/roles')).json().items.find((r: { systemKey: string }) => r.systemKey === 'cashier').id],
      mustChangePassword: true,
    });
    expect(res.statusCode).toBe(201);
    const c = new Client(env.app);
    const login = await c.post('/api/auth/login', { email: 'cashier@mustchange.test', password: 'Temp-Pass-123' });
    expect(login.json().user.mustChangePassword).toBe(true);
    expect((await c.get('/api/dashboard')).json().error.code).toBe('password_change_required');
    await c.post('/api/auth/change-password', { currentPassword: 'Temp-Pass-123', newPassword: 'Real-Pass-456' });
    expect((await c.get('/api/dashboard')).statusCode).toBe(200);
  });

  it('deactivated users are logged out immediately', async () => {
    const { owner } = await setupBusiness(env, sa, 'Deactivate Co');
    const staff = await createStaff(env, owner, 'waiter@deactivate.test', 'waiter');
    expect((await staff.client.get('/api/dashboard')).statusCode).toBe(200);
    await owner.patch(`/api/users/${staff.userId}`, { isActive: false });
    const res = await staff.client.get('/api/dashboard');
    expect(res.statusCode).toBe(401);
    const relog = await new Client(env.app).post('/api/auth/login', { email: 'waiter@deactivate.test', password: staff.password });
    expect(relog.json().error.code).toBe('account_disabled');
  });

  it('stores only hashed session tokens and argon2id password hashes', async () => {
    const { owner, businessId } = await setupBusiness(env, sa, 'Hash Check');
    const raw = owner.cookies.get('ox_session')!;
    const rows = await env.db.select().from(userSessions).where(eq(userSessions.businessId, businessId));
    expect(rows.some((r) => r.tokenHash === raw)).toBe(false);
    const [u] = await env.db.select().from(users).where(eq(users.businessId, businessId));
    expect(u!.passwordHash).toMatch(/^\$argon2id\$/);
  });
});

describe('self registration', () => {
  const body = {
    businessName: 'Sunrise Bakery',
    businessType: 'bakery',
    ownerName: 'Aisha',
    email: 'aisha@sunrise.test',
    password: 'Bakery-Pass-1',
    currency: 'MVR',
    language: 'dv',
  };

  it('approval mode creates a pending business the owner can see but not operate', async () => {
    const c = new Client(env.app);
    const res = await c.post('/api/auth/register', body);
    expect(res.statusCode).toBe(201);
    expect(res.json().state).toBe('business_pending');
    expect(res.json().user.language).toBe('dv');
    expect((await c.get('/api/dashboard')).json().error.code).toBe('business_pending');

    const id = res.json().registeredBusinessId;
    expect((await sa.post(`/api/superadmin/businesses/${id}/approve`)).statusCode).toBe(200);
    expect((await c.get('/api/dashboard')).statusCode).toBe(200);
  });

  it('open mode activates immediately; closed mode rejects', async () => {
    await sa.patch('/api/superadmin/settings', { registrationMode: 'open' });
    const open = await new Client(env.app).post('/api/auth/register', body);
    expect(open.json().state).toBe('ok');

    await sa.patch('/api/superadmin/settings', { registrationMode: 'closed' });
    const closed = await new Client(env.app).post('/api/auth/register', { ...body, email: 'other@sunrise.test' });
    expect(closed.statusCode).toBe(403);
    expect(closed.json().error.code).toBe('registration_closed');
  });

  it('validates input and rejects duplicate emails', async () => {
    const bad = await new Client(env.app).post('/api/auth/register', { ...body, email: 'not-an-email', password: 'x' });
    expect(bad.statusCode).toBe(422);
    expect(bad.json().error.fields.email.code).toBe('invalid_email');
    expect(bad.json().error.fields.password.code).toBe('too_short');
    await new Client(env.app).post('/api/auth/register', body);
    const dup = await new Client(env.app).post('/api/auth/register', { ...body, email: 'AISHA@sunrise.test' });
    expect(dup.json().error.code).toBe('email_taken');
  });
});
