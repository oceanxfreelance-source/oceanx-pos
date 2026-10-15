import { isRetailType } from '@oceanx/shared';
import type { FastifyInstance } from 'fastify';
import { and, count, eq, isNull, sql } from 'drizzle-orm';
import { importCustomersSchema, importProductsSchema, toMinor } from '@oceanx/shared';
import { categories, customers, products } from '../../db/schema';
import { bizCtx, requirePermission } from '../../guards/business';
import { audit } from '../../lib/audit';
import { AppError } from '../../lib/errors';
import { actor, requireOutlet } from '../../lib/tenant';
import { parse } from '../../lib/validation';
import { withinLimit } from '../../services/access';
import { moveStock } from '../../services/ops/inventory';

/** Rolls the transaction back after a dry run, so a preview never saves anything. */
class DryRun extends Error {
  constructor(readonly result: unknown) {
    super('dry run');
  }
}

/** SKUs may only use letters, digits and . _ / - (spaces become dashes). */
const cleanSku = (s: string) =>
  s
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9._/-]/g, '')
    .slice(0, 40);
const cleanPhone = (s: string) => s.replace(/[^+0-9 ()-]/g, '').slice(0, 32);
const key = (s: string) => s.trim().toLowerCase();

/**
 * Import add-on: bring products and customers in from a CSV/Excel file (read in the browser).
 * Everything is checked first and saved in one go; with `dryRun` nothing is saved and the counts are a preview.
 */
