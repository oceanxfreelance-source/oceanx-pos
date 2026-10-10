import type { FastifyInstance } from 'fastify';
import { and, asc, count, desc, eq, ilike, inArray, isNull, lte, ne, notInArray, or, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import {
  HUB_INVOICE_STATUSES,
  HUB_LEAD_STATUSES,
  HUB_PROJECT_STATUSES,
  HUB_QUOTE_STATUSES,
  HUB_TASK_STATUSES,
  HUB_TICKET_STATUSES,
  hubClientSchema,
  hubDocumentSchema,
  hubLeadSchema,
  hubPaymentSchema,
  hubProjectSchema,
  hubServiceSchema,
  hubTaskSchema,
  hubTicketNoteSchema,
  hubTicketSchema,
  toMinor,
} from '@oceanx/shared';
import type { Executor } from '../../db/client';
import {
  billingPayments,
  businesses,
  hubClients,
  hubDocuments,
  hubLeads,
  hubPayments,
  hubProjects,
  hubServices,
  hubTasks,
  hubTicketNotes,
  hubTickets,
  superAdmins,
  type HubDocItem,
} from '../../db/schema';
import { saCtx } from '../../guards/superadmin';
import { audit } from '../../lib/audit';
import { AppError, notFound } from '../../lib/errors';
import { idParam } from '../../lib/params';
import { parse } from '../../lib/validation';
import { getPlatformSettings } from '../../services/platformSettings';

const today = () => new Date().toISOString().slice(0, 10);

/** One yearly sequence per prefix (OXQ quotes, OXI invoices, OXT tickets); the advisory lock serialises creation. */
async function nextNumber(tx: Executor, prefix: 'OXQ' | 'OXI' | 'OXT', table: 'hub_documents' | 'hub_tickets') {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'hub_number_' + prefix}))`);
  const p = `${prefix}-${new Date().getUTCFullYear()}-`;
  const res = await tx.execute<{ n: string }>(sql`SELECT count(*)::text AS n FROM ${sql.raw(table)} WHERE number LIKE ${p + '%'}`);
  return `${p}${String(Number(res.rows[0]?.n ?? 0) + 1).padStart(5, '0')}`;
}

/** Prices are entered in major units; everything is stored and summed in minor units on the server. */
function price(items: z.output<typeof hubDocumentSchema>['items'], discount: number) {
  const rows: HubDocItem[] = items.map((i) => {
    const unit = toMinor(i.unitPrice);
    return { serviceId: i.serviceId, description: i.description, quantity: i.quantity, unitPrice: unit, total: Math.round(unit * i.quantity) };
  });
  const subtotal = rows.reduce((a, r) => a + r.total, 0);
  const disc = Math.min(toMinor(discount), subtotal);
  return { rows, subtotal, discount: disc, total: subtotal - disc };
}

/** OceanX Hub: the company's main office (leads, clients, services, quotes & invoices, projects, tasks, tickets). */
export async function hubRoutes(app: FastifyInstance) {
  const { db } = app.deps;
  const saAudit = (ctx: ReturnType<typeof saCtx>) => ({ actorType: 'super_admin' as const, actorId: ctx.admin.id, actorName: ctx.admin.name });

  async function assertClient(tx: Executor, id: string | null | undefined) {
    if (!id) return;
    const [c] = await tx.select({ id: hubClients.id }).from(hubClients).where(eq(hubClients.id, id));
    if (!c) throw new AppError('validation_failed', 'Unknown client', { fields: { clientId: { code: 'invalid' } } });
  }
  async function assertAdmin(tx: Executor, id: string | null | undefined) {
    if (!id) return;
    const [a] = await tx.select({ id: superAdmins.id }).from(superAdmins).where(eq(superAdmins.id, id));
    if (!a) throw new AppError('validation_failed', 'Unknown team member', { fields: { assignedTo: { code: 'invalid' } } });
  }
  async function assertBusiness(tx: Executor, id: string | null | undefined) {
    if (!id) return;
    const [b] = await tx.select({ id: businesses.id }).from(businesses).where(eq(businesses.id, id));
    if (!b) throw new AppError('validation_failed', 'Unknown business', { fields: { businessId: { code: 'invalid' } } });
  }

  // ------------------------------------------------------------------ overview
  app.get('/hub/overview', async (req) => {
    const me = saCtx(req).admin.id;
    const d = today();
    const monthStart = `${d.slice(0, 8)}01`;
    const [leads, followUps, clients, projects, myTasks, openTasks, tickets, urgent, unpaid, paidMonth, pos, posPending] = await Promise.all([
      db.select({ n: count() }).from(hubLeads).where(notInArray(hubLeads.status, ['won', 'lost'])),
      db.select({ n: count() }).from(hubLeads).where(and(notInArray(hubLeads.status, ['won', 'lost']), lte(hubLeads.nextFollowUp, d))),
      db.select({ n: count() }).from(hubClients),
      db.select({ n: count() }).from(hubProjects).where(inArray(hubProjects.status, ['planned', 'in_progress', 'review'])),
      db.select({ n: count() }).from(hubTasks).where(and(ne(hubTasks.status, 'done'), eq(hubTasks.assignedTo, me))),
      db.select({ n: count() }).from(hubTasks).where(ne(hubTasks.status, 'done')),
      db.select({ n: count() }).from(hubTickets).where(inArray(hubTickets.status, ['open', 'in_progress', 'waiting'])),
      db.select({ n: count() }).from(hubTickets).where(and(inArray(hubTickets.status, ['open', 'in_progress', 'waiting']), inArray(hubTickets.priority, ['high', 'urgent']))),
      db
        .select({ n: count(), due: sql<string>`COALESCE(sum(${hubDocuments.total} - ${hubDocuments.paidAmount}), 0)::text` })
        .from(hubDocuments)
        .where(and(eq(hubDocuments.kind, 'invoice'), inArray(hubDocuments.status, ['issued', 'partially_paid']))),
      db
        .select({ total: sql<string>`COALESCE(sum(${hubPayments.amount}), 0)::text` })
        .from(hubPayments)
        .where(and(isNull(hubPayments.voidedAt), sql`${hubPayments.paidAt} >= ${monthStart}`)),
      db.select({ n: count() }).from(businesses).where(eq(businesses.status, 'active')),
      db.select({ n: count() }).from(billingPayments).where(eq(billingPayments.status, 'pending')),
    ]);
    const settings = await getPlatformSettings(db);
    return {
      currency: settings.defaultCurrency,
      leadsOpen: leads[0]?.n ?? 0,
      followUpsDue: followUps[0]?.n ?? 0,
      clients: clients[0]?.n ?? 0,
      projectsActive: projects[0]?.n ?? 0,
      myOpenTasks: myTasks[0]?.n ?? 0,
      openTasks: openTasks[0]?.n ?? 0,
      ticketsOpen: tickets[0]?.n ?? 0,
      ticketsUrgent: urgent[0]?.n ?? 0,
      invoicesUnpaid: unpaid[0]?.n ?? 0,
      amountDue: Number(unpaid[0]?.due ?? 0),
      receivedThisMonth: Number(paidMonth[0]?.total ?? 0),
      posBusinessesActive: pos[0]?.n ?? 0,
      posPaymentsPending: posPending[0]?.n ?? 0,
    };
  });

  /** Team members to assign work to. */
  app.get('/hub/team', async () => ({
    items: await db.select({ id: superAdmins.id, name: superAdmins.name, email: superAdmins.email }).from(superAdmins).where(eq(superAdmins.isActive, true)).orderBy(asc(superAdmins.name)),
  }));

  // ------------------------------------------------------------------ services (price list)
  app.get('/hub/services', async (req) => {
    const q = parse(z.object({ active: z.enum(['true', 'false']).optional() }), req.query);
    const items = await db
      .select()
      .from(hubServices)
      .where(q.active ? eq(hubServices.isActive, q.active === 'true') : undefined)
      .orderBy(asc(hubServices.category), asc(hubServices.name));
    return { items };
  });
  app.post('/hub/services', async (req, reply) => {
    const ctx = saCtx(req);
    const b = parse(hubServiceSchema, req.body);
    const [s] = await db.insert(hubServices).values({ ...b, price: toMinor(b.price) }).returning();
    await audit(db, { ...saAudit(ctx), action: 'hub.service_created', entityType: 'hub_service', entityId: s!.id, req });
    reply.status(201);
    return s;
  });
  app.put('/hub/services/:id', async (req) => {
    const ctx = saCtx(req);
    const b = parse(hubServiceSchema, req.body);
    const [s] = await db
      .update(hubServices)
      .set({ ...b, price: toMinor(b.price), updatedAt: new Date() })
      .where(eq(hubServices.id, idParam(req)))
      .returning();
    if (!s) throw notFound();
    await audit(db, { ...saAudit(ctx), action: 'hub.service_updated', entityType: 'hub_service', entityId: s.id, req });
    return s;
  });

  // ------------------------------------------------------------------ clients
  app.get('/hub/clients', async (req) => {
    const q = parse(z.object({ q: z.string().trim().max(100).optional() }), req.query);
    const where = q.q ? or(ilike(hubClients.name, `%${q.q}%`), ilike(hubClients.company, `%${q.q}%`), ilike(hubClients.phone, `%${q.q}%`), ilike(hubClients.email, `%${q.q}%`)) : undefined;
    const rows = await db
      .select({
        c: hubClients,
        businessName: businesses.name,
        due: sql<string>`(SELECT COALESCE(sum(d.total - d.paid_amount), 0) FROM hub_documents d WHERE d.client_id = ${hubClients.id} AND d.kind = 'invoice' AND d.status IN ('issued','partially_paid'))::text`,
        openProjects: sql<number>`(SELECT count(*) FROM hub_projects p WHERE p.client_id = ${hubClients.id} AND p.status IN ('planned','in_progress','review'))::int`,
      })
      .from(hubClients)
      .leftJoin(businesses, eq(businesses.id, hubClients.businessId))
      .where(where)
      .orderBy(asc(hubClients.name))
      .limit(500);
    return { items: rows.map((r) => ({ ...r.c, businessName: r.businessName, amountDue: Number(r.due), openProjects: r.openProjects })) };
  });
  app.get('/hub/clients/:id', async (req) => {
    const id = idParam(req);
    const [c] = await db.select({ c: hubClients, businessName: businesses.name }).from(hubClients).leftJoin(businesses, eq(businesses.id, hubClients.businessId)).where(eq(hubClients.id, id));
    if (!c) throw notFound();
    const [projects, documents, tickets, leads] = await Promise.all([
      db.select().from(hubProjects).where(eq(hubProjects.clientId, id)).orderBy(desc(hubProjects.createdAt)),
      db
        .select({ id: hubDocuments.id, kind: hubDocuments.kind, number: hubDocuments.number, status: hubDocuments.status, issueDate: hubDocuments.issueDate, total: hubDocuments.total, paidAmount: hubDocuments.paidAmount })
        .from(hubDocuments)
        .where(eq(hubDocuments.clientId, id))
        .orderBy(desc(hubDocuments.createdAt)),
      db.select({ id: hubTickets.id, number: hubTickets.number, subject: hubTickets.subject, status: hubTickets.status, priority: hubTickets.priority, createdAt: hubTickets.createdAt }).from(hubTickets).where(eq(hubTickets.clientId, id)).orderBy(desc(hubTickets.createdAt)),
      db.select({ id: hubLeads.id, name: hubLeads.name, status: hubLeads.status, createdAt: hubLeads.createdAt }).from(hubLeads).where(eq(hubLeads.clientId, id)),
    ]);
    return { client: { ...c.c, businessName: c.businessName }, projects, documents, tickets, leads };
  });
  app.post('/hub/clients', async (req, reply) => {
    const ctx = saCtx(req);
    const b = parse(hubClientSchema, req.body);
    await assertBusiness(db, b.businessId);
    const [c] = await db.insert(hubClients).values({ ...b, createdBy: ctx.admin.id }).returning();
    await audit(db, { ...saAudit(ctx), action: 'hub.client_created', entityType: 'hub_client', entityId: c!.id, req });
    reply.status(201);
    return c;
  });
  app.put('/hub/clients/:id', async (req) => {
    const ctx = saCtx(req);
    const b = parse(hubClientSchema, req.body);
    await assertBusiness(db, b.businessId);
    const [c] = await db.update(hubClients).set({ ...b, updatedAt: new Date() }).where(eq(hubClients.id, idParam(req))).returning();
    if (!c) throw notFound();
    await audit(db, { ...saAudit(ctx), action: 'hub.client_updated', entityType: 'hub_client', entityId: c.id, req });
    return c;
  });
  app.delete('/hub/clients/:id', async (req) => {
    const ctx = saCtx(req);
    const id = idParam(req);
    const [docs] = await db.select({ n: count() }).from(hubDocuments).where(eq(hubDocuments.clientId, id));
    if ((docs?.n ?? 0) > 0) throw new AppError('conflict', 'Client has quotations or invoices');
    const [c] = await db.delete(hubClients).where(eq(hubClients.id, id)).returning({ id: hubClients.id });
    if (!c) throw notFound();
    await audit(db, { ...saAudit(ctx), action: 'hub.client_deleted', entityType: 'hub_client', entityId: id, req });
    return { ok: true };
  });

  // ------------------------------------------------------------------ leads
  app.get('/hub/leads', async (req) => {
    const q = parse(z.object({ status: z.enum([...HUB_LEAD_STATUSES, 'open']).optional(), q: z.string().trim().max(100).optional() }), req.query);
    const conds: SQL[] = [];
    if (q.status === 'open') conds.push(notInArray(hubLeads.status, ['won', 'lost']));
    else if (q.status) conds.push(eq(hubLeads.status, q.status));
    if (q.q) conds.push(or(ilike(hubLeads.name, `%${q.q}%`), ilike(hubLeads.company, `%${q.q}%`), ilike(hubLeads.phone, `%${q.q}%`))!);
    const rows = await db
      .select({ l: hubLeads, serviceName: hubServices.name, assignedName: superAdmins.name })
      .from(hubLeads)
      .leftJoin(hubServices, eq(hubServices.id, hubLeads.serviceId))
      .leftJoin(superAdmins, eq(superAdmins.id, hubLeads.assignedTo))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(sql`${hubLeads.nextFollowUp} ASC NULLS LAST`, desc(hubLeads.createdAt))
      .limit(500);
    return { items: rows.map((r) => ({ ...r.l, serviceName: r.serviceName, assignedName: r.assignedName })) };
  });
  app.post('/hub/leads', async (req, reply) => {
    const ctx = saCtx(req);
    const b = parse(hubLeadSchema, req.body);
    await assertAdmin(db, b.assignedTo);
    const [l] = await db.insert(hubLeads).values({ ...b, createdBy: ctx.admin.id }).returning();
    await audit(db, { ...saAudit(ctx), action: 'hub.lead_created', entityType: 'hub_lead', entityId: l!.id, metadata: { source: b.source }, req });
    reply.status(201);
    return l;
  });
  app.put('/hub/leads/:id', async (req) => {
    const ctx = saCtx(req);
    const b = parse(hubLeadSchema, req.body);
    await assertAdmin(db, b.assignedTo);
    const [l] = await db.update(hubLeads).set({ ...b, updatedAt: new Date() }).where(eq(hubLeads.id, idParam(req))).returning();
    if (!l) throw notFound();
    await audit(db, { ...saAudit(ctx), action: 'hub.lead_updated', entityType: 'hub_lead', entityId: l.id, metadata: { status: l.status }, req });
    return l;
  });
  /** Won: the lead becomes a client (or is linked to an existing one). */
  app.post('/hub/leads/:id/convert', async (req) => {
    const ctx = saCtx(req);
    const id = idParam(req);
    const body = parse(z.object({ clientId: z.uuid().optional() }), req.body ?? {});
    return db.transaction(async (tx) => {
      const [l] = await tx.select().from(hubLeads).where(eq(hubLeads.id, id)).for('update');
      if (!l) throw notFound();
      if (l.clientId) throw new AppError('conflict', 'Lead already converted');
      let clientId = body.clientId;
      if (clientId) await assertClient(tx, clientId);
      else {
        const [c] = await tx
          .insert(hubClients)
          .values({ name: l.name, company: l.company, phone: l.phone, email: l.email, kind: l.company ? 'company' : 'person', notes: l.notes, createdBy: ctx.admin.id })
          .returning({ id: hubClients.id });
        clientId = c!.id;
      }
      const [u] = await tx.update(hubLeads).set({ status: 'won', clientId, updatedAt: new Date() }).where(eq(hubLeads.id, id)).returning();
      await audit(tx, { ...saAudit(ctx), action: 'hub.lead_converted', entityType: 'hub_lead', entityId: id, metadata: { clientId }, req });
      return u;
    });
  });

  // ------------------------------------------------------------------ projects & tasks
  app.get('/hub/projects', async (req) => {
    const q = parse(z.object({ status: z.enum([...HUB_PROJECT_STATUSES, 'active']).optional(), clientId: z.uuid().optional() }), req.query);
    const conds: SQL[] = [];
    if (q.status === 'active') conds.push(inArray(hubProjects.status, ['planned', 'in_progress', 'review']));
    else if (q.status) conds.push(eq(hubProjects.status, q.status));
    if (q.clientId) conds.push(eq(hubProjects.clientId, q.clientId));
    const rows = await db
      .select({
        p: hubProjects,
        clientName: hubClients.name,
        assignedName: superAdmins.name,
        tasksOpen: sql<number>`(SELECT count(*) FROM hub_tasks t WHERE t.project_id = ${hubProjects.id} AND t.status <> 'done')::int`,
        tasksDone: sql<number>`(SELECT count(*) FROM hub_tasks t WHERE t.project_id = ${hubProjects.id} AND t.status = 'done')::int`,
      })
      .from(hubProjects)
      .leftJoin(hubClients, eq(hubClients.id, hubProjects.clientId))
      .leftJoin(superAdmins, eq(superAdmins.id, hubProjects.assignedTo))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(sql`${hubProjects.dueDate} ASC NULLS LAST`, desc(hubProjects.createdAt))
      .limit(500);
    return { items: rows.map((r) => ({ ...r.p, clientName: r.clientName, assignedName: r.assignedName, tasksOpen: r.tasksOpen, tasksDone: r.tasksDone })) };
  });
  app.post('/hub/projects', async (req, reply) => {
    const ctx = saCtx(req);
    const b = parse(hubProjectSchema, req.body);
    await assertClient(db, b.clientId);
    await assertAdmin(db, b.assignedTo);
    const [p] = await db.insert(hubProjects).values({ ...b, value: toMinor(b.value), createdBy: ctx.admin.id }).returning();
    await audit(db, { ...saAudit(ctx), action: 'hub.project_created', entityType: 'hub_project', entityId: p!.id, req });
    reply.status(201);
    return p;
  });
  app.put('/hub/projects/:id', async (req) => {
    const ctx = saCtx(req);
    const b = parse(hubProjectSchema, req.body);
    await assertClient(db, b.clientId);
    await assertAdmin(db, b.assignedTo);
    const [p] = await db
      .update(hubProjects)
      .set({ ...b, value: toMinor(b.value), updatedAt: new Date() })
      .where(eq(hubProjects.id, idParam(req)))
      .returning();
    if (!p) throw notFound();
    await audit(db, { ...saAudit(ctx), action: 'hub.project_updated', entityType: 'hub_project', entityId: p.id, metadata: { status: p.status }, req });
    return p;
  });

  app.get('/hub/tasks', async (req) => {
    const q = parse(z.object({ status: z.enum([...HUB_TASK_STATUSES, 'open']).optional(), mine: z.enum(['true']).optional(), projectId: z.uuid().optional() }), req.query);
    const conds: SQL[] = [];
    if (q.status === 'open') conds.push(ne(hubTasks.status, 'done'));
    else if (q.status) conds.push(eq(hubTasks.status, q.status));
    if (q.mine) conds.push(eq(hubTasks.assignedTo, saCtx(req).admin.id));
    if (q.projectId) conds.push(eq(hubTasks.projectId, q.projectId));
    const rows = await db
      .select({ t: hubTasks, projectTitle: hubProjects.title, assignedName: superAdmins.name })
      .from(hubTasks)
      .leftJoin(hubProjects, eq(hubProjects.id, hubTasks.projectId))
      .leftJoin(superAdmins, eq(superAdmins.id, hubTasks.assignedTo))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(sql`${hubTasks.dueDate} ASC NULLS LAST`, desc(hubTasks.createdAt))
      .limit(1000);
    return { items: rows.map((r) => ({ ...r.t, projectTitle: r.projectTitle, assignedName: r.assignedName })) };
  });
  app.post('/hub/tasks', async (req, reply) => {
    const ctx = saCtx(req);
    const b = parse(hubTaskSchema, req.body);
    await assertAdmin(db, b.assignedTo);
    const [t] = await db
      .insert(hubTasks)
      .values({ ...b, createdBy: ctx.admin.id, completedAt: b.status === 'done' ? new Date() : null })
      .returning();
    reply.status(201);
    return t;
  });
  app.put('/hub/tasks/:id', async (req) => {
    const b = parse(hubTaskSchema, req.body);
    await assertAdmin(db, b.assignedTo);
    const id = idParam(req);
    const [before] = await db.select({ status: hubTasks.status, completedAt: hubTasks.completedAt }).from(hubTasks).where(eq(hubTasks.id, id));
    if (!before) throw notFound();
    const completedAt = b.status === 'done' ? (before.completedAt ?? new Date()) : null;
    const [t] = await db.update(hubTasks).set({ ...b, completedAt, updatedAt: new Date() }).where(eq(hubTasks.id, id)).returning();
    return t;
  });
  app.delete('/hub/tasks/:id', async (req) => {
    const [t] = await db.delete(hubTasks).where(eq(hubTasks.id, idParam(req))).returning({ id: hubTasks.id });
    if (!t) throw notFound();
    return { ok: true };
  });

  // ------------------------------------------------------------------ support tickets
  app.get('/hub/tickets', async (req) => {
    const q = parse(z.object({ status: z.enum([...HUB_TICKET_STATUSES, 'open_all']).optional(), q: z.string().trim().max(100).optional() }), req.query);
    const conds: SQL[] = [];
    if (q.status === 'open_all') conds.push(inArray(hubTickets.status, ['open', 'in_progress', 'waiting']));
    else if (q.status) conds.push(eq(hubTickets.status, q.status));
    if (q.q) conds.push(or(ilike(hubTickets.subject, `%${q.q}%`), ilike(hubTickets.number, `%${q.q}%`))!);
    const rows = await db
      .select({ t: hubTickets, clientName: hubClients.name, businessName: businesses.name, assignedName: superAdmins.name })
      .from(hubTickets)
      .leftJoin(hubClients, eq(hubClients.id, hubTickets.clientId))
      .leftJoin(businesses, eq(businesses.id, hubTickets.businessId))
      .leftJoin(superAdmins, eq(superAdmins.id, hubTickets.assignedTo))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(
        sql`CASE ${hubTickets.priority} WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END`,
        desc(hubTickets.createdAt),
      )
      .limit(500);
    return { items: rows.map((r) => ({ ...r.t, clientName: r.clientName, businessName: r.businessName, assignedName: r.assignedName })) };
  });
  app.get('/hub/tickets/:id', async (req) => {
    const id = idParam(req);
    const [t] = await db
      .select({ t: hubTickets, clientName: hubClients.name, businessName: businesses.name })
      .from(hubTickets)
      .leftJoin(hubClients, eq(hubClients.id, hubTickets.clientId))
      .leftJoin(businesses, eq(businesses.id, hubTickets.businessId))
      .where(eq(hubTickets.id, id));
    if (!t) throw notFound();
    const notes = await db
      .select({ id: hubTicketNotes.id, body: hubTicketNotes.body, createdAt: hubTicketNotes.createdAt, authorName: superAdmins.name })
      .from(hubTicketNotes)
      .leftJoin(superAdmins, eq(superAdmins.id, hubTicketNotes.authorId))
      .where(eq(hubTicketNotes.ticketId, id))
      .orderBy(asc(hubTicketNotes.createdAt));
    return { ticket: { ...t.t, clientName: t.clientName, businessName: t.businessName }, notes };
  });
  app.post('/hub/tickets', async (req, reply) => {
    const ctx = saCtx(req);
    const b = parse(hubTicketSchema, req.body);
    await assertClient(db, b.clientId);
    await assertBusiness(db, b.businessId);
    await assertAdmin(db, b.assignedTo);
    const t = await db.transaction(async (tx) => {
      const number = await nextNumber(tx, 'OXT', 'hub_tickets');
      const [row] = await tx.insert(hubTickets).values({ ...b, number, createdBy: ctx.admin.id }).returning();
      await audit(tx, { ...saAudit(ctx), action: 'hub.ticket_created', entityType: 'hub_ticket', entityId: row!.id, metadata: { number }, req });
      return row!;
    });
    reply.status(201);
    return t;
  });
  app.put('/hub/tickets/:id', async (req) => {
    const ctx = saCtx(req);
    const b = parse(hubTicketSchema, req.body);
    await assertClient(db, b.clientId);
    await assertBusiness(db, b.businessId);
    await assertAdmin(db, b.assignedTo);
    const id = idParam(req);
    const [before] = await db.select({ resolvedAt: hubTickets.resolvedAt }).from(hubTickets).where(eq(hubTickets.id, id));
    if (!before) throw notFound();
    const resolvedAt = b.status === 'resolved' || b.status === 'closed' ? (before.resolvedAt ?? new Date()) : null;
    const [t] = await db.update(hubTickets).set({ ...b, resolvedAt, updatedAt: new Date() }).where(eq(hubTickets.id, id)).returning();
    await audit(db, { ...saAudit(ctx), action: 'hub.ticket_updated', entityType: 'hub_ticket', entityId: id, metadata: { status: b.status }, req });
    return t;
  });
  app.post('/hub/tickets/:id/notes', async (req, reply) => {
    const ctx = saCtx(req);
    const b = parse(hubTicketNoteSchema, req.body);
    const id = idParam(req);
    const [t] = await db.select({ id: hubTickets.id }).from(hubTickets).where(eq(hubTickets.id, id));
    if (!t) throw notFound();
    const [n] = await db.insert(hubTicketNotes).values({ ticketId: id, body: b.body, authorId: ctx.admin.id }).returning();
    await db.update(hubTickets).set({ updatedAt: new Date() }).where(eq(hubTickets.id, id));
    reply.status(201);
    return n;
  });

  // ------------------------------------------------------------------ quotations & invoices
  app.get('/hub/documents', async (req) => {
    const q = parse(
      z.object({ kind: z.enum(['quote', 'invoice']), status: z.enum([...HUB_QUOTE_STATUSES, ...HUB_INVOICE_STATUSES, 'unpaid']).optional(), clientId: z.uuid().optional() }),
      req.query,
    );
    const conds: SQL[] = [eq(hubDocuments.kind, q.kind)];
    if (q.status === 'unpaid') conds.push(inArray(hubDocuments.status, ['issued', 'partially_paid']));
    else if (q.status) conds.push(eq(hubDocuments.status, q.status));
    if (q.clientId) conds.push(eq(hubDocuments.clientId, q.clientId));
    const rows = await db
      .select({ d: hubDocuments, clientName: hubClients.name })
      .from(hubDocuments)
      .innerJoin(hubClients, eq(hubClients.id, hubDocuments.clientId))
      .where(and(...conds))
      .orderBy(desc(hubDocuments.createdAt))
      .limit(500);
    return { items: rows.map((r) => ({ ...r.d, items: undefined, clientName: r.clientName })) };
  });
  app.get('/hub/documents/:id', async (req) => {
    const id = idParam(req);
    const [d] = await db.select({ d: hubDocuments, c: hubClients }).from(hubDocuments).innerJoin(hubClients, eq(hubClients.id, hubDocuments.clientId)).where(eq(hubDocuments.id, id));
    if (!d) throw notFound();
    const [payments, s] = await Promise.all([
      db
        .select({ id: hubPayments.id, amount: hubPayments.amount, method: hubPayments.method, reference: hubPayments.reference, paidAt: hubPayments.paidAt, voidedAt: hubPayments.voidedAt, receivedByName: superAdmins.name })
        .from(hubPayments)
        .leftJoin(superAdmins, eq(superAdmins.id, hubPayments.receivedBy))
        .where(eq(hubPayments.documentId, id))
        .orderBy(asc(hubPayments.createdAt)),
      getPlatformSettings(db),
    ]);
    return {
      document: d.d,
      client: d.c,
      payments,
      company: { name: s.platformName, address: s.companyAddress, phone: s.companyPhone, email: s.supportEmail, taxNumber: s.companyTaxNumber, bankDetails: s.billingBankDetails },
    };
  });
  app.post('/hub/documents', async (req, reply) => {
    const ctx = saCtx(req);
    const { kind } = parse(z.object({ kind: z.enum(['quote', 'invoice']) }), req.query);
    const b = parse(hubDocumentSchema, req.body);
    const d = await db.transaction(async (tx) => {
      await assertClient(tx, b.clientId);
      const settings = await getPlatformSettings(tx);
      const { rows, subtotal, discount, total } = price(b.items, b.discount);
      const number = await nextNumber(tx, kind === 'quote' ? 'OXQ' : 'OXI', 'hub_documents');
      const [row] = await tx
        .insert(hubDocuments)
        .values({
          kind,
          number,
          clientId: b.clientId,
          projectId: b.projectId,
          issueDate: b.issueDate,
          dueDate: b.dueDate,
          currency: settings.defaultCurrency,
          items: rows,
          subtotal,
          discount,
          total,
          notes: b.notes,
          terms: b.terms || settings.hubTerms,
          createdBy: ctx.admin.id,
        })
        .returning();
      await audit(tx, { ...saAudit(ctx), action: `hub.${kind}_created`, entityType: 'hub_document', entityId: row!.id, metadata: { number, total }, req });
      return row!;
    });
    reply.status(201);
    return d;
  });
  app.put('/hub/documents/:id', async (req) => {
    const ctx = saCtx(req);
    const b = parse(hubDocumentSchema, req.body);
    const id = idParam(req);
    return db.transaction(async (tx) => {
      const [d] = await tx.select().from(hubDocuments).where(eq(hubDocuments.id, id)).for('update');
      if (!d) throw notFound();
      const editable = d.kind === 'quote' ? ['draft', 'sent'].includes(d.status) : d.status === 'draft';
      if (!editable) throw new AppError('document_locked', 'This document can no longer be edited');
      await assertClient(tx, b.clientId);
      const { rows, subtotal, discount, total } = price(b.items, b.discount);
      const [u] = await tx
        .update(hubDocuments)
        .set({ clientId: b.clientId, projectId: b.projectId, issueDate: b.issueDate, dueDate: b.dueDate, items: rows, subtotal, discount, total, notes: b.notes, terms: b.terms, updatedAt: new Date() })
        .where(eq(hubDocuments.id, id))
        .returning();
      await audit(tx, { ...saAudit(ctx), action: `hub.${d.kind}_updated`, entityType: 'hub_document', entityId: id, metadata: { total }, req });
      return u;
    });
  });
  const TRANSITIONS: Record<string, Record<string, string[]>> = {
    quote: { sent: ['draft'], accepted: ['draft', 'sent'], rejected: ['draft', 'sent'], draft: ['sent'] },
    invoice: { issued: ['draft'], void: ['draft', 'issued'] },
  };
  app.post('/hub/documents/:id/status', async (req) => {
    const ctx = saCtx(req);
    const { status } = parse(z.object({ status: z.enum(['draft', 'sent', 'accepted', 'rejected', 'issued', 'void']) }), req.body);
    const id = idParam(req);
    return db.transaction(async (tx) => {
      const [d] = await tx.select().from(hubDocuments).where(eq(hubDocuments.id, id)).for('update');
      if (!d) throw notFound();
      const from = TRANSITIONS[d.kind]?.[status];
      if (!from?.includes(d.status)) throw new AppError('invalid_status_transition', `Cannot change ${d.status} to ${status}`);
      if (status === 'void' && d.paidAmount > 0) throw new AppError('invalid_status_transition', 'Invoice has payments');
      const [u] = await tx.update(hubDocuments).set({ status, updatedAt: new Date() }).where(eq(hubDocuments.id, id)).returning();
      await audit(tx, { ...saAudit(ctx), action: `hub.${d.kind}_${status}`, entityType: 'hub_document', entityId: id, metadata: { number: d.number }, req });
      return u;
    });
  });
  /** Accepted quotation → draft invoice with the same lines. */
  app.post('/hub/documents/:id/convert', async (req, reply) => {
    const ctx = saCtx(req);
    const id = idParam(req);
    const inv = await db.transaction(async (tx) => {
      const [q] = await tx.select().from(hubDocuments).where(eq(hubDocuments.id, id)).for('update');
      if (!q || q.kind !== 'quote') throw notFound();
      if (q.status === 'converted') throw new AppError('already_converted', 'Quotation already converted');
      if (q.status !== 'accepted') throw new AppError('invalid_status_transition', 'Only accepted quotations can be converted');
      const number = await nextNumber(tx, 'OXI', 'hub_documents');
      const due = new Date();
      due.setUTCDate(due.getUTCDate() + 14);
      const [row] = await tx
        .insert(hubDocuments)
        .values({
          kind: 'invoice',
          number,
          clientId: q.clientId,
          projectId: q.projectId,
          issueDate: today(),
          dueDate: due.toISOString().slice(0, 10),
          currency: q.currency,
          items: q.items,
          subtotal: q.subtotal,
          discount: q.discount,
          total: q.total,
          notes: q.notes,
          terms: q.terms,
          sourceQuoteId: q.id,
          createdBy: ctx.admin.id,
        })
        .returning();
      await tx.update(hubDocuments).set({ status: 'converted', updatedAt: new Date() }).where(eq(hubDocuments.id, id));
      await audit(tx, { ...saAudit(ctx), action: 'hub.quote_converted', entityType: 'hub_document', entityId: id, metadata: { invoice: number }, req });
      return row!;
    });
    reply.status(201);
    return inv;
  });
  app.delete('/hub/documents/:id', async (req) => {
    const ctx = saCtx(req);
    const id = idParam(req);
    const [d] = await db.select().from(hubDocuments).where(eq(hubDocuments.id, id));
    if (!d) throw notFound();
    if (d.status !== 'draft') throw new AppError('document_locked', 'Only drafts can be deleted');
    await db.delete(hubDocuments).where(eq(hubDocuments.id, id));
    await audit(db, { ...saAudit(ctx), action: `hub.${d.kind}_deleted`, entityType: 'hub_document', entityId: id, metadata: { number: d.number }, req });
    return { ok: true };
  });
  app.post('/hub/documents/:id/payments', async (req, reply) => {
    const ctx = saCtx(req);
    const b = parse(hubPaymentSchema, req.body);
    const id = idParam(req);
    const amount = toMinor(b.amount);
    const u = await db.transaction(async (tx) => {
      const [d] = await tx.select().from(hubDocuments).where(eq(hubDocuments.id, id)).for('update');
      if (!d || d.kind !== 'invoice') throw notFound();
      if (!['issued', 'partially_paid'].includes(d.status)) throw new AppError('invalid_status_transition', 'Invoice is not open for payment');
      if (amount > d.total - d.paidAmount) throw new AppError('payment_exceeds_balance', 'Payment exceeds the balance due', { details: { balanceDue: d.total - d.paidAmount } });
      await tx.insert(hubPayments).values({ documentId: id, amount, method: b.method, reference: b.reference, paidAt: b.paidAt, receivedBy: ctx.admin.id });
      const paid = d.paidAmount + amount;
      const [row] = await tx
        .update(hubDocuments)
        .set({ paidAmount: paid, status: paid >= d.total ? 'paid' : 'partially_paid', updatedAt: new Date() })
        .where(eq(hubDocuments.id, id))
        .returning();
      await audit(tx, { ...saAudit(ctx), action: 'hub.invoice_payment', entityType: 'hub_document', entityId: id, metadata: { amount, number: d.number }, req });
      return row!;
    });
    reply.status(201);
    return u;
  });
}
