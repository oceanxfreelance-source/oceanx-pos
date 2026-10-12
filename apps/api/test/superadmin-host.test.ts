import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createSuperAdmin, createTestEnv, resetDb, SA_PASSWORD, type TestEnv } from './helpers';

let env: TestEnv;
beforeAll(async () => {
  env = await createTestEnv({ env: { SUPERADMIN_APP_URL: 'http://admin.test' } });
  await resetDb(env.db);
  await createSuperAdmin(env.db);
});
afterAll(async () => env.close());

const login = (host: string) => env.app.inject({ method: 'POST', url: '/api/superadmin/auth/login', headers: { host }, payload: { email: 'root@platform.test', password: SA_PASSWORD } });

describe('Super Admin on its own address', () => {
  it('answers only on the admin address, never on the POS or Gravity addresses', async () => {
    expect((await login('app.test')).statusCode).toBe(404);
    expect((await login('gravity.app.test')).statusCode).toBe(404);
    expect((await login('admin.test')).statusCode).toBe(200);
    // Business sign-in still works on the customers' address.
    expect((await env.app.inject({ method: 'POST', url: '/api/auth/login', headers: { host: 'app.test' }, payload: { email: 'x@y.test', password: 'nope-nope-1' } })).statusCode).not.toBe(404);
  });

  it('password reset e-mails link to the admin address', async () => {
    env.mailer.outbox.length = 0;
    await env.app.inject({ method: 'POST', url: '/api/superadmin/auth/forgot-password', headers: { host: 'admin.test' }, payload: { email: 'root@platform.test' } });
    expect(env.mailer.outbox.at(-1)!.text).toContain('http://admin.test/superadmin/reset-password?token=');
  });
});
