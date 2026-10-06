import type { FastifyInstance } from 'fastify';
import { and, asc, desc, eq, gte, isNull, lt, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  BOOKING_STATUSES,
  karaokeBookingSchema,
  karaokeRoomSchema,
  paymentInputSchema,
  RESERVATION_STATUSES,
  reservationSchema,
  toMinor,
  voidSchema,
} from '@oceanx/shared';
import { customers, diningTables, karaokeBookings, karaokeRooms, notifications, payments, reservations, saleItems, sales } from '../../db/schema';
import { bizCtx, requirePermission } from '../../guards/business';
import { audit } from '../../lib/audit';
import { AppError, notFound } from '../../lib/errors';
import { idParam } from '../../lib/params';
import { actor, own, requireOutlet } from '../../lib/tenant';
import { parse } from '../../lib/validation';
import { voidSale } from '../../services/ops/sales';
import { kitchenOrders } from '../../db/schema';
import { businessToday } from '../../lib/tenant';

const dayQuery = z.object({ date: z.iso.date().optional() });

export async function addonModuleRoutes(app: FastifyInstance) {
  const { db } = app.deps;

  // ================================================================ KARAOKE (add-on): business configures rooms, prices, bookings
  app.get('/karaoke/rooms', { preHandler: requirePermission('karaoke.view') }, async (req) => {
    const ctx = bizCtx(req);
    const rows = await db
      .select()
      .from(karaokeRooms)
      .where(and(eq(karaokeRooms.businessId, ctx.businessId), eq(karaokeRooms.outletId, requireOutlet(ctx))))
      .orderBy(asc(karaokeRooms.name));
    return { items: rows };
  });

  app.post('/karaoke/rooms', { preHandler: requirePermission('karaoke.manage') }, async (req, reply) => {
    const ctx = bizCtx(req);
    const body = parse(karaokeRoomSchema, req.body);
    const [r] = await db
      .insert(karaokeRooms)
      .values({ ...body, hourlyRate: toMinor(body.hourlyRate), businessId: ctx.businessId, outletId: requireOutlet(ctx) })
      .returning();
    await audit(db, { ...actor(ctx), action: 'karaoke.room_created', entityType: 'karaoke_room', entityId: r!.id, req });
    reply.status(201);
    return r;
  });

  app.put('/karaoke/rooms/:id', { preHandler: requirePermission('karaoke.manage') }, async (req) => {
    const ctx = bizCtx(req);
    const body = parse(karaokeRoomSchema, req.body);
    const [r] = await db
      .update(karaokeRooms)
      .set({ ...body, hourlyRate: toMinor(body.hourlyRate), updatedAt: new Date() })
      .where(own(karaokeRooms, ctx, idParam(req)))
      .returning();
    if (!r) throw notFound();
    return r;
  });

  app.get('/karaoke/bookings', { preHandler: requirePermission('karaoke.view') }, async (req) => {
    const ctx = bizCtx(req);
    const { date } = parse(dayQuery, req.query);
    const day = date ?? businessToday(ctx.access.business.timezone);
    const start = new Date(`${day}T00:00:00Z`);
    const end = new Date(start.getTime() + 2 * 86_400_000);
    const rows = await db
      .select({ b: karaokeBookings, roomName: karaokeRooms.name })
      .from(karaokeBookings)
      .innerJoin(karaokeRooms, eq(karaokeRooms.id, karaokeBookings.roomId))
      .where(and(eq(karaokeBookings.businessId, ctx.businessId), eq(karaokeBookings.outletId, requireOutlet(ctx)), gte(karaokeBookings.endAt, new Date(start.getTime() - 86_400_000)), lt(karaokeBookings.startAt, end)))
      .orderBy(asc(karaokeBookings.startAt));
    return { items: rows.map((r) => ({ ...r.b, roomName: r.roomName })) };
  });

  /** Booking price is computed on the server from the room's hourly rate; overlapping bookings are rejected under a room lock. */
  app.post('/karaoke/bookings', { preHandler: requirePermission('karaoke.manage') }, async (req, reply) => {
    const ctx = bizCtx(req);
    const body = parse(karaokeBookingSchema, req.body);
    const startAt = new Date(body.startAt);
    const endAt = new Date(body.endAt);
    if (endAt <= startAt) throw new AppError('validation_failed', 'End must be after start', { fields: { endAt: { code: 'invalid' } } });
    const booking = await db.transaction(async (tx) => {
      const [room] = await tx
        .select()
        .from(karaokeRooms)
        .where(and(own(karaokeRooms, ctx, body.roomId), eq(karaokeRooms.outletId, requireOutlet(ctx))))
        .for('update');
      if (!room || !room.isActive) throw new AppError('validation_failed', 'Unknown room', { fields: { roomId: { code: 'invalid_option' } } });
      if (body.customerId) {
        const [c] = await tx.select({ id: customers.id }).from(customers).where(own(customers, ctx, body.customerId));
        if (!c) throw new AppError('validation_failed', 'Unknown customer', { fields: { customerId: { code: 'invalid_option' } } });
      }
      const [clash] = await tx
        .select({ id: karaokeBookings.id })
        .from(karaokeBookings)
        .where(and(eq(karaokeBookings.roomId, room.id), sql`${karaokeBookings.status} IN ('booked','checked_in')`, lt(karaokeBookings.startAt, endAt), sql`${karaokeBookings.endAt} > ${startAt}`))
        .limit(1);
      if (clash) throw new AppError('booking_conflict', 'Room is already booked for that time');
      const minutes = (endAt.getTime() - startAt.getTime()) / 60_000;
      const total = Math.round((room.hourlyRate * minutes) / 60);
      const deposit = toMinor(body.deposit);
      if (deposit > total) throw new AppError('payment_exceeds_balance', 'Deposit exceeds the booking total');
      const [b] = await tx
        .insert(karaokeBookings)
        .values({
          businessId: ctx.businessId,
          outletId: room.outletId,
          roomId: room.id,
          customerId: body.customerId,
          customerName: body.customerName,
          customerPhone: body.customerPhone,
          startAt,
          endAt,
          hourlyRate: room.hourlyRate,
          total,
          deposit,
          paidAmount: deposit,
          notes: body.notes,
          createdBy: ctx.user.id,
        })
        .returning();
      if (deposit > 0) {
        await tx.insert(payments).values({ businessId: ctx.businessId, outletId: room.outletId, customerId: body.customerId, bookingId: b!.id, kind: 'booking', method: 'cash', amount: deposit, reference: 'deposit', receivedBy: ctx.user.id });
      }
      await audit(tx, { ...actor(ctx), action: 'karaoke.booked', entityType: 'karaoke_booking', entityId: b!.id, metadata: { total }, req });
      return b!;
    });
    reply.status(201);
    return booking;
  });

  app.patch('/karaoke/bookings/:id/status', { preHandler: requirePermission('karaoke.manage') }, async (req) => {
    const ctx = bizCtx(req);
    const { status } = parse(z.object({ status: z.enum(BOOKING_STATUSES) }), req.body);
    const [b] = await db
      .update(karaokeBookings)
      .set({ status, updatedAt: new Date() })
      .where(own(karaokeBookings, ctx, idParam(req)))
      .returning();
    if (!b) throw notFound();
    await audit(db, { ...actor(ctx), action: `karaoke.${status}`, entityType: 'karaoke_booking', entityId: b.id, req });
    return b;
  });

  app.post('/karaoke/bookings/:id/payments', { preHandler: requirePermission('karaoke.manage') }, async (req) => {
    const ctx = bizCtx(req);
    const body = parse(paymentInputSchema.extend({ method: z.enum(['cash', 'card', 'bank_transfer', 'other']) }), req.body);
    const amount = toMinor(body.amount);
    return db.transaction(async (tx) => {
      const [b] = await tx.select().from(karaokeBookings).where(own(karaokeBookings, ctx, idParam(req))).for('update');
      if (!b) throw notFound();
      if (b.paidAmount + amount > b.total) throw new AppError('payment_exceeds_balance', 'Payment exceeds the booking balance');
      await tx.insert(payments).values({ businessId: ctx.businessId, outletId: b.outletId, customerId: b.customerId, bookingId: b.id, kind: 'booking', method: body.method, amount, reference: body.reference, receivedBy: ctx.user.id });
      const [u] = await tx
        .update(karaokeBookings)
        .set({ paidAmount: b.paidAmount + amount, updatedAt: new Date() })
        .where(eq(karaokeBookings.id, b.id))
        .returning();
      return u;
    });
  });

  // ================================================================ RESERVATIONS (add-on)
  app.get('/reservations', { preHandler: requirePermission('reservations.view') }, async (req) => {
    const ctx = bizCtx(req);
    const { date } = parse(dayQuery, req.query);
    const day = date ?? businessToday(ctx.access.business.timezone);
    const start = new Date(`${day}T00:00:00Z`);
    const rows = await db
      .select({ r: reservations, tableName: diningTables.name })
      .from(reservations)
      .leftJoin(diningTables, eq(diningTables.id, reservations.tableId))
      .where(
        and(
          eq(reservations.businessId, ctx.businessId),
          eq(reservations.outletId, requireOutlet(ctx)),
          gte(reservations.reservedAt, new Date(start.getTime() - 12 * 3_600_000)),
          lt(reservations.reservedAt, new Date(start.getTime() + 36 * 3_600_000)),
        ),
      )
      .orderBy(asc(reservations.reservedAt));
    return { items: rows.map((r) => ({ ...r.r, tableName: r.tableName })) };
  });

  async function assertTable(ctx: ReturnType<typeof bizCtx>, tableId: string | null) {
    if (!tableId) return;
    const [t] = await db
      .select({ id: diningTables.id })
      .from(diningTables)
      .where(and(own(diningTables, ctx, tableId), eq(diningTables.outletId, requireOutlet(ctx))));
    if (!t) throw new AppError('validation_failed', 'Unknown table', { fields: { tableId: { code: 'invalid_option' } } });
  }

  async function assertNoTableClash(ctx: ReturnType<typeof bizCtx>, body: z.output<typeof reservationSchema>, exceptId?: string) {
    if (!body.tableId) return;
    const start = new Date(body.reservedAt);
    const end = new Date(start.getTime() + body.durationMinutes * 60_000);
    const [clash] = await db
      .select({ id: reservations.id })
      .from(reservations)
      .where(
        and(
          eq(reservations.businessId, ctx.businessId),
          eq(reservations.tableId, body.tableId),
          sql`${reservations.status} IN ('booked','seated')`,
          lt(reservations.reservedAt, end),
          sql`${reservations.reservedAt} + (${reservations.durationMinutes} * interval '1 minute') > ${start}`,
          exceptId ? ne(reservations.id, exceptId) : undefined,
        ),
      )
      .limit(1);
    if (clash) throw new AppError('booking_conflict', 'Table already reserved for that time');
  }

  app.post('/reservations', { preHandler: requirePermission('reservations.manage') }, async (req, reply) => {
    const ctx = bizCtx(req);
    const body = parse(reservationSchema, req.body);
    await assertTable(ctx, body.tableId);
    await assertNoTableClash(ctx, body);
    const [r] = await db
      .insert(reservations)
      .values({ ...body, reservedAt: new Date(body.reservedAt), businessId: ctx.businessId, outletId: requireOutlet(ctx), createdBy: ctx.user.id })
      .returning();
    await audit(db, { ...actor(ctx), action: 'reservation.created', entityType: 'reservation', entityId: r!.id, req });
    reply.status(201);
    return r;
  });

  app.put('/reservations/:id', { preHandler: requirePermission('reservations.manage') }, async (req) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    const body = parse(reservationSchema, req.body);
    await assertTable(ctx, body.tableId);
    await assertNoTableClash(ctx, body, id);
    const [r] = await db
      .update(reservations)
      .set({ ...body, reservedAt: new Date(body.reservedAt), updatedAt: new Date() })
      .where(own(reservations, ctx, id))
      .returning();
    if (!r) throw notFound();
    return r;
  });

  app.patch('/reservations/:id/status', { preHandler: requirePermission('reservations.manage') }, async (req) => {
    const ctx = bizCtx(req);
    const { status } = parse(z.object({ status: z.enum(RESERVATION_STATUSES) }), req.body);
    const [r] = await db.update(reservations).set({ status, updatedAt: new Date() }).where(own(reservations, ctx, idParam(req))).returning();
    if (!r) throw notFound();
    return r;
  });

  // ================================================================ ONLINE ORDERS (add-on): staff accept / reject
  app.get('/online-orders', { preHandler: requirePermission('online_orders.manage') }, async (req) => {
    const ctx = bizCtx(req);
    const rows = await db
      .select()
      .from(sales)
      .where(and(eq(sales.businessId, ctx.businessId), eq(sales.source, 'online'), eq(sales.status, 'open')))
      .orderBy(asc(sales.createdAt))
      .limit(100);
    const items = rows.length
      ? await db
          .select()
          .from(saleItems)
          .where(sql`${saleItems.saleId} IN (${sql.join(
            rows.map((r) => sql`${r.id}`),
            sql`, `,
          )})`)
      : [];
    return { items: rows.map((r) => ({ ...r, lines: items.filter((i) => i.saleId === r.id) })) };
  });

  app.post('/online-orders/:id/accept', { preHandler: requirePermission('online_orders.manage') }, async (req) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    return db.transaction(async (tx) => {
      const [s] = await tx
        .select()
        .from(sales)
        .where(and(own(sales, ctx, id), eq(sales.source, 'online')))
        .for('update');
      if (!s || s.status !== 'open') throw notFound();
      const [already] = await tx.select({ id: kitchenOrders.id }).from(kitchenOrders).where(eq(kitchenOrders.saleId, id)).limit(1);
      if (!already && ctx.access.modules.has('kitchen')) {
        const lines = await tx.select().from(saleItems).where(eq(saleItems.saleId, id));
        const day = businessToday(ctx.access.business.timezone);
        const seq = await tx.execute<{ last_number: number }>(sql`
          INSERT INTO document_sequences (business_id, scope, doc_type, period, last_number)
          VALUES (${ctx.businessId}, ${'outlet:' + s.outletId}, 'kitchen', ${day}, 1)
          ON CONFLICT (business_id, scope, doc_type, period) DO UPDATE SET last_number = document_sequences.last_number + 1, updated_at = now()
          RETURNING last_number`);
        await tx.insert(kitchenOrders).values({
          businessId: ctx.businessId,
          outletId: s.outletId,
          saleId: id,
          ticketNumber: Number(seq.rows[0]!.last_number),
          orderType: s.orderType,
          tableName: s.onlineCustomer?.tableName ?? null,
          note: s.note,
          items: lines.filter((l) => l.sendToKitchen).map((l) => ({ name: l.nameSnapshot, quantity: Number(l.quantity), options: l.options.map((o) => o.choice), note: l.note })),
        });
      }
      await tx.update(sales).set({ cashierId: ctx.user.id, updatedAt: new Date() }).where(eq(sales.id, id));
      await audit(tx, { ...actor(ctx), action: 'online_order.accepted', entityType: 'sale', entityId: id, req });
      return { ok: true };
    });
  });

  app.post('/online-orders/:id/reject', { preHandler: requirePermission('online_orders.manage') }, async (req) => {
    const ctx = bizCtx(req);
    const { reason } = parse(voidSchema, req.body);
    const id = idParam(req);
    const [s] = await db
      .select({ id: sales.id })
      .from(sales)
      .where(and(own(sales, ctx, id), eq(sales.source, 'online'), eq(sales.status, 'open')));
    if (!s) throw notFound();
    return voidSale(db, ctx, id, reason, req);
  });

  // ================================================================ NOTIFICATIONS
  app.get('/notifications', { config: { sessionOnly: true } }, async (req) => {
    const ctx = bizCtx(req);
    const [items, [unread]] = await Promise.all([
      db.select().from(notifications).where(eq(notifications.userId, ctx.user.id)).orderBy(desc(notifications.createdAt)).limit(30),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(notifications)
        .where(and(eq(notifications.userId, ctx.user.id), isNull(notifications.readAt))),
    ]);
    return { items, unread: unread?.n ?? 0 };
  });

  app.post('/notifications/read', { config: { sessionOnly: true } }, async (req) => {
    const ctx = bizCtx(req);
    const { ids } = parse(z.object({ ids: z.array(z.number().int()).max(100).optional() }), req.body);
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.userId, ctx.user.id),
          isNull(notifications.readAt),
          ids?.length
            ? sql`${notifications.id} IN (${sql.join(
                ids.map((i) => sql`${i}`),
                sql`, `,
              )})`
            : undefined,
        ),
      );
    return { ok: true };
  });
}
