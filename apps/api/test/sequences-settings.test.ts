import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { formatDocumentNumber } from '@oceanx/shared';
import { allocateDocumentNumber } from '../src/services/sequences';
import { createStaff, createSuperAdmin, createTestEnv, loginSuperAdmin, resetDb, setupBusiness, type TestEnv } from './helpers';

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

const numbering = { prefix: 'INV', startNumber: 1, padding: 5, format: '{PREFIX}-{YYYY}-{SEQ}', reset: 'yearly' as const };

describe('document numbering', () => {
  it('formats numbers like INV-2026-00001 / QT-2026-00001', () => {
    const d = new Date(Date.UTC(2026, 4, 1));
    expect(formatDocumentNumber(numbering, 1, d)).toBe('INV-2026-00001');
    expect(formatDocumentNumber({ ...numbering, prefix: 'QT' }, 42, d)).toBe('QT-2026-00042');
    expect(formatDocumentNumber({ ...numbering, format: '{PREFIX}/{YY}{MM}/{SEQ}', padding: 3 }, 7, d)).toBe('INV/2605/007');
  });

  it('is concurrency safe: 100 parallel allocations yield 100 unique, gap-free numbers', async () => {
    const sa = await loginSuperAdmin(env);
    const { businessId } = await setupBusiness(env, sa, 'Numbering Co');
    const results = await Promise.all(
      Array.from({ length: 100 }, () => allocateDocumentNumber(env.db, { businessId, docType: 'invoice', numbering })),
    );
    const seqs = results.map((r) => r.sequence).sort((x, y) => x - y);
    expect(new Set(seqs).size).toBe(100);
    expect(seqs[0]).toBe(1);
    expect(seqs[99]).toBe(100);
  });

  it('is scoped per business, per document type, per outlet and per period', async () => {
    const sa = await loginSuperAdmin(env);
    const a = await setupBusiness(env, sa, 'Seq A');
    const b = await setupBusiness(env, sa, 'Seq B');
    await allocateDocumentNumber(env.db, { businessId: a.businessId, docType: 'invoice', numbering });
    expect((await allocateDocumentNumber(env.db, { businessId: b.businessId, docType: 'invoice', numbering })).sequence).toBe(1);
    expect((await allocateDocumentNumber(env.db, { businessId: a.businessId, docType: 'quotation', numbering })).sequence).toBe(1);
    const outletId = a.session.outlet.id;
    expect((await allocateDocumentNumber(env.db, { businessId: a.businessId, docType: 'invoice', numbering, outletId })).sequence).toBe(1);
    const next = await allocateDocumentNumber(env.db, { businessId: a.businessId, docType: 'invoice', numbering, date: new Date(Date.UTC(2031, 0, 1)) });
    expect(next.number).toBe('INV-2031-00001');
  });

  it('honours a raised starting number and rolls back with the transaction', async () => {
    const sa = await loginSuperAdmin(env);
    const { businessId } = await setupBusiness(env, sa, 'Start Co');
    await allocateDocumentNumber(env.db, { businessId, docType: 'invoice', numbering });
    const jumped = await allocateDocumentNumber(env.db, { businessId, docType: 'invoice', numbering: { ...numbering, startNumber: 500 } });
    expect(jumped.sequence).toBe(500);
    await env.db
      .transaction(async (tx) => {
        await allocateDocumentNumber(tx, { businessId, docType: 'invoice', numbering });
        throw new Error('rollback');
      })
      .catch(() => {});
    expect((await allocateDocumentNumber(env.db, { businessId, docType: 'invoice', numbering })).sequence).toBe(501);
  });
});

