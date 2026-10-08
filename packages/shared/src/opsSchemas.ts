import { z } from 'zod';
import { LANGUAGE_CODES } from './languages';

/**
 * Request schemas for operational modules. Money is entered in MAJOR units (e.g. 12.50)
 * and converted to minor units on the server. Totals are never accepted from clients.
 */
const money = z.number().min(0).max(100_000_000);
const qty = z.number().gt(0).max(1_000_000);
const text = (max: number) => z.string().trim().max(max).optional().default('');
const req = (max: number) => z.string().trim().min(1).max(max);
const id = z.uuid();
const phone = z
  .string()
  .trim()
  .max(32)
  .regex(/^[+0-9 ()-]*$/)
  .optional()
  .default('');
const email = z.union([z.string().trim().toLowerCase().pipe(z.email()), z.literal('')]).optional().default('');
const isoDate = z.iso.date();

export const PAYMENT_METHODS = ['cash', 'card', 'bank_transfer', 'other', 'credit'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const ORDER_TYPES = ['dine_in', 'takeaway', 'delivery'] as const;
export const EXPENSE_CATEGORIES = ['rent', 'electricity', 'internet', 'salaries', 'ingredients', 'transport', 'maintenance', 'other'] as const;
export const KITCHEN_STATUSES = ['new', 'preparing', 'ready', 'completed'] as const;

export const optionGroupSchema = z.object({
  name: req(60),
  required: z.boolean().default(false),
  multiple: z.boolean().default(false),
  choices: z
    .array(z.object({ name: req(60), price: money.default(0) }))
    .min(1)
    .max(30),
});

/** Menu names/descriptions in other languages, shown to customers who switch language. Missing → base name. */
export const translationsSchema = z.partialRecord(
  z.enum(LANGUAGE_CODES),
  z.object({ name: z.string().trim().max(120).optional().default(''), description: z.string().trim().max(1000).optional().default('') }),
);
export type Translations = z.output<typeof translationsSchema>;

export const categorySchema = z.object({
  name: req(80),
  description: text(300),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
  isActive: z.boolean().default(true),
  kitchenStation: text(40),
  translations: translationsSchema.optional(),
});

export const productSchema = z.object({
  name: req(120),
  sku: z
    .string()
    .trim()
    .max(40)
    .regex(/^[A-Za-z0-9._/-]*$/)
    .optional()
    .default(''),
  categoryId: id.nullable().default(null),
  description: text(1000),
  unit: z.string().trim().min(1).max(20).default('pcs'),
  type: z.enum(['item', 'ingredient', 'service']).default('item'),
  costPrice: money.default(0),
  sellingPrice: money.default(0),
  taxRate: z.number().min(0).max(100).nullable().default(null),
  trackStock: z.boolean().default(false),
  minStock: z.number().min(0).max(1_000_000).default(0),
  isActive: z.boolean().default(true),
  showInPos: z.boolean().default(true),
  showInMenu: z.boolean().default(true),
  sendToKitchen: z.boolean().default(true),
  options: z.array(optionGroupSchema).max(10).default([]),
  // Optional so older clients that omit it never wipe stored translations.
  translations: translationsSchema.optional(),
});

export const customerSchema = z.object({
  name: req(120),
  phone,
  /** Registered Viber number for Credit (Pay Later) messages; empty = use phone. */
  viberPhone: phone,
  email,
  company: text(120),
  address: text(500),
  taxNumber: text(50),
  notes: text(1000),
  creditLimit: money.nullable().default(null),
  creditDays: z.number().int().min(0).max(365).nullable().default(null),
});

export const tableSchema = z.object({
  name: req(40),
  capacity: z.number().int().min(1).max(100).default(4),
  area: text(40),
  isActive: z.boolean().default(true),
});

const selectedOption = z.object({ group: req(60), choice: req(60) });
export const orderItemSchema = z.object({
  productId: id,
  quantity: qty,
  discount: money.default(0),
  options: z.array(selectedOption).max(30).default([]),
  note: text(200),
});
export const paymentInputSchema = z.object({
  method: z.enum(PAYMENT_METHODS),
  amount: z.number().gt(0).max(100_000_000),
  reference: text(80),
});

export const posOrderSchema = z.object({
  orderType: z.enum(ORDER_TYPES).default('dine_in'),
  tableId: id.nullable().default(null),
  customerId: id.nullable().default(null),
  items: z.array(orderItemSchema).min(1).max(200),
  discount: money.default(0),
  note: text(500),
  delivery: z.object({ address: text(300), phone, fee: money.default(0) }).nullable().default(null),
  redeemPoints: z.number().int().min(0).max(10_000_000).default(0),
  sendToKitchen: z.boolean().optional(),
});
export const completeOrderSchema = z.object({ payments: z.array(paymentInputSchema).min(1).max(10) });

export const recordPaymentSchema = z.object({
  method: z.enum(['cash', 'card', 'bank_transfer', 'other']),
  amount: z.number().gt(0).max(100_000_000),
  reference: text(80),
  notes: text(300),
  paidAt: z.iso.datetime().optional(),
});

export const voidSchema = z.object({ reason: z.string().trim().min(3).max(300) });

const docItemSchema = z.object({
  productId: id.nullable().default(null),
  name: req(200),
  description: text(500),
  quantity: qty,
  unit: z.string().trim().max(20).default('pcs'),
  unitPrice: money,
  discount: money.default(0),
  taxRate: z.number().min(0).max(100).nullable().default(null),
});

const docBase = {
  customerId: id,
  salespersonId: id.nullable().default(null),
  discount: money.default(0),
  notes: text(2000),
  terms: text(5000),
  language: z.enum(LANGUAGE_CODES).nullable().default(null),
  items: z.array(docItemSchema).min(1).max(200),
};
export const quotationSchema = z.object({ ...docBase, quotationDate: isoDate, validUntil: isoDate });
export const invoiceSchema = z.object({ ...docBase, invoiceDate: isoDate, dueDate: isoDate });
export const QUOTATION_STATUSES = ['draft', 'sent', 'accepted', 'rejected', 'expired', 'converted', 'cancelled'] as const;
export const INVOICE_STATUSES = ['draft', 'issued', 'partially_paid', 'paid', 'overdue', 'void', 'cancelled'] as const;

export const supplierSchema = z.object({
  name: req(120),
  phone,
  email,
  address: text(500),
  notes: text(1000),
  isActive: z.boolean().default(true),
});

export const purchaseSchema = z.object({
  supplierId: id,
  purchaseDate: isoDate,
  reference: text(60),
  notes: text(1000),
  items: z
    .array(
      // Either the cost per unit, or the total paid for the whole line (bulk buys) — the server works out the other.
      z
        .object({ productId: id, quantity: qty, unitCost: money.optional(), lineTotal: money.optional() })
        .refine((i) => i.unitCost !== undefined || i.lineTotal !== undefined, { message: 'Unit cost or line total required', path: ['unitCost'] }),
    )
    .min(1)
    .max(300),
});
export const purchasePaymentSchema = z.object({ amount: z.number().gt(0).max(100_000_000), method: z.enum(['cash', 'card', 'bank_transfer', 'other']).default('cash') });

export const expenseSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  amount: z.number().gt(0).max(100_000_000),
  expenseDate: isoDate,
  paymentMethod: z.enum(['cash', 'card', 'bank_transfer', 'other']).default('cash'),
  payee: text(120),
  reference: text(80),
  notes: text(1000),
});

