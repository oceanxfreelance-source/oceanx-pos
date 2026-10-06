import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as OTPAuth from 'otpauth';
import { eq, sql } from 'drizzle-orm';
import { superAdmins, superAdminSessions } from '../src/db/schema';
import { Client, createSuperAdmin, createTestEnv, lastMailToken, loginSuperAdmin, resetDb, SA_PASSWORD, setupBusiness, type TestEnv } from './helpers';

let env: TestEnv;

beforeAll(async () => {
  env = await createTestEnv();
});
afterAll(async () => env.close());
beforeEach(async () => {
  await resetDb(env.db);
  env.mailer.outbox.length = 0;
  await createSuperAdmin(env.db);
});

function totpNow(secret: string, offsetSteps = 0) {
  const t = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret), period: 30, digits: 6, algorithm: 'SHA1' });
  return t.generate({ timestamp: Date.now() + offsetSteps * 30_000 });
}

describe('super admin authentication', () => {
  it('logs in and out with a strict, path-scoped cookie', async () => {
    const res = await env.app.inject({ method: 'POST', url: '/api/superadmin/auth/login', payload: { email: 'root@platform.test', password: SA_PASSWORD } });
    expect(res.statusCode).toBe(200);
    const cookie = res.cookies.find((c) => c.name === 'ox_sa_session')!;
    expect(cookie.path).toBe('/api/superadmin');
    expect(cookie.httpOnly).toBe(true);
    expect(String(cookie.sameSite).toLowerCase()).toBe('strict');

    const sa = await loginSuperAdmin(env);
    expect((await sa.get('/api/superadmin/dashboard')).statusCode).toBe(200);
    expect((await sa.post('/api/superadmin/auth/logout')).statusCode).toBe(200);
    expect((await sa.get('/api/superadmin/dashboard')).statusCode).toBe(401);
  });

  it('records login/logout audit events', async () => {
    const sa = await loginSuperAdmin(env);
    await sa.post('/api/superadmin/auth/logout');
    const sa2 = await loginSuperAdmin(env);
    const logs = (await sa2.get('/api/superadmin/activity-logs?action=superadmin.log')).json().items.map((i: { action: string }) => i.action);
    expect(logs).toContain('superadmin.login');
    expect(logs).toContain('superadmin.logout');
  });

  it('locks after repeated failures', async () => {
    const c = new Client(env.app);
    for (let i = 0; i < 5; i++) await c.post('/api/superadmin/auth/login', { email: 'root@platform.test', password: 'wrong-password-x' });
    const res = await c.post('/api/superadmin/auth/login', { email: 'root@platform.test', password: SA_PASSWORD });
    expect(res.json().error.code).toBe('too_many_attempts');
  });

  it('rate-limits login attempts per IP', async () => {
    const limited = await createTestEnv({ authRateLimit: 3 });
    try {
      const c = new Client(limited.app, '10.9.9.9');
      const codes: number[] = [];
      for (let i = 0; i < 5; i++) codes.push((await c.post('/api/superadmin/auth/login', { email: `x${i}@y.test`, password: 'whatever' })).statusCode);
      expect(codes.slice(0, 3).every((s) => s === 401)).toBe(true);
      expect(codes[3]).toBe(429);
      // Business login is limited separately per route.
      const b = await c.post('/api/auth/login', { email: 'a@b.test', password: 'whatever' });
      expect(b.statusCode).toBe(401);
    } finally {
      await limited.close();
    }
  });

  it('expires idle super admin sessions (short idle timeout)', async () => {
    const sa = await loginSuperAdmin(env);
    await env.db.update(superAdminSessions).set({ lastSeenAt: sql`now() - interval '31 minutes'` });
    expect((await sa.get('/api/superadmin/dashboard')).json().error.code).toBe('session_expired');
  });

  it('password reset flow revokes sessions', async () => {
    const sa = await loginSuperAdmin(env);
    const anon = new Client(env.app);
    await anon.post('/api/superadmin/auth/forgot-password', { email: 'root@platform.test' });
    const token = lastMailToken(env.mailer, 'root@platform.test');
    expect(env.mailer.outbox.at(-1)!.text).toContain('/superadmin/reset-password?token=');
    const weak = await anon.post('/api/superadmin/auth/reset-password', { token, password: 'short' });
    expect(weak.statusCode).toBe(422);
    const ok = await anon.post('/api/superadmin/auth/reset-password', { token, password: 'A-much-longer-password-2026' });
    expect(ok.statusCode).toBe(200);
    expect((await sa.get('/api/superadmin/dashboard')).statusCode).toBe(401);
    expect((await anon.post('/api/superadmin/auth/login', { email: 'root@platform.test', password: 'A-much-longer-password-2026' })).statusCode).toBe(200);
  });

  it('TOTP 2FA: setup, enable, login challenge, replay protection, disable', async () => {
    const sa = await loginSuperAdmin(env);
    const setup = (await sa.post('/api/superadmin/security/2fa/setup')).json();
    expect(setup.otpauthUri).toMatch(/^otpauth:\/\/totp\//);
    const [stored] = await env.db.select().from(superAdmins);
    expect(stored!.totpSecretEnc).not.toContain(setup.secret); // encrypted at rest

    expect((await sa.post('/api/superadmin/security/2fa/enable', { code: '000000' })).statusCode).toBe(422);
    expect((await sa.post('/api/superadmin/security/2fa/enable', { code: totpNow(setup.secret) })).statusCode).toBe(200);

    const c = new Client(env.app);
    const login = await c.post('/api/superadmin/auth/login', { email: 'root@platform.test', password: SA_PASSWORD });
    expect(login.json().mfaPending).toBe(true);
    const preCookie = c.cookies.get('ox_sa_session');
    expect((await c.get('/api/superadmin/dashboard')).json().error.code).toBe('mfa_required');

    // The code used to enable is already consumed (replay protection) — use the next window's code.
    const replay = await c.post('/api/superadmin/auth/mfa', { code: totpNow(setup.secret) });
    expect(replay.json().error.code).toBe('mfa_invalid');
    const ok = await c.post('/api/superadmin/auth/mfa', { code: totpNow(setup.secret, 1) });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().mfaPending).toBe(false);
    expect(c.cookies.get('ox_sa_session')).not.toBe(preCookie); // session rotated
    expect((await c.get('/api/superadmin/dashboard')).statusCode).toBe(200);

    // An older (already superseded) code is rejected...
    const stale = await c.post('/api/superadmin/security/2fa/disable', { password: SA_PASSWORD, code: totpNow(setup.secret, -1) });
    expect(stale.json().error.code).toBe('mfa_invalid');
    // ...simulate time passing, then a fresh code plus password disables 2FA.
    await env.db.update(superAdmins).set({ totpLastStep: 0 });
    const noPw = await c.post('/api/superadmin/security/2fa/disable', { password: 'wrong', code: totpNow(setup.secret) });
    expect(noPw.json().error.code).toBe('password_incorrect');
    const dis = await c.post('/api/superadmin/security/2fa/disable', { password: SA_PASSWORD, code: totpNow(setup.secret) });
    expect(dis.statusCode).toBe(200);
    const [after] = await env.db.select().from(superAdmins).where(eq(superAdmins.email, 'root@platform.test'));
    expect(after!.totpEnabled).toBe(false);
  });

  it('lists and revokes own sessions', async () => {
    const a = await loginSuperAdmin(env);
    const b = await loginSuperAdmin(env);
    const list = (await a.get('/api/superadmin/security/sessions')).json().items;
    expect(list).toHaveLength(2);
    const other = list.find((s: { current: boolean }) => !s.current);
    expect((await a.delete(`/api/superadmin/security/sessions/${other.id}`)).statusCode).toBe(200);
    expect((await b.get('/api/superadmin/dashboard')).statusCode).toBe(401);
  });
});

