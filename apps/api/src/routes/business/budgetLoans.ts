import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { budgetLoanPaymentSchema, budgetLoanPersonSchema, budgetLoanSchema, daysInMonth, PAYDAY_OF_MONTH, type BudgetLoanSide } from '@oceanx/shared';
import type { Executor } from '../../db/client';
import { budgetLoanEntries, budgetLoanPeople } from '../../db/schema';
import { bizCtx, requirePermission } from '../../guards/business';
import { audit } from '../../lib/audit';
import { AppError, notFound } from '../../lib/errors';
import { idParam } from '../../lib/params';
import { actor, businessToday } from '../../lib/tenant';
import { parse } from '../../lib/validation';
import { budgetFeaturesFor } from '../../services/budgetFeatures';

const n = (v: unknown) => Number(v ?? 0);
/** What comes back on each side: money lent comes back as "received", money borrowed goes back as "repaid". */
const BACK: Record<BudgetLoanSide, 'received' | 'repaid'> = { gave: 'received', took: 'repaid' };

/** Loans is a new feature: only for accounts Super Admin turned it on for (or for everyone). */
const requireLoans: preHandlerHookHandler = async (req) => {
  const ctx = bizCtx(req);
  if (!(await budgetFeaturesFor(req.server.deps.db, ctx.access.business)).includes('loans')) throw new AppError('forbidden', 'Loans is not available for this account yet');
};

/** Salary day this month: the 30th, or the month's last day when it is shorter. */
function paydayOf(today: string) {
  const month = today.slice(0, 7);
  return `${month}-${String(Math.min(PAYDAY_OF_MONTH, daysInMonth(month))).padStart(2, '0')}`;
}

/** Everyone with what is still owed each way, the earliest return date still open, and the last loan date. */
async function people(db: Executor, businessId: string) {
  const sum = (kind: string) => sql<string>`coalesce(sum(${budgetLoanEntries.amount}) filter (where ${budgetLoanEntries.kind} = ${kind}), 0)::text`;
  const rows = await db
    .select({
      id: budgetLoanPeople.id,
      name: budgetLoanPeople.name,
      phone: budgetLoanPeople.phone,
      gave: sum('gave'),
      received: sum('received'),
      took: sum('took'),
      repaid: sum('repaid'),
      gaveCount: sql<number>`count(*) filter (where ${budgetLoanEntries.kind} = 'gave')::int`,
      tookCount: sql<number>`count(*) filter (where ${budgetLoanEntries.kind} = 'took')::int`,
      gaveDue: sql<string | null>`min(${budgetLoanEntries.dueOn}) filter (where ${budgetLoanEntries.kind} = 'gave')`,
      tookDue: sql<string | null>`min(${budgetLoanEntries.dueOn}) filter (where ${budgetLoanEntries.kind} = 'took')`,
      lastGave: sql<string | null>`max(${budgetLoanEntries.occurredOn}) filter (where ${budgetLoanEntries.kind} = 'gave')`,
      lastTook: sql<string | null>`max(${budgetLoanEntries.occurredOn}) filter (where ${budgetLoanEntries.kind} = 'took')`,
      lastBack: sql<string | null>`max(${budgetLoanEntries.occurredOn}) filter (where ${budgetLoanEntries.kind} in ('received', 'repaid'))`,
    })
    .from(budgetLoanPeople)
    .leftJoin(budgetLoanEntries, eq(budgetLoanEntries.personId, budgetLoanPeople.id))
    .where(eq(budgetLoanPeople.businessId, businessId))
    .groupBy(budgetLoanPeople.id)
    .orderBy(asc(budgetLoanPeople.name));
  return rows.map((r) => {
    const owesMe = n(r.gave) - n(r.received);
    const iOwe = n(r.took) - n(r.repaid);
    return {
      id: r.id,
      name: r.name,
      phone: r.phone,
      owesMe,
      iOwe,
      gaveCount: r.gaveCount,
      tookCount: r.tookCount,
      gaveTotal: n(r.gave),
      tookTotal: n(r.took),
      gaveDue: owesMe > 0 ? r.gaveDue : null,
      tookDue: iOwe > 0 ? r.tookDue : null,
      lastGave: r.lastGave,
      lastTook: r.lastTook,
      lastBack: r.lastBack,
    };
  });
}

