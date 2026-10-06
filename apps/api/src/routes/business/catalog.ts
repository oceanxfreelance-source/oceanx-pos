import type { FastifyInstance } from 'fastify';
import { and, asc, count, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { categorySchema, paginationQuerySchema, productSchema, recipeSchema, toMinor } from '@oceanx/shared';
import { categories, products, recipeItems, stockLevels } from '../../db/schema';
import { assertPermission, bizCtx, requireAnyPermission, requirePermission } from '../../guards/business';
import { audit } from '../../lib/audit';
import { AppError, notFound } from '../../lib/errors';
import { idParam } from '../../lib/params';
import { IMAGE_TYPES } from '../../lib/storage';
import { actor, own, requireOutlet } from '../../lib/tenant';
import { parse } from '../../lib/validation';
import { withinLimit } from '../../services/access';
import type { BusinessContext } from '../../types';

const productListQuery = paginationQuerySchema.extend({
  categoryId: z.uuid().optional(),
  type: z.enum(['item', 'ingredient', 'service']).optional(),
  active: z.enum(['true', 'false']).optional(),
});

/** Convert validated product input (major units) to DB values (minor units). */
function productValues(body: z.output<typeof productSchema>) {
  return {
    name: body.name,
    sku: body.sku,
    categoryId: body.categoryId,
    description: body.description,
    unit: body.unit,
    type: body.type,
    costPrice: toMinor(body.costPrice),
    sellingPrice: toMinor(body.sellingPrice),
    taxRate: body.taxRate,
    trackStock: body.trackStock,
    minStock: body.minStock,
    isActive: body.isActive,
    showInPos: body.showInPos,
    showInMenu: body.showInMenu,
    sendToKitchen: body.sendToKitchen,
    options: body.options.map((g) => ({ ...g, choices: g.choices.map((c) => ({ name: c.name, price: toMinor(c.price) })) })),
  };
}

async function assertCategory(app: FastifyInstance, ctx: BusinessContext, categoryId: string | null) {
  if (!categoryId) return;
  const [c] = await app.deps.db.select({ id: categories.id }).from(categories).where(own(categories, ctx, categoryId));
  if (!c) throw new AppError('validation_failed', 'Unknown category', { fields: { categoryId: { code: 'invalid_option' } } });
}

export async function catalogRoutes(app: FastifyInstance) {
  const { db, storage } = app.deps;

  // ---------------------------------------------------------------- categories
  app.get('/categories', { preHandler: requireAnyPermission('categories.view', 'products.view', 'pos.access') }, async (req) => {
    const ctx = bizCtx(req);
    const rows = await db
      .select({ c: categories, n: count(products.id) })
      .from(categories)
      .leftJoin(products, and(eq(products.categoryId, categories.id), isNull(products.deletedAt)))
      .where(eq(categories.businessId, ctx.businessId))
      .groupBy(categories.id)
      .orderBy(asc(categories.sortOrder), asc(categories.name));
    return { items: rows.map((r) => ({ ...r.c, productCount: Number(r.n) })) };
  });

  app.post('/categories', { preHandler: requirePermission('categories.manage') }, async (req, reply) => {
    const ctx = bizCtx(req);
    const body = parse(categorySchema, req.body);
    const [c] = await db
      .insert(categories)
      .values({ ...body, businessId: ctx.businessId })
      .returning();
    await audit(db, { ...actor(ctx), action: 'category.created', entityType: 'category', entityId: c!.id, req });
    reply.status(201);
    return c;
  });

  app.patch('/categories/:id', { preHandler: requirePermission('categories.manage') }, async (req) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    const body = parse(categorySchema.partial(), req.body);
    const [c] = await db
      .update(categories)
      .set({ ...body, updatedAt: new Date() })
      .where(own(categories, ctx, id))
      .returning();
    if (!c) throw notFound();
    return c;
  });

  app.delete('/categories/:id', { preHandler: requirePermission('categories.manage') }, async (req) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    const [c] = await db.delete(categories).where(own(categories, ctx, id)).returning({ id: categories.id });
    if (!c) throw notFound();
    await audit(db, { ...actor(ctx), action: 'category.deleted', entityType: 'category', entityId: id, req });
    return { ok: true };
  });

  // ---------------------------------------------------------------- products
  app.get('/products', { preHandler: requirePermission('products.view') }, async (req) => {
    const ctx = bizCtx(req);
    const q = parse(productListQuery, req.query);
    const where = and(
      eq(products.businessId, ctx.businessId),
      isNull(products.deletedAt),
      q.q ? or(ilike(products.name, `%${q.q}%`), ilike(products.sku, `%${q.q}%`)) : undefined,
      q.categoryId ? eq(products.categoryId, q.categoryId) : undefined,
      q.type ? eq(products.type, q.type) : undefined,
      q.active ? eq(products.isActive, q.active === 'true') : undefined,
    );
    const outletId = ctx.outletId;
    const [items, [total]] = await Promise.all([
      db
        .select({
          p: products,
          categoryName: categories.name,
          stock: sql<string | null>`(SELECT quantity FROM stock_levels s WHERE s.product_id = "products"."id" AND s.outlet_id = ${outletId})`,
        })
        .from(products)
        .leftJoin(categories, eq(categories.id, products.categoryId))
        .where(where)
        .orderBy(asc(products.name))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      db.select({ n: count() }).from(products).where(where),
    ]);
    return {
      items: items.map((r) => ({ ...r.p, categoryName: r.categoryName, stock: r.stock === null ? null : Number(r.stock) })),
      page: q.page,
      pageSize: q.pageSize,
      total: Number(total?.n ?? 0),
    };
  });

  app.get('/products/:id', { preHandler: requirePermission('products.view') }, async (req) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    const [p] = await db.select().from(products).where(own(products, ctx, id));
    if (!p) throw notFound();
    const recipe = await db
      .select({ ingredientId: recipeItems.ingredientId, quantity: recipeItems.quantity, name: products.name, unit: products.unit, costPrice: products.costPrice })
      .from(recipeItems)
      .innerJoin(products, eq(products.id, recipeItems.ingredientId))
      .where(and(eq(recipeItems.businessId, ctx.businessId), eq(recipeItems.productId, id)));
    const stock = await db
      .select({ outletId: stockLevels.outletId, quantity: stockLevels.quantity })
      .from(stockLevels)
      .where(and(eq(stockLevels.businessId, ctx.businessId), eq(stockLevels.productId, id)));
    return { ...p, recipe, stock };
  });

  app.post('/products', { preHandler: requirePermission('products.create') }, async (req, reply) => {
    const ctx = bizCtx(req);
    const body = parse(productSchema, req.body);
    await assertCategory(app, ctx, body.categoryId);
    const created = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'products:' + ctx.businessId}))`);
      const [n] = await tx
        .select({ n: count() })
        .from(products)
        .where(and(eq(products.businessId, ctx.businessId), isNull(products.deletedAt)));
      if (!withinLimit(ctx.access.limits, 'max_products', Number(n?.n ?? 0))) {
        throw new AppError('plan_limit_reached', 'Product limit reached', { details: { limit: 'max_products' } });
      }
      const [p] = await tx
        .insert(products)
        .values({ ...productValues(body), businessId: ctx.businessId })
        .returning();
      await audit(tx, { ...actor(ctx), action: 'product.created', entityType: 'product', entityId: p!.id, metadata: { name: p!.name }, req });
      return p!;
    });
    reply.status(201);
    return created;
  });

  app.put('/products/:id', { preHandler: requirePermission('products.edit') }, async (req) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    const body = parse(productSchema, req.body);
    await assertCategory(app, ctx, body.categoryId);
    const [before] = await db.select().from(products).where(own(products, ctx, id));
    if (!before) throw notFound();
    const values = productValues(body);
    const [p] = await db
      .update(products)
      .set({ ...values, updatedAt: new Date() })
      .where(own(products, ctx, id))
      .returning();
    const priceChanged = before.sellingPrice !== values.sellingPrice || before.costPrice !== values.costPrice;
    await audit(db, {
      ...actor(ctx),
      action: 'product.updated',
      entityType: 'product',
      entityId: id,
      metadata: priceChanged ? { sellingPrice: [before.sellingPrice, values.sellingPrice], costPrice: [before.costPrice, values.costPrice] } : {},
      req,
    });
    return p;
  });

  app.delete('/products/:id', { preHandler: requirePermission('products.delete') }, async (req) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    // Soft delete: historical sales/documents keep their snapshots.
    const [p] = await db
      .update(products)
      .set({ deletedAt: new Date(), isActive: false })
      .where(own(products, ctx, id))
      .returning({ id: products.id });
    if (!p) throw notFound();
    await audit(db, { ...actor(ctx), action: 'product.deleted', entityType: 'product', entityId: id, req });
    return { ok: true };
  });

  app.put('/products/:id/image', { preHandler: requirePermission('products.edit'), bodyLimit: 2_097_152 }, async (req) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    const [p] = await db.select({ imagePath: products.imagePath }).from(products).where(own(products, ctx, id));
    if (!p) throw notFound();
    if (!Buffer.isBuffer(req.body) || !req.body.length) throw new AppError('validation_failed', 'Image required', { fields: { file: { code: 'invalid_image' } } });
    const saved = await storage.saveBusinessImage(ctx.businessId, `product-${id}`, req.body);
    await db.update(products).set({ imagePath: saved.rel, updatedAt: new Date() }).where(own(products, ctx, id));
    if (p.imagePath) await storage.remove(p.imagePath);
    return { ok: true };
  });

  app.delete('/products/:id/image', { preHandler: requirePermission('products.edit') }, async (req) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    const [p] = await db.select({ imagePath: products.imagePath }).from(products).where(own(products, ctx, id));
    if (!p) throw notFound();
    await db.update(products).set({ imagePath: null, updatedAt: new Date() }).where(own(products, ctx, id));
    if (p.imagePath) await storage.remove(p.imagePath);
    return { ok: true };
  });

  app.get('/products/:id/image', async (req, reply) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    const [p] = await db.select({ imagePath: products.imagePath }).from(products).where(own(products, ctx, id));
    if (!p?.imagePath) throw notFound();
    const ext = p.imagePath.split('.').pop();
    const type = Object.entries(IMAGE_TYPES).find(([, d]) => d.ext === ext)?.[0] ?? 'application/octet-stream';
    reply.header('content-type', type).header('cache-control', 'private, no-cache').header('x-content-type-options', 'nosniff');
    return reply.send(await storage.read(p.imagePath));
  });

  // ---------------------------------------------------------------- recipes (add-on)
  app.put('/products/:id/recipe', { preHandler: requirePermission('recipes.manage') }, async (req) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    const body = parse(recipeSchema, req.body);
    const [p] = await db.select({ id: products.id }).from(products).where(own(products, ctx, id));
    if (!p) throw notFound();
    const ingredientIds = [...new Set(body.items.map((i) => i.ingredientId))];
    if (ingredientIds.includes(id)) throw new AppError('validation_failed', 'A product cannot be its own ingredient', { fields: { items: { code: 'invalid_option' } } });
    if (ingredientIds.length) {
      const found = await db
        .select({ id: products.id })
        .from(products)
        .where(and(eq(products.businessId, ctx.businessId), inArray(products.id, ingredientIds), isNull(products.deletedAt)));
      if (found.length !== ingredientIds.length) throw new AppError('validation_failed', 'Unknown ingredient', { fields: { items: { code: 'invalid_option' } } });
    }
    await db.transaction(async (tx) => {
      await tx.delete(recipeItems).where(and(eq(recipeItems.businessId, ctx.businessId), eq(recipeItems.productId, id)));
      if (body.items.length) {
        await tx.insert(recipeItems).values(body.items.map((i) => ({ businessId: ctx.businessId, productId: id, ingredientId: i.ingredientId, quantity: i.quantity })));
      }
      await audit(tx, { ...actor(ctx), action: 'recipe.updated', entityType: 'product', entityId: id, req });
    });
    return { ok: true };
  });

  // ---------------------------------------------------------------- POS catalog (fast, single payload)
  app.get('/pos/catalog', { preHandler: requirePermission('pos.access') }, async (req) => {
    const ctx = bizCtx(req);
    const outletId = requireOutlet(ctx);
    const [cats, prods] = await Promise.all([
      db
        .select({ id: categories.id, name: categories.name, sortOrder: categories.sortOrder })
        .from(categories)
        .where(and(eq(categories.businessId, ctx.businessId), eq(categories.isActive, true)))
        .orderBy(asc(categories.sortOrder), asc(categories.name)),
      db
        .select({
          id: products.id,
          name: products.name,
          sku: products.sku,
          categoryId: products.categoryId,
          sellingPrice: products.sellingPrice,
          taxRate: products.taxRate,
          trackStock: products.trackStock,
          options: products.options,
          hasImage: sql<boolean>`${products.imagePath} IS NOT NULL`,
          stock: sql<string | null>`(SELECT quantity FROM stock_levels s WHERE s.product_id = "products"."id" AND s.outlet_id = ${outletId})`,
        })
        .from(products)
        .where(and(eq(products.businessId, ctx.businessId), eq(products.isActive, true), eq(products.showInPos, true), isNull(products.deletedAt), sql`${products.type} <> 'ingredient'`))
        .orderBy(asc(products.name)),
    ]);
    return { categories: cats, products: prods.map((p) => ({ ...p, stock: p.stock === null ? null : Number(p.stock) })) };
  });

  void assertPermission;
}
