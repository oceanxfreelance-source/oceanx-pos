import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, asc, count, desc, eq, gte, ilike, isNull, lte, or, sql, type SQL } from 'drizzle-orm';
import {
  addMonths,
  daysInMonth,
  financeCategorySchema,
  financeListQuerySchema,
  financeTransactionSchema,
  monthSchema,
  type FinanceKind,
} from '@oceanx/shared';
import type { Executor } from '../../db/client';
import { financeCategories, financeTransactions } from '../../db/schema';
import { bizCtx, requirePermission } from '../../guards/business';
import { audit } from '../../lib/audit';
import { AppError, notFound } from '../../lib/errors';
import { idParam } from '../../lib/params';
import { actor, businessToday, own } from '../../lib/tenant';
import { parse } from '../../lib/validation';

type Ctx = ReturnType<typeof bizCtx>;

/** Starter categories, added the first time an account opens Gravity Flow (renamed or removed freely). */
const STARTER_CATEGORIES: Record<FinanceKind, string[]> = {
  income: ['Sales', 'Services', 'Other income'],
  expense: ['Rent', 'Salaries', 'Utilities', 'Supplies', 'Transport', 'Marketing', 'Other expenses'],
};

const monthRange = (month: string) => ({ from: `${month}-01`, to: `${month}-${String(daysInMonth(month)).padStart(2, '0')}` });
const currentMonth = (ctx: Ctx) => businessToday(ctx.access.business.timezone).slice(0, 7);
/** Profit margin in percent with one decimal (null when there is no income to compare against). */
const margin = (income: number, net: number) => (income > 0 ? Math.round((net * 1000) / income) / 10 : null);
const n = (v: unknown) => Number(v ?? 0);

/** Income and expense totals per day for one account (in minor units, exact integers). */
async function dailyTotals(db: Executor, businessId: string, from: string, to: string) {
  return db
    .select({ day: financeTransactions.occurredOn, kind: financeTransactions.kind, total: sql<string>`sum(${financeTransactions.amount})::text` })
    .from(financeTransactions)
    .where(and(eq(financeTransactions.businessId, businessId), isNull(financeTransactions.deletedAt), gte(financeTransactions.occurredOn, from), lte(financeTransactions.occurredOn, to)))
    .groupBy(financeTransactions.occurredOn, financeTransactions.kind);
}

/** Totals per month ("2026-10") for one account. */
async function monthlyTotals(db: Executor, businessId: string, from?: string, to?: string) {
  const m = sql<string>`substr(${financeTransactions.occurredOn}, 1, 7)`;
  return db
    .select({ month: m, kind: financeTransactions.kind, total: sql<string>`sum(${financeTransactions.amount})::text`, n: count() })
    .from(financeTransactions)
    .where(and(eq(financeTransactions.businessId, businessId), isNull(financeTransactions.deletedAt), from ? gte(financeTransactions.occurredOn, from) : undefined, to ? lte(financeTransactions.occurredOn, to) : undefined))
    .groupBy(m, financeTransactions.kind);
}

/**
 * One month: every calendar day (also days with nothing recorded), daily profit = income − expenses,
 * and the running monthly profit from the 1st (cumulative), which can go below zero.
 */
