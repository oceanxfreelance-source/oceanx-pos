import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, asc, count, desc, eq, gte, ilike, inArray, isNotNull, isNull, lte, or, sql, type SQL } from 'drizzle-orm';
import {
  addMonths,
  budgetBillPaySchema,
  budgetBillSchema,
  budgetCategorySchema,
  budgetCategoryUpdateSchema,
  budgetSetupCategorySchema,
  budgetEntrySchema,
  budgetGoalMoveSchema,
  budgetGoalSchema,
  budgetListQuerySchema,
  daysInMonth,
  monthSchema,
  PAID_WITH,
  type BudgetKind,
} from '@oceanx/shared';
import type { Executor } from '../../db/client';
import { budgetBills, budgetCategories, budgetEntries, budgetGoalMoves, budgetGoals } from '../../db/schema';
import { bizCtx, requirePermission } from '../../guards/business';
import { audit } from '../../lib/audit';
import { AppError, notFound } from '../../lib/errors';
import { idParam } from '../../lib/params';
import { actor, businessToday, own } from '../../lib/tenant';
import { parse } from '../../lib/validation';

type Ctx = ReturnType<typeof bizCtx>;

const n = (v: unknown) => Number(v ?? 0);
const monthRange = (month: string) => ({ from: `${month}-01`, to: `${month}-${String(daysInMonth(month)).padStart(2, '0')}` });
const pad2 = (v: number) => String(v).padStart(2, '0');
/** A bill's due date in a month (day 31 in a 30-day month is the 30th). */
const dueDate = (month: string, dueDay: number) => `${month}-${pad2(Math.min(dueDay, daysInMonth(month)))}`;
const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);
/** Whole months from `today` to `target` (at least 1 when the date is still ahead). */
const monthsUntil = (today: string, target: string) => {
  const [ty, tm, td] = today.split('-').map(Number) as [number, number, number];
  const [gy, gm, gd] = target.split('-').map(Number) as [number, number, number];
  const months = (gy - ty) * 12 + (gm - tm) + (gd >= td ? 1 : 0);
  return Math.max(0, months);
};

/** One advice line for the person: a code the app translates, with its numbers. */
export interface Insight {
  code: string;
  tone: 'bad' | 'warn' | 'good' | 'info';
  params: Record<string, string | number>;
}

/**
 * Everything the home screen needs for one month: money in, money out, money put into goals and what is left;
 * every spending category against its monthly limit and last month; the month's bills (paid or not); spending
 * day by day; and plain-language advice. For the current month also the safe amount to spend per day.
 */
