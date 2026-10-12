import { z } from 'zod';

/** Gravity Flow: money in (income) and money out (expense). Profit = income − expenses. */
export const FINANCE_KINDS = ['income', 'expense'] as const;
export type FinanceKind = (typeof FINANCE_KINDS)[number];

/** A calendar month, "2026-10". */
export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'invalid_month');
const isoDay = z.iso.date();

/**
 * An amount typed by a person, as exact decimal text ("1250", "1250.5", "1,250.50"), never a float.
 * Converted to whole minor units (laari/cents) with string arithmetic, so 0.1 + 0.2 problems cannot happen.
 */
export const moneyTextSchema = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim().replace(/,/g, ''))
  .refine((v) => /^\d{1,12}(\.\d{1,2})?$/.test(v), 'invalid_amount')
  .transform((v) => decimalToMinor(v))
  .refine((n) => n > 0, 'must_be_positive');

/** "12.5" → 1250 (exact, no floating point). */
export function decimalToMinor(text: string): number {
  const [whole, frac = ''] = text.split('.');
  return Number(whole) * 100 + Number((frac + '00').slice(0, 2));
}

/** 1250 → "12.50" (exact). */
export function minorToDecimal(minor: number): string {
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

export const financeTransactionSchema = z.object({
  kind: z.enum(FINANCE_KINDS),
  amount: moneyTextSchema,
  occurredOn: isoDay,
  categoryId: z.string().uuid().nullable().default(null),
  description: z.string().trim().max(300).default(''),
  reference: z.string().trim().max(80).default(''),
});

export const financeCategorySchema = z.object({
  kind: z.enum(FINANCE_KINDS),
  name: z.string().trim().min(1).max(60),
});

export const financeListQuerySchema = z.object({
  month: monthSchema.optional(),
  kind: z.enum(FINANCE_KINDS).optional(),
  categoryId: z.string().uuid().optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sort: z.enum(['newest', 'oldest', 'largest', 'smallest']).default('newest'),
});

/** Days in a month, "2026-02" → 28. */
export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** "2026-01" + (-1) → "2025-12". */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