export async function monthSummary(db: Executor, businessId: string, month: string) {
  const { from, to } = monthRange(month);
  const rows = await dailyTotals(db, businessId, from, to);
  const byDay = new Map<string, { income: number; expense: number }>();
  for (const r of rows) {
    const d = byDay.get(r.day) ?? { income: 0, expense: 0 };
    d[r.kind as FinanceKind] += n(r.total);
    byDay.set(r.day, d);
  }
  let running = 0;
  const days = Array.from({ length: daysInMonth(month) }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, '0')}`;
    const { income, expense } = byDay.get(date) ?? { income: 0, expense: 0 };
    const profit = income - expense;
    running += profit;
    return { date, income, expense, profit, cumulative: running };
  });
  const income = days.reduce((s, d) => s + d.income, 0);
  const expense = days.reduce((s, d) => s + d.expense, 0);
  const net = income - expense;
  return { month, totals: { income, expense, net, margin: margin(income, net) }, days };
}

export async function financeRoutes(app: FastifyInstance) {
  const { db } = app.deps;

  const ensureStarterCategories = async (businessId: string) => {
    // Only for an account that has never had categories (deleted ones count: the owner removed them on purpose).
    const [had] = await db.select({ n: count() }).from(financeCategories).where(eq(financeCategories.businessId, businessId));
    if (n(had?.n) > 0) return;
    const values = (Object.keys(STARTER_CATEGORIES) as FinanceKind[]).flatMap((kind) => STARTER_CATEGORIES[kind].map((name, i) => ({ businessId, kind, name, sortOrder: i })));
    await db.insert(financeCategories).values(values).onConflictDoNothing();
  };

  const loadCategory = async (ctx: Ctx, id: string, kind: FinanceKind) => {
    const [c] = await db.select().from(financeCategories).where(own(financeCategories, ctx, id));
    if (!c) throw new AppError('validation_failed', 'Unknown category', { fields: { categoryId: { code: 'invalid_option' } } });
    if (c.kind !== kind) throw new AppError('validation_failed', 'Category is for the other kind', { fields: { categoryId: { code: 'invalid_option' } } });
    return c;
  };

  // ---------------------------------------------------------------- dashboard
  /** The month's KPIs, every day of it, and the month before it for comparison. No month = this month (account time zone). */
  app.get('/finance/summary', { preHandler: requirePermission('finance.view') }, async (req) => {
    const ctx = bizCtx(req);
    const q = parse(z.object({ month: monthSchema.optional() }), req.query);
    const today = businessToday(ctx.access.business.timezone);
    const month = q.month ?? today.slice(0, 7);
    const [current, previous] = await Promise.all([monthSummary(db, ctx.businessId, month), monthSummary(db, ctx.businessId, addMonths(month, -1))]);
    const { from, to } = monthRange(month);
    const byCategory = await db
      .select({ kind: financeTransactions.kind, categoryId: financeTransactions.categoryId, name: financeCategories.name, total: sql<string>`sum(${financeTransactions.amount})::text`, n: count() })
      .from(financeTransactions)
      .leftJoin(financeCategories, and(eq(financeCategories.id, financeTransactions.categoryId), eq(financeCategories.businessId, financeTransactions.businessId)))
      .where(and(eq(financeTransactions.businessId, ctx.businessId), isNull(financeTransactions.deletedAt), gte(financeTransactions.occurredOn, from), lte(financeTransactions.occurredOn, to)))
      .groupBy(financeTransactions.kind, financeTransactions.categoryId, financeCategories.name)
      .orderBy(desc(sql`sum(${financeTransactions.amount})`));
    return {
      ...current,
      today,
      currentMonth: today.slice(0, 7),
      currency: ctx.access.business.currency,
      timezone: ctx.access.business.timezone,
      previous: previous.totals,
      byCategory: byCategory.map((c) => ({ kind: c.kind, categoryId: c.categoryId, name: c.name ?? '', total: n(c.total), count: n(c.n) })),
    };
  });

  /** Income, expenses and profit for the `count` months ending with `to` (empty months included). */
  app.get('/finance/months', { preHandler: requirePermission('finance.view') }, async (req) => {
    const ctx = bizCtx(req);
    const q = parse(z.object({ to: monthSchema.optional(), count: z.coerce.number().int().min(1).max(36).default(12) }), req.query);
    const to = q.to ?? currentMonth(ctx);
    const first = addMonths(to, -(q.count - 1));
    const rows = await monthlyTotals(db, ctx.businessId, monthRange(first).from, monthRange(to).to);
    return { items: monthSeries(first, q.count, rows) };
  });

  /** Every month the account has recorded anything in (newest first), plus the current month. */
  app.get('/finance/history', { preHandler: requirePermission('finance.view') }, async (req) => {
    const ctx = bizCtx(req);
    const rows = await monthlyTotals(db, ctx.businessId);
    const months = new Map<string, { income: number; expense: number; count: number }>();
    months.set(currentMonth(ctx), { income: 0, expense: 0, count: 0 });
    for (const r of rows) {
      const m = months.get(r.month) ?? { income: 0, expense: 0, count: 0 };
      m[r.kind as FinanceKind] += n(r.total);
      m.count += n(r.n);
      months.set(r.month, m);
    }
    const items = [...months.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([month, m]) => ({ month, income: m.income, expense: m.expense, net: m.income - m.expense, margin: margin(m.income, m.income - m.expense), count: m.count }));
    return { items };
  });

  // ---------------------------------------------------------------- categories
  app.get('/finance/categories', { preHandler: requirePermission('finance.view') }, async (req) => {
    const ctx = bizCtx(req);
    await ensureStarterCategories(ctx.businessId);
    const usage = db
      .select({ categoryId: financeTransactions.categoryId, n: count().as('n') })
      .from(financeTransactions)
      .where(and(eq(financeTransactions.businessId, ctx.businessId), isNull(financeTransactions.deletedAt)))
      .groupBy(financeTransactions.categoryId)
      .as('usage');
    const rows = await db
      .select({ c: financeCategories, used: usage.n })
      .from(financeCategories)
      .leftJoin(usage, eq(usage.categoryId, financeCategories.id))
      .where(and(eq(financeCategories.businessId, ctx.businessId), isNull(financeCategories.deletedAt)))
      .orderBy(asc(financeCategories.kind), asc(financeCategories.sortOrder), asc(financeCategories.name));
    return { items: rows.map((r) => ({ id: r.c.id, kind: r.c.kind, name: r.c.name, transactions: n(r.used) })) };
  });

  const nameTaken = (e: unknown) => {
    if ((e as { code?: string; cause?: { code?: string } })?.code === '23505' || (e as { cause?: { code?: string } })?.cause?.code === '23505')
      throw new AppError('validation_failed', 'Name already used', { fields: { name: { code: 'duplicate' } } });
    throw e;
  };

  app.post('/finance/categories', { preHandler: requirePermission('finance.manage') }, async (req, reply) => {
    const ctx = bizCtx(req);
    const body = parse(financeCategorySchema, req.body);
    const [c] = await db
      .insert(financeCategories)
      .values({ businessId: ctx.businessId, kind: body.kind, name: body.name, sortOrder: 100 })
      .returning()
      .catch(nameTaken);
    reply.status(201);
    return c;
  });

  app.patch('/finance/categories/:id', { preHandler: requirePermission('finance.manage') }, async (req) => {
    const ctx = bizCtx(req);
    const body = parse(financeCategorySchema.pick({ name: true }), req.body);
    const [c] = await db
      .update(financeCategories)
      .set({ name: body.name, updatedAt: new Date() })
      .where(own(financeCategories, ctx, idParam(req)))
      .returning()
      .catch(nameTaken);
    if (!c) throw notFound();
    return c;
  });

  /** Removing a category keeps its transactions (they show the old name and stay in every total). */
  app.delete('/finance/categories/:id', { preHandler: requirePermission('finance.manage') }, async (req) => {
    const ctx = bizCtx(req);
    const [c] = await db.update(financeCategories).set({ deletedAt: new Date() }).where(own(financeCategories, ctx, idParam(req))).returning({ id: financeCategories.id });
    if (!c) throw notFound();
    return { ok: true };
  });

  // ---------------------------------------------------------------- transactions
  const listWhere = (ctx: Ctx, q: z.infer<typeof financeListQuerySchema>): SQL | undefined => {
    const range = q.month ? monthRange(q.month) : null;
    return and(
      eq(financeTransactions.businessId, ctx.businessId),
      isNull(financeTransactions.deletedAt),
      range ? gte(financeTransactions.occurredOn, range.from) : undefined,
      range ? lte(financeTransactions.occurredOn, range.to) : undefined,
      q.kind ? eq(financeTransactions.kind, q.kind) : undefined,
      q.categoryId ? eq(financeTransactions.categoryId, q.categoryId) : undefined,
      q.q ? or(ilike(financeTransactions.description, `%${q.q}%`), ilike(financeTransactions.reference, `%${q.q}%`), ilike(financeCategories.name, `%${q.q}%`)) : undefined,
    );
  };
  const listSelect = () =>
    db
      .select({ t: financeTransactions, categoryName: financeCategories.name })
      .from(financeTransactions)
      .leftJoin(financeCategories, and(eq(financeCategories.id, financeTransactions.categoryId), eq(financeCategories.businessId, financeTransactions.businessId)));
  const order = (sort: string) =>
    sort === 'oldest'
      ? [asc(financeTransactions.occurredOn), asc(financeTransactions.createdAt)]
      : sort === 'largest'
        ? [desc(financeTransactions.amount), desc(financeTransactions.occurredOn)]
        : sort === 'smallest'
          ? [asc(financeTransactions.amount), desc(financeTransactions.occurredOn)]
          : [desc(financeTransactions.occurredOn), desc(financeTransactions.createdAt)];
  const out = (r: { t: typeof financeTransactions.$inferSelect; categoryName: string | null }) => ({
    id: r.t.id,
    kind: r.t.kind,
    amount: r.t.amount,
    occurredOn: r.t.occurredOn,
    categoryId: r.t.categoryId,
    categoryName: r.categoryName ?? '',
    description: r.t.description,
    reference: r.t.reference,
    createdAt: r.t.createdAt,
  });

  app.get('/finance/transactions', { preHandler: requirePermission('finance.view') }, async (req) => {
    const ctx = bizCtx(req);
    const q = parse(financeListQuerySchema, req.query);
    const where = listWhere(ctx, q);
    const [items, [total]] = await Promise.all([
      listSelect()
        .where(where)
        .orderBy(...order(q.sort))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      db
        .select({ n: count() })
        .from(financeTransactions)
        .leftJoin(financeCategories, and(eq(financeCategories.id, financeTransactions.categoryId), eq(financeCategories.businessId, financeTransactions.businessId)))
        .where(where),
    ]);
    return { items: items.map(out), page: q.page, pageSize: q.pageSize, total: n(total?.n) };
  });

  app.post('/finance/transactions', { preHandler: requirePermission('finance.manage') }, async (req, reply) => {
    const ctx = bizCtx(req);
    const body = parse(financeTransactionSchema, req.body);
    if (body.categoryId) await loadCategory(ctx, body.categoryId, body.kind);
    const [t] = await db
      .insert(financeTransactions)
      .values({ businessId: ctx.businessId, kind: body.kind, amount: body.amount, occurredOn: body.occurredOn, categoryId: body.categoryId, description: body.description, reference: body.reference, createdBy: ctx.user.id })
      .returning();
    await audit(db, { ...actor(ctx), action: `finance.${body.kind}_added`, entityType: 'finance_transaction', entityId: t!.id, metadata: { amount: body.amount, occurredOn: body.occurredOn }, req });
    reply.status(201);
    return t;
  });

  app.put('/finance/transactions/:id', { preHandler: requirePermission('finance.manage') }, async (req) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    const body = parse(financeTransactionSchema, req.body);
    if (body.categoryId) await loadCategory(ctx, body.categoryId, body.kind);
    const [t] = await db
      .update(financeTransactions)
      .set({ kind: body.kind, amount: body.amount, occurredOn: body.occurredOn, categoryId: body.categoryId, description: body.description, reference: body.reference, updatedAt: new Date() })
      .where(own(financeTransactions, ctx, id))
      .returning();
    if (!t) throw notFound();
    await audit(db, { ...actor(ctx), action: 'finance.transaction_updated', entityType: 'finance_transaction', entityId: id, metadata: { amount: body.amount, occurredOn: body.occurredOn }, req });
    return t;
  });

  app.delete('/finance/transactions/:id', { preHandler: requirePermission('finance.manage') }, async (req) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    const [t] = await db.update(financeTransactions).set({ deletedAt: new Date() }).where(own(financeTransactions, ctx, id)).returning({ id: financeTransactions.id });
    if (!t) throw notFound();
    await audit(db, { ...actor(ctx), action: 'finance.transaction_deleted', entityType: 'finance_transaction', entityId: id, req });
    return { ok: true };
  });

}

/** `count` months from `first`, each with income, expense, net and margin (zero when nothing was recorded). */
function monthSeries(first: string, count: number, rows: { month: string; kind: string; total: string }[]) {
  const map = new Map<string, { income: number; expense: number }>();
  for (const r of rows) {
    const m = map.get(r.month) ?? { income: 0, expense: 0 };
    m[r.kind as FinanceKind] += Number(r.total);
    map.set(r.month, m);
  }
  return Array.from({ length: count }, (_, i) => {
    const month = addMonths(first, i);
    const { income, expense } = map.get(month) ?? { income: 0, expense: 0 };
    return { month, income, expense, net: income - expense, margin: margin(income, income - expense) };
  });
}