export async function budgetOverview(db: Executor, businessId: string, month: string, today: string) {
  const { from, to } = monthRange(month);
  const prev = addMonths(month, -1);
  const prevRange = monthRange(prev);
  const live = and(eq(budgetEntries.businessId, businessId), isNull(budgetEntries.deletedAt));

  const [cats, sums, prevSums, daily, paidWith, saved, bills, paidBills] = await Promise.all([
    db
      .select()
      .from(budgetCategories)
      .where(and(eq(budgetCategories.businessId, businessId), isNull(budgetCategories.deletedAt)))
      .orderBy(asc(budgetCategories.sortOrder), asc(budgetCategories.name)),
    db
      .select({ kind: budgetEntries.kind, categoryId: budgetEntries.categoryId, total: sql<string>`sum(${budgetEntries.amount})::text`, n: count() })
      .from(budgetEntries)
      .where(and(live, gte(budgetEntries.occurredOn, from), lte(budgetEntries.occurredOn, to)))
      .groupBy(budgetEntries.kind, budgetEntries.categoryId),
    db
      .select({ kind: budgetEntries.kind, categoryId: budgetEntries.categoryId, total: sql<string>`sum(${budgetEntries.amount})::text` })
      .from(budgetEntries)
      .where(and(live, gte(budgetEntries.occurredOn, prevRange.from), lte(budgetEntries.occurredOn, prevRange.to)))
      .groupBy(budgetEntries.kind, budgetEntries.categoryId),
    db
      .select({ day: budgetEntries.occurredOn, total: sql<string>`sum(${budgetEntries.amount})::text` })
      .from(budgetEntries)
      .where(and(live, eq(budgetEntries.kind, 'expense'), gte(budgetEntries.occurredOn, from), lte(budgetEntries.occurredOn, to)))
      .groupBy(budgetEntries.occurredOn),
    db
      .select({ paidWith: budgetEntries.paidWith, total: sql<string>`sum(${budgetEntries.amount})::text` })
      .from(budgetEntries)
      .where(and(live, eq(budgetEntries.kind, 'expense'), gte(budgetEntries.occurredOn, from), lte(budgetEntries.occurredOn, to)))
      .groupBy(budgetEntries.paidWith),
    db
      .select({ total: sql<string>`coalesce(sum(${budgetGoalMoves.amount}),0)::text` })
      .from(budgetGoalMoves)
      .innerJoin(budgetGoals, and(eq(budgetGoals.id, budgetGoalMoves.goalId), isNull(budgetGoals.deletedAt)))
      .where(and(eq(budgetGoalMoves.businessId, businessId), gte(budgetGoalMoves.occurredOn, from), lte(budgetGoalMoves.occurredOn, to))),
    db
      .select()
      .from(budgetBills)
      .where(and(eq(budgetBills.businessId, businessId), isNull(budgetBills.deletedAt), eq(budgetBills.isActive, true)))
      .orderBy(asc(budgetBills.dueDay), asc(budgetBills.name)),
    db
      .select({ id: budgetEntries.id, billId: budgetEntries.billId, amount: budgetEntries.amount, occurredOn: budgetEntries.occurredOn })
      .from(budgetEntries)
      .where(and(live, isNotNull(budgetEntries.billId), gte(budgetEntries.occurredOn, from), lte(budgetEntries.occurredOn, to))),
  ]);

  const sum = (rows: { kind: string; total: string }[], kind: BudgetKind) => rows.filter((r) => r.kind === kind).reduce((s, r) => s + n(r.total), 0);
  const income = sum(sums, 'income');
  const spent = sum(sums, 'expense');
  const savedNet = n(saved[0]?.total);
  const left = income - spent - savedNet;
  const prevIncome = sum(prevSums, 'income');
  const prevSpent = sum(prevSums, 'expense');

  const spentBy = new Map<string | null, number>();
  for (const r of sums) if (r.kind === 'expense') spentBy.set(r.categoryId, n(r.total));
  const prevBy = new Map<string | null, number>();
  for (const r of prevSums) if (r.kind === 'expense') prevBy.set(r.categoryId, n(r.total));
  const incomeBy = new Map<string | null, number>();
  for (const r of sums) if (r.kind === 'income') incomeBy.set(r.categoryId, n(r.total));

  const categories = cats
    .filter((c) => c.kind === 'expense')
    .map((c) => {
      const s = spentBy.get(c.id) ?? 0;
      return { id: c.id, name: c.name, key: c.key, emoji: c.emoji, limit: c.monthlyLimit, spent: s, lastMonth: prevBy.get(c.id) ?? 0, left: c.monthlyLimit === null ? null : c.monthlyLimit - s };
    });
  // Spending in a removed category, or with no category, still counts (shown as "Other").
  const known = new Set(categories.map((c) => c.id));
  const otherSpent = [...spentBy.entries()].filter(([id]) => id === null || !known.has(id)).reduce((s, [, v]) => s + v, 0);
  const otherLast = [...prevBy.entries()].filter(([id]) => id === null || !known.has(id)).reduce((s, [, v]) => s + v, 0);
  const incomeCategories = cats.filter((c) => c.kind === 'income').map((c) => ({ id: c.id, name: c.name, key: c.key, emoji: c.emoji, total: incomeBy.get(c.id) ?? 0 }));
  const budgeted = categories.reduce((s, c) => s + (c.limit ?? 0), 0);

  const isCurrent = today.slice(0, 7) === month;
  const isPast = month < today.slice(0, 7);
  const dim = daysInMonth(month);
  const dayOfMonth = isCurrent ? Number(today.slice(8)) : isPast ? dim : 0;
  const daysLeft = isCurrent ? dim - dayOfMonth + 1 : 0;

  const paidByBill = new Map<string, { entryId: string; amount: number; on: string }>();
  for (const p of paidBills) if (p.billId) paidByBill.set(p.billId, { entryId: p.id, amount: p.amount, on: p.occurredOn });
  const billRows = bills.map((b) => {
    const due = dueDate(month, b.dueDay);
    const paid = paidByBill.get(b.id) ?? null;
    const inDays = dayDiff(due, today);
    return {
      id: b.id,
      name: b.name,
      amount: b.amount,
      dueDay: b.dueDay,
      dueDate: due,
      categoryId: b.categoryId,
      paid: !!paid,
      paidAmount: paid?.amount ?? null,
      paidOn: paid?.on ?? null,
      entryId: paid?.entryId ?? null,
      overdue: !paid && (isPast || (isCurrent && inDays < 0)),
      dueInDays: !paid && isCurrent ? inDays : null,
    };
  });
  const billsUnpaid = billRows.filter((b) => !b.paid).reduce((s, b) => s + b.amount, 0);
  // What can still be spent per day: what is left, less bills not yet paid, over the days left (today included).
  const free = left - (isCurrent ? billsUnpaid : 0);
  const safePerDay = isCurrent ? Math.max(0, Math.floor(free / daysLeft)) : null;

  const days = Array.from({ length: dim }, (_, i) => {
    const date = `${month}-${pad2(i + 1)}`;
    return { date, spent: n(daily.find((d) => d.day === date)?.total) };
  });

  // ------------------------------------------------------------ advice
  const insights: Insight[] = [];
  if (spent > 0 && income === 0 && !isPast) insights.push({ code: 'no_income', tone: 'info', params: {} });
  if (income > 0 && spent + savedNet > income) insights.push({ code: 'over_income', tone: 'bad', params: { amount: spent + savedNet - income } });
  for (const b of billRows.filter((x) => x.overdue)) insights.push({ code: 'bill_overdue', tone: 'bad', params: { name: b.name, amount: b.amount } });
  for (const c of categories) {
    if (c.limit === null || c.limit <= 0) continue;
    if (c.spent > c.limit) insights.push({ code: 'over_limit', tone: 'bad', params: { name: c.name, nameKey: c.key ?? '', amount: c.spent - c.limit } });
    else if (c.spent >= c.limit * 0.8) insights.push({ code: 'near_limit', tone: 'warn', params: { name: c.name, nameKey: c.key ?? '', amount: c.limit - c.spent } });
  }
  const dueSoon = billRows.filter((b) => b.dueInDays !== null && b.dueInDays >= 0 && b.dueInDays <= 7);
  if (dueSoon.length) insights.push({ code: 'bills_soon', tone: 'warn', params: { count: dueSoon.length, amount: dueSoon.reduce((s, b) => s + b.amount, 0) } });
  // At this pace the month's spending would pass the month's income.
  if (isCurrent && dayOfMonth >= 5 && dayOfMonth < dim && income > 0 && spent <= income) {
    const projected = Math.round((spent / dayOfMonth) * dim);
    if (projected > income) insights.push({ code: 'pace', tone: 'warn', params: { amount: projected } });
  }
  // Spending that grew most against last month (only notable amounts).
  const grew = categories
    .filter((c) => c.lastMonth > 0 && c.spent > c.lastMonth * 1.2 && c.spent - c.lastMonth >= 50_00)
    .sort((a, b) => b.spent - b.lastMonth - (a.spent - a.lastMonth))[0];
  if (grew) insights.push({ code: 'more_than_last', tone: 'warn', params: { name: grew.name, nameKey: grew.key ?? '', amount: grew.spent - grew.lastMonth } });
  const top = [...categories, { name: '', key: null, spent: otherSpent }].sort((a, b) => b.spent - a.spent)[0];
  if (spent > 0 && top && top.spent > 0 && top.name) insights.push({ code: 'top', tone: 'info', params: { name: top.name, nameKey: top.key ?? '', percent: Math.round((top.spent * 100) / spent) } });
  if (savedNet > 0) insights.push({ code: 'saved', tone: 'good', params: { amount: savedNet } });
  if (budgeted === 0 && categories.length) insights.push({ code: 'set_limits', tone: 'info', params: {} });
  if (income > 0 && budgeted > income) insights.push({ code: 'budget_over_income', tone: 'warn', params: { amount: budgeted - income } });
  if (!insights.some((i) => i.tone === 'bad' || i.tone === 'warn') && income > 0 && spent > 0) insights.push({ code: 'on_track', tone: 'good', params: {} });

  return {
    month,
    today,
    currentMonth: today.slice(0, 7),
    isCurrent,
    daysInMonth: dim,
    daysLeft,
    totals: { income, spent, saved: savedNet, left, budgeted, billsUnpaid },
    previous: { income: prevIncome, spent: prevSpent },
    safePerDay,
    categories,
    other: { spent: otherSpent, lastMonth: otherLast },
    incomeCategories,
    bills: billRows,
    paidWith: PAID_WITH.map((p) => ({ paidWith: p, total: n(paidWith.find((r) => r.paidWith === p)?.total) })).filter((r) => r.total > 0),
    days,
    insights,
  };
}

