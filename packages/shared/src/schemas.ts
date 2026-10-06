import { z } from 'zod';
import { BUSINESS_TYPES } from './businessTypes';
import { LANGUAGE_CODES } from './languages';
import { PLAN_LIMIT_KEYS, MODULES } from './modules';

/**
 * Request schemas shared by API (authoritative validation) and web (form UX).
 * Note: these schemas deliberately never accept business_id / outlet_id /
 * totals from the client — tenant scope is resolved from the session.
 */

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email()).pipe(z.string().max(254));
export const businessPasswordSchema = z.string().min(8).max(128);
export const superAdminPasswordSchema = z.string().min(12).max(128);
const name = z.string().trim().min(1).max(120);
const optionalText = (max: number) => z.string().trim().max(max).optional().default('');
const phone = z
  .string()
  .trim()
  .max(32)
  .regex(/^[+0-9 ()-]*$/)
  .optional()
  .default('');

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(100).optional(),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

// ---------------------------------------------------------------- auth
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(256),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = (min: 'business' | 'superadmin') =>
  z.object({
    token: z.string().min(20).max(200),
    password: min === 'business' ? businessPasswordSchema : superAdminPasswordSchema,
  });

export const changePasswordSchema = (min: 'business' | 'superadmin') =>
  z.object({
    currentPassword: z.string().min(1).max(256),
    newPassword: min === 'business' ? businessPasswordSchema : superAdminPasswordSchema,
  });

export const mfaCodeSchema = z.object({ code: z.string().trim().regex(/^\d{6}$/) });

export const registerBusinessSchema = z.object({
  businessName: name,
  businessType: z.enum(BUSINESS_TYPES),
  ownerName: name,
  email: emailSchema,
  password: businessPasswordSchema,
  phone,
  currency: z.string().trim().length(3).toUpperCase().default('MVR'),
  language: z.enum(LANGUAGE_CODES).default('en'),
});

// ---------------------------------------------------------------- business: me / users / roles
export const preferencesSchema = z
  .object({
    language: z.enum(LANGUAGE_CODES),
    reduceAnimations: z.boolean(),
    theme: z.enum(['system', 'light', 'dark']),
  })
  .partial();

export const createUserSchema = z.object({
  name,
  email: emailSchema,
  phone,
  password: businessPasswordSchema,
  language: z.enum(LANGUAGE_CODES).default('en'),
  roleIds: z.array(z.uuid()).min(1).max(20),
  outletIds: z.array(z.uuid()).max(100).optional(),
  mustChangePassword: z.boolean().default(true),
});

export const updateUserSchema = z
  .object({
    name,
    email: emailSchema,
    phone,
    language: z.enum(LANGUAGE_CODES),
    roleIds: z.array(z.uuid()).min(1).max(20),
    outletIds: z.array(z.uuid()).max(100),
    isActive: z.boolean(),
  })
  .partial();

export const adminSetPasswordSchema = z.object({
  password: businessPasswordSchema,
  mustChangePassword: z.boolean().default(true),
});

export const roleSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: optionalText(300),
  permissions: z.array(z.string().max(64)).max(500),
});

export const businessProfileSchema = z.object({
  name,
  businessType: z.enum(BUSINESS_TYPES),
  email: z.union([emailSchema, z.literal('')]).default(''),
  phone,
  address: optionalText(500),
});

export const outletSchema = z.object({
  name: z.string().trim().min(1).max(80),
  code: z
    .string()
    .trim()
    .max(12)
    .regex(/^[A-Za-z0-9_-]*$/)
    .optional()
    .default(''),
  address: optionalText(500),
  phone,
  isActive: z.boolean().default(true),
});

export const addonConfigSchema = z.object({ config: z.record(z.string(), z.unknown()) });

// ---------------------------------------------------------------- super admin
const limitsSchema = z
  .object(Object.fromEntries(PLAN_LIMIT_KEYS.map((k) => [k, z.number().int().min(0).max(1_000_000).nullable().optional()])))
  .strict();

export const planSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-z][a-z0-9_]*$/),
  name: z.string().trim().min(1).max(80),
  description: optionalText(500),
  priceMonthly: z.number().min(0).max(1_000_000),
  currency: z.string().trim().length(3).toUpperCase(),
  trialDays: z.number().int().min(0).max(365),
  limits: limitsSchema,
  modules: z.array(z.enum(MODULES)).max(MODULES.length),
  isActive: z.boolean().default(true),
  isPublic: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(1000).default(0),
});

export const addonSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-z][a-z0-9_]*$/),
  name: z.string().trim().min(1).max(80),
  description: optionalText(500),
  category: z.string().trim().max(40).default('general'),
  priceMonthly: z.number().min(0).max(1_000_000).nullable().default(null),
  currency: z.string().trim().length(3).toUpperCase().default('USD'),
  isActive: z.boolean().default(true),
});

export const createBusinessSchema = z.object({
  name,
  businessType: z.enum(BUSINESS_TYPES),
  email: z.union([emailSchema, z.literal('')]).default(''),
  phone,
  address: optionalText(500),
  currency: z.string().trim().length(3).toUpperCase().default('MVR'),
  timezone: z.string().trim().min(1).max(64).default('Indian/Maldives'),
  planId: z.uuid(),
  trialDays: z.number().int().min(0).max(365).optional(),
  owner: z.object({
    name,
    email: emailSchema,
    language: z.enum(LANGUAGE_CODES).default('en'),
  }),
});

export const updateBusinessSchema = z
  .object({
    name,
    businessType: z.enum(BUSINESS_TYPES),
    email: z.union([emailSchema, z.literal('')]),
    phone,
    address: z.string().trim().max(500),
  })
  .partial();

export const suspendBusinessSchema = z.object({ reason: z.string().trim().min(3).max(500) });

export const changePlanSchema = z.object({
  planId: z.uuid(),
  status: z.enum(['trialing', 'active']).default('active'),
  /** ISO date; defaults to +30 days (active) or plan trial length (trialing). */
  periodEnd: z.iso.datetime().optional(),
});

export const extendSubscriptionSchema = z.object({ days: z.number().int().min(1).max(3650) });

export const platformSettingsSchema = z
  .object({
    platformName: z.string().trim().min(1).max(80),
    supportEmail: z.union([emailSchema, z.literal('')]),
    registrationMode: z.enum(['open', 'approval', 'closed']),
    defaultPlanCode: z.string().trim().max(40),
    defaultCurrency: z.string().trim().length(3).toUpperCase(),
  })
  .partial();

export const languageUpdateSchema = z.object({ isEnabled: z.boolean().optional(), isDefault: z.boolean().optional() });

export const createSuperAdminSchema = z.object({ name, email: emailSchema });