export async function importRoutes(app: FastifyInstance) {
  const { db } = app.deps;

  app.post('/import/products', { preHandler: requirePermission('import.run', 'products.create') }, async (req) => {
    const ctx = bizCtx(req);
    const body = parse(importProductsSchema, req.body);
    const outletId = requireOutlet(ctx);
    const retail = isRetailType(ctx.access.business.businessType);
    const run = async () =>
      db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'products:' + ctx.businessId}))`);
        const cats = await tx.select({ id: categories.id, name: categories.name }).from(categories).where(eq(categories.businessId, ctx.businessId));
        const catByName = new Map(cats.map((c) => [key(c.name), c.id]));
        const existing = await tx
          .select({ id: products.id, name: products.name, sku: products.sku })
          .from(products)
          .where(and(eq(products.businessId, ctx.businessId), isNull(products.deletedAt)));
        const bySku = new Map(existing.filter((p) => p.sku).map((p) => [key(p.sku), p.id]));
        const byName = new Map(existing.map((p) => [key(p.name), p.id]));

        let created = 0;
        let updated = 0;
        let skipped = 0;
        let categoriesCreated = 0;
        const seen = new Set<string>();
        const errors: { row: number; code: string }[] = [];
        for (const [i, r] of body.rows.entries()) {
          const sku = cleanSku(r.sku);
          const ident = sku ? `sku:${key(sku)}` : `name:${key(r.name)}`;
          if (seen.has(ident)) {
            errors.push({ row: i + 1, code: 'duplicate_in_file' });
            continue;
          }
          seen.add(ident);
          let categoryId: string | null = null;
          if (r.category) {
            categoryId = catByName.get(key(r.category)) ?? null;
            if (!categoryId) {
              const [c] = await tx.insert(categories).values({ businessId: ctx.businessId, name: r.category.slice(0, 80) }).returning({ id: categories.id });
              categoryId = c!.id;
              catByName.set(key(r.category), categoryId);
              categoriesCreated++;
            }
          }
          const match = (sku && bySku.get(key(sku))) || (!sku ? byName.get(key(r.name)) : undefined);
          const values = {
            name: r.name,
            sku,
            categoryId,
            sellingPrice: toMinor(r.sellingPrice),
            costPrice: toMinor(r.costPrice),
            ...(r.unit ? { unit: r.unit } : {}),
            ...(retail ? { sendToKitchen: false } : {}),
          };
          let productId: string;
          if (match) {
            if (!body.updateExisting) {
              skipped++;
              continue;
            }
            await tx
              .update(products)
              .set({ ...values, updatedAt: new Date() })
              .where(eq(products.id, match));
            productId = match;
            updated++;
          } else {
            const [p] = await tx
              .insert(products)
              .values({ ...values, businessId: ctx.businessId, trackStock: r.stock !== null })
              .returning({ id: products.id });
            productId = p!.id;
            if (sku) bySku.set(key(sku), productId);
            byName.set(key(r.name), productId);
            created++;
          }
          if (r.stock !== null && r.stock > 0) {
            if (match) await tx.update(products).set({ trackStock: true }).where(eq(products.id, productId));
            const [lvl] = (
              await tx.execute<{ q: string }>(sql`SELECT quantity::text AS q FROM stock_levels WHERE outlet_id = ${outletId} AND product_id = ${productId}`)
            ).rows;
            const delta = r.stock - Number(lvl?.q ?? 0);
            if (delta !== 0) await moveStock(tx, { businessId: ctx.businessId, outletId, productId, delta, type: 'count', note: 'Import', userId: ctx.user.id, allowNegative: true });
          }
        }
        const [n] = await tx
          .select({ n: count() })
          .from(products)
          .where(and(eq(products.businessId, ctx.businessId), isNull(products.deletedAt)));
        if (created > 0 && !withinLimit(ctx.access.limits, 'max_products', Number(n?.n ?? 0) - 1)) {
          throw new AppError('plan_limit_reached', 'Product limit reached', { details: { limit: 'max_products' } });
        }
        const result = { created, updated, skipped, categoriesCreated, errors };
        if (body.dryRun) throw new DryRun(result);
        await audit(tx, { ...actor(ctx), action: 'import.products', entityType: 'product', metadata: { created, updated, skipped, categoriesCreated }, req });
        return result;
      });
    try {
      return { dryRun: body.dryRun, ...(await run()) };
    } catch (e) {
      if (e instanceof DryRun) return { dryRun: true, ...(e.result as object) };
      throw e;
    }
  });

  app.post('/import/customers', { preHandler: requirePermission('import.run', 'customers.create') }, async (req) => {
    const ctx = bizCtx(req);
    const body = parse(importCustomersSchema, req.body);
    // Credit limits are a financial control: only credit managers bring them in.
    const withCredit = ctx.access.addons.has('credit') && ctx.permissions.has('credit.manage');
    const run = async () =>
      db.transaction(async (tx) => {
        const existing = await tx
          .select({ id: customers.id, name: customers.name, phone: customers.phone })
          .from(customers)
          .where(and(eq(customers.businessId, ctx.businessId), isNull(customers.deletedAt)));
        const digits = (s: string) => s.replace(/\D/g, '');
        const byPhone = new Map(existing.filter((c) => digits(c.phone)).map((c) => [digits(c.phone), c.id]));
        const byName = new Map(existing.map((c) => [key(c.name), c.id]));
        let created = 0;
        let updated = 0;
        let skipped = 0;
        const seen = new Set<string>();
        const errors: { row: number; code: string }[] = [];
        for (const [i, r] of body.rows.entries()) {
          const phone = cleanPhone(r.phone);
          const ident = digits(phone) ? `phone:${digits(phone)}` : `name:${key(r.name)}`;
          if (seen.has(ident)) {
            errors.push({ row: i + 1, code: 'duplicate_in_file' });
            continue;
          }
          seen.add(ident);
          const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email) ? r.email.toLowerCase() : '';
          const values = {
            name: r.name,
            phone,
            email,
            company: r.company,
            address: r.address,
            taxNumber: r.taxNumber,
            kind: r.company ? 'company' : 'person',
            ...(withCredit && r.creditLimit !== null ? { creditLimit: toMinor(r.creditLimit) } : {}),
          };
          const match = (digits(phone) && byPhone.get(digits(phone))) || byName.get(key(r.name));
          if (match) {
            if (!body.updateExisting) {
              skipped++;
              continue;
            }
            await tx
              .update(customers)
              .set({ ...values, updatedAt: new Date() })
              .where(eq(customers.id, match));
            updated++;
          } else {
            const [c] = await tx
              .insert(customers)
              .values({ ...values, businessId: ctx.businessId })
              .returning({ id: customers.id });
            if (digits(phone)) byPhone.set(digits(phone), c!.id);
            byName.set(key(r.name), c!.id);
            created++;
          }
        }
        const result = { created, updated, skipped, errors };
        if (body.dryRun) throw new DryRun(result);
        await audit(tx, { ...actor(ctx), action: 'import.customers', entityType: 'customer', metadata: { created, updated, skipped }, req });
        return result;
      });
    try {
      return { dryRun: body.dryRun, ...(await run()) };
    } catch (e) {
      if (e instanceof DryRun) return { dryRun: true, ...(e.result as object) };
      throw e;
    }
  });
}
