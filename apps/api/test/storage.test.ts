import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { createSuperAdmin, createTestEnv, loginSuperAdmin, resetDb, setupBusiness, type TestEnv } from './helpers';

// Smallest valid PNG (1×1, transparent).
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da6364f8ff1f0003030200efa6c8f00000000049454e44ae426082', 'hex');

describe('database file storage (STORAGE_DRIVER=db)', () => {
  let env: TestEnv;
  beforeAll(async () => {
    env = await createTestEnv({ storageDriver: 'db' });
    await resetDb(env.db);
    await createSuperAdmin(env.db);
  });
  afterAll(() => env.close());

  it('stores a product photo in PostgreSQL, serves it back, and replaces the old file', async () => {
    const sa = await loginSuperAdmin(env);
    const { owner } = await setupBusiness(env, sa, 'Photo Cafe', { type: 'cafe' });
    const p = await owner.post('/api/products', { name: 'Flat white', sellingPrice: 40, costPrice: 12 });
    expect(p.statusCode).toBe(201);
    const id = p.json().id as string;

    const up = await owner.request('PUT', `/api/products/${id}/image`, PNG, { 'content-type': 'image/png' });
    expect(up.statusCode).toBe(200);
    const img = await owner.get(`/api/products/${id}/image`);
    expect(img.statusCode).toBe(200);
    expect(img.headers['content-type']).toBe('image/png');
    expect(Buffer.compare(img.rawPayload, PNG)).toBe(0);

    // Replacing the photo removes the previous stored file.
    await owner.request('PUT', `/api/products/${id}/image`, PNG, { 'content-type': 'image/png' });
    const rows = await env.db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM stored_files`);
    expect(rows.rows[0]!.n).toBe(1);

    // The POS catalogue flags the photo so tiles show it.
    const cat = await owner.get('/api/pos/catalog');
    expect(cat.json().products.find((x: { id: string }) => x.id === id).hasImage).toBe(true);

    // Removing the photo deletes the stored bytes and the POS falls back to initials.
    expect((await owner.delete(`/api/products/${id}/image`)).statusCode).toBe(200);
    expect((await owner.get(`/api/products/${id}/image`)).statusCode).toBe(404);
    const left = await env.db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM stored_files`);
    expect(left.rows[0]!.n).toBe(0);
  });

  it('rejects files that are not real images', async () => {
    const sa = await loginSuperAdmin(env);
    const { owner } = await setupBusiness(env, sa, 'Fake Image Cafe', { type: 'cafe' });
    const id = (await owner.post('/api/products', { name: 'Tea', sellingPrice: 10, costPrice: 2 })).json().id;
    const up = await owner.request('PUT', `/api/products/${id}/image`, Buffer.from('<svg onload=alert(1)>'), { 'content-type': 'image/png' });
    expect(up.statusCode).toBe(422);
    expect(up.json().error.code).toBe('validation_failed');
  });
});
