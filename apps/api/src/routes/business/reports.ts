import { isRetailType } from '@oceanx/shared';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { and, count, desc, eq, sql, type SQL } from 'drizzle-orm';
import { reportQuerySchema } from '@oceanx/shared';
import { businesses, kitchenOrders, outlets, products, sales, userOutlets } from '../../db/schema';
import { assertPermission, bizCtx, requirePermission } from '../../guards/business';
import { AppError, notFound } from '../../lib/errors';
import { businessToday } from '../../lib/tenant';
import { parse } from '../../lib/validation';
import type { BusinessContext } from '../../types';

export const REPORT_TYPES = [
  'sales-summary',
  'products',
  'categories',
  'payment-methods',
  'expenses',
  'profit',
  'inventory',
  'customers',
  'quotations',
  'invoices',
  'credit',
  'staff',
  'outlets',
  'costing',
  'rack-low',
  'store-stock',
] as const;
/** Shop-only reports (rack vs stock room). */
const RETAIL_REPORTS: ReadonlyArray<string> = ['rack-low', 'store-stock'];
type ReportType = (typeof REPORT_TYPES)[number];

const REPORT_PERMISSION_EXTRA: Partial<Record<ReportType, string>> = {
  quotations: 'quotations.view',
  invoices: 'invoices.view',
  credit: 'credit.view',
  inventory: 'inventory.view',
  'rack-low': 'inventory.view',
  'store-stock': 'inventory.view',
  expenses: 'expenses.view',
  costing: 'costing.view',
};

/** Outlets the user may report on: assigned outlets, or all outlets of the business. */
async function allowedOutlets(app: FastifyInstance, ctx: BusinessContext, requested?: string): Promise<string[]> {
  const { db } = app.deps;
  const assigned = await db.select({ id: userOutlets.outletId }).from(userOutlets).where(eq(userOutlets.userId, ctx.user.id));
  const all = (await db.select({ id: outlets.id }).from(outlets).where(eq(outlets.businessId, ctx.businessId))).map((o) => o.id);
  const scope = assigned.length ? assigned.map((a) => a.id) : all;
  if (requested) {
    if (!scope.includes(requested)) throw notFound();
    return [requested];
  }
  return scope;
}

const inList = (col: SQL, ids: string[]) =>
  sql`${col} IN (${sql.join(
    ids.map((i) => sql`${i}::uuid`),
    sql`, `,
  )})`;

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]!);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    // Neutralise spreadsheet formula injection.
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}

