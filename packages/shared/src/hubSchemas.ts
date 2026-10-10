import { z } from 'zod';

/** OceanX Hub (the company's main office in the Super Admin console). */
const money = z.number().min(0).max(100_000_000);
const text = (max: number) => z.string().trim().max(max).optional().default('');
const req = (max: number) => z.string().trim().min(1).max(max);
const id = z.uuid();
const optId = z.uuid().nullable().optional().default(null);
const optDate = z.iso.date().nullable().optional().default(null);
const phone = z.string().trim().max(40).regex(/^[0-9+()\-\s]*$/).optional().default('');
const email = z.union([z.string().trim().toLowerCase().pipe(z.email()), z.literal('')]).optional().default('');

export const HUB_SERVICE_CATEGORIES = ['pos', 'websites', 'design', 'marketing', 'hardware', 'it_support', 'software', 'other'] as const;
export const HUB_LEAD_SOURCES = ['tiktok', 'instagram', 'facebook', 'whatsapp', 'viber', 'email', 'phone', 'walk_in', 'website', 'referral', 'other'] as const;
export const HUB_LEAD_STATUSES = ['new', 'contacted', 'demo', 'proposal', 'won', 'lost'] as const;
export const HUB_PROJECT_STATUSES = ['planned', 'in_progress', 'review', 'done', 'cancelled'] as const;
export const HUB_TASK_STATUSES = ['todo', 'doing', 'done'] as const;
export const HUB_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export const HUB_TICKET_STATUSES = ['open', 'in_progress', 'waiting', 'resolved', 'closed'] as const;
export const HUB_TICKET_CHANNELS = ['phone', 'whatsapp', 'email', 'social', 'visit', 'other'] as const;
export const HUB_CLIENT_KINDS = ['person', 'company', 'government'] as const;
export const HUB_QUOTE_STATUSES = ['draft', 'sent', 'accepted', 'rejected', 'converted'] as const;
export const HUB_INVOICE_STATUSES = ['draft', 'issued', 'partially_paid', 'paid', 'void'] as const;
export const HUB_PAYMENT_METHODS = ['cash', 'bank_transfer', 'card', 'cheque', 'other'] as const;

export const hubServiceSchema = z.object({
  name: req(120),
  category: z.enum(HUB_SERVICE_CATEGORIES).default('other'),
  description: text(1000),
  unit: z.string().trim().min(1).max(30).optional().default('job'),
  price: money.default(0),
  isActive: z.boolean().default(true),
});

export const hubClientSchema = z.object({
  name: req(120),
  company: text(120),
  kind: z.enum(HUB_CLIENT_KINDS).default('company'),
  phone,
  email,
  address: text(500),
  taxNumber: text(50),
  notes: text(2000),
  businessId: optId,
});

export const hubLeadSchema = z.object({
  name: req(120),
  company: text(120),
  phone,
  email,
  source: z.enum(HUB_LEAD_SOURCES).default('other'),
  serviceId: optId,
  interest: text(500),
  status: z.enum(HUB_LEAD_STATUSES).default('new'),
  nextFollowUp: optDate,
  assignedTo: optId,
  notes: text(2000),
});

export const hubProjectSchema = z.object({
  title: req(160),
  clientId: optId,
  serviceId: optId,
  description: text(2000),
  status: z.enum(HUB_PROJECT_STATUSES).default('planned'),
  startDate: optDate,
  dueDate: optDate,
  value: money.default(0),
  assignedTo: optId,
});

export const hubTaskSchema = z.object({
  title: req(200),
  projectId: optId,
  notes: text(2000),
  status: z.enum(HUB_TASK_STATUSES).default('todo'),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
  dueDate: optDate,
  assignedTo: optId,
});

export const hubTicketSchema = z
  .object({
    subject: req(200),
    description: text(4000),
    clientId: optId,
    businessId: optId,
    channel: z.enum(HUB_TICKET_CHANNELS).default('phone'),
    priority: z.enum(HUB_PRIORITIES).default('normal'),
    status: z.enum(HUB_TICKET_STATUSES).default('open'),
    assignedTo: optId,
  });

export const hubTicketNoteSchema = z.object({ body: req(4000) });

export const hubDocItemSchema = z.object({
  serviceId: optId,
  description: req(300),
  quantity: z.number().gt(0).max(1_000_000),
  unitPrice: money,
});

export const hubDocumentSchema = z.object({
  clientId: id,
  projectId: optId,
  issueDate: z.iso.date(),
  dueDate: optDate,
  discount: money.default(0),
  notes: text(2000),
  terms: text(4000),
  items: z.array(hubDocItemSchema).min(1).max(100),
});

export const hubPaymentSchema = z.object({
  amount: z.number().gt(0).max(100_000_000),
  method: z.enum(HUB_PAYMENT_METHODS).default('bank_transfer'),
  reference: text(100),
  paidAt: z.iso.date(),
});
