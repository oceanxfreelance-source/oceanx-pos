import type { FastifyInstance, FastifyReply } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { businesses, users } from '../../db/schema';
import { bizCtx, requirePermission } from '../../guards/business';
import { audit } from '../../lib/audit';
import { AppError, notFound } from '../../lib/errors';
import { idParam } from '../../lib/params';
import { IMAGE_TYPES } from '../../lib/storage';
import { actor } from '../../lib/tenant';

const MAX_BYTES = 2_097_152;

/** Personal signatures (each user adds their own) and the company stamp, printed on documents. */
export async function brandingRoutes(app: FastifyInstance) {
  const { db, storage } = app.deps;

  const image = (body: unknown) => {
    if (!Buffer.isBuffer(body) || body.length === 0) throw new AppError('validation_failed', 'Image required', { fields: { file: { code: 'invalid_image' } } });
    return body;
  };
  const send = async (reply: FastifyReply, rel: string) => {
    const ext = rel.split('.').pop();
    const type = Object.entries(IMAGE_TYPES).find(([, d]) => d.ext === ext)?.[0] ?? 'application/octet-stream';
    reply.header('content-type', type).header('cache-control', 'private, no-cache').header('x-content-type-options', 'nosniff');
    return reply.send(await storage.read(rel));
  };

  // ---------------------------------------------------------------- my signature
  app.put('/me/signature', { config: { sessionOnly: true }, bodyLimit: MAX_BYTES }, async (req) => {
    const ctx = bizCtx(req);
    const saved = await storage.saveBusinessImage(ctx.businessId, `signature-${ctx.user.id}`, image(req.body));
    const [before] = await db.select({ p: users.signaturePath }).from(users).where(eq(users.id, ctx.user.id));
    await db.update(users).set({ signaturePath: saved.rel, updatedAt: new Date() }).where(and(eq(users.id, ctx.user.id), eq(users.businessId, ctx.businessId)));
    if (before?.p && before.p !== saved.rel) await storage.remove(before.p);
    await audit(db, { ...actor(ctx), action: 'user.signature_updated', entityType: 'user', entityId: ctx.user.id, req });
    return { ok: true };
  });

  app.delete('/me/signature', { config: { sessionOnly: true } }, async (req) => {
    const ctx = bizCtx(req);
    const [before] = await db.select({ p: users.signaturePath }).from(users).where(eq(users.id, ctx.user.id));
    await db.update(users).set({ signaturePath: null, updatedAt: new Date() }).where(eq(users.id, ctx.user.id));
    if (before?.p) await storage.remove(before.p);
    await audit(db, { ...actor(ctx), action: 'user.signature_removed', entityType: 'user', entityId: ctx.user.id, req });
    return { ok: true };
  });

  /** Signature image of a user of the SAME business (used on printed documents). */
  app.get('/users/:id/signature', async (req, reply) => {
    const ctx = bizCtx(req);
    const [u] = await db
      .select({ p: users.signaturePath })
      .from(users)
      .where(and(eq(users.id, idParam(req)), eq(users.businessId, ctx.businessId)));
    if (!u?.p) throw notFound();
    return send(reply, u.p);
  });

  // ---------------------------------------------------------------- company stamp
  app.put('/settings/stamp', { preHandler: requirePermission('branding.manage'), bodyLimit: MAX_BYTES }, async (req) => {
    const ctx = bizCtx(req);
    const saved = await storage.saveBusinessImage(ctx.businessId, 'stamp', image(req.body));
    const old = ctx.access.business.stampPath;
    await db.update(businesses).set({ stampPath: saved.rel, updatedAt: new Date() }).where(eq(businesses.id, ctx.businessId));
    if (old && old !== saved.rel) await storage.remove(old);
    await audit(db, { ...actor(ctx), action: 'settings.stamp_updated', req });
    return { ok: true };
  });

  app.delete('/settings/stamp', { preHandler: requirePermission('branding.manage') }, async (req) => {
    const ctx = bizCtx(req);
    const old = ctx.access.business.stampPath;
    await db.update(businesses).set({ stampPath: null, updatedAt: new Date() }).where(eq(businesses.id, ctx.businessId));
    if (old) await storage.remove(old);
    await audit(db, { ...actor(ctx), action: 'settings.stamp_removed', req });
    return { ok: true };
  });

  app.get('/settings/stamp', async (req, reply) => {
    const ctx = bizCtx(req);
    const rel = ctx.access.business.stampPath;
    if (!rel) throw notFound();
    return send(reply, rel);
  });
}
