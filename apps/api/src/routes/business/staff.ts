import type { FastifyInstance } from 'fastify';
import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  payrollFinalizeSchema,
  payrollPeriodSchema,
  payrollUpdateSchema,
  rotaCopySchema,
  rotaEntrySchema,
  rotaShiftSchema,
  staffSchema,
  toMinor,
} from '@oceanx/shared';
import { expenses, payrollLines, payrollRuns, rotaEntries, rotaShifts, staffMembers } from '../../db/schema';
import { bizCtx, requireAnyPermission, requirePermission } from '../../guards/business';
import { audit } from '../../lib/audit';
import { AppError, notFound } from '../../lib/errors';
import { idParam } from '../../lib/params';
import { actor, own, requireOutlet } from '../../lib/tenant';
import { parse } from '../../lib/validation';

const isoDate = z.iso.date();
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const netOf = (l: { basic: number; allowances: number; overtime: number; deductions: number; advance: number }) =>
  l.basic + l.allowances + l.overtime - l.deductions - l.advance;

/**
 * Staff records (shared), Payroll add-on (monthly salary sheets) and Duty Rota add-on (weekly shifts).
 * Money is entered in major units and stored in minor units; net pay and totals are always computed here.
 */
export async function staffRoutes(app: FastifyInstance) {
  const { db } = app.deps;

  // ---------------------------------------------------------------- staff (used by both add-ons)
  const staffView = requireAnyPermission('payroll.view', 'rota.view');
  const staffManage = requireAnyPermission('payroll.manage', 'rota.manage');

  app.get('/staff', { preHandler: staffView }, async (req) => {
    const ctx = bizCtx(req);
    const showPay = ctx.permissions.has('payroll.view');
    const rows = await db
      .select()
      .from(staffMembers)
      .where(and(eq(staffMembers.businessId, ctx.businessId), isNull(staffMembers.deletedAt)))
      .orderBy(desc(staffMembers.isActive), asc(staffMembers.name));
    // Salaries are private to people who may see payroll.
    return { items: rows.map(({ basicSalary, deletedAt: _d, ...r }) => ({ ...r, basicSalary: showPay ? basicSalary : null })) };
  });

  app.post('/staff', { preHandler: staffManage }, async (req, reply) => {
    const ctx = bizCtx(req);
    const { basicSalary, ...body } = parse(staffSchema, req.body);
    const pay = ctx.permissions.has('payroll.manage') && basicSalary !== undefined ? toMinor(basicSalary) : 0;
    const [s] = await db
      .insert(staffMembers)
      .values({ ...body, basicSalary: pay, businessId: ctx.businessId })
      .returning();
    await audit(db, { ...actor(ctx), action: 'staff.created', entityType: 'staff', entityId: s!.id, metadata: { name: s!.name }, req });
    reply.status(201);
    return s;
  });

  app.put('/staff/:id', { preHandler: staffManage }, async (req) => {
    const ctx = bizCtx(req);
    const { basicSalary, ...body } = parse(staffSchema, req.body);
    const pay = ctx.permissions.has('payroll.manage') && basicSalary !== undefined ? { basicSalary: toMinor(basicSalary) } : {};
    const [s] = await db
      .update(staffMembers)
      .set({ ...body, ...pay, updatedAt: new Date() })
      .where(and(own(staffMembers, ctx, idParam(req)), isNull(staffMembers.deletedAt)))
      .returning();
    if (!s) throw notFound();
    await audit(db, { ...actor(ctx), action: 'staff.updated', entityType: 'staff', entityId: s.id, req });
    return s;
  });

  app.delete('/staff/:id', { preHandler: staffManage }, async (req) => {
    const ctx = bizCtx(req);
    // Archived, not erased: past salary sheets keep their lines.
    const [s] = await db
      .update(staffMembers)
      .set({ deletedAt: new Date(), isActive: false, updatedAt: new Date() })
      .where(and(own(staffMembers, ctx, idParam(req)), isNull(staffMembers.deletedAt)))
      .returning({ id: staffMembers.id });
    if (!s) throw notFound();
    await audit(db, { ...actor(ctx), action: 'staff.deleted', entityType: 'staff', entityId: s.id, req });
    return { ok: true };
  });

  // ---------------------------------------------------------------- payroll (salary sheets)
  const loadRun = async (ctx: ReturnType<typeof bizCtx>, id: string) => {
    const [run] = await db.select().from(payrollRuns).where(own(payrollRuns, ctx, id));
    if (!run) throw notFound();
    return run;
  };
  const runPayload = async (ctx: ReturnType<typeof bizCtx>, id: string) => {
    const run = await loadRun(ctx, id);
    const lines = await db
      .select()
      .from(payrollLines)
      .where(and(eq(payrollLines.businessId, ctx.businessId), eq(payrollLines.runId, id)))
      .orderBy(asc(payrollLines.sortOrder), asc(payrollLines.name));
    const totals = lines.reduce(
      (a, l) => ({
        basic: a.basic + l.basic,
        allowances: a.allowances + l.allowances,
        overtime: a.overtime + l.overtime,
        deductions: a.deductions + l.deductions,
        advance: a.advance + l.advance,
        net: a.net + l.net,
      }),
      { basic: 0, allowances: 0, overtime: 0, deductions: 0, advance: 0, net: 0 },
    );
    return { ...run, lines, totals };
  };
  const assertDraft = (run: { status: string }) => {
    if (run.status !== 'draft') throw new AppError('document_locked', 'This salary sheet is finalized');
  };
  const recomputeTotal = async (tx: typeof db, ctx: ReturnType<typeof bizCtx>, runId: string) => {
    await tx
      .update(payrollRuns)
      .set({
        totalNet: sql`(SELECT COALESCE(SUM(net), 0) FROM payroll_lines WHERE business_id = ${ctx.businessId} AND run_id = ${runId})`,
        updatedAt: new Date(),
      })
      .where(own(payrollRuns, ctx, runId));
  };
  /** Lines for active staff not yet on the sheet, starting from their basic salary. */
  const addMissingStaff = async (tx: typeof db, ctx: ReturnType<typeof bizCtx>, runId: string) => {
    const staff = await tx
      .select()
      .from(staffMembers)
      .where(and(eq(staffMembers.businessId, ctx.businessId), eq(staffMembers.isActive, true), isNull(staffMembers.deletedAt)))
      .orderBy(asc(staffMembers.name));
    const existing = new Set(
      (await tx.select({ staffId: payrollLines.staffId }).from(payrollLines).where(and(eq(payrollLines.businessId, ctx.businessId), eq(payrollLines.runId, runId)))).map(
        (r) => r.staffId,
      ),
    );
    const add = staff.filter((s) => !existing.has(s.id));
    if (add.length) {
      await tx.insert(payrollLines).values(
        add.map((s, i) => ({
          businessId: ctx.businessId,
          runId,
          staffId: s.id,
          name: s.name,
          position: s.position,
          basic: s.basicSalary,
          net: s.basicSalary,
          sortOrder: existing.size + i,
        })),
      );
    }
    return add.length;
  };

  app.get('/payroll', { preHandler: requirePermission('payroll.view') }, async (req) => {
    const ctx = bizCtx(req);
    const rows = await db
      .select({ run: payrollRuns, staffCount: sql<number>`(SELECT count(*)::int FROM payroll_lines l WHERE l.run_id = "payroll_runs"."id")` })
      .from(payrollRuns)
      .where(eq(payrollRuns.businessId, ctx.businessId))
      .orderBy(desc(payrollRuns.period));
    return { items: rows.map((r) => ({ ...r.run, staffCount: Number(r.staffCount) })) };
  });

  app.post('/payroll', { preHandler: requirePermission('payroll.manage') }, async (req, reply) => {
    const ctx = bizCtx(req);
    const { period } = parse(payrollPeriodSchema, req.body);
    const id = await db.transaction(async (tx) => {
      const [dupe] = await tx
        .select({ id: payrollRuns.id })
        .from(payrollRuns)
        .where(and(eq(payrollRuns.businessId, ctx.businessId), eq(payrollRuns.period, period)));
      if (dupe) throw new AppError('payroll_period_exists', 'A salary sheet for this month already exists', { details: { id: dupe.id } });
      const [run] = await tx.insert(payrollRuns).values({ businessId: ctx.businessId, period, createdBy: ctx.user.id }).returning({ id: payrollRuns.id });
      await addMissingStaff(tx as unknown as typeof db, ctx, run!.id);
      await recomputeTotal(tx as unknown as typeof db, ctx, run!.id);
      await audit(tx, { ...actor(ctx), action: 'payroll.created', entityType: 'payroll', entityId: run!.id, metadata: { period }, req });
      return run!.id;
    });
    reply.status(201);
    return runPayload(ctx, id);
  });

  app.get('/payroll/:id', { preHandler: requirePermission('payroll.view') }, async (req) => runPayload(bizCtx(req), idParam(req)));

  app.put('/payroll/:id', { preHandler: requirePermission('payroll.manage') }, async (req) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    const body = parse(payrollUpdateSchema, req.body);
    await db.transaction(async (tx) => {
      const [run] = await tx.select().from(payrollRuns).where(own(payrollRuns, ctx, id)).for('update');
      if (!run) throw notFound();
      assertDraft(run);
      for (const l of body.lines) {
        const v = {
          basic: toMinor(l.basic),
          allowances: toMinor(l.allowances),
          overtime: toMinor(l.overtime),
          deductions: toMinor(l.deductions),
          advance: toMinor(l.advance),
        };
        await tx
          .update(payrollLines)
          .set({ ...v, net: netOf(v), notes: l.notes })
          .where(and(eq(payrollLines.businessId, ctx.businessId), eq(payrollLines.runId, id), eq(payrollLines.id, l.id)));
      }
      await tx.update(payrollRuns).set({ notes: body.notes }).where(own(payrollRuns, ctx, id));
      await recomputeTotal(tx as unknown as typeof db, ctx, id);
    });
    return runPayload(ctx, id);
  });

  app.post('/payroll/:id/add-staff', { preHandler: requirePermission('payroll.manage') }, async (req) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    await db.transaction(async (tx) => {
      const [run] = await tx.select().from(payrollRuns).where(own(payrollRuns, ctx, id)).for('update');
      if (!run) throw notFound();
      assertDraft(run);
      await addMissingStaff(tx as unknown as typeof db, ctx, id);
      await recomputeTotal(tx as unknown as typeof db, ctx, id);
    });
    return runPayload(ctx, id);
  });

  app.delete<{ Params: { id: string; lineId: string } }>('/payroll/:id/lines/:lineId', { preHandler: requirePermission('payroll.manage') }, async (req) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    const lineId = z.uuid().safeParse(req.params.lineId);
    if (!lineId.success) throw notFound();
    await db.transaction(async (tx) => {
      const [run] = await tx.select().from(payrollRuns).where(own(payrollRuns, ctx, id)).for('update');
      if (!run) throw notFound();
      assertDraft(run);
      await tx.delete(payrollLines).where(and(eq(payrollLines.businessId, ctx.businessId), eq(payrollLines.runId, id), eq(payrollLines.id, lineId.data)));
      await recomputeTotal(tx as unknown as typeof db, ctx, id);
    });
    return runPayload(ctx, id);
  });

  app.post('/payroll/:id/finalize', { preHandler: requirePermission('payroll.manage') }, async (req) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    const body = parse(payrollFinalizeSchema, req.body ?? {});
    await db.transaction(async (tx) => {
      const [run] = await tx.select().from(payrollRuns).where(own(payrollRuns, ctx, id)).for('update');
      if (!run) throw notFound();
      assertDraft(run);
      let expenseId: string | null = null;
      // Optionally book the month's net salaries as one expense (category "Salaries").
      if (body.addToExpenses && run.totalNet > 0 && ctx.permissions.has('expenses.create')) {
        const [y, m] = run.period.split('-').map(Number) as [number, number];
        const lastDay = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
        const today = new Date().toISOString().slice(0, 10);
        const [e] = await tx
          .insert(expenses)
          .values({
            businessId: ctx.businessId,
            outletId: requireOutlet(ctx),
            category: 'salaries',
            amount: run.totalNet,
            expenseDate: lastDay < today ? lastDay : today,
            paymentMethod: body.paymentMethod,
            payee: `Salaries ${run.period}`,
            reference: `PAYROLL-${run.period}`,
            notes: '',
            createdBy: ctx.user.id,
          })
          .returning({ id: expenses.id });
        expenseId = e!.id;
      }
      await tx
        .update(payrollRuns)
        .set({ status: 'finalized', finalizedAt: new Date(), finalizedBy: ctx.user.id, expenseId, updatedAt: new Date() })
        .where(own(payrollRuns, ctx, id));
      await audit(tx, { ...actor(ctx), action: 'payroll.finalized', entityType: 'payroll', entityId: id, metadata: { period: run.period, totalNet: run.totalNet, expenseId }, req });
    });
    return runPayload(ctx, id);
  });

  app.post('/payroll/:id/reopen', { preHandler: requirePermission('payroll.manage') }, async (req) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    await db.transaction(async (tx) => {
      const [run] = await tx.select().from(payrollRuns).where(own(payrollRuns, ctx, id)).for('update');
      if (!run) throw notFound();
      if (run.status !== 'finalized') throw new AppError('invalid_status_transition', 'Salary sheet is not finalized');
      // The booked expense is withdrawn so finalizing again cannot count salaries twice.
      if (run.expenseId) await tx.update(expenses).set({ deletedAt: new Date() }).where(own(expenses, ctx, run.expenseId));
      await tx.update(payrollRuns).set({ status: 'draft', finalizedAt: null, finalizedBy: null, expenseId: null, updatedAt: new Date() }).where(own(payrollRuns, ctx, id));
      await audit(tx, { ...actor(ctx), action: 'payroll.reopened', entityType: 'payroll', entityId: id, metadata: { period: run.period }, req });
    });
    return runPayload(ctx, id);
  });

  app.delete('/payroll/:id', { preHandler: requirePermission('payroll.manage') }, async (req) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    const run = await loadRun(ctx, id);
    assertDraft(run);
    await db.delete(payrollRuns).where(own(payrollRuns, ctx, id));
    await audit(db, { ...actor(ctx), action: 'payroll.deleted', entityType: 'payroll', entityId: id, metadata: { period: run.period }, req });
    return { ok: true };
  });

  // ---------------------------------------------------------------- duty rota
  app.get('/rota/shifts', { preHandler: requireAnyPermission('rota.view', 'rota.manage') }, async (req) => {
    const ctx = bizCtx(req);
    return {
      items: await db.select().from(rotaShifts).where(eq(rotaShifts.businessId, ctx.businessId)).orderBy(asc(rotaShifts.sortOrder), asc(rotaShifts.startTime)),
    };
  });

  app.post('/rota/shifts', { preHandler: requirePermission('rota.manage') }, async (req, reply) => {
    const ctx = bizCtx(req);
    const body = parse(rotaShiftSchema, req.body);
    const [s] = await db.insert(rotaShifts).values({ ...body, businessId: ctx.businessId }).returning();
    reply.status(201);
    return s;
  });

  app.put('/rota/shifts/:id', { preHandler: requirePermission('rota.manage') }, async (req) => {
    const ctx = bizCtx(req);
    const body = parse(rotaShiftSchema, req.body);
    const [s] = await db.update(rotaShifts).set({ ...body, updatedAt: new Date() }).where(own(rotaShifts, ctx, idParam(req))).returning();
    if (!s) throw notFound();
    return s;
  });

  app.delete('/rota/shifts/:id', { preHandler: requirePermission('rota.manage') }, async (req) => {
    const ctx = bizCtx(req);
    // Cells using this shift are removed with it (cascade).
    const [s] = await db.delete(rotaShifts).where(own(rotaShifts, ctx, idParam(req))).returning({ id: rotaShifts.id });
    if (!s) throw notFound();
    return { ok: true };
  });

  /** One week (7 days from `start`): shifts, staff and every cell. */
  app.get('/rota', { preHandler: requireAnyPermission('rota.view', 'rota.manage') }, async (req) => {
    const ctx = bizCtx(req);
    const q = parse(z.object({ start: isoDate }), req.query);
    const end = addDays(q.start, 6);
    const [shifts, entries] = await Promise.all([
      db.select().from(rotaShifts).where(eq(rotaShifts.businessId, ctx.businessId)).orderBy(asc(rotaShifts.sortOrder), asc(rotaShifts.startTime)),
      db
        .select()
        .from(rotaEntries)
        .where(and(eq(rotaEntries.businessId, ctx.businessId), gte(rotaEntries.date, q.start), lte(rotaEntries.date, end))),
    ]);
    const withEntries = [...new Set(entries.map((e) => e.staffId))];
    const staff = await db
      .select({ id: staffMembers.id, name: staffMembers.name, position: staffMembers.position, isActive: staffMembers.isActive })
      .from(staffMembers)
      .where(
        and(
          eq(staffMembers.businessId, ctx.businessId),
          isNull(staffMembers.deletedAt),
          withEntries.length ? sql`(${staffMembers.isActive} OR ${inArray(staffMembers.id, withEntries)})` : eq(staffMembers.isActive, true),
        ),
      )
      .orderBy(asc(staffMembers.name));
    return {
      start: q.start,
      days: Array.from({ length: 7 }, (_, i) => addDays(q.start, i)),
      shifts,
      staff,
      entries: entries.map((e) => ({ staffId: e.staffId, date: e.date, kind: e.kind, shiftId: e.shiftId, note: e.note })),
    };
  });

  app.put('/rota/entries', { preHandler: requirePermission('rota.manage') }, async (req) => {
    const ctx = bizCtx(req);
    const body = parse(rotaEntrySchema, req.body);
    const [staff] = await db
      .select({ id: staffMembers.id })
      .from(staffMembers)
      .where(and(own(staffMembers, ctx, body.staffId), isNull(staffMembers.deletedAt)));
    if (!staff) throw notFound();
    const where = and(eq(rotaEntries.businessId, ctx.businessId), eq(rotaEntries.staffId, body.staffId), eq(rotaEntries.date, body.date));
    if (body.kind === 'none') {
      await db.delete(rotaEntries).where(where);
      return { ok: true };
    }
    if (body.kind === 'shift') {
      const [s] = await db.select({ id: rotaShifts.id }).from(rotaShifts).where(own(rotaShifts, ctx, body.shiftId!));
      if (!s) throw new AppError('validation_failed', 'Unknown shift', { fields: { shiftId: { code: 'invalid_option' } } });
    }
    const values = { kind: body.kind, shiftId: body.kind === 'shift' ? body.shiftId : null, note: body.note, updatedAt: new Date() };
    await db
      .insert(rotaEntries)
      .values({ businessId: ctx.businessId, staffId: body.staffId, date: body.date, ...values })
      .onConflictDoUpdate({ target: [rotaEntries.businessId, rotaEntries.staffId, rotaEntries.date], set: values });
    return { ok: true };
  });

  /** Copy a whole week onto another week (replacing what was there). */
  app.post('/rota/copy', { preHandler: requirePermission('rota.manage') }, async (req) => {
    const ctx = bizCtx(req);
    const body = parse(rotaCopySchema, req.body);
    const shift = Math.round((Date.parse(body.to) - Date.parse(body.from)) / 86_400_000);
    if (shift === 0) return { copied: 0 };
    const copied = await db.transaction(async (tx) => {
      const src = await tx
        .select()
        .from(rotaEntries)
        .where(and(eq(rotaEntries.businessId, ctx.businessId), gte(rotaEntries.date, body.from), lte(rotaEntries.date, addDays(body.from, 6))));
      await tx.delete(rotaEntries).where(and(eq(rotaEntries.businessId, ctx.businessId), gte(rotaEntries.date, body.to), lte(rotaEntries.date, addDays(body.to, 6))));
      if (src.length) {
        await tx.insert(rotaEntries).values(
          src.map((e) => ({ businessId: ctx.businessId, staffId: e.staffId, date: addDays(e.date, shift), kind: e.kind, shiftId: e.shiftId, note: e.note })),
        );
      }
      await audit(tx, { ...actor(ctx), action: 'rota.copied', entityType: 'rota', entityId: body.to, metadata: { from: body.from, to: body.to, count: src.length }, req });
      return src.length;
    });
    return { copied };
  });
}
