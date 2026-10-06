import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomToken } from './crypto';
import { AppError } from './errors';

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

/**
 * Tenant files are stored under <root>/businesses/<businessId>/ with server-generated
 * names. Paths are never derived from client input, and reads are always resolved
 * through the owning business record (authorization happens before this layer).
 */
export class Storage {
  constructor(private readonly root: string) {}

  private resolve(rel: string): string {
    const full = path.resolve(this.root, rel);
    if (!full.startsWith(path.resolve(this.root) + path.sep)) throw new AppError('forbidden');
    return full;
  }

  async saveBusinessImage(businessId: string, kind: string, buf: Buffer): Promise<{ rel: string; type: ImageType }> {
    const type = detectImage(buf);
    if (!type) throw new AppError('validation_failed', 'Unsupported image', { fields: { file: { code: 'invalid_image' } } });
    const rel = path.posix.join('businesses', businessId, `${kind}-${randomToken(9)}.${IMAGE_TYPES[type].ext}`);
    const full = this.resolve(rel);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, buf, { mode: 0o640 });
    return { rel, type };
  }

  /** Images or PDF (e.g. expense receipts). */
  async saveBusinessDocument(businessId: string, kind: string, buf: Buffer): Promise<{ rel: string; type: string }> {
    const isPdf = buf.subarray(0, 5).toString('latin1') === '%PDF-';
    if (!isPdf) return this.saveBusinessImage(businessId, kind, buf);
    const rel = path.posix.join('businesses', businessId, `${kind}-${randomToken(9)}.pdf`);
    const full = this.resolve(rel);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, buf, { mode: 0o640 });
    return { rel, type: 'application/pdf' };
  }

  async read(rel: string): Promise<Buffer> {
    return readFile(this.resolve(rel));
  }

  async remove(rel: string): Promise<void> {
    await rm(this.resolve(rel), { force: true });
  }
}