describe('business settings', () => {
  it('validates and saves each section; numbering requires {SEQ}', async () => {
    const sa = await loginSuperAdmin(env);
    const { owner } = await setupBusiness(env, sa, 'Settings Co');
    const all = (await owner.get('/api/settings')).json();
    expect(all.editable).toEqual(expect.arrayContaining(['regional', 'tax', 'receipt', 'invoice', 'quotation']));
    expect(all.sections.invoice.numbering.prefix).toBe('INV');

    const bad = await owner.patch('/api/settings/invoice', { ...all.sections.invoice, numbering: { ...all.sections.invoice.numbering, format: '{PREFIX}-{YYYY}' } });
    expect(bad.statusCode).toBe(422);
    expect(bad.json().error.fields['numbering.format'].code).toBe('format_requires_seq');

    const ok = await owner.patch('/api/settings/regional', { ...all.sections.regional, currency: 'usd', documentLanguage: 'dv' });
    expect(ok.statusCode).toBe(200);
    const after = (await owner.get('/api/settings')).json();
    expect(after.sections.regional.currency).toBe('USD');
    expect(after.sections.regional.documentLanguage).toBe('dv');
    expect((await owner.get('/api/auth/session')).json().business.currency).toBe('USD');
    expect((await owner.patch('/api/settings/nonsense', {})).statusCode).toBe(404);
  });

  it('salesperson cannot change numbering; manager sees invoice settings read-only', async () => {
    const sa = await loginSuperAdmin(env);
    const { owner } = await setupBusiness(env, sa, 'Numbering Perms');
    const all = (await owner.get('/api/settings')).json();
    const { client: sales } = await createStaff(env, owner, 'sales@np.test', 'salesperson');
    expect((await sales.patch('/api/settings/invoice', all.sections.invoice)).statusCode).toBe(403);
    const { client: mgr } = await createStaff(env, owner, 'mgr@np.test', 'manager');
    const m = (await mgr.get('/api/settings')).json();
    expect(m.sections.invoice).toBeDefined();
    expect(m.editable).not.toContain('tax');
    expect((await mgr.patch('/api/settings/tax', all.sections.tax)).statusCode).toBe(403);
  });

  it('logo upload validates real image content', async () => {
    const sa = await loginSuperAdmin(env);
    const { owner } = await setupBusiness(env, sa, 'Logo Co');
    const fake = await owner.request('PUT', '/api/settings/logo', Buffer.from('<?php echo "x"; ?>'), { 'content-type': 'image/png' });
    expect(fake.statusCode).toBe(422);
    const html = await owner.request('PUT', '/api/settings/logo', Buffer.from('<html></html>'), { 'content-type': 'text/html' });
    expect(html.statusCode).toBe(415);
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
    expect((await owner.request('PUT', '/api/settings/logo', png, { 'content-type': 'image/png' })).statusCode).toBe(200);
    const got = await owner.get('/api/settings/logo');
    expect(got.headers['content-type']).toBe('image/png');
    expect(got.headers['x-content-type-options']).toBe('nosniff');
    const big = Buffer.concat([png, Buffer.alloc(1_100_000)]);
    expect((await owner.request('PUT', '/api/settings/logo', big, { 'content-type': 'image/png' })).statusCode).toBe(413);
  });

  it('user language preference is per user', async () => {
    const sa = await loginSuperAdmin(env);
    const { owner } = await setupBusiness(env, sa, 'Lang Co');
    const { client: chef } = await createStaff(env, owner, 'chef@lang.test', 'kitchen_staff');
    await owner.patch('/api/me/preferences', { language: 'dv', reduceAnimations: true });
    await chef.patch('/api/me/preferences', { language: 'hi' });
    expect((await owner.get('/api/auth/session')).json().user.language).toBe('dv');
    expect((await owner.get('/api/auth/session')).json().user.preferences.reduceAnimations).toBe(true);
    expect((await chef.get('/api/auth/session')).json().user.language).toBe('hi');
    expect((await chef.patch('/api/me/preferences', { language: 'fr' })).statusCode).toBe(422);
    const langs = (await chef.get('/api/languages')).json().items.map((l: { code: string }) => l.code);
    expect(langs).toEqual(['en', 'dv', 'hi', 'bn', 'ne', 'si']);
    await sa.patch('/api/superadmin/languages/si', { isEnabled: false });
    expect((await chef.get('/api/auth/session')).json().languages.map((l: { code: string }) => l.code)).not.toContain('si');
  });
});