describe('separate security domains', () => {
  it('business users cannot access any super admin route, even with a valid business session', async () => {
    const sa = await loginSuperAdmin(env);
    const { owner } = await setupBusiness(env, sa, 'Domain Test');
    for (const url of ['/api/superadmin/dashboard', '/api/superadmin/businesses', '/api/superadmin/auth/session', '/api/superadmin/plans']) {
      const res = await owner.get(url);
      expect(res.statusCode, url).toBe(401);
    }
    // Copying the business token into the super admin cookie does not work either.
    const forged = new Client(env.app);
    forged.cookies.set('ox_sa_session', owner.cookies.get('ox_session')!);
    expect((await forged.get('/api/superadmin/dashboard')).statusCode).toBe(401);
  });

  it('super admin is not a tenant user and cannot use business APIs', async () => {
    const sa = await loginSuperAdmin(env);
    expect((await sa.get('/api/auth/session')).statusCode).toBe(401);
    expect((await sa.get('/api/users')).statusCode).toBe(401);
    const forged = new Client(env.app);
    forged.cookies.set('ox_session', sa.cookies.get('ox_sa_session')!);
    expect((await forged.get('/api/users')).statusCode).toBe(401);
  });

  it('both sessions can coexist in one browser and stay isolated', async () => {
    const sa = await loginSuperAdmin(env);
    const { ownerEmail } = await setupBusiness(env, sa, 'Coexist');
    // Same jar logs into both domains.
    await sa.post('/api/auth/login', { email: ownerEmail, password: 'Owner-Pass-123' });
    expect(sa.cookies.has('ox_session')).toBe(true);
    expect(sa.cookies.has('ox_sa_session')).toBe(true);
    const bizCsrf = sa.csrf;
    // Logging out of business does not end the super admin session.
    expect((await sa.post('/api/auth/logout')).statusCode).toBe(200);
    expect((await sa.get('/api/superadmin/auth/session')).statusCode).toBe(200);
    expect(bizCsrf).toBeTruthy();
  });
});
