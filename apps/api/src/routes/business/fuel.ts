import type { FastifyInstance } from 'fastify';
import { and, asc, eq, isNull, notInArray } from 'drizzle-orm';
import { defaultFuelShedConfig, fuelSetupSchema, fuelShedConfigSchema, type FuelShedConfig } from '@oceanx/shared';
import type { Executor } from '../../db/client';
import { fuelNozzles, fuelSheds, fuelTanks } from '../../db/schema';
import { bizCtx, requirePermission } from '../../guards/business';
import { audit } from '../../lib/audit';
import { AppError } from '../../lib/errors';
import { actor } from '../../lib/tenant';
import { parse } from '../../lib/validation';

/** A shed's set-up as the app edits it: config, tanks (keyed by id) and nozzles pointing at their tank. */
export async function fuelSetupOf(db: Executor, businessId: string) {
  const [shed] = await db.select().from(fuelSheds).where(eq(fuelSheds.businessId, businessId));
  const stored = fuelShedConfigSchema.partial().safeParse(shed?.config ?? {});
  const config: FuelShedConfig = { ...defaultFuelShedConfig(), ...(stored.success ? stored.data : {}) };
  const tanks = await db
    .select()
    .from(fuelTanks)
    .where(and(eq(fuelTanks.businessId, businessId), isNull(fuelTanks.deletedAt)))
    .orderBy(asc(fuelTanks.sortOrder), asc(fuelTanks.createdAt));
  const nozzles = await db
    .select()
    .from(fuelNozzles)
    .where(and(eq(fuelNozzles.businessId, businessId), isNull(fuelNozzles.deletedAt)))
    .orderBy(asc(fuelNozzles.sortOrder), asc(fuelNozzles.createdAt));
  return {
    done: !!shed?.setupDoneAt,
    config,
    tanks: tanks.map((t) => ({ id: t.id, key: t.id, name: t.name, fuel: t.fuel, storage: t.storage, capacityL: Number(t.capacityL), reorderL: Number(t.reorderL), drumSizeL: t.drumSizeL })),
    nozzles: nozzles.map((n) => ({ id: n.id, name: n.name, tankKey: n.tankId, openingMeter: Number(n.openingMeter) })),
  };
}

/**
 * Theyo Fihaara: the shed sets itself up (first time as a wizard, later on the Shed settings page). Saving
 * replaces the whole set-up: tanks and nozzles kept by id are updated, new ones added, removed ones retired.
 */
export async function fuelRoutes(app: FastifyInstance) {
  const { db } = app.deps;

  app.get('/fuel/setup', { preHandler: requirePermission('fuel.view') }, async (req) => fuelSetupOf(db, bizCtx(req).businessId));

  app.put('/fuel/setup', { preHandler: requirePermission('fuel.manage') }, async (req) => {
    const ctx = bizCtx(req);
    const body = parse(fuelSetupSchema, req.body);
    // Prices only for the fuels it sells.
    const prices = Object.fromEntries(body.config.fuels.map((f) => [f, Math.round(body.config.prices[f]! * 100) / 100]));
    const config: FuelShedConfig = { ...body.config, prices };
    await db.transaction(async (tx) => {
      const existingTanks = await tx.select({ id: fuelTanks.id }).from(fuelTanks).where(and(eq(fuelTanks.businessId, ctx.businessId), isNull(fuelTanks.deletedAt)));
      const existingNozzles = await tx.select({ id: fuelNozzles.id }).from(fuelNozzles).where(and(eq(fuelNozzles.businessId, ctx.businessId), isNull(fuelNozzles.deletedAt)));
      const tankIds = new Set(existingTanks.map((t) => t.id));
      const nozzleIds = new Set(existingNozzles.map((n) => n.id));
      const keyToId = new Map<string, string>();
      for (const [i, t] of body.tanks.entries()) {
        const values = { name: t.name, fuel: t.fuel, storage: t.storage, capacityL: t.capacityL, reorderL: t.reorderL, drumSizeL: t.drumSizeL, sortOrder: i, updatedAt: new Date() };
        if (t.id) {
          if (!tankIds.has(t.id)) throw new AppError('validation_failed', 'Unknown tank', { fields: { [`tanks.${i}`]: { code: 'invalid' } } });
          await tx.update(fuelTanks).set(values).where(and(eq(fuelTanks.id, t.id), eq(fuelTanks.businessId, ctx.businessId)));
          keyToId.set(t.key, t.id);
        } else {
          const [row] = await tx.insert(fuelTanks).values({ ...values, businessId: ctx.businessId }).returning({ id: fuelTanks.id });
          keyToId.set(t.key, row!.id);
        }
      }
      const keptNozzles: string[] = [];
      for (const [i, n] of body.nozzles.entries()) {
        const values = { name: n.name, tankId: keyToId.get(n.tankKey)!, openingMeter: n.openingMeter, sortOrder: i, updatedAt: new Date() };
        if (n.id) {
          if (!nozzleIds.has(n.id)) throw new AppError('validation_failed', 'Unknown nozzle', { fields: { [`nozzles.${i}`]: { code: 'invalid' } } });
          await tx.update(fuelNozzles).set(values).where(and(eq(fuelNozzles.id, n.id), eq(fuelNozzles.businessId, ctx.businessId)));
          keptNozzles.push(n.id);
        } else {
          const [row] = await tx.insert(fuelNozzles).values({ ...values, businessId: ctx.businessId }).returning({ id: fuelNozzles.id });
          keptNozzles.push(row!.id);
        }
      }
      // Removed nozzles and tanks are retired, not erased: past readings will point at them.
      const now = new Date();
      await tx
        .update(fuelNozzles)
        .set({ deletedAt: now })
        .where(and(eq(fuelNozzles.businessId, ctx.businessId), isNull(fuelNozzles.deletedAt), keptNozzles.length ? notInArray(fuelNozzles.id, keptNozzles) : undefined));
      const keptTanks = [...keyToId.values()];
      await tx
        .update(fuelTanks)
        .set({ deletedAt: now })
        .where(and(eq(fuelTanks.businessId, ctx.businessId), isNull(fuelTanks.deletedAt), keptTanks.length ? notInArray(fuelTanks.id, keptTanks) : undefined));
      await tx
        .insert(fuelSheds)
        .values({ businessId: ctx.businessId, config, setupDoneAt: now, updatedBy: ctx.user.id })
        .onConflictDoUpdate({ target: fuelSheds.businessId, set: { config, updatedAt: now, updatedBy: ctx.user.id } });
      await audit(tx, { ...actor(ctx), action: 'fuel.setup_saved', entityType: 'fuel_shed', entityId: ctx.businessId, metadata: { tanks: body.tanks.length, nozzles: body.nozzles.length, mode: config.mode }, req });
    });
    return fuelSetupOf(db, ctx.businessId);
  });
}
