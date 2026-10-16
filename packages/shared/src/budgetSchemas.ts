import { z } from 'zod';
import { monthSchema, moneyTextSchema } from './financeSchemas';

/**
 * Gravity Budget: a personal money manager. Money in (income: salary, family, side jobs) and money out
 * (spending), a monthly limit per spending category, monthly bills with a due day, and savings goals.
 * Amounts are exact decimal text from the person, stored as whole laari/cents.
 */
export const BUDGET_KINDS = ['income', 'expense'] as const;
export type BudgetKind = (typeof BUDGET_KINDS)[number];

/** How a payment was made: lets people see how much went on the card or by transfer. */
export const PAID_WITH = ['cash', 'card', 'transfer', 'other'] as const;

const isoDay = z.iso.date();
/** A short emoji or symbol shown on the category / goal (optional). */
const emoji = z.string().trim().max(8).default('');
/** A money amount that may be left empty (no monthly limit). */
const optionalMoney = z
  .union([moneyTextSchema, z.literal(''), z.null()])
  .optional()
  .transform((v) => (typeof v === 'number' ? v : null));

/**
 * The categories offered at set-up. A category made from one keeps its key, so the app shows its name in the
 * person's language (changing language changes it too) until they rename it.
 */
export const BUDGET_STARTER_KEYS = ['salary', 'side_income', 'from_family', 'food', 'eating_out', 'rent', 'utilities', 'phone', 'transport', 'family', 'loans', 'shopping', 'health', 'education', 'fun', 'other'] as const;

export const budgetCategorySchema = z.object({
  kind: z.enum(BUDGET_KINDS),
  name: z.string().trim().min(1).max(60),
  emoji,
  /** Spending categories: the most to spend on it in a month (empty = no limit). */
  monthlyLimit: optionalMoney,
});
export const budgetCategoryUpdateSchema = budgetCategorySchema.omit({ kind: true }).partial();
export const budgetSetupCategorySchema = budgetCategorySchema.extend({ key: z.enum(BUDGET_STARTER_KEYS).optional() });

export const budgetEntrySchema = z.object({
  kind: z.enum(BUDGET_KINDS),
  amount: moneyTextSchema,
  occurredOn: isoDay,
  categoryId: z.string().uuid().nullable().default(null),
  note: z.string().trim().max(300).default(''),
  paidWith: z.enum(PAID_WITH).default('cash'),
});

export const budgetListQuerySchema = z.object({
  month: monthSchema.optional(),
  day: isoDay.optional(),
  kind: z.enum(BUDGET_KINDS).optional(),
  categoryId: z.string().uuid().optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});

/** A bill paid every month (rent, phone, internet, electricity, loan, school fees) and the day it is due. */
export const budgetBillSchema = z.object({
  name: z.string().trim().min(1).max(60),
  amount: moneyTextSchema,
  dueDay: z.coerce.number().int().min(1).max(31),
  categoryId: z.string().uuid().nullable().default(null),
  isActive: z.boolean().default(true),
});

/** Paying a bill records it as spending (amount can differ, e.g. this month's electricity). */
export const budgetBillPaySchema = z.object({
  amount: moneyTextSchema.optional(),
  occurredOn: isoDay.optional(),
  paidWith: z.enum(PAID_WITH).default('transfer'),
});

/** Something to save for: a phone, Umrah, a wedding, an emergency fund. */
export const BUDGET_GOAL_KINDS = ['goal', 'emergency'] as const;
export const budgetGoalSchema = z.object({
  /** 'emergency': the one emergency fund (money kept for sudden needs); it cannot be changed later. */
  kind: z.enum(BUDGET_GOAL_KINDS).default('goal'),
  name: z.string().trim().min(1).max(60),
  emoji,
  target: moneyTextSchema,
  /** When the money is needed (optional): shows how much to save each month. */
  targetDate: z.union([isoDay, z.literal(''), z.null()]).optional().transform((v) => v || null),
});

/** Put money into a goal, or take some out. */
export const budgetGoalMoveSchema = z.object({
  direction: z.enum(['add', 'take']),
  amount: moneyTextSchema,
  occurredOn: isoDay.optional(),
  note: z.string().trim().max(200).default(''),
});