export async function reportRoutes(app: FastifyInstance) {
  const { db } = app.deps;

  app.get<{ Params: { type: string } }>('/reports/:type', { preHandler: requirePermission('reports.view') }, async (req, reply: FastifyReply) => {
    const ctx = bizCtx(req);
    const type = req.params.type as ReportType;
    if (!REPORT_TYPES.includes(type)) throw notFound();
    if (RETAIL_REPORTS.includes(type) && !isRetailType(ctx.access.business.businessType)) throw notFound();
    const extra = REPORT_PERMISSION_EXTRA[type];
    if (extra) assertPermission(ctx, extra);
    const q = parse(reportQuerySchema, req.query);
    if (q.from > q.to) throw new AppError('validation_failed', 'Invalid range', { fields: { to: { code: 'invalid' } } });
    const days = (Date.parse(q.to) - Date.parse(q.from)) / 86_400_000;
    if (days > 366) throw new AppError('validation_failed', 'Range too long', { fields: { to: { code: 'too_big', params: { max: 366 } } } });
    const historyLimit = ctx.access.limits.report_history_days;
    if (historyLimit != null) {
      const earliest = new Date(Date.now() - historyLimit * 86_400_000).toISOString().slice(0, 10);
      if (q.from < earliest) throw new AppError('plan_limit_reached', 'Report history limited by plan', { details: { limit: 'report_history_days', value: historyLimit } });
    }
    if (q.format === 'csv') assertPermission(ctx, 'reports.export');

    const oids = await allowedOutlets(app, ctx, q.outletId);
    const tz = ctx.access.business.timezone;
    const bid = ctx.businessId;
    const saleDay = sql`(s.completed_at AT TIME ZONE ${tz})::date`;
    const inRange = sql`${saleDay} BETWEEN ${q.from}::date AND ${q.to}::date`;
    const saleScope = sql`s.business_id = ${bid} AND s.status = 'completed' AND ${inList(sql`s.outlet_id`, oids)} AND ${inRange}`;

    let rows: Record<string, unknown>[] = [];
    let summary: Record<string, unknown> = {};
    const run = async <T extends Record<string, unknown>>(query: SQL) => (await db.execute<T>(query)).rows;

    switch (type) {
      case 'sales-summary': {
        rows = await run(sql`
          SELECT to_char(${saleDay}, 'YYYY-MM-DD') AS day, count(*)::int AS orders, SUM(s.subtotal)::bigint AS gross, SUM(s.discount)::bigint AS discount,
                 SUM(s.service_charge)::bigint AS service_charge, SUM(s.tax)::bigint AS tax, SUM(s.total)::bigint AS total,
                 (SUM(s.total) / NULLIF(count(*),0))::bigint AS average
          FROM sales s WHERE ${saleScope} GROUP BY 1 ORDER BY 1`);
        break;
      }
      case 'products': {
        rows = await run(sql`
          SELECT i.name_snapshot AS product, SUM(i.quantity)::float AS quantity, SUM(i.total)::bigint AS revenue,
                 SUM(round(i.cost_price * i.quantity))::bigint AS cost, (SUM(i.total) - SUM(round(i.cost_price * i.quantity)))::bigint AS margin
          FROM sale_items i JOIN sales s ON s.id = i.sale_id WHERE ${saleScope}
          GROUP BY i.name_snapshot ORDER BY revenue DESC LIMIT 500`);
        break;
      }
      case 'categories': {
        rows = await run(sql`
          SELECT COALESCE(c.name, '—') AS category, SUM(i.quantity)::float AS quantity, SUM(i.total)::bigint AS revenue
          FROM sale_items i JOIN sales s ON s.id = i.sale_id LEFT JOIN categories c ON c.id = i.category_id
          WHERE ${saleScope} GROUP BY 1 ORDER BY revenue DESC`);
        break;
      }
      case 'payment-methods': {
        rows = await run(sql`
          SELECT p.method, p.kind, count(*)::int AS count, SUM(p.amount)::bigint AS amount
          FROM payments p WHERE p.business_id = ${bid} AND p.voided_at IS NULL
            AND (p.outlet_id IS NULL OR ${inList(sql`p.outlet_id`, oids)})
            AND (p.paid_at AT TIME ZONE ${tz})::date BETWEEN ${q.from}::date AND ${q.to}::date
          GROUP BY 1, 2 ORDER BY amount DESC`);
        break;
      }
      case 'expenses': {
        rows = await run(sql`
          SELECT e.category, count(*)::int AS count, SUM(e.amount)::bigint AS amount FROM expenses e
          WHERE e.business_id = ${bid} AND e.deleted_at IS NULL AND ${inList(sql`e.outlet_id`, oids)} AND e.expense_date BETWEEN ${q.from} AND ${q.to}
          GROUP BY 1 ORDER BY amount DESC`);
        break;
      }
      case 'profit': {
        const [s] = await run<{ revenue: string; tax: string; cogs: string }>(sql`
          SELECT COALESCE(SUM(s.total - s.tax),0)::bigint AS revenue, COALESCE(SUM(s.tax),0)::bigint AS tax,
                 COALESCE((SELECT SUM(round(i.cost_price * i.quantity)) FROM sale_items i JOIN sales s ON s.id = i.sale_id WHERE ${saleScope}),0)::bigint AS cogs
          FROM sales s WHERE ${saleScope}`);
        const [inv] = await run<{ revenue: string }>(sql`
          SELECT COALESCE(SUM(total - tax),0)::bigint AS revenue FROM invoices
          WHERE business_id = ${bid} AND status IN ('issued','partially_paid','paid') AND invoice_date BETWEEN ${q.from} AND ${q.to}`);
        const [e] = await run<{ amount: string }>(sql`
          SELECT COALESCE(SUM(amount),0)::bigint AS amount FROM expenses WHERE business_id = ${bid} AND deleted_at IS NULL
            AND ${inList(sql`outlet_id`, oids)} AND expense_date BETWEEN ${q.from} AND ${q.to}`);
        const salesRevenue = Number(s?.revenue ?? 0);
        const invoiceRevenue = Number(inv?.revenue ?? 0);
        const cogs = Number(s?.cogs ?? 0);
        const exp = Number(e?.amount ?? 0);
        summary = { salesRevenue, invoiceRevenue, revenue: salesRevenue + invoiceRevenue, cogs, grossProfit: salesRevenue + invoiceRevenue - cogs, expenses: exp, netProfit: salesRevenue + invoiceRevenue - cogs - exp, taxCollected: Number(s?.tax ?? 0) };
        rows = [summary];
        break;
      }
      case 'inventory': {
        rows = isRetailType(ctx.access.business.businessType)
          ? await run(sql`
          SELECT p.name AS product, p.sku, o.name AS outlet, st.quantity::float AS on_rack, st.store_quantity::float AS in_store, p.cost_price AS unit_cost,
                 round((GREATEST(st.quantity,0) + GREATEST(st.store_quantity,0)) * p.cost_price)::bigint AS value
          FROM stock_levels st JOIN products p ON p.id = st.product_id JOIN outlets o ON o.id = st.outlet_id
          WHERE st.business_id = ${bid} AND p.deleted_at IS NULL AND ${inList(sql`st.outlet_id`, oids)} ORDER BY p.name LIMIT 2000`)
          : await run(sql`
          SELECT p.name AS product, p.sku, o.name AS outlet, st.quantity::float AS quantity, p.min_stock::float AS min_stock, p.cost_price AS unit_cost,
                 round(GREATEST(st.quantity,0) * p.cost_price)::bigint AS value
          FROM stock_levels st JOIN products p ON p.id = st.product_id JOIN outlets o ON o.id = st.outlet_id
          WHERE st.business_id = ${bid} AND p.deleted_at IS NULL AND ${inList(sql`st.outlet_id`, oids)} ORDER BY p.name LIMIT 2000`);
        summary = { stockValue: rows.reduce((a, r) => a + Number(r.value), 0) };
        break;
      }
      // Shops: products at or below their rack alert level, and what the stock room has to refill them.
      case 'rack-low': {
        rows = await run(sql`
          SELECT p.name AS product, p.sku, o.name AS outlet, COALESCE(st.quantity,0)::float AS on_rack, p.min_stock::float AS rack_alert_at,
                 COALESCE(st.store_quantity,0)::float AS in_store
          FROM products p CROSS JOIN outlets o
          LEFT JOIN stock_levels st ON st.product_id = p.id AND st.outlet_id = o.id
          WHERE p.business_id = ${bid} AND o.business_id = ${bid} AND p.deleted_at IS NULL AND p.is_active AND p.track_stock AND p.min_stock > 0
            AND ${inList(sql`o.id`, oids)} AND COALESCE(st.quantity,0) <= p.min_stock
          ORDER BY COALESCE(st.quantity,0) ASC, p.name LIMIT 2000`);
        break;
      }
      // Shops: everything in the stock room, items at/below their store alert level first.
      case 'store-stock': {
        rows = await run(sql`
          SELECT p.name AS product, p.sku, o.name AS outlet, COALESCE(st.store_quantity,0)::float AS in_store, p.min_store_stock::float AS store_alert_at,
                 COALESCE(st.quantity,0)::float AS on_rack, p.cost_price AS unit_cost, round(GREATEST(COALESCE(st.store_quantity,0),0) * p.cost_price)::bigint AS value
          FROM products p CROSS JOIN outlets o
          LEFT JOIN stock_levels st ON st.product_id = p.id AND st.outlet_id = o.id
          WHERE p.business_id = ${bid} AND o.business_id = ${bid} AND p.deleted_at IS NULL AND p.is_active AND p.track_stock AND ${inList(sql`o.id`, oids)}
          ORDER BY (COALESCE(st.store_quantity,0) <= p.min_store_stock) DESC, p.name LIMIT 2000`);
        summary = { stockValue: rows.reduce((a, r) => a + Number(r.value), 0) };
        break;
      }
      case 'customers': {
        rows = await run(sql`
          SELECT c.name AS customer, c.phone, count(*)::int AS orders, SUM(s.total)::bigint AS spent, SUM(s.balance_due)::bigint AS due
          FROM sales s JOIN customers c ON c.id = s.customer_id WHERE ${saleScope}
          GROUP BY c.id, c.name, c.phone ORDER BY spent DESC LIMIT 500`);
        break;
      }
      case 'quotations': {
        rows = await run(sql`
          SELECT status, count(*)::int AS count, SUM(total)::bigint AS value FROM quotations
          WHERE business_id = ${bid} AND quotation_date BETWEEN ${q.from} AND ${q.to} GROUP BY 1 ORDER BY 1`);
        break;
      }
      case 'invoices': {
        const today = businessToday(tz);
        rows = await run(sql`
          SELECT CASE WHEN status IN ('issued','partially_paid') AND balance_due > 0 AND due_date < ${today} THEN 'overdue' ELSE status END AS status,
                 count(*)::int AS count, SUM(total)::bigint AS total, SUM(paid_amount)::bigint AS paid, SUM(balance_due)::bigint AS outstanding
          FROM invoices WHERE business_id = ${bid} AND invoice_date BETWEEN ${q.from} AND ${q.to} GROUP BY 1 ORDER BY 1`);
        break;
      }
      case 'credit': {
        const [agg] = await run<{ credit_sales: string; credit_payments: string }>(sql`
          SELECT COALESCE((SELECT SUM(s.total - s.paid_amount + s.change_amount) FROM sales s WHERE ${saleScope} AND (s.total - s.paid_amount + s.change_amount) > 0),0)::bigint AS credit_sales,
                 COALESCE((SELECT SUM(amount) FROM payments p WHERE p.business_id = ${bid} AND p.kind = 'credit_payment' AND p.voided_at IS NULL
                   AND (p.paid_at AT TIME ZONE ${tz})::date BETWEEN ${q.from}::date AND ${q.to}::date),0)::bigint AS credit_payments`);
        rows = await run(sql`
          SELECT c.name AS customer, c.phone, c.credit_limit,
                 COALESCE((SELECT SUM(balance_due) FROM sales WHERE customer_id = c.id AND status = 'completed'),0)::bigint AS sales_due,
                 COALESCE((SELECT SUM(balance_due) FROM invoices WHERE customer_id = c.id AND status IN ('issued','partially_paid')),0)::bigint AS invoice_due
          FROM customers c WHERE c.business_id = ${bid} AND c.deleted_at IS NULL
            AND (EXISTS (SELECT 1 FROM sales WHERE customer_id = c.id AND balance_due > 0) OR EXISTS (SELECT 1 FROM invoices WHERE customer_id = c.id AND balance_due > 0 AND status IN ('issued','partially_paid')))
          ORDER BY 4 DESC LIMIT 1000`);
        summary = { creditSales: Number(agg?.credit_sales ?? 0), creditPayments: Number(agg?.credit_payments ?? 0), outstanding: rows.reduce((a, r) => a + Number(r.sales_due) + Number(r.invoice_due), 0) };
        break;
      }
      case 'staff': {
        rows = await run(sql`
          SELECT u.name AS staff, 'pos' AS source, count(*)::int AS count, SUM(s.total)::bigint AS total
          FROM sales s JOIN users u ON u.id = s.cashier_id WHERE ${saleScope} GROUP BY u.name
          UNION ALL
          SELECT u.name, 'invoices', count(*)::int, SUM(i.total)::bigint FROM invoices i JOIN users u ON u.id = i.salesperson_id
          WHERE i.business_id = ${bid} AND i.status IN ('issued','partially_paid','paid') AND i.invoice_date BETWEEN ${q.from} AND ${q.to} GROUP BY u.name
          ORDER BY 4 DESC`);
        break;
      }
      case 'outlets': {
        rows = await run(sql`
          SELECT o.name AS outlet, count(s.id)::int AS orders, COALESCE(SUM(s.total),0)::bigint AS total
          FROM outlets o LEFT JOIN sales s ON s.outlet_id = o.id AND s.status = 'completed' AND ${inRange}
          WHERE o.business_id = ${bid} AND ${inList(sql`o.id`, oids)} GROUP BY o.id, o.name ORDER BY total DESC`);
        break;
      }
      case 'costing': {
        rows = await run(sql`
          SELECT p.name AS product, p.selling_price AS price,
                 COALESCE(SUM(round(ing.cost_price * r.quantity)),0)::bigint AS recipe_cost,
                 (p.selling_price - COALESCE(SUM(round(ing.cost_price * r.quantity)),0))::bigint AS margin
          FROM products p JOIN recipe_items r ON r.product_id = p.id JOIN products ing ON ing.id = r.ingredient_id
          WHERE p.business_id = ${bid} AND p.deleted_at IS NULL GROUP BY p.id, p.name, p.selling_price ORDER BY margin ASC`);
        break;
      }
    }

    // Normalise numeric strings from the driver.
    rows = rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) && !['day', 'sku', 'phone'].includes(k) ? Number(v) : v])));

    if (q.format === 'csv') {
      reply.header('content-type', 'text/csv; charset=utf-8').header('content-disposition', `attachment; filename="${type}_${q.from}_${q.to}.csv"`);
      return reply.send('﻿' + toCsv(rows));
    }
    return { type, from: q.from, to: q.to, outlets: oids, rows, summary };
  });

  // ---------------------------------------------------------------- dashboard sales widgets
  app.get('/dashboard/sales', { preHandler: requirePermission('dashboard.view') }, async (req) => {
    const ctx = bizCtx(req);
    const oids = await allowedOutlets(app, ctx);
    const tz = ctx.access.business.timezone;
    const bid = ctx.businessId;
    const today = businessToday(tz);
    const out: Record<string, unknown> = {};
    const scope = sql`s.business_id = ${bid} AND s.status = 'completed' AND ${inList(sql`s.outlet_id`, oids)}`;
    const day = sql`(s.completed_at AT TIME ZONE ${tz})::date`;

    if (ctx.permissions.has('sales.view')) {
      const [t] = (
        await db.execute<{ orders: number; total: string }>(sql`
        SELECT count(*)::int AS orders, COALESCE(SUM(total),0)::bigint AS total FROM sales s WHERE ${scope} AND ${day} = ${today}::date`)
      ).rows;
      out.today = { orders: t?.orders ?? 0, total: Number(t?.total ?? 0), average: t?.orders ? Math.round(Number(t.total) / t.orders) : 0 };
      out.trend = (
        await db.execute<{ day: string; total: string; orders: number }>(sql`
        SELECT to_char(d::date,'YYYY-MM-DD') AS day, COALESCE(SUM(s.total),0)::bigint AS total, count(s.id)::int AS orders
        FROM generate_series(${today}::date - 13, ${today}::date, interval '1 day') d
        LEFT JOIN sales s ON ${scope} AND ${day} = d::date GROUP BY d ORDER BY d`)
      ).rows.map((r) => ({ day: r.day, total: Number(r.total), orders: r.orders }));
      out.topProducts = (
        await db.execute<{ name: string; quantity: number; revenue: string }>(sql`
        SELECT i.name_snapshot AS name, SUM(i.quantity)::float AS quantity, SUM(i.total)::bigint AS revenue
        FROM sale_items i JOIN sales s ON s.id = i.sale_id WHERE ${scope} AND ${day} > ${today}::date - 7
        GROUP BY 1 ORDER BY revenue DESC LIMIT 6`)
      ).rows.map((r) => ({ ...r, revenue: Number(r.revenue) }));
      out.topDrinks = (
        await db.execute<{ name: string; quantity: number; revenue: string }>(sql`
        SELECT i.name_snapshot AS name, SUM(i.quantity)::float AS quantity, SUM(i.total)::bigint AS revenue
        FROM sale_items i JOIN sales s ON s.id = i.sale_id JOIN categories c ON c.id = i.category_id
        WHERE ${scope} AND ${day} > ${today}::date - 7 AND c.name ~* '(drink|coffee|tea|juice|beverage|smoothie|ބުއި|पेय|পানীয়)'
        GROUP BY 1 ORDER BY quantity DESC LIMIT 6`)
      ).rows.map((r) => ({ ...r, revenue: Number(r.revenue) }));
      out.recentSales = await db
        .select({ id: sales.id, number: sales.number, total: sales.total, completedAt: sales.completedAt, orderType: sales.orderType })
        .from(sales)
        .where(and(eq(sales.businessId, bid), eq(sales.status, 'completed')))
        .orderBy(desc(sales.completedAt))
        .limit(8);
      const [open] = await db
        .select({ n: count() })
        .from(sales)
        .where(and(eq(sales.businessId, bid), eq(sales.status, 'open')));
      out.openOrders = Number(open?.n ?? 0);
    }
    if (ctx.permissions.has('customers.view')) {
      const [c] = (await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM customers WHERE business_id = ${bid} AND deleted_at IS NULL`)).rows;
      out.customers = c?.n ?? 0;
    }
    if (ctx.permissions.has('credit.view') || ctx.permissions.has('invoices.view')) {
      const [d] = (
        await db.execute<{ s: string; i: string }>(sql`
        SELECT COALESCE((SELECT SUM(balance_due) FROM sales WHERE business_id = ${bid} AND status = 'completed'),0)::bigint AS s,
               COALESCE((SELECT SUM(balance_due) FROM invoices WHERE business_id = ${bid} AND status IN ('issued','partially_paid')),0)::bigint AS i`)
      ).rows;
      out.outstandingDue = (ctx.permissions.has('credit.view') ? Number(d?.s ?? 0) : 0) + (ctx.permissions.has('invoices.view') ? Number(d?.i ?? 0) : 0);
    }
    if (ctx.permissions.has('inventory.view')) {
      const [l] = (
        await db.execute<{ n: number }>(sql`
        SELECT count(*)::int AS n FROM products p LEFT JOIN stock_levels st ON st.product_id = p.id AND st.outlet_id = ${ctx.outletId}
        WHERE p.business_id = ${bid} AND p.deleted_at IS NULL AND p.track_stock AND p.min_stock > 0 AND COALESCE(st.quantity,0) <= p.min_stock`)
      ).rows;
      out.lowStock = l?.n ?? 0;
    }
    if (ctx.permissions.has('kitchen.view') && ctx.outletId) {
      const [k] = await db
        .select({ n: count() })
        .from(kitchenOrders)
        .where(and(eq(kitchenOrders.businessId, bid), eq(kitchenOrders.outletId, ctx.outletId), sql`${kitchenOrders.status} IN ('new','preparing')`));
      out.kitchenPending = Number(k?.n ?? 0);
    }
    return out;
  });

  // ---------------------------------------------------------------- onboarding
  app.get('/onboarding', { preHandler: requirePermission('settings.view') }, async (req) => {
    const ctx = bizCtx(req);
    const [c] = (await db.execute<{ cats: number; prods: number; tables: number; users: number; sales: number }>(sql`
      SELECT (SELECT count(*)::int FROM categories WHERE business_id = ${ctx.businessId}) AS cats,
             (SELECT count(*)::int FROM products WHERE business_id = ${ctx.businessId} AND deleted_at IS NULL) AS prods,
             (SELECT count(*)::int FROM dining_tables WHERE business_id = ${ctx.businessId}) AS tables,
             (SELECT count(*)::int FROM users WHERE business_id = ${ctx.businessId} AND deleted_at IS NULL) AS users,
             (SELECT count(*)::int FROM sales WHERE business_id = ${ctx.businessId} AND status = 'completed') AS sales`)).rows;
    return {
      completed: !!ctx.access.business.onboardingCompletedAt,
      categories: c?.cats ?? 0,
      products: c?.prods ?? 0,
      tables: c?.tables ?? 0,
      users: c?.users ?? 0,
      sales: c?.sales ?? 0,
      hasLogo: !!ctx.access.business.logoPath,
    };
  });

  app.post('/onboarding/complete', { preHandler: requirePermission('settings.manage') }, async (req) => {
    const ctx = bizCtx(req);
    await db.update(businesses).set({ onboardingCompletedAt: new Date() }).where(eq(businesses.id, ctx.businessId));
    return { ok: true };
  });

  void products;
}