/** Every goal with what is saved, what is still needed and, with a date, how much to save each month. */
export async function budgetGoalList(db: Executor, businessId: string, today: string) {
  const month = today.slice(0, 7);
  const { from, to } = monthRange(month);
  const goals = await db
    .select()
    .from(budgetGoals)
    .where(and(eq(budgetGoals.businessId, businessId), isNull(budgetGoals.deletedAt)))
    .orderBy(asc(budgetGoals.createdAt));
  if (!goals.length) return [];
  const sums = await db
    .select({
      goalId: budgetGoalMoves.goalId,
      saved: sql<string>`sum(${budgetGoalMoves.amount})::text`,
      thisMonth: sql<string>`coalesce(sum(${budgetGoalMoves.amount}) filter (where ${budgetGoalMoves.occurredOn} between ${from} and ${to}),0)::text`,
    })
    .from(budgetGoalMoves)
    .where(
      and(
        eq(budgetGoalMoves.businessId, businessId),
        inArray(
          budgetGoalMoves.goalId,
          goals.map((g) => g.id),
        ),
      ),
    )
    .groupBy(budgetGoalMoves.goalId);
  return goals.map((g) => {
    const s = sums.find((x) => x.goalId === g.id);
    const saved = n(s?.saved);
    const thisMonth = n(s?.thisMonth);
    const remaining = Math.max(0, g.target - saved);
    const monthsLeft = g.targetDate ? monthsUntil(today, g.targetDate) : null;
    // Saving needed each month from now on (this month included, less what is already in this month).
    const perMonth = remaining > 0 && monthsLeft !== null && monthsLeft > 0 ? Math.ceil((remaining + thisMonth) / monthsLeft) : null;
    return {
      id: g.id,
      name: g.name,
      emoji: g.emoji,
      target: g.target,
      targetDate: g.targetDate,
      saved,
      remaining,
      percent: Math.min(100, Math.floor((saved * 100) / g.target)),
      done: saved >= g.target,
      thisMonth,
      monthsLeft,
      perMonth,
      late: !!g.targetDate && g.targetDate < today && saved < g.target,
      onTrack: perMonth === null ? null : thisMonth >= perMonth,
      createdAt: g.createdAt,
    };
  });
}

