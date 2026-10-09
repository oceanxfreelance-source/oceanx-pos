import type { FastifyInstance } from 'fastify';
import { and, asc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { outlets, products, stockLevels } from '../../db/schema';
import { bizCtx, requireAnyPermission } from '../../guards/business';
import { parse } from '../../lib/validation';
import { notFound } from '../../lib/errors';
import { isRetailType } from '@oceanx/shared';

type Availability = 'in_stock' | 'low' | 'out' | 'untracked';

/**
 * "Do we have it?" — scan a barcode or type a name and see the stock here and at every other outlet.
 * Open to the counter (POS) as well as stock staff.
 */
export async function stockCheckRoutes(app: FastifyInstance) {
  const { db } = app.deps;

  app.get('/stock-check', { preHandler: requireAnyPermission('pos.access', 'inventory.view', 'products.view') }, async (req) => {
    const ctx = bizCtx(req);
    // A shop feature; restaurants and cafés keep their screens as they are.
    if (!isRetailType(ctx.access.business.businessType)) throw notFound();
    const { q } = parse(z.object({ q: z.string().trim().min(1).max(80) }), req.query);
    const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    const rows = await db
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        unit: products.unit,
        sellingPrice: products.sellingPrice,
        trackStock: products.trackStock,
        minStock: products.minStock,
        hasImage: sql<boolean>`${products.imagePath} IS NOT NULL`,
        exact: sql<boolean>`lower(${products.sku}) = lower(${q})`,
      })
      .from(products)
      .where(and(eq(products.businessId, ctx.businessId), isNull(products.deletedAt), eq(products.isActive, true), or(ilike(products.name, like), ilike(products.sku, q))))
      .orderBy(sql`lower(${products.sku}) = lower(${q}) DESC`, asc(products.name))
      .limit(20);

    const outletRows = await db
      .select({ id: outlets.id, name: outlets.name })
      .from(outlets)
      .where(and(eq(outlets.businessId, ctx.businessId), eq(outlets.isActive, true)))
      .orderBy(asc(outlets.name));
    const ids = rows.map((r) => r.id);
    const levels = ids.length
      ? await db
          .select({ productId: stockLevels.productId, outletId: stockLevels.outletId, quantity: stockLevels.quantity })
          .from(stockLevels)
          .where(and(eq(stockLevels.businessId, ctx.businessId), inArray(stockLevels.productId, ids)))
      : [];

    const status = (trackStock: boolean, qty: number, min: number): Availability => (!trackStock ? 'untracked' : qty <= 0 ? 'out' : qty <= min ? 'low' : 'in_stock');
    return {
      currentOutletId: ctx.outletId,
      items: rows.map((r) => {
        const min = Number(r.minStock);
        const byOutlet = outletRows.map((o) => {
          const qty = Number(levels.find((l) => l.productId === r.id && l.outletId === o.id)?.quantity ?? 0);
          return { outletId: o.id, outletName: o.name, quantity: qty, status: status(r.trackStock, qty, min) };
        });
        const here = byOutlet.find((o) => o.outletId === ctx.outletId);
        return {
          id: r.id,
          name: r.name,
          sku: r.sku,
          unit: r.unit,
          sellingPrice: r.sellingPrice,
          hasImage: r.hasImage,
          exact: r.exact,
          trackStock: r.trackStock,
          minStock: min,
          quantity: here?.quantity ?? 0,
          status: here?.status ?? status(r.trackStock, 0, min),
          outlets: byOutlet,
        };
      }),
    };
  });
}
