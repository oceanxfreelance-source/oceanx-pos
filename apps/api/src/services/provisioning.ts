import { eq, sql } from 'drizzle-orm';
import {
  defaultBusinessSettings,
  isRetailType,
  RETAIL_CASHIER_PERMISSIONS,
  RETAIL_SYSTEM_ROLE_KEYS,
  SYSTEM_ROLE_KEYS,
  SYSTEM_ROLE_TEMPLATES,
  type BusinessType,
  type LanguageCode,
  type SystemRoleKey,
  type Product,
} from '@oceanx/shared';
import type { Executor } from '../db/client';
import { businesses, businessSettings, outlets, plans, rolePermissions, roles, subscriptions, userRoles, users } from '../db/schema';
import { AppError } from '../lib/errors';

export const SYSTEM_ROLE_NAMES: Record<SystemRoleKey, string> = {
  business_admin: 'Business Admin',
  manager: 'Manager',
  salesperson: 'Salesperson',
  cashier: 'Cashier',
  kitchen_staff: 'Kitchen Staff',
  waiter: 'Waiter',
};
/** Shops: the same two roles under shop names. */
const RETAIL_ROLE_NAMES: Partial<Record<SystemRoleKey, string>> = { business_admin: 'Owner', cashier: 'Cashier / Salesperson' };

export function slugify(name: string): string {
  const base = name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return base || 'business';
}

async function uniqueSlug(db: Executor, name: string): Promise<string> {
  const base = slugify(name);
  for (let i = 0; i < 8; i++) {
    const candidate = i === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 7)}`;
    const [hit] = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.slug, candidate)).limit(1);
    if (!hit) return candidate;
  }
  throw new AppError('slug_taken');
}

export async function emailInUse(db: Executor, email: string, exceptUserId?: string): Promise<boolean> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${email.toLowerCase()} AND ${users.deletedAt} IS NULL`)
    .limit(2);
  return rows.some((r) => r.id !== exceptUserId);
}

export interface ProvisionInput {
  /** OceanX product the account is for (default pos). The plan must be for the same product. */
  product?: Product;
  name: string;
  businessType: BusinessType;
  email?: string;
  phone?: string;
  address?: string;
  currency: string;
  timezone?: string;
  status: 'pending' | 'active';
  planId: string;
  /** Overrides plan.trial_days. 0 = start as paid/active for 30 days. */
  trialDays?: number;
  createdBySuperAdminId?: string | null;
  owner: { name: string; email: string; language: LanguageCode; passwordHash: string | null; phone?: string; mustChangePassword?: boolean };
}

/**
 * Create a fully-provisioned tenant in ONE transaction:
 * business + subscription + default outlet + settings + system roles + owner (Business Admin).
 */
const GRAVITY_SYSTEM_ROLE_KEYS: readonly SystemRoleKey[] = ['business_admin'];

export async function provisionBusiness(tx: Executor, input: ProvisionInput) {
  const [plan] = await tx.select().from(plans).where(eq(plans.id, input.planId)).limit(1);
  if (!plan) throw new AppError('validation_failed', 'Unknown plan', { fields: { planId: { code: 'invalid_option' } } });
  const product = input.product ?? 'pos';
  if (plan.product !== product) throw new AppError('validation_failed', 'Plan is for another product', { fields: { planId: { code: 'invalid_option' } } });
  if (await emailInUse(tx, input.owner.email)) throw new AppError('email_taken', 'Email already registered', { fields: { 'owner.email': { code: 'email_taken' } } });

  const now = new Date();
  const [business] = await tx
    .insert(businesses)
    .values({
      name: input.name,
      slug: await uniqueSlug(tx, input.name),
      product,
      businessType: input.businessType,
      status: input.status,
      email: input.email ?? '',
      phone: input.phone ?? '',
      address: input.address ?? '',
      currency: input.currency,
      timezone: input.timezone ?? 'Indian/Maldives',
      approvedAt: input.status === 'active' ? now : null,
      createdBySuperAdminId: input.createdBySuperAdminId ?? null,
    })
    .returning();
  if (!business) throw new AppError('internal_error');

  const trialDays = input.trialDays ?? plan.trialDays;
  const trialing = trialDays > 0;
  await tx.insert(subscriptions).values({
    businessId: business.id,
    planId: plan.id,
    status: trialing ? 'trialing' : 'active',
    startsAt: now,
    currentPeriodEnd: new Date(now.getTime() + (trialing ? trialDays : 30) * 86_400_000),
  });

  const [outlet] = await tx
    .insert(outlets)
    .values({ businessId: business.id, name: 'Main', code: 'MAIN', isDefault: true, address: input.address ?? '', phone: input.phone ?? '' })
    .returning();

  await tx.insert(businessSettings).values({
    businessId: business.id,
    settings: defaultBusinessSettings({ currency: input.currency, timezone: input.timezone }),
  });

  const roleIds: Partial<Record<SystemRoleKey, string>> = {};
  const retail = isRetailType(input.businessType);
  // Gravity (quotations & invoices only) is one person: just the owner's admin role, no POS roles.
  const roleKeys = product === 'gravity' ? GRAVITY_SYSTEM_ROLE_KEYS : retail ? RETAIL_SYSTEM_ROLE_KEYS : SYSTEM_ROLE_KEYS;
  for (const key of roleKeys) {
    const [role] = await tx
      .insert(roles)
      .values({ businessId: business.id, name: (retail && RETAIL_ROLE_NAMES[key]) || SYSTEM_ROLE_NAMES[key], systemKey: key })
      .returning({ id: roles.id });
    if (!role) throw new AppError('internal_error');
    roleIds[key] = role.id;
    const perms = retail && key === 'cashier' ? RETAIL_CASHIER_PERMISSIONS : SYSTEM_ROLE_TEMPLATES[key];
    if (perms.length) await tx.insert(rolePermissions).values(perms.map((permissionKey) => ({ roleId: role.id, permissionKey })));
  }

  const [owner] = await tx
    .insert(users)
    .values({
      businessId: business.id,
      name: input.owner.name,
      email: input.owner.email,
      phone: input.owner.phone ?? '',
      passwordHash: input.owner.passwordHash,
      passwordChangedAt: input.owner.passwordHash ? now : null,
      language: input.owner.language,
      isOwner: true,
      mustChangePassword: input.owner.mustChangePassword ?? false,
      defaultOutletId: outlet?.id ?? null,
    })
    .returning();
  if (!owner) throw new AppError('internal_error');
  await tx.insert(userRoles).values({ businessId: business.id, userId: owner.id, roleId: roleIds.business_admin! });

  return { business, owner, plan, outlet };
}