export async function budgetRoutes(app: FastifyInstance) {
  const { db } = app.deps;
  const today = (ctx: Ctx) => businessToday(ctx.access.business.timezone);

  const loadCategory = async (ctx: Ctx, id: string, kind: BudgetKind) => {
    const [c] = await db.select().from(budgetCategories).where(own(budgetCategories, ctx, id));
    if (!c || c.kind !== kind) throw new AppError('validation_failed', 'Unknown category', { fields: { categoryId: { code: 'invalid_option' } } });
    return c;
  };
  const nameTaken = (e: unknown): never => {
    const code = (e as { code?: string })?.code ?? (e as { cause?: { code?: string } })?.cause?.code;
    if (code === '23505') throw new AppError('validation_failed', 'Name already used', { fields: { name: { code: 'duplicate' } } });
    throw e;
  };

  // ---------------------------------------------------------------- overview
  app.get('/budget/overview', { preHandler: requirePermission('budget.view') }, async (req) => {
    const ctx = bizCtx(req);
    const q = parse(z.object({ month: monthSchema.optional() }), req.query);
    const t = today(ctx);
    const [hasCategories] = await db.select({ n: count() }).from(budgetCategories).where(eq(budgetCategories.businessId, ctx.businessId));
    const overview = await budgetOverview(db, ctx.businessId, q.month ?? t.slice(0, 7), t);
    return { ...overview, setUp: n(hasCategories?.n) > 0, currency: ctx.access.business.currency };
  });

  /** Money in, money out and money saved for the `count` months ending with `to` (empty months included). */
  app.get('/budget/months', { preHandler: requirePermission('budget.view') }, async (req) => {
    const ctx = bizCtx(req);
    const q = parse(z.object({ to: monthSchema.optional(), count: z.coerce.number().int().min(1).max(36).default(12) }), req.query);
    const to = q.to ?? today(ctx).slice(0, 7);
    const first = addMonths(to, -(q.count - 1));
    const m = sql<string>`substr(${budgetEntries.occurredOn}, 1, 7)`;
    const gm = sql<string>`substr(${budgetGoalMoves.occurredOn}, 1, 7)`;
    const [rows, moves] = await Promise.all([
      db
        .select({ month: m, kind: budgetEntries.kind, total: sql<string>`sum(${budgetEntries.amount})::text` })
        .from(budgetEntries)
        .where(and(eq(budgetEntries.businessId, ctx.businessId), isNull(budgetEntries.deletedAt), gte(budgetEntries.occurredOn, monthRange(first).from), lte(budgetEntries.occurredOn, monthRange(to).to)))
        .groupBy(m, budgetEntries.kind),
      db
        .select({ month: gm, total: sql<string>`sum(${budgetGoalMoves.amount})::text` })
        .from(budgetGoalMoves)
        .innerJoin(budgetGoals, and(eq(budgetGoals.id, budgetGoalMoves.goalId), isNull(budgetGoals.deletedAt)))
        .where(and(eq(budgetGoalMoves.businessId, ctx.businessId), gte(budgetGoalMoves.occurredOn, monthRange(first).from), lte(budgetGoalMoves.occurredOn, monthRange(to).to)))
        .groupBy(gm),
    ]);
    const items = Array.from({ length: q.count }, (_, i) => {
      const month = addMonths(first, i);
      const income = rows.filter((r) => r.month === month && r.kind === 'income').reduce((s, r) => s + n(r.total), 0);
      const spent = rows.filter((r) => r.month === month && r.kind === 'expense').reduce((s, r) => s + n(r.total), 0);
      const saved = n(moves.find((r) => r.month === month)?.total);
      return { month, income, spent, saved, left: income - spent - saved };
    });
    return { items };
  });

  /** One month on paper: the overview, every record, the goals, and who it is for. */
  app.get('/budget/report', { preHandler: requirePermission('budget.view') }, async (req) => {
    const ctx = bizCtx(req);
    const q = parse(z.object({ month: monthSchema.optional() }), req.query);
    const t = today(ctx);
    const month = q.month ?? t.slice(0, 7);
    const { from, to } = monthRange(month);
    const [overview, goals, entries] = await Promise.all([
      budgetOverview(db, ctx.businessId, month, t),
      budgetGoalList(db, ctx.businessId, t),
      db
        .select({ e: budgetEntries, categoryName: budgetCategories.name, categoryKey: budgetCategories.key, categoryEmoji: budgetCategories.emoji })
        .from(budgetEntries)
        .leftJoin(budgetCategories, and(eq(budgetCategories.id, budgetEntries.categoryId), eq(budgetCategories.businessId, budgetEntries.businessId)))
        .where(and(eq(budgetEntries.businessId, ctx.businessId), isNull(budgetEntries.deletedAt), gte(budgetEntries.occurredOn, from), lte(budgetEntries.occurredOn, to)))
        .orderBy(asc(budgetEntries.occurredOn), asc(budgetEntries.createdAt))
        .limit(2000),
    ]);
    return {
      ...overview,
      currency: ctx.access.business.currency,
      person: { name: ctx.user.name, account: ctx.access.business.name },
      goals,
      entries: entries.map((r) => entryOut(r)),
    };
  });

  // ---------------------------------------------------------------- set-up
  /**
   * First time: the categories the person picked (names come in their language from the app), with limits.
   * Only for an account that has never had categories.
   */
  app.post('/budget/setup', { preHandler: requirePermission('budget.manage') }, async (req) => {
    const ctx = bizCtx(req);
    const body = parse(z.object({ categories: z.array(budgetSetupCategorySchema).min(1).max(40) }), req.body);
    const [had] = await db.select({ n: count() }).from(budgetCategories).where(eq(budgetCategories.businessId, ctx.businessId));
    if (n(had?.n) > 0) return { ok: true, created: 0 };
    const seen = new Set<string>();
    const values = body.categories
      .filter((c) => {
        const k = `${c.kind}|${c.name.toLowerCase()}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .map((c, i) => ({ businessId: ctx.businessId, kind: c.kind, name: c.name, key: c.key ?? null, emoji: c.emoji, monthlyLimit: c.kind === 'expense' ? c.monthlyLimit : null, sortOrder: i }));
    await db.insert(budgetCategories).values(values).onConflictDoNothing();
    await audit(db, { ...actor(ctx), action: 'budget.set_up', entityType: 'business', entityId: ctx.businessId, metadata: { categories: values.length }, req });
    return { ok: true, created: values.length };
  });

  // ---------------------------------------------------------------- categories
  app.get('/budget/categories', { preHandler: requirePermission('budget.view') }, async (req) => {
    const ctx = bizCtx(req);
    const rows = await db
      .select()
      .from(budgetCategories)
      .where(and(eq(budgetCategories.businessId, ctx.businessId), isNull(budgetCategories.deletedAt)))
      .orderBy(asc(budgetCategories.kind), asc(budgetCategories.sortOrder), asc(budgetCategories.name));
    return { items: rows.map((c) => ({ id: c.id, kind: c.kind, name: c.name, key: c.key, emoji: c.emoji, monthlyLimit: c.monthlyLimit })) };
  });

  app.post('/budget/categories', { preHandler: requirePermission('budget.manage') }, async (req, reply) => {
    const ctx = bizCtx(req);
    const body = parse(budgetCategorySchema, req.body);
    const [c] = await db
      .insert(budgetCategories)
      .values({ businessId: ctx.businessId, kind: body.kind, name: body.name, emoji: body.emoji, monthlyLimit: body.kind === 'expense' ? body.monthlyLimit : null, sortOrder: 100 })
      .returning()
      .catch(nameTaken);
    reply.status(201);
    return c;
  });

  app.patch('/budget/categories/:id', { preHandler: requirePermission('budget.manage') }, async (req) => {
    const ctx = bizCtx(req);
    const raw = (req.body ?? {}) as Record<string, unknown>;
    const body = parse(budgetCategoryUpdateSchema, raw);
    const [cur] = await db.select().from(budgetCategories).where(own(budgetCategories, ctx, idParam(req)));
    if (!cur) throw notFound();
    const set: Partial<typeof budgetCategories.$inferInsert> = { updatedAt: new Date() };
    // A renamed set-up category keeps the person's own name from then on.
    if (body.name !== undefined && body.name !== cur.name) {
      set.name = body.name;
      set.key = null;
    }
    if ('emoji' in raw && body.emoji !== undefined) set.emoji = body.emoji;
    // The limit is changed only when sent (empty or null removes it); income has none.
    if ('monthlyLimit' in raw) set.monthlyLimit = cur.kind === 'expense' ? (body.monthlyLimit ?? null) : null;
    const [c] = await db.update(budgetCategories).set(set).where(eq(budgetCategories.id, cur.id)).returning().catch(nameTaken);
    return c;
  });

  /** Removing a category keeps its records (they count as "Other" from then on). */
  app.delete('/budget/categories/:id', { preHandler: requirePermission('budget.manage') }, async (req) => {
    const ctx = bizCtx(req);
    const [c] = await db.update(budgetCategories).set({ deletedAt: new Date() }).where(own(budgetCategories, ctx, idParam(req))).returning({ id: budgetCategories.id });
    if (!c) throw notFound();
    return { ok: true };
  });

  // ---------------------------------------------------------------- income and spending
  const entrySelect = () =>
    db
      .select({ e: budgetEntries, categoryName: budgetCategories.name, categoryKey: budgetCategories.key, categoryEmoji: budgetCategories.emoji })
      .from(budgetEntries)
      .leftJoin(budgetCategories, and(eq(budgetCategories.id, budgetEntries.categoryId), eq(budgetCategories.businessId, budgetEntries.businessId)));
  const listWhere = (ctx: Ctx, q: z.infer<typeof budgetListQuerySchema>): SQL | undefined => {
    const range = q.month ? monthRange(q.month) : null;
    return and(
      eq(budgetEntries.businessId, ctx.businessId),
      isNull(budgetEntries.deletedAt),
      range ? gte(budgetEntries.occurredOn, range.from) : undefined,
      range ? lte(budgetEntries.occurredOn, range.to) : undefined,
      q.day ? eq(budgetEntries.occurredOn, q.day) : undefined,
      q.kind ? eq(budgetEntries.kind, q.kind) : undefined,
      q.categoryId ? eq(budgetEntries.categoryId, q.categoryId) : undefined,
      q.q ? or(ilike(budgetEntries.note, `%${q.q}%`), ilike(budgetCategories.name, `%${q.q}%`)) : undefined,
    );
  };

  app.get('/budget/entries', { preHandler: requirePermission('budget.view') }, async (req) => {
    const ctx = bizCtx(req);
    const q = parse(budgetListQuerySchema, req.query);
    const where = listWhere(ctx, q);
    const [items, [total]] = await Promise.all([
      entrySelect()
        .where(where)
        .orderBy(desc(budgetEntries.occurredOn), desc(budgetEntries.createdAt))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      db
        .select({ n: count() })
        .from(budgetEntries)
        .leftJoin(budgetCategories, and(eq(budgetCategories.id, budgetEntries.categoryId), eq(budgetCategories.businessId, budgetEntries.businessId)))
        .where(where),
    ]);
    return { items: items.map(entryOut), page: q.page, pageSize: q.pageSize, total: n(total?.n) };
  });

  app.post('/budget/entries', { preHandler: requirePermission('budget.manage') }, async (req, reply) => {
    const ctx = bizCtx(req);
    const body = parse(budgetEntrySchema.extend({ id: z.uuid().optional() }), req.body);
    // A record written offline comes with the id the phone gave it: sending it again (after a lost answer)
    // returns the same record instead of a second one.
    if (body.id) {
      const [had] = await db.select().from(budgetEntries).where(eq(budgetEntries.id, body.id));
      if (had) {
        if (had.businessId !== ctx.businessId) throw new AppError('conflict', 'Record id already used', {}, 409);
        reply.status(200);
        return had;
      }
    }
    if (body.categoryId) await loadCategory(ctx, body.categoryId, body.kind);
    const [e] = await db
      .insert(budgetEntries)
      .values({ ...(body.id ? { id: body.id } : {}), businessId: ctx.businessId, kind: body.kind, amount: body.amount, occurredOn: body.occurredOn, categoryId: body.categoryId, note: body.note, paidWith: body.paidWith, createdBy: ctx.user.id })
      .returning();
    reply.status(201);
    return e;
  });

  app.put('/budget/entries/:id', { preHandler: requirePermission('budget.manage') }, async (req) => {
    const ctx = bizCtx(req);
    const body = parse(budgetEntrySchema, req.body);
    if (body.categoryId) await loadCategory(ctx, body.categoryId, body.kind);
    const [e] = await db
      .update(budgetEntries)
      .set({ kind: body.kind, amount: body.amount, occurredOn: body.occurredOn, categoryId: body.categoryId, note: body.note, paidWith: body.paidWith, updatedAt: new Date() })
      .where(own(budgetEntries, ctx, idParam(req)))
      .returning();
    if (!e) throw notFound();
    return e;
  });

  app.delete('/budget/entries/:id', { preHandler: requirePermission('budget.manage') }, async (req) => {
    const ctx = bizCtx(req);
    const [e] = await db.update(budgetEntries).set({ deletedAt: new Date() }).where(own(budgetEntries, ctx, idParam(req))).returning({ id: budgetEntries.id });
    if (!e) throw notFound();
    return { ok: true };
  });

  // ---------------------------------------------------------------- bills
  const checkBillCategory = async (ctx: Ctx, categoryId: string | null) => {
    if (categoryId) await loadCategory(ctx, categoryId, 'expense');
  };

  app.get('/budget/bills', { preHandler: requirePermission('budget.view') }, async (req) => {
    const ctx = bizCtx(req);
    const rows = await db
      .select()
      .from(budgetBills)
      .where(and(eq(budgetBills.businessId, ctx.businessId), isNull(budgetBills.deletedAt)))
      .orderBy(asc(budgetBills.dueDay), asc(budgetBills.name));
    return { items: rows.map((b) => ({ id: b.id, name: b.name, amount: b.amount, dueDay: b.dueDay, categoryId: b.categoryId, isActive: b.isActive })) };
  });

  app.post('/budget/bills', { preHandler: requirePermission('budget.manage') }, async (req, reply) => {
    const ctx = bizCtx(req);
    const body = parse(budgetBillSchema, req.body);
    await checkBillCategory(ctx, body.categoryId);
    const [b] = await db.insert(budgetBills).values({ businessId: ctx.businessId, ...body }).returning();
    reply.status(201);
    return b;
  });

  app.put('/budget/bills/:id', { preHandler: requirePermission('budget.manage') }, async (req) => {
    const ctx = bizCtx(req);
    const body = parse(budgetBillSchema, req.body);
    await checkBillCategory(ctx, body.categoryId);
    const [b] = await db
      .update(budgetBills)
      .set({ ...body, updatedAt: new Date() })
      .where(own(budgetBills, ctx, idParam(req)))
      .returning();
    if (!b) throw notFound();
    return b;
  });

  app.delete('/budget/bills/:id', { preHandler: requirePermission('budget.manage') }, async (req) => {
    const ctx = bizCtx(req);
    const [b] = await db.update(budgetBills).set({ deletedAt: new Date() }).where(own(budgetBills, ctx, idParam(req))).returning({ id: budgetBills.id });
    if (!b) throw notFound();
    return { ok: true };
  });

  /** Pay a bill for a month: records the spending (in the bill's category), once per month. */
  app.post('/budget/bills/:id/pay', { preHandler: requirePermission('budget.manage') }, async (req, reply) => {
    const ctx = bizCtx(req);
    const body = parse(budgetBillPaySchema, req.body ?? {});
    const [bill] = await db.select().from(budgetBills).where(own(budgetBills, ctx, idParam(req)));
    if (!bill) throw notFound();
    const on = body.occurredOn ?? today(ctx);
    const { from, to } = monthRange(on.slice(0, 7));
    const [already] = await db
      .select({ id: budgetEntries.id })
      .from(budgetEntries)
      .where(and(eq(budgetEntries.businessId, ctx.businessId), eq(budgetEntries.billId, bill.id), isNull(budgetEntries.deletedAt), gte(budgetEntries.occurredOn, from), lte(budgetEntries.occurredOn, to)));
    if (already) throw new AppError('conflict', 'This bill is already paid for this month', {}, 409);
    // A removed category is not used for new records.
    let categoryId = bill.categoryId;
    if (categoryId) {
      const [c] = await db.select({ id: budgetCategories.id }).from(budgetCategories).where(own(budgetCategories, ctx, categoryId));
      if (!c) categoryId = null;
    }
    const [e] = await db
      .insert(budgetEntries)
      .values({ businessId: ctx.businessId, kind: 'expense', amount: body.amount ?? bill.amount, occurredOn: on, categoryId, note: bill.name, paidWith: body.paidWith, billId: bill.id, createdBy: ctx.user.id })
      .returning();
    reply.status(201);
    return e;
  });

  // ---------------------------------------------------------------- goals
  app.get('/budget/goals', { preHandler: requirePermission('budget.view') }, async (req) => {
    const ctx = bizCtx(req);
    return { today: today(ctx), items: await budgetGoalList(db, ctx.businessId, today(ctx)) };
  });

  app.post('/budget/goals', { preHandler: requirePermission('budget.manage') }, async (req, reply) => {
    const ctx = bizCtx(req);
    const body = parse(budgetGoalSchema, req.body);
    const [g] = await db.insert(budgetGoals).values({ businessId: ctx.businessId, ...body }).returning();
    await audit(db, { ...actor(ctx), action: 'budget.goal_added', entityType: 'budget_goal', entityId: g!.id, metadata: { target: body.target }, req });
    reply.status(201);
    return g;
  });

  app.put('/budget/goals/:id', { preHandler: requirePermission('budget.manage') }, async (req) => {
    const ctx = bizCtx(req);
    const body = parse(budgetGoalSchema, req.body);
    const [g] = await db
      .update(budgetGoals)
      .set({ ...body, updatedAt: new Date() })
      .where(own(budgetGoals, ctx, idParam(req)))
      .returning();
    if (!g) throw notFound();
    return g;
  });

  /** Removing a goal: its savings are no longer counted as put aside. */
  app.delete('/budget/goals/:id', { preHandler: requirePermission('budget.manage') }, async (req) => {
    const ctx = bizCtx(req);
    const [g] = await db.update(budgetGoals).set({ deletedAt: new Date() }).where(own(budgetGoals, ctx, idParam(req))).returning({ id: budgetGoals.id });
    if (!g) throw notFound();
    return { ok: true };
  });

  app.get('/budget/goals/:id/moves', { preHandler: requirePermission('budget.view') }, async (req) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    const [g] = await db.select({ id: budgetGoals.id }).from(budgetGoals).where(own(budgetGoals, ctx, id));
    if (!g) throw notFound();
    const rows = await db
      .select()
      .from(budgetGoalMoves)
      .where(and(eq(budgetGoalMoves.businessId, ctx.businessId), eq(budgetGoalMoves.goalId, id)))
      .orderBy(desc(budgetGoalMoves.occurredOn), desc(budgetGoalMoves.createdAt))
      .limit(200);
    return { items: rows.map((m) => ({ id: m.id, amount: m.amount, occurredOn: m.occurredOn, note: m.note })) };
  });

  /** Put money into a goal, or take some out (never more than is in it). */
  app.post('/budget/goals/:id/moves', { preHandler: requirePermission('budget.manage') }, async (req, reply) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    const body = parse(budgetGoalMoveSchema, req.body);
    const [g] = await db.select({ id: budgetGoals.id }).from(budgetGoals).where(own(budgetGoals, ctx, id));
    if (!g) throw notFound();
    if (body.direction === 'take') {
      const [s] = await db
        .select({ saved: sql<string>`coalesce(sum(${budgetGoalMoves.amount}),0)::text` })
        .from(budgetGoalMoves)
        .where(and(eq(budgetGoalMoves.businessId, ctx.businessId), eq(budgetGoalMoves.goalId, id)));
      if (body.amount > n(s?.saved)) throw new AppError('validation_failed', 'More than is saved', { fields: { amount: { code: 'too_big', params: { max: n(s?.saved) / 100 } } } });
    }
    const [m] = await db
      .insert(budgetGoalMoves)
      .values({ businessId: ctx.businessId, goalId: id, amount: body.direction === 'add' ? body.amount : -body.amount, occurredOn: body.occurredOn ?? today(ctx), note: body.note })
      .returning();
    reply.status(201);
    return m;
  });

  app.delete('/budget/goals/:goalId/moves/:id', { preHandler: requirePermission('budget.manage') }, async (req) => {
    const ctx = bizCtx(req);
    const [m] = await db
      .delete(budgetGoalMoves)
      .where(and(eq(budgetGoalMoves.businessId, ctx.businessId), eq(budgetGoalMoves.goalId, idParam(req, 'goalId')), eq(budgetGoalMoves.id, idParam(req))))
      .returning({ id: budgetGoalMoves.id });
    if (!m) throw notFound();
    return { ok: true };
  });
}

function entryOut(r: { e: typeof budgetEntries.$inferSelect; categoryName: string | null; categoryKey: string | null; categoryEmoji: string | null }) {
  return {
    id: r.e.id,
    kind: r.e.kind,
    amount: r.e.amount,
    occurredOn: r.e.occurredOn,
    categoryId: r.e.categoryId,
    categoryName: r.categoryName ?? '',
    categoryKey: r.categoryKey,
    categoryEmoji: r.categoryEmoji ?? '',
    note: r.e.note,
    paidWith: r.e.paidWith,
    billId: r.e.billId,
    createdAt: r.e.createdAt,
  };
}