export const stockAdjustSchema = z.object({
  productId: id,
  mode: z.enum(['add', 'remove', 'set', 'wastage']),
  quantity: z.number().min(0).max(1_000_000),
  reason: text(300),
});

export const transferSchema = z.object({
  fromOutletId: id,
  toOutletId: id,
  notes: text(300),
  items: z
    .array(z.object({ productId: id, quantity: qty }))
    .min(1)
    .max(200),
});

export const kitchenStatusSchema = z.object({ status: z.enum(KITCHEN_STATUSES) });

export const karaokeRoomSchema = z.object({
  name: req(60),
  capacity: z.number().int().min(1).max(200),
  hourlyRate: money,
  isActive: z.boolean().default(true),
  notes: text(300),
});
export const karaokeBookingSchema = z.object({
  roomId: id,
  customerId: id.nullable().default(null),
  customerName: req(120),
  customerPhone: phone,
  startAt: z.iso.datetime(),
  endAt: z.iso.datetime(),
  deposit: money.default(0),
  notes: text(500),
});
export const BOOKING_STATUSES = ['booked', 'checked_in', 'completed', 'cancelled', 'no_show'] as const;

export const reservationSchema = z.object({
  tableId: id.nullable().default(null),
  customerName: req(120),
  phone,
  partySize: z.number().int().min(1).max(200),
  reservedAt: z.iso.datetime(),
  durationMinutes: z.number().int().min(15).max(720).default(90),
  notes: text(500),
});
export const RESERVATION_STATUSES = ['booked', 'seated', 'completed', 'cancelled', 'no_show'] as const;

