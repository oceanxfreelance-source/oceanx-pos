import type { FastifyInstance } from 'fastify';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { publicOrderSchema } from '@oceanx/shared';
import { businesses, categories, outlets, products, sales, saleItems } from '../db/schema';
import { AppError, notFound } from '../lib/errors';
import { contentTypeFor } from '../lib/storage';
import { parse } from '../lib/validation';
import { loadBusinessAccess } from '../services/access';
import { notifyPermission } from '../services/notifications';
import { priceOrder } from '../services/ops/sales';
import { loadBusinessSettings } from '../services/settings';
import type { BusinessContext } from '../types';

/**
 * Public QR menu and online ordering. No authentication: only explicitly public data is exposed,
 * only for operational businesses with the QR-menu add-on, and prices are computed on the server.
 */
export async function publicRoutes(app: FastifyInstance, opts: { authRateLimit: number }) {
  const { db } = app.deps;

  async function load(slug: string) {
    const parsed = z
      .string()
      .regex(/^[a-z0-9-]{1,60}$/)
      .safeParse(slug);
    if (!parsed.success) throw notFound();
    const [b] = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.slug, parsed.data));
    if (!b) throw notFound();
    const access = await loadBusinessAccess(db, b.id);
    if (!access || access.state !== 'ok' || !access.addons.has('qr_menu')) throw notFound();
    const settings = await loadBusinessSettings(db, b.id);
    if (!settings.online.menuEnabled) throw notFound();
    return { access, settings };
  }

  app.get<{ Params: { slug: string } }>('/menu/:slug', async (req) => {
    const { access, settings } = await load(req.params.slug);
    const bid = access.business.id;
    const [cats, prods] = await Promise.all([
      db
        .select({ id: categories.id, name: categories.name, description: categories.description, translations: categories.translations })
        .from(categories)
        .where(and(eq(categories.businessId, bid), eq(categories.isActive, true)))
        .orderBy(asc(categories.sortOrder), asc(categories.name)),
      db
        .select({
          id: products.id,
          name: products.name,
          description: products.description,
          translations: products.translations,
          categoryId: products.categoryId,
          price: products.sellingPrice,
          options: products.options,
          hasImage: sql<boolean>`${products.imagePath} IS NOT NULL`,
        })
        .from(products)
        .where(and(eq(products.businessId, bid), eq(products.isActive, true), eq(products.showInMenu, true), isNull(products.deletedAt), sql`${products.type} <> 'ingredient'`))
        .orderBy(asc(products.name)),
    ]);
    const b = access.business;
    return {
      business: { name: b.name, businessType: b.businessType, address: b.address, phone: b.phone, currency: b.currency, hasLogo: !!b.logoPath },
      currencySymbol: settings.regional.currencySymbol,
      message: settings.online.message,
      messageTranslations: settings.online.messageTranslations ?? {},
      showPrices: settings.online.showPrices,
      ordersEnabled: settings.online.ordersEnabled && access.addons.has('online_ordering'),
      deliveryEnabled: access.addons.has('delivery'),
      categories: cats,
      products: prods.map((p) => ({ ...p, price: settings.online.showPrices ? p.price : null, options: settings.online.showPrices ? p.options : p.options.map((g) => ({ ...g, choices: g.choices.map((c) => ({ ...c, price: 0 })) })) })),
    };
  });

  app.get<{ Params: { slug: string; id: string } }>('/menu/:slug/products/:id/image', async (req, reply) => {
    const { access } = await load(req.params.slug);
    const pid = z.uuid().safeParse(req.params.id);
    if (!pid.success) throw notFound();
    const [p] = await db
      .select({ imagePath: products.imagePath })
      .from(products)
      .where(and(eq(products.businessId, access.business.id), eq(products.id, pid.data), eq(products.showInMenu, true), isNull(products.deletedAt)));
    if (!p?.imagePath) throw notFound();
    reply.header('content-type', contentTypeFor(p.imagePath)).header('cache-control', 'public, max-age=600').header('x-content-type-options', 'nosniff').header('cross-origin-resource-policy', 'same-site');
    return reply.send(await app.deps.storage.read(p.imagePath));
  });

  app.get<{ Params: { slug: string } }>('/menu/:slug/logo', async (req, reply) => {
    const { access } = await load(req.params.slug);
    const rel = access.business.logoPath;
    if (!rel) throw notFound();
    reply.header('content-type', contentTypeFor(rel)).header('cache-control', 'public, max-age=600').header('x-content-type-options', 'nosniff');
    return reply.send(await app.deps.storage.read(rel));
  });

  app.post<{ Params: { slug: string } }>('/menu/:slug/orders', { config: { rateLimit: { max: Math.min(opts.authRateLimit, 10), timeWindow: '1 minute' } } }, async (req, reply) => {
    const { access, settings } = await load(req.params.slug);
    if (!settings.online.ordersEnabled || !access.addons.has('online_ordering')) throw new AppError('online_ordering_closed', 'Online ordering is not available');
    const body = parse(publicOrderSchema, req.body);
    if (body.orderType === 'delivery' && (!access.addons.has('delivery') || !body.address)) throw new AppError('validation_failed', 'Address required', { fields: { address: { code: 'required' } } });
    const [outlet] = await db
      .select({ id: outlets.id })
      .from(outlets)
      .where(and(eq(outlets.businessId, access.business.id), eq(outlets.isActive, true)))
      .orderBy(sql`${outlets.isDefault} DESC`, asc(outlets.createdAt))
      .limit(1);
    if (!outlet) throw notFound();
    // A minimal, permission-less context: no discounts, no credit, no loyalty — server prices only.
    const ctx = { businessId: access.business.id, outletId: outlet.id, access, permissions: new Set<string>(), rawPermissions: new Set<string>() } as unknown as BusinessContext;
    const order = await db.transaction(async (tx) => {
      const priced = await priceOrder(tx, ctx, {
        orderType: body.orderType,
        tableId: null,
        customerId: null,
        items: body.items.map((i) => ({ productId: i.productId, quantity: i.quantity, discount: 0, options: i.options, note: '' })),
        discount: 0,
        note: body.note,
        delivery: body.orderType === 'delivery' ? { address: body.address, phone: body.phone, fee: 0 } : null,
        redeemPoints: 0,
      });
      const [s] = await tx
        .insert(sales)
        .values({
          businessId: access.business.id,
          outletId: outlet.id,
          status: 'open',
          source: 'online',
          orderType: body.orderType,
          currency: access.business.currency,
          note: body.note,
          onlineCustomer: { name: body.customerName, phone: body.phone, tableName: body.tableName || undefined },
          delivery: body.orderType === 'delivery' ? { address: body.address, phone: body.phone } : null,
          subtotal: priced.calc.subtotal,
          discount: priced.calc.discount,
          serviceCharge: priced.calc.serviceCharge,
          tax: priced.calc.tax,
          deliveryFee: priced.deliveryFee,
          total: priced.total,
        })
        .returning();
      await tx.insert(saleItems).values(
        priced.lines.map((l) => ({
          businessId: access.business.id,
          saleId: s!.id,
          productId: l.productId,
          categoryId: l.categoryId,
          nameSnapshot: l.name,
          skuSnapshot: l.sku,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          options: l.options,
          discount: l.discount,
          taxRate: l.taxRate,
          tax: l.tax,
          total: l.total,
          costPrice: l.costPrice,
          note: l.note,
          sendToKitchen: l.sendToKitchen,
        })),
      );
      await notifyPermission(tx, access.business.id, 'online_orders.manage', 'notify.online_order', { name: body.customerName }, '/online-orders');
      return s!;
    });
    reply.status(201);
    return { reference: order.id.slice(0, 8).toUpperCase(), total: order.total, currency: order.currency };
  });
}
