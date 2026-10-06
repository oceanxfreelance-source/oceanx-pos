import { and, eq, isNull, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { AppError } from './errors';
import type { BusinessContext } from '../types';

/** The working outlet always comes from the server-side session. */
export function requireOutlet(ctx: BusinessContext): string {
  if (!ctx.outletId) throw new AppError('outlet_mismatch', 'No active outlet');
  return ctx.outletId;
}

/** WHERE business_id = session business AND id = :id [AND deleted_at IS NULL]. */
export function own(table: { businessId: PgColumn; id: PgColumn; deletedAt?: PgColumn }, ctx: BusinessContext, id: string, ...extra: (SQL | undefined)[]) {
  return and(eq(table.businessId, ctx.businessId), eq(table.id, id), table.deletedAt ? isNull(table.deletedAt) : undefined, ...extra);
}

export const actor = (ctx: BusinessContext) => ({ actorType: 'user' as const, actorId: ctx.user.id, actorName: ctx.user.name, businessId: ctx.businessId });

/** Today's date (YYYY-MM-DD) in the business time zone. */
export function businessToday(tz: string, d = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export const round3 = (n: number) => Math.round(n * 1000) / 1000;