export const recipeSchema = z.object({
  items: z
    .array(z.object({ ingredientId: id, quantity: qty }))
    .max(100),
});

export const loyaltyAdjustSchema = z.object({ points: z.number().int().min(-10_000_000).max(10_000_000), reason: req(200) });

export const publicOrderSchema = z.object({
  customerName: req(120),
  phone: z
    .string()
    .trim()
    .min(5)
    .max(32)
    .regex(/^[+0-9 ()-]*$/),
  orderType: z.enum(ORDER_TYPES).default('takeaway'),
  tableName: text(40),
  address: text(300),
  note: text(500),
  items: z
    .array(z.object({ productId: id, quantity: z.number().int().min(1).max(100), options: z.array(selectedOption).max(30).default([]) }))
    .min(1)
    .max(50),
});

export const reportQuerySchema = z.object({
  from: isoDate,
  to: isoDate,
  outletId: id.optional(),
  format: z.enum(['json', 'csv']).default('json'),
});

// ---------------------------------------------------------------- staff, payroll, duty rota (add-ons)
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const staffSchema = z.object({
  name: req(120),
  position: text(80),
  phone,
  /** Monthly basic salary in major units; only stored when the user may manage payroll. */
  basicSalary: money.optional(),
  isActive: z.boolean().default(true),
  notes: text(500),
});

export const payrollPeriodSchema = z.object({ period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) });

/** Editable amounts of one salary-sheet line (major units). Net is always calculated by the server. */
export const payrollLineSchema = z.object({
  id,
  basic: money.default(0),
  allowances: money.default(0),
  overtime: money.default(0),
  deductions: money.default(0),
  advance: money.default(0),
  notes: text(200),
});
export const payrollUpdateSchema = z.object({ lines: z.array(payrollLineSchema).max(500), notes: text(1000) });
export const payrollFinalizeSchema = z.object({
  addToExpenses: z.boolean().default(false),
  paymentMethod: z.enum(['cash', 'card', 'bank_transfer', 'other']).default('bank_transfer'),
});

export const ROTA_KINDS = ['shift', 'off', 'leave'] as const;
export const SHIFT_COLORS = ['sky', 'amber', 'violet', 'emerald', 'rose', 'slate'] as const;
export const rotaShiftSchema = z.object({
  name: req(40),
  startTime: time,
  endTime: time,
  color: z.enum(SHIFT_COLORS).default('sky'),
  sortOrder: z.number().int().min(0).max(1000).default(0),
});
export const rotaEntrySchema = z
  .object({
    staffId: id,
    date: isoDate,
    /** 'none' clears the cell. */
    kind: z.enum([...ROTA_KINDS, 'none']),
    shiftId: id.nullable().default(null),
    note: text(120),
  })
  .refine((v) => v.kind !== 'shift' || !!v.shiftId, { path: ['shiftId'], message: 'required' });
export const rotaCopySchema = z.object({ from: isoDate, to: isoDate });
