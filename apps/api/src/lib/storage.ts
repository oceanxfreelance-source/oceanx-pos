import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomToken } from './crypto';
import { eq } from 'drizzle-orm';
import { AppError } from './errors';
import type { DB } from '../db/client';
import { storedFiles } from '../db/schema';

export const IMAGE_TYPES = {
  'image/png': { ext: 'png', magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  'image/jpeg': { ext: 'jpg', magic: [0xff, 0xd8, 0xff] },
  'image/webp': { ext: 'webp', magic: [0x52, 0x49, 0x46, 0x46] },
} as const;
export type ImageType = keyof typeof IMAGE_TYPES;

export function contentTypeFor(rel: string): string {
  const ext = rel.split('.').pop();
  if (ext === 'pdf') return 'application/pdf';
  return Object.entries(IMAGE_TYPES).find(([, d]) => d.ext === ext)?.[0] ?? 'application/octet-stream';
}

/** Verify the file content really is the declared image type (never trust the client's content-type). */
export function detectImage(buf: Buffer): ImageType | null {
  for (const [type, def] of Object.entries(IMAGE_TYPES) as [ImageType, (typeof IMAGE_TYPES)[ImageType]][]) {
    if (def.magic.every((b, i) => buf[i] === b)) {
      if (type === 'image/webp' && buf.subarray(8, 12).toString('ascii') !== 'WEBP') continue;
      return type;
    }
  }
  return null;
}

/** Where file bytes live. Paths are always server-generated relative paths. */
export interface StorageBackend {
  write(rel: string, buf: Buffer): Promise<void>;
  read(rel: string): Promise<Buffer>;
  remove(rel: string): Promise<void>;
}

/** Local disk / mounted volume (Docker, VM). */
export class FileBackend implements StorageBackend {
  constructor(private readonly root: string) {}
  private resolve(rel: string): string {
    const full = path.resolve(this.root, rel);
    if (!full.startsWith(path.resolve(this.root) + path.sep)) throw new AppError('forbidden');
    return full;
  }
  async write(rel: string, buf: Buffer) {
    const full = this.resolve(rel);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, buf, { mode: 0o640 });
  }
  read(rel: string) {
    return readFile(this.resolve(rel));
  }
  async remove(rel: string) {
    await rm(this.resolve(rel), { force: true });
  }
}

/** PostgreSQL `stored_files` table — durable storage for serverless hosts without a persistent disk. */
export class DbBackend implements StorageBackend {
  constructor(private readonly db: DB) {}
  async write(rel: string, buf: Buffer) {
    await this.db
      .insert(storedFiles)
      .values({ path: rel, data: buf, size: buf.length })
      .onConflictDoUpdate({ target: storedFiles.path, set: { data: buf, size: buf.length } });
  }
  async read(rel: string) {
    const [row] = await this.db.select({ data: storedFiles.data }).from(storedFiles).where(eq(storedFiles.path, rel));
    if (!row) throw new AppError('not_found');
    return Buffer.from(row.data);
  }
  async remove(rel: string) {
    await this.db.delete(storedFiles).where(eq(storedFiles.path, rel));
  }
}

/**
 * Tenant files are stored under businesses/<businessId>/ with server-generated
 * names. Paths are never derived from client input, and reads are always resolved
 * through the owning business record (authorization happens before this layer).
 */
export class Storage {
  constructor(private readonly backend: StorageBackend) {}

  async saveBusinessImage(businessId: string, kind: string, buf: Buffer): Promise<{ rel: string; type: ImageType }> {
    const type = detectImage(buf);
    if (!type) throw new AppError('validation_failed', 'Unsupported image', { fields: { file: { code: 'invalid_image' } } });
    const rel = path.posix.join('businesses', businessId, `${kind}-${randomToken(9)}.${IMAGE_TYPES[type].ext}`);
    await this.backend.write(rel, buf);
    return { rel, type };
  }

  /** Images or PDF (e.g. expense receipts). */
  async saveBusinessDocument(businessId: string, kind: string, buf: Buffer): Promise<{ rel: string; type: string }> {
    const isPdf = buf.subarray(0, 5).toString('latin1') === '%PDF-';
    if (!isPdf) return this.saveBusinessImage(businessId, kind, buf);
    const rel = path.posix.join('businesses', businessId, `${kind}-${randomToken(9)}.pdf`);
    await this.backend.write(rel, buf);
    return { rel, type: 'application/pdf' };
  }

  read(rel: string): Promise<Buffer> {
    return this.backend.read(rel);
  }

  remove(rel: string): Promise<void> {
    return this.backend.remove(rel);
  }
}