async function ownPerson(db: Executor, businessId: string, id: string) {
  const [p] = await db.select().from(budgetLoanPeople).where(and(eq(budgetLoanPeople.id, id), eq(budgetLoanPeople.businessId, businessId)));
  if (!p) throw notFound();
  return p;
}

/**
 * Gravity Budget loans: money lent to people and borrowed from them, paid back bit by bit, with a reminder on
 * salary day every month until it is all paid. Kept apart from spending and income.
 */
export async function budgetLoanRoutes(app: FastifyInstance) {
  const { db } = app.deps;
  const view = { preHandler: [requirePermission('budget.view'), requireLoans] };
  const manage = { preHandler: [requirePermission('budget.manage'), requireLoans] };

  /** Everyone, with the two totals: what people owe me and what I owe. */
  app.get('/budget/loans', view, async (req) => {
    const ctx = bizCtx(req);
    const list = await people(db, ctx.businessId);
    return {
      today: businessToday(ctx.access.business.timezone),
      owesMe: list.reduce((a, p) => a + Math.max(p.owesMe, 0), 0),
      iOwe: list.reduce((a, p) => a + Math.max(p.iOwe, 0), 0),
      people: list,
    };
  });

  /**
   * The reminder for the home screen: on salary day (the 30th) and after it, or on a return date, the money to
   * collect and the money to return. Empty when nothing is owed or it is not the time yet.
   */
  app.get('/budget/loans/reminder', view, async (req) => {
    const ctx = bizCtx(req);
    const today = businessToday(ctx.access.business.timezone);
    const salaryDay = today >= paydayOf(today);
    const list = await people(db, ctx.businessId);
    const pick = (side: BudgetLoanSide) =>
      list
        .map((p) => ({ id: p.id, name: p.name, phone: p.phone, amount: side === 'gave' ? p.owesMe : p.iOwe, due: side === 'gave' ? p.gaveDue : p.tookDue }))
        .filter((p) => p.amount > 0 && (salaryDay || (p.due !== null && p.due <= today)));
    return { today, salaryDay, collect: pick('gave'), giveBack: pick('took') };
  });

  /** One person: what is owed each way and every loan and payment, newest first. */
  app.get('/budget/loans/people/:id', view, async (req) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    await ownPerson(db, ctx.businessId, id);
    const [summary] = (await people(db, ctx.businessId)).filter((p) => p.id === id);
    const entries = await db
      .select({ id: budgetLoanEntries.id, kind: budgetLoanEntries.kind, amount: budgetLoanEntries.amount, occurredOn: budgetLoanEntries.occurredOn, dueOn: budgetLoanEntries.dueOn, note: budgetLoanEntries.note })
      .from(budgetLoanEntries)
      .where(and(eq(budgetLoanEntries.personId, id), eq(budgetLoanEntries.businessId, ctx.businessId)))
      .orderBy(desc(budgetLoanEntries.occurredOn), desc(budgetLoanEntries.createdAt));
    return { person: summary, entries };
  });

  /** A new loan, given or taken, to someone in the list or a new person (as many and as large as needed). */
  app.post('/budget/loans', manage, async (req, reply) => {
    const ctx = bizCtx(req);
    const body = parse(budgetLoanSchema, req.body);
    const created = await db.transaction(async (tx) => {
      let personId = body.personId;
      if (personId) await ownPerson(tx, ctx.businessId, personId);
      else {
        // The same name again is the same person (so their loans add up).
        const [same] = await tx
          .select({ id: budgetLoanPeople.id })
          .from(budgetLoanPeople)
          .where(and(eq(budgetLoanPeople.businessId, ctx.businessId), sql`lower(${budgetLoanPeople.name}) = lower(${body.name!})`));
        personId = same?.id ?? (await tx.insert(budgetLoanPeople).values({ businessId: ctx.businessId, name: body.name!, phone: body.phone }).returning({ id: budgetLoanPeople.id }))[0]!.id;
        if (same && body.phone) await tx.update(budgetLoanPeople).set({ phone: body.phone, updatedAt: new Date() }).where(eq(budgetLoanPeople.id, same.id));
      }
      const [e] = await tx
        .insert(budgetLoanEntries)
        .values({ businessId: ctx.businessId, personId, kind: body.side, amount: body.amount, occurredOn: body.occurredOn, dueOn: body.dueOn, note: body.note, createdBy: ctx.user.id })
        .returning({ id: budgetLoanEntries.id });
      await audit(tx, { ...actor(ctx), action: 'budget.loan_added', entityType: 'budget_loan', entityId: e!.id, metadata: { side: body.side, amount: body.amount }, req });
      return { id: e!.id, personId };
    });
    reply.status(201);
    return created;
  });

  /** Money back: part of it, or everything still owed ("fully paid"). Never more than is owed. */
  app.post('/budget/loans/people/:id/payments', manage, async (req, reply) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    const body = parse(budgetLoanPaymentSchema, req.body);
    const created = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT 1 FROM ${budgetLoanPeople} WHERE ${budgetLoanPeople.id} = ${id} AND ${budgetLoanPeople.businessId} = ${ctx.businessId} FOR UPDATE`);
      await ownPerson(tx, ctx.businessId, id);
      const [p] = (await people(tx, ctx.businessId)).filter((x) => x.id === id);
      const owed = body.side === 'gave' ? p!.owesMe : p!.iOwe;
      const amount = body.all ? owed : (body.amount ?? 0);
      if (owed <= 0) throw new AppError('conflict', 'Nothing is owed');
      if (amount <= 0) throw new AppError('validation_failed', 'Amount required', { fields: { amount: { code: 'required' } } });
      if (amount > owed) throw new AppError('validation_failed', 'More than is owed', { fields: { amount: { code: 'too_big' } } });
      const [e] = await tx
        .insert(budgetLoanEntries)
        .values({ businessId: ctx.businessId, personId: id, kind: BACK[body.side], amount, occurredOn: body.occurredOn, note: body.note, createdBy: ctx.user.id })
        .returning({ id: budgetLoanEntries.id });
      await audit(tx, { ...actor(ctx), action: 'budget.loan_payment', entityType: 'budget_loan', entityId: e!.id, metadata: { side: body.side, amount }, req });
      return { id: e!.id, left: owed - amount };
    });
    reply.status(201);
    return created;
  });

  /** Correct a name or phone number. */
  app.patch('/budget/loans/people/:id', manage, async (req) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    await ownPerson(db, ctx.businessId, id);
    const body = parse(budgetLoanPersonSchema, req.body);
    await db.update(budgetLoanPeople).set({ name: body.name, phone: body.phone, updatedAt: new Date() }).where(eq(budgetLoanPeople.id, id));
    return { ok: true };
  });

  /** Remove a loan or payment added by mistake. */
  app.delete('/budget/loans/entries/:id', manage, async (req) => {
    const ctx = bizCtx(req);
    const [e] = await db
      .delete(budgetLoanEntries)
      .where(and(eq(budgetLoanEntries.id, idParam(req)), eq(budgetLoanEntries.businessId, ctx.businessId)))
      .returning({ id: budgetLoanEntries.id, kind: budgetLoanEntries.kind, amount: budgetLoanEntries.amount });
    if (!e) throw notFound();
    await audit(db, { ...actor(ctx), action: 'budget.loan_entry_removed', entityType: 'budget_loan', entityId: e.id, metadata: { kind: e.kind, amount: e.amount }, req });
    return { ok: true };
  });

  /** Remove a person and all their loans and payments. */
  app.delete('/budget/loans/people/:id', manage, async (req) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    await ownPerson(db, ctx.businessId, id);
    await db.delete(budgetLoanPeople).where(eq(budgetLoanPeople.id, id));
    await audit(db, { ...actor(ctx), action: 'budget.loan_person_removed', entityType: 'budget_loan_person', entityId: id, req });
    return { ok: true };
  });
}
