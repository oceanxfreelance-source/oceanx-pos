import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { Client, createSuperAdmin, createTestEnv, loginSuperAdmin, resetDb, setupBusiness, type TestEnv } from './helpers';

let env: TestEnv;
let sa: Client;

beforeAll(async () => {
  env = await createTestEnv();
});
afterAll(async () => env.close());
beforeEach(async () => {
  await resetDb(env.db);
  await createSuperAdmin(env.db);
  sa = await loginSuperAdmin(env);
  await sa.patch('/api/superadmin/settings', { registrationMode: 'open' });
  env.mailer.outbox.length = 0;
});

const gravity = (n: string) => ({ product: 'gravity', businessName: `Gravity ${n}`, ownerName: `Owner ${n}`, email: `${n}@gravity.test`, password: 'Gravity-Pass-123', currency: 'MVR' });

describe('Office mail (Super Admin → business owners)', () => {
  it('reminds Gravity trials ending in 24 hours, personalised, and keeps a history', async () => {
    await new Client(env.app).post('/api/auth/register', gravity('soon'));
    await new Client(env.app).post('/api/auth/register', gravity('later'));
    await setupBusiness(env, sa, 'Lagoon Cafe', { type: 'cafe' });
    // "soon" ends in 5 hours; "later" keeps its 14 days.
    await env.db.execute(sql`UPDATE subscriptions SET current_period_end = now() + interval '5 hours' WHERE business_id = (SELECT id FROM businesses WHERE name = 'Gravity soon')`);

    const msg = {
      audience: { product: 'gravity', segment: 'trial_ending', hours: 24 },
      subject: 'Your Gravity trial ends in {{time_left}}',
      body: 'Hello {{name}},\n{{business}} trial ends on {{ends}}. Gravity is {{price}} a month.\n{{link}}',
    };
    const preview = (await sa.post('/api/superadmin/mail/preview', msg)).json();
    expect(preview.count).toBe(1);
    expect(preview.recipients[0]).toMatchObject({ email: 'soon@gravity.test', business: 'Gravity soon' });
    expect(preview.sample.subject).toMatch(/^Your Gravity trial ends in [45] h/);
    expect(preview.sample.text).toContain('Hello Owner soon,');
    expect(preview.sample.text).toContain('MVR 139.00 a month');

    env.mailer.outbox.length = 0;
    const sent = (await sa.post('/api/superadmin/mail/send', msg)).json();
    expect(sent).toMatchObject({ sent: 1, failed: 0 });
    expect(env.mailer.outbox.map((m) => m.to)).toEqual(['soon@gravity.test']);
    expect(env.mailer.outbox[0]!.text).not.toContain('{{');

    const history = (await sa.get('/api/superadmin/mail')).json().items;
    expect(history[0]).toMatchObject({ subject: msg.subject, sentCount: 1, failedCount: 0 });
    expect(history[0].recipients).toEqual([{ email: 'soon@gravity.test', business: 'Gravity soon', ok: true }]);
  });

  it('reaches POS owners too, or everyone; only real accounts, never typed addresses', async () => {
    await new Client(env.app).post('/api/auth/register', gravity('one'));
    const { businessId } = await setupBusiness(env, sa, 'Lagoon Cafe', { type: 'cafe' });
    const base = { subject: 'Notice', body: 'Hi {{name}}' };
    const pos = (await sa.post('/api/superadmin/mail/preview', { ...base, audience: { product: 'pos', segment: 'all' } })).json();
    expect(pos.recipients.map((r: { email: string }) => r.email)).toEqual(['owner@lagooncafe.test']);
    const all = (await sa.post('/api/superadmin/mail/preview', { ...base, audience: { product: 'all', segment: 'all' } })).json();
    expect(all.count).toBe(2);
    // One chosen account.
    const one = (await sa.post('/api/superadmin/mail/preview', { ...base, audience: { product: 'all', segment: 'selected', businessIds: [businessId] } })).json();
    expect(one.recipients.map((r: { business: string }) => r.business)).toEqual(['Lagoon Cafe']);
    // Nobody in the group: nothing is sent.
    env.mailer.outbox.length = 0;
    expect((await sa.post('/api/superadmin/mail/send', { ...base, audience: { product: 'pos', segment: 'trial_ending', hours: 1 } })).statusCode).toBe(422);
    expect(env.mailer.outbox).toHaveLength(0);
    // Business users cannot use it.
    const owner = new Client(env.app);
    expect((await owner.post('/api/superadmin/mail/send', { ...base, audience: { product: 'all', segment: 'all' } })).statusCode).toBe(401);
  });
});
