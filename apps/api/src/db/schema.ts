import { sql } from 'drizzle-orm';
import type { Translations } from '@oceanx/shared';
import {
  check,
  customType,
  bigint,
  date,
  bigserial,
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const createdAt = () => ts('created_at').notNull().defaultNow();
const updatedAt = () => ts('updated_at').notNull().defaultNow();

// ============================================================ enums
export const businessTypeEnum = pgEnum('business_type', [
  'restaurant',
  'cafe',
  'coffee_shop',
  'bakery',
  'fast_food',
  'juice_shop',
  'dessert_shop',
  'takeaway',
  'retail_shop',
  'supermarket',
  'other',
]);
export const businessStatusEnum = pgEnum('business_status', ['pending', 'active', 'suspended', 'deactivated']);
export const subscriptionStatusEnum = pgEnum('subscription_status', ['trialing', 'active', 'past_due', 'expired', 'cancelled']);
export const addonGrantStatusEnum = pgEnum('addon_grant_status', ['active', 'revoked']);
export const actorTypeEnum = pgEnum('actor_type', ['super_admin', 'user', 'system']);
export const tokenPurposeEnum = pgEnum('token_purpose', ['reset', 'invite']);

// ============================================================ SUPER ADMIN DOMAIN (not tenant data)
export const superAdmins = pgTable(
  'super_admins',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    name: text('name').notNull(),
    passwordHash: text('password_hash'),
    isActive: boolean('is_active').notNull().default(true),
    /** AES-256-GCM encrypted TOTP secret (never stored in plaintext). */
    totpSecretEnc: text('totp_secret_enc'),
    totpEnabled: boolean('totp_enabled').notNull().default(false),
    /** Last accepted TOTP time-step — prevents code replay. */
    totpLastStep: integer('totp_last_step'),
    failedLoginCount: integer('failed_login_count').notNull().default(0),
    lockedUntil: ts('locked_until'),
    lastLoginAt: ts('last_login_at'),
    passwordChangedAt: ts('password_changed_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('super_admins_email_uq').on(sql`lower(${t.email})`)],
);

export const superAdminSessions = pgTable(
  'super_admin_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    superAdminId: uuid('super_admin_id')
      .notNull()
      .references(() => superAdmins.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    csrfToken: text('csrf_token').notNull(),
    mfaPending: boolean('mfa_pending').notNull().default(false),
    /**
     * Signed in from the OceanX Admin phone app: stays signed in (renewed on use), but can only approve or
     * reject payments and read the phone screen's numbers. Everything else needs a normal sign-in.
     */
    phoneApp: boolean('phone_app').notNull().default(false),
    ip: text('ip'),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
    lastSeenAt: ts('last_seen_at').notNull().defaultNow(),
    expiresAt: ts('expires_at').notNull(),
    revokedAt: ts('revoked_at'),
  },
  (t) => [uniqueIndex('super_admin_sessions_token_uq').on(t.tokenHash), index('super_admin_sessions_admin_idx').on(t.superAdminId)],
);

/**
 * OceanX Admin phone app: a key that lets the phone check, in the background, whether payments wait for
 * approval (so it can show a notification while the app is closed). It can only read that count, never act:
 * approving still needs a normal Super Admin sign-in. Stored hashed; removable at any time.
 */
export const superAdminAlertKeys = pgTable(
  'super_admin_alert_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    superAdminId: uuid('super_admin_id')
      .notNull()
      .references(() => superAdmins.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    device: text('device').notNull().default(''),
    createdAt: createdAt(),
    lastUsedAt: ts('last_used_at'),
    revokedAt: ts('revoked_at'),
  },
  (t) => [uniqueIndex('super_admin_alert_keys_token_uq').on(t.tokenHash), index('super_admin_alert_keys_admin_idx').on(t.superAdminId)],
);

export const superAdminTokens = pgTable(
  'super_admin_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    superAdminId: uuid('super_admin_id')
      .notNull()
      .references(() => superAdmins.id, { onDelete: 'cascade' }),
    purpose: tokenPurposeEnum('purpose').notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: ts('expires_at').notNull(),
    usedAt: ts('used_at'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('super_admin_tokens_token_uq').on(t.tokenHash)],
);

export const platformSettings = pgTable('platform_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: updatedAt(),
  updatedBy: uuid('updated_by').references(() => superAdmins.id, { onDelete: 'set null' }),
});

export const platformLanguages = pgTable('platform_languages', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  nativeName: text('native_name').notNull(),
  direction: text('direction').notNull().default('ltr'),
  isEnabled: boolean('is_enabled').notNull().default(true),
  isDefault: boolean('is_default').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
});

// ============================================================ PLATFORM CATALOG
export const plans = pgTable(
  'plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Which OceanX product the plan is for: pos | gravity. */
    product: text('product').notNull().default('pos'),
    code: text('code').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    priceMonthly: numeric('price_monthly', { precision: 12, scale: 2 }).notNull().default('0'),
    currency: text('currency').notNull().default('USD'),
    trialDays: integer('trial_days').notNull().default(0),
    /** Trial length in minutes; when set it is used instead of trial_days (Gravity: days, hours or minutes). */
    trialMinutes: integer('trial_minutes'),
    /** { max_users, max_outlets, ... } — null value = unlimited */
    limits: jsonb('limits').$type<Record<string, number | null>>().notNull().default({}),
    /** Plan-controlled module keys (core modules are always on). */
    modules: text('modules').array().notNull().default(sql`'{}'::text[]`),
    isActive: boolean('is_active').notNull().default(true),
    isPublic: boolean('is_public').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('plans_code_uq').on(t.code)],
);

export const addons = pgTable(
  'addons',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    category: text('category').notNull().default('general'),
    priceMonthly: numeric('price_monthly', { precision: 12, scale: 2 }),
    currency: text('currency').notNull().default('USD'),
    isActive: boolean('is_active').notNull().default(true),
    /** Platform-level configuration (Super Admin). Operational config lives on business_addons. */
    platformConfig: jsonb('platform_config').notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('addons_code_uq').on(t.code)],
);

// ============================================================ TENANTS
export const businesses = pgTable(
  'businesses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    /** Which OceanX product this account uses: pos (OceanX POS) | gravity (quotations & invoices). */
    product: text('product').notNull().default('pos'),
    businessType: businessTypeEnum('business_type').notNull(),
    status: businessStatusEnum('status').notNull().default('pending'),
    email: text('email').notNull().default(''),
    phone: text('phone').notNull().default(''),
    /** Shown on quotations and invoices so customers can reach the business on Viber. */
    viberPhone: text('viber_phone').notNull().default(''),
    /** New features Super Admin has turned on early for this account (e.g. Gravity Budget 'loans'). */
    betaFeatures: text('beta_features').array().notNull().default(sql`'{}'::text[]`),
    address: text('address').notNull().default(''),
    logoPath: text('logo_path'),
    /** Company stamp printed on documents. */
    stampPath: text('stamp_path'),
    currency: text('currency').notNull().default('MVR'),
    timezone: text('timezone').notNull().default('Indian/Maldives'),
    suspensionReason: text('suspension_reason'),
    approvedAt: ts('approved_at'),
    suspendedAt: ts('suspended_at'),
    createdBySuperAdminId: uuid('created_by_super_admin_id').references(() => superAdmins.id, { onDelete: 'set null' }),
    onboardingCompletedAt: ts('onboarding_completed_at'),
    /** Viber credit messaging (optional feature). Sends only when BOTH flags are true. */
    superadminViberCreditEnabled: boolean('superadmin_viber_credit_enabled').notNull().default(false),
    managerViberCreditEnabled: boolean('manager_viber_credit_enabled').notNull().default(false),
    viberCreditRequestedAt: ts('viber_credit_requested_at'),
    /** Country calling code added to local numbers (e.g. 960 for the Maldives). */
    viberCountryCode: text('viber_country_code').notNull().default(''),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: ts('deleted_at'),
  },
  (t) => [
    uniqueIndex('businesses_slug_uq').on(t.slug),
    index('businesses_status_idx').on(t.status),
    index('businesses_type_idx').on(t.businessType),
    index('businesses_created_idx').on(t.createdAt),
  ],
);

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    planId: uuid('plan_id')
      .notNull()
      .references(() => plans.id),
    status: subscriptionStatusEnum('status').notNull(),
    startsAt: ts('starts_at').notNull().defaultNow(),
    currentPeriodEnd: ts('current_period_end').notNull(),
    /** Per-business limit overrides (Custom plans / negotiated deals). */
    customLimits: jsonb('custom_limits').$type<Record<string, number | null>>(),
    notes: text('notes').notNull().default(''),
    /** Gravity Budget "pay on salary day": the salary date the customer chose (once); the app keeps working until just after it. */
    paydayDate: date('payday_date', { mode: 'string' }),
    paydayChosenAt: ts('payday_chosen_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('subscriptions_business_uq').on(t.businessId),
    index('subscriptions_status_idx').on(t.status),
    index('subscriptions_period_end_idx').on(t.currentPeriodEnd),
  ],
);

/**
 * Subscription payments from a business to the platform: a bank-transfer slip uploaded by the owner
 * (pending until the OceanX team approves it) or a payment recorded directly by the team (e.g. cash).
 * Approving extends the subscription by `months`.
 */
export const billingPayments = pgTable(
  'billing_payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    planId: uuid('plan_id')
      .notNull()
      .references(() => plans.id),
    months: integer('months').notNull(),
    /** Minor units of `currency`. */
    amount: bigint('amount', { mode: 'number' }).notNull(),
    currency: text('currency').notNull(),
    method: text('method').notNull(),
    reference: text('reference').notNull().default(''),
    slipPath: text('slip_path'),
    status: text('status').notNull().default('pending'),
    receiptNumber: text('receipt_number'),
    submittedByUser: uuid('submitted_by_user').references(() => users.id, { onDelete: 'set null' }),
    recordedByAdmin: uuid('recorded_by_admin').references(() => superAdmins.id, { onDelete: 'set null' }),
    reviewedBy: uuid('reviewed_by').references(() => superAdmins.id, { onDelete: 'set null' }),
    reviewedAt: ts('reviewed_at'),
    reviewNote: text('review_note').notNull().default(''),
    periodStart: ts('period_start'),
    periodEnd: ts('period_end'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('billing_payments_business_idx').on(t.businessId, t.createdAt), index('billing_payments_status_idx').on(t.status), uniqueIndex('billing_payments_receipt_uq').on(t.receiptNumber)],
);

export const businessAddons = pgTable(
  'business_addons',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    addonId: uuid('addon_id')
      .notNull()
      .references(() => addons.id),
    status: addonGrantStatusEnum('status').notNull().default('active'),
    grantedAt: ts('granted_at').notNull().defaultNow(),
    grantedBy: uuid('granted_by').references(() => superAdmins.id, { onDelete: 'set null' }),
    revokedAt: ts('revoked_at'),
    revokedBy: uuid('revoked_by').references(() => superAdmins.id, { onDelete: 'set null' }),
    expiresAt: ts('expires_at'),
    /** Operational configuration owned by the business (rooms, prices, rules...). */
    config: jsonb('config').notNull().default({}),
    updatedAt: updatedAt(),
  },
  (t) => [unique('business_addons_uq').on(t.businessId, t.addonId), index('business_addons_addon_idx').on(t.addonId, t.status)],
);

export const outlets = pgTable(
  'outlets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    code: text('code').notNull().default(''),
    address: text('address').notNull().default(''),
    phone: text('phone').notNull().default(''),
    isDefault: boolean('is_default').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // (business_id, id) is the target of tenant-consistent composite foreign keys.
    unique('outlets_business_id_uq').on(t.businessId, t.id),
    uniqueIndex('outlets_business_name_uq').on(t.businessId, sql`lower(${t.name})`),
    index('outlets_business_idx').on(t.businessId),
  ],
);

export const businessSettings = pgTable('business_settings', {
  businessId: uuid('business_id')
    .primaryKey()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  settings: jsonb('settings').notNull().default({}),
  updatedAt: updatedAt(),
  updatedBy: uuid('updated_by'),
});

// ============================================================ BUSINESS USERS / RBAC
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    email: text('email').notNull(),
    phone: text('phone').notNull().default(''),
    passwordHash: text('password_hash'),
    language: text('language').notNull().default('en'),
    /** The user's own signature image, printed on documents they prepare. */
    signaturePath: text('signature_path'),
    preferences: jsonb('preferences').$type<{ reduceAnimations?: boolean; theme?: string }>().notNull().default({}),
    isOwner: boolean('is_owner').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    mustChangePassword: boolean('must_change_password').notNull().default(false),
    defaultOutletId: uuid('default_outlet_id'),
    failedLoginCount: integer('failed_login_count').notNull().default(0),
    lockedUntil: ts('locked_until'),
    lastLoginAt: ts('last_login_at'),
    passwordChangedAt: ts('password_changed_at'),
    createdBy: uuid('created_by'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: ts('deleted_at'),
  },
  (t) => [
    // Login identifier: globally unique among non-deleted business users.
    uniqueIndex('users_email_uq')
      .on(sql`lower(${t.email})`)
      .where(sql`${t.deletedAt} IS NULL`),
    unique('users_business_id_uq').on(t.businessId, t.id),
    index('users_business_idx').on(t.businessId),
    foreignKey({ columns: [t.businessId, t.defaultOutletId], foreignColumns: [outlets.businessId, outlets.id], name: 'users_default_outlet_fk' }),
  ],
);

export const userSessions = pgTable(
  'user_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    csrfToken: text('csrf_token').notNull(),
    currentOutletId: uuid('current_outlet_id'),
    ip: text('ip'),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
    lastSeenAt: ts('last_seen_at').notNull().defaultNow(),
    expiresAt: ts('expires_at').notNull(),
    revokedAt: ts('revoked_at'),
    /** Signed in from the Gravity / Gravity Flow phone app: stays signed in (sign in once). */
    longLived: boolean('long_lived').notNull().default(false),
  },
  (t) => [
    uniqueIndex('user_sessions_token_uq').on(t.tokenHash),
    index('user_sessions_user_idx').on(t.userId),
    foreignKey({ columns: [t.businessId, t.userId], foreignColumns: [users.businessId, users.id], name: 'user_sessions_user_fk' }).onDelete(
      'cascade',
    ),
    foreignKey({
      columns: [t.businessId, t.currentOutletId],
      foreignColumns: [outlets.businessId, outlets.id],
      name: 'user_sessions_outlet_fk',
    }).onDelete('set null'),
  ],
);

export const userTokens = pgTable(
  'user_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    purpose: tokenPurposeEnum('purpose').notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: ts('expires_at').notNull(),
    usedAt: ts('used_at'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('user_tokens_token_uq').on(t.tokenHash), index('user_tokens_user_idx').on(t.userId)],
);

/** Permission catalog mirror (synced from @oceanx/shared on migrate/seed). */
export const permissions = pgTable('permissions', {
  key: text('key').primaryKey(),
  module: text('module').notNull(),
  addon: text('addon'),
});

export const roles = pgTable(
  'roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** System template key (business_admin, manager...) — null for custom roles. */
    systemKey: text('system_key'),
    description: text('description').notNull().default(''),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique('roles_business_id_uq').on(t.businessId, t.id),
    uniqueIndex('roles_business_name_uq').on(t.businessId, sql`lower(${t.name})`),
    uniqueIndex('roles_business_system_key_uq')
      .on(t.businessId, t.systemKey)
      .where(sql`${t.systemKey} IS NOT NULL`),
  ],
);

export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionKey: text('permission_key')
      .notNull()
      .references(() => permissions.key, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionKey] })],
);

export const userRoles = pgTable(
  'user_roles',
  {
    businessId: uuid('business_id').notNull(),
    userId: uuid('user_id').notNull(),
    roleId: uuid('role_id').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.roleId] }),
    // Composite FKs guarantee at the database level that a user can only hold roles of their own business.
    foreignKey({ columns: [t.businessId, t.userId], foreignColumns: [users.businessId, users.id], name: 'user_roles_user_fk' }).onDelete('cascade'),
    foreignKey({ columns: [t.businessId, t.roleId], foreignColumns: [roles.businessId, roles.id], name: 'user_roles_role_fk' }).onDelete('cascade'),
    index('user_roles_role_idx').on(t.roleId),
  ],
);

export const userOutlets = pgTable(
  'user_outlets',
  {
    businessId: uuid('business_id').notNull(),
    userId: uuid('user_id').notNull(),
    outletId: uuid('outlet_id').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.outletId] }),
    foreignKey({ columns: [t.businessId, t.userId], foreignColumns: [users.businessId, users.id], name: 'user_outlets_user_fk' }).onDelete('cascade'),
    foreignKey({ columns: [t.businessId, t.outletId], foreignColumns: [outlets.businessId, outlets.id], name: 'user_outlets_outlet_fk' }).onDelete(
      'cascade',
    ),
  ],
);

// ============================================================ DOCUMENT NUMBERING
/**
 * Concurrency-safe counters. A number is allocated with a single atomic
 * INSERT ... ON CONFLICT DO UPDATE ... RETURNING statement (row-level lock),
 * scoped per business + scope (outlet or "business") + document type + period.
 */
export const documentSequences = pgTable(
  'document_sequences',
  {
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    scope: text('scope').notNull(),
    docType: text('doc_type').notNull(),
    period: text('period').notNull(),
    lastNumber: integer('last_number').notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.scope, t.docType, t.period] })],
);

// ============================================================ AUDIT
export const activityLogs = pgTable(
  'activity_logs',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    actorType: actorTypeEnum('actor_type').notNull(),
    actorId: uuid('actor_id'),
    actorName: text('actor_name'),
    businessId: uuid('business_id').references(() => businesses.id, { onDelete: 'cascade' }),
    action: text('action').notNull(),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    metadata: jsonb('metadata').notNull().default({}),
    ip: text('ip'),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
  },
  (t) => [
    index('activity_logs_business_created_idx').on(t.businessId, t.createdAt),
    index('activity_logs_actor_created_idx').on(t.actorType, t.createdAt),
    index('activity_logs_action_idx').on(t.action),
  ],
);

// =====================================================================================
// OPERATIONS (Phases 2–5). Every table carries business_id; outlet-bound tables carry
// outlet_id. Money columns are integer MINOR units (bigint); quantities are numeric(14,3).
// Composite FKs to (business_id, id) keep references inside one tenant at the DB level.
// =====================================================================================
const money = (name: string) => bigint(name, { mode: 'number' });
const qty = (name: string) => numeric(name, { precision: 14, scale: 3, mode: 'number' });
const tenantFk = <T extends { businessId: unknown }>(name: string, t: T, col: unknown, target: { businessId: unknown; id: unknown }) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  foreignKey({ columns: [t.businessId as any, col as any], foreignColumns: [target.businessId as any, target.id as any], name });

export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    translations: jsonb('translations').$type<Translations>().notNull().default({}),
    description: text('description').notNull().default(''),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    kitchenStation: text('kitchen_station').notNull().default(''),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique('categories_business_id_uq').on(t.businessId, t.id), uniqueIndex('categories_business_name_uq').on(t.businessId, sql`lower(${t.name})`)],
);

export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id'),
    name: text('name').notNull(),
    translations: jsonb('translations').$type<Translations>().notNull().default({}),
    sku: text('sku').notNull().default(''),
    description: text('description').notNull().default(''),
    unit: text('unit').notNull().default('pcs'),
    type: text('type').notNull().default('item'),
    costPrice: money('cost_price').notNull().default(0),
    sellingPrice: money('selling_price').notNull().default(0),
    taxRate: numeric('tax_rate', { precision: 6, scale: 3, mode: 'number' }),
    /** GST type: standard (taxed), zero_rated (0%, input tax claimable) or exempt (no GST, not claimable). */
    gstType: text('gst_type').notNull().default('standard'),
    trackStock: boolean('track_stock').notNull().default(false),
    minStock: qty('min_stock').notNull().default(0),
    /** Shops: alert when the stock room falls to this level (minStock is the rack alert). */
    minStoreStock: qty('min_store_stock').notNull().default(0),
    /** Shops: pieces in one case / pack as it sits in the store (1 = sold and stored singly). */
    packSize: qty('pack_size').notNull().default(1),
    isActive: boolean('is_active').notNull().default(true),
    showInPos: boolean('show_in_pos').notNull().default(true),
    showInMenu: boolean('show_in_menu').notNull().default(true),
    sendToKitchen: boolean('send_to_kitchen').notNull().default(true),
    /** Position on the customer QR menu (lower first, then name). */
    menuSort: integer('menu_sort').notNull().default(0),
    options: jsonb('options').$type<{ name: string; required: boolean; multiple: boolean; choices: { name: string; price: number }[] }[]>().notNull().default([]),
    imagePath: text('image_path'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: ts('deleted_at'),
  },
  (t) => [
    unique('products_business_id_uq').on(t.businessId, t.id),
    uniqueIndex('products_business_sku_uq')
      .on(t.businessId, sql`lower(${t.sku})`)
      .where(sql`${t.sku} <> '' AND ${t.deletedAt} IS NULL`),
    index('products_business_category_idx').on(t.businessId, t.categoryId),
    index('products_business_name_idx').on(t.businessId, t.name),
    tenantFk('products_category_fk', t, t.categoryId, categories).onDelete('set null'),
  ],
);

export const stockLevels = pgTable(
  'stock_levels',
  {
    businessId: uuid('business_id').notNull(),
    outletId: uuid('outlet_id').notNull(),
    productId: uuid('product_id').notNull(),
    /** On the shop floor / rack (what the POS sells from). */
    quantity: qty('quantity').notNull().default(0),
    /** Shops: in the stock room / store behind the shop (purchases arrive here; refills move it to the rack). */
    storeQuantity: qty('store_quantity').notNull().default(0),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.outletId, t.productId] }),
    index('stock_levels_business_idx').on(t.businessId, t.productId),
    tenantFk('stock_levels_outlet_fk', t, t.outletId, outlets).onDelete('cascade'),
    tenantFk('stock_levels_product_fk', t, t.productId, products).onDelete('cascade'),
  ],
);

export const inventoryTransactions = pgTable(
  'inventory_transactions',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    businessId: uuid('business_id').notNull(),
    outletId: uuid('outlet_id').notNull(),
    productId: uuid('product_id').notNull(),
    type: text('type').notNull(), // sale | sale_void | purchase | adjustment | wastage | count | transfer_in | transfer_out | recipe
    quantity: qty('quantity').notNull(), // signed change
    balanceAfter: qty('balance_after').notNull(),
    /** shop (rack) | store (stock room) */
    location: text('location').notNull().default('shop'),
    unitCost: money('unit_cost').notNull().default(0),
    referenceType: text('reference_type'),
    referenceId: text('reference_id'),
    note: text('note').notNull().default(''),
    userId: uuid('user_id'),
    createdAt: createdAt(),
  },
  (t) => [
    index('inventory_tx_business_product_idx').on(t.businessId, t.productId, t.createdAt),
    index('inventory_tx_business_created_idx').on(t.businessId, t.createdAt),
    tenantFk('inventory_tx_outlet_fk', t, t.outletId, outlets).onDelete('cascade'),
    tenantFk('inventory_tx_product_fk', t, t.productId, products).onDelete('cascade'),
  ],
);

export const recipeItems = pgTable(
  'recipe_items',
  {
    businessId: uuid('business_id').notNull(),
    productId: uuid('product_id').notNull(),
    ingredientId: uuid('ingredient_id').notNull(),
    quantity: qty('quantity').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.productId, t.ingredientId] }),
    tenantFk('recipe_items_product_fk', t, t.productId, products).onDelete('cascade'),
    tenantFk('recipe_items_ingredient_fk', t, t.ingredientId, products).onDelete('cascade'),
  ],
);

export const customers = pgTable(
  'customers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    phone: text('phone').notNull().default(''),
    email: text('email').notNull().default(''),
    company: text('company').notNull().default(''),
    /** person | company | government (councils, ministries: paid by PO and payment voucher). */
    kind: text('kind').notNull().default('person'),
    address: text('address').notNull().default(''),
    taxNumber: text('tax_number').notNull().default(''),
    notes: text('notes').notNull().default(''),
    creditLimit: money('credit_limit'),
    creditDays: integer('credit_days'),
    loyaltyPoints: integer('loyalty_points').notNull().default(0),
    /** Registered Viber number for credit messages (falls back to `phone` when empty). */
    viberPhone: text('viber_phone').notNull().default(''),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: ts('deleted_at'),
  },
  (t) => [
    unique('customers_business_id_uq').on(t.businessId, t.id),
    index('customers_business_name_idx').on(t.businessId, t.name),
    index('customers_business_phone_idx').on(t.businessId, t.phone),
  ],
);

export const diningTables = pgTable(
  'dining_tables',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id').notNull(),
    outletId: uuid('outlet_id').notNull(),
    name: text('name').notNull(),
    capacity: integer('capacity').notNull().default(4),
    area: text('area').notNull().default(''),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique('tables_business_id_uq').on(t.businessId, t.id),
    uniqueIndex('tables_outlet_name_uq').on(t.outletId, sql`lower(${t.name})`),
    tenantFk('tables_outlet_fk', t, t.outletId, outlets).onDelete('cascade'),
  ],
);

export const sales = pgTable(
  'sales',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id').notNull(),
    outletId: uuid('outlet_id').notNull(),
    number: text('number'),
    status: text('status').notNull().default('open'), // open | completed | void
    source: text('source').notNull().default('pos'), // pos | online
    orderType: text('order_type').notNull().default('dine_in'),
    tableId: uuid('table_id'),
    customerId: uuid('customer_id'),
    cashierId: uuid('cashier_id'),
    currency: text('currency').notNull(),
    subtotal: money('subtotal').notNull().default(0),
    discount: money('discount').notNull().default(0),
    serviceCharge: money('service_charge').notNull().default(0),
    tax: money('tax').notNull().default(0),
    deliveryFee: money('delivery_fee').notNull().default(0),
    pointsDiscount: money('points_discount').notNull().default(0),
    total: money('total').notNull().default(0),
    paidAmount: money('paid_amount').notNull().default(0),
    changeAmount: money('change_amount').notNull().default(0),
    balanceDue: money('balance_due').notNull().default(0),
    pointsRedeemed: integer('points_redeemed').notNull().default(0),
    pointsEarned: integer('points_earned').notNull().default(0),
    /** Money given back on this bill (Refunds add-on), incl. tax. */
    refundedTotal: money('refunded_total').notNull().default(0),
    note: text('note').notNull().default(''),
    delivery: jsonb('delivery').$type<{ address: string; phone: string } | null>(),
    onlineCustomer: jsonb('online_customer').$type<{ name: string; phone: string; tableName?: string } | null>(),
    voidReason: text('void_reason'),
    voidedBy: uuid('voided_by'),
    voidedAt: ts('voided_at'),
    completedAt: ts('completed_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique('sales_business_id_uq').on(t.businessId, t.id),
    uniqueIndex('sales_business_number_uq')
      .on(t.businessId, t.number)
      .where(sql`${t.number} IS NOT NULL`),
    index('sales_business_created_idx').on(t.businessId, t.createdAt),
    index('sales_business_status_idx').on(t.businessId, t.status),
    index('sales_business_customer_idx').on(t.businessId, t.customerId),
    tenantFk('sales_outlet_fk', t, t.outletId, outlets),
    tenantFk('sales_customer_fk', t, t.customerId, customers),
    tenantFk('sales_table_fk', t, t.tableId, diningTables).onDelete('set null'),
  ],
);

export const saleItems = pgTable(
  'sale_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id').notNull(),
    saleId: uuid('sale_id').notNull(),
    productId: uuid('product_id'),
    categoryId: uuid('category_id'),
    nameSnapshot: text('name_snapshot').notNull(),
    skuSnapshot: text('sku_snapshot').notNull().default(''),
    quantity: qty('quantity').notNull(),
    unitPrice: money('unit_price').notNull(),
    options: jsonb('options').$type<{ group: string; choice: string; price: number }[]>().notNull().default([]),
    discount: money('discount').notNull().default(0),
    taxRate: numeric('tax_rate', { precision: 6, scale: 3, mode: 'number' }).notNull().default(0),
    /** The product's GST type when sold (standard / zero_rated / exempt), for the GST return. */
    gstType: text('gst_type').notNull().default('standard'),
    tax: money('tax').notNull().default(0),
    total: money('total').notNull(),
    costPrice: money('cost_price').notNull().default(0),
    note: text('note').notNull().default(''),
    sendToKitchen: boolean('send_to_kitchen').notNull().default(true),
  },
  (t) => [
    index('sale_items_sale_idx').on(t.saleId),
    index('sale_items_business_product_idx').on(t.businessId, t.productId),
    tenantFk('sale_items_sale_fk', t, t.saleId, sales).onDelete('cascade'),
  ],
);

/**
 * End-of-day cash closing at one outlet: what came in since the last closing (by payment method), the cash that
 * should be in the drawer, what was counted, and the difference. The float kept starts the next closing.
 */
export const cashClosings = pgTable(
  'cash_closings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    outletId: uuid('outlet_id').notNull(),
    number: integer('number').notNull(),
    periodStart: ts('period_start').notNull(),
    periodEnd: ts('period_end').notNull(),
    salesCount: integer('sales_count').notNull().default(0),
    salesTotal: money('sales_total').notNull().default(0),
    /** Money received at this outlet in the period, by method (cash is what was handed over, before change). */
    byMethod: jsonb('by_method').$type<Record<string, number>>().notNull().default({}),
    openingFloat: money('opening_float').notNull().default(0),
    cashIn: money('cash_in').notNull().default(0),
    changeGiven: money('change_given').notNull().default(0),
    cashRefunds: money('cash_refunds').notNull().default(0),
    expectedCash: money('expected_cash').notNull().default(0),
    countedCash: money('counted_cash').notNull().default(0),
    /** counted − expected: below zero is a shortage. */
    difference: money('difference').notNull().default(0),
    /** Cash left in the drawer for the next day (the next closing's opening float). */
    keptFloat: money('kept_float').notNull().default(0),
    note: text('note').notNull().default(''),
    closedBy: uuid('closed_by'),
    createdAt: createdAt(),
  },
  (t) => [
    unique('cash_closings_business_id_uq').on(t.businessId, t.id),
    uniqueIndex('cash_closings_outlet_number_uq').on(t.businessId, t.outletId, t.number),
    index('cash_closings_outlet_end_idx').on(t.businessId, t.outletId, t.periodEnd),
  ],
);

/** A refund on a completed bill (Refunds & Returns add-on): some or all items, money back, optional restock. */
export const saleRefunds = pgTable(
  'sale_refunds',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id').notNull(),
    outletId: uuid('outlet_id').notNull(),
    saleId: uuid('sale_id').notNull(),
    number: text('number').notNull(),
    reason: text('reason').notNull().default(''),
    method: text('method').notNull(),
    /** Amount given back, incl. tax and service charge. */
    total: money('total').notNull(),
    /** Part of `total` that is tax (reduces output GST). */
    tax: money('tax').notNull().default(0),
    restocked: boolean('restocked').notNull().default(true),
    createdBy: uuid('created_by'),
    createdAt: createdAt(),
  },
  (t) => [
    unique('sale_refunds_business_id_uq').on(t.businessId, t.id),
    uniqueIndex('sale_refunds_business_number_uq').on(t.businessId, t.number),
    index('sale_refunds_sale_idx').on(t.saleId),
    index('sale_refunds_business_created_idx').on(t.businessId, t.createdAt),
    tenantFk('sale_refunds_sale_fk', t, t.saleId, sales).onDelete('cascade'),
  ],
);

export const saleRefundItems = pgTable(
  'sale_refund_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id').notNull(),
    refundId: uuid('refund_id').notNull(),
    saleItemId: uuid('sale_item_id').notNull(),
    nameSnapshot: text('name_snapshot').notNull(),
    quantity: qty('quantity').notNull(),
    taxRate: numeric('tax_rate', { precision: 6, scale: 3, mode: 'number' }).notNull().default(0),
    /** Net of tax, before service charge. */
    net: money('net').notNull(),
    tax: money('tax').notNull().default(0),
  },
  (t) => [index('sale_refund_items_refund_idx').on(t.refundId), index('sale_refund_items_item_idx').on(t.saleItemId), tenantFk('sale_refund_items_refund_fk', t, t.refundId, saleRefunds).onDelete('cascade')],
);

export const kitchenOrders = pgTable(
  'kitchen_orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id').notNull(),
    outletId: uuid('outlet_id').notNull(),
    saleId: uuid('sale_id').notNull(),
    ticketNumber: integer('ticket_number').notNull(),
    status: text('status').notNull().default('new'),
    orderType: text('order_type').notNull(),
    tableName: text('table_name'),
    station: text('station').notNull().default(''),
    priority: integer('priority').notNull().default(0),
    items: jsonb('items').$type<{ name: string; quantity: number; options: string[]; note: string }[]>().notNull(),
    note: text('note').notNull().default(''),
    createdAt: createdAt(),
    startedAt: ts('started_at'),
    readyAt: ts('ready_at'),
    completedAt: ts('completed_at'),
  },
  (t) => [
    index('kitchen_orders_outlet_status_idx').on(t.businessId, t.outletId, t.status, t.createdAt),
    tenantFk('kitchen_orders_sale_fk', t, t.saleId, sales).onDelete('cascade'),
  ],
);

export const quotations = pgTable(
  'quotations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id').notNull(),
    outletId: uuid('outlet_id'),
    number: text('number').notNull(),
    customerId: uuid('customer_id').notNull(),
    quotationDate: text('quotation_date').notNull(),
    validUntil: text('valid_until').notNull(),
    /** The customer's own reference: purchase order (PO) / tender number. */
    customerRef: text('customer_ref').notNull().default(''),
    salespersonId: uuid('salesperson_id'),
    status: text('status').notNull().default('draft'),
    language: text('language'),
    notes: text('notes').notNull().default(''),
    terms: text('terms').notNull().default(''),
    currency: text('currency').notNull(),
    subtotal: money('subtotal').notNull().default(0),
    discount: money('discount').notNull().default(0),
    orderDiscount: money('order_discount').notNull().default(0),
    serviceCharge: money('service_charge').notNull().default(0),
    tax: money('tax').notNull().default(0),
    total: money('total').notNull().default(0),
    taxConfig: jsonb('tax_config').notNull(),
    createdBy: uuid('created_by'),
    updatedBy: uuid('updated_by'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique('quotations_business_id_uq').on(t.businessId, t.id),
    uniqueIndex('quotations_business_number_uq').on(t.businessId, t.number),
    index('quotations_business_status_idx').on(t.businessId, t.status),
    index('quotations_business_customer_idx').on(t.businessId, t.customerId),
    tenantFk('quotations_customer_fk', t, t.customerId, customers),
  ],
);

export const quotationItems = pgTable(
  'quotation_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id').notNull(),
    quotationId: uuid('quotation_id').notNull(),
    position: integer('position').notNull(),
    productId: uuid('product_id'),
    itemNameSnapshot: text('item_name_snapshot').notNull(),
    description: text('description').notNull().default(''),
    quantity: qty('quantity').notNull(),
    unit: text('unit').notNull().default('pcs'),
    unitPrice: money('unit_price').notNull(),
    discount: money('discount').notNull().default(0),
    taxRate: numeric('tax_rate', { precision: 6, scale: 3, mode: 'number' }),
    tax: money('tax').notNull().default(0),
    total: money('total').notNull(),
  },
  (t) => [index('quotation_items_q_idx').on(t.quotationId), tenantFk('quotation_items_q_fk', t, t.quotationId, quotations).onDelete('cascade')],
);

export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id').notNull(),
    outletId: uuid('outlet_id'),
    number: text('number').notNull(),
    customerId: uuid('customer_id').notNull(),
    invoiceDate: text('invoice_date').notNull(),
    dueDate: text('due_date').notNull(),
    /** The customer's own reference: purchase order (PO) / tender number. */
    customerRef: text('customer_ref').notNull().default(''),
    salespersonId: uuid('salesperson_id'),
    status: text('status').notNull().default('draft'),
    sourceQuotationId: uuid('source_quotation_id'),
    language: text('language'),
    notes: text('notes').notNull().default(''),
    terms: text('terms').notNull().default(''),
    currency: text('currency').notNull(),
    subtotal: money('subtotal').notNull().default(0),
    discount: money('discount').notNull().default(0),
    orderDiscount: money('order_discount').notNull().default(0),
    serviceCharge: money('service_charge').notNull().default(0),
    tax: money('tax').notNull().default(0),
    total: money('total').notNull().default(0),
    paidAmount: money('paid_amount').notNull().default(0),
    balanceDue: money('balance_due').notNull().default(0),
    taxConfig: jsonb('tax_config').notNull(),
    voidReason: text('void_reason'),
    issuedAt: ts('issued_at'),
    createdBy: uuid('created_by'),
    updatedBy: uuid('updated_by'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique('invoices_business_id_uq').on(t.businessId, t.id),
    uniqueIndex('invoices_business_number_uq').on(t.businessId, t.number),
    uniqueIndex('invoices_source_quotation_uq')
      .on(t.sourceQuotationId)
      .where(sql`${t.sourceQuotationId} IS NOT NULL`),
    index('invoices_business_status_idx').on(t.businessId, t.status),
    index('invoices_business_customer_idx').on(t.businessId, t.customerId),
    tenantFk('invoices_customer_fk', t, t.customerId, customers),
  ],
);

export const invoiceItems = pgTable(
  'invoice_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id').notNull(),
    invoiceId: uuid('invoice_id').notNull(),
    position: integer('position').notNull(),
    productId: uuid('product_id'),
    itemNameSnapshot: text('item_name_snapshot').notNull(),
    description: text('description').notNull().default(''),
    quantity: qty('quantity').notNull(),
    unit: text('unit').notNull().default('pcs'),
    unitPrice: money('unit_price').notNull(),
    discount: money('discount').notNull().default(0),
    taxRate: numeric('tax_rate', { precision: 6, scale: 3, mode: 'number' }),
    tax: money('tax').notNull().default(0),
    total: money('total').notNull(),
  },
  (t) => [index('invoice_items_i_idx').on(t.invoiceId), tenantFk('invoice_items_i_fk', t, t.invoiceId, invoices).onDelete('cascade')],
);

/** One payments table for POS sales, credit payments and invoice payments (single financial ledger). */
export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id').notNull(),
    outletId: uuid('outlet_id'),
    customerId: uuid('customer_id'),
    saleId: uuid('sale_id'),
    invoiceId: uuid('invoice_id'),
    bookingId: uuid('booking_id'),
    kind: text('kind').notNull(), // sale | credit_payment | invoice | booking
    method: text('method').notNull(),
    amount: money('amount').notNull(),
    reference: text('reference').notNull().default(''),
    notes: text('notes').notNull().default(''),
    receivedBy: uuid('received_by'),
    paidAt: ts('paid_at').notNull().defaultNow(),
    voidedAt: ts('voided_at'),
    /** One customer due payment spread over several bills shares a group (for its receipt). */
    groupId: uuid('group_id'),
    /** Customer's total remaining due right after that payment. */
    balanceAfter: money('balance_after'),
    createdAt: createdAt(),
  },
  (t) => [
    index('payments_group_idx').on(t.groupId),
    index('payments_business_paid_idx').on(t.businessId, t.paidAt),
    index('payments_sale_idx').on(t.saleId),
    index('payments_invoice_idx').on(t.invoiceId),
    index('payments_business_customer_idx').on(t.businessId, t.customerId),
    tenantFk('payments_sale_fk', t, t.saleId, sales).onDelete('cascade'),
    tenantFk('payments_invoice_fk', t, t.invoiceId, invoices).onDelete('cascade'),
    tenantFk('payments_customer_fk', t, t.customerId, customers),
  ],
);

export const suppliers = pgTable(
  'suppliers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    phone: text('phone').notNull().default(''),
    email: text('email').notNull().default(''),
    /** Supplier's GST TIN, for the input tax statement. */
    taxNumber: text('tax_number').notNull().default(''),
    address: text('address').notNull().default(''),
    notes: text('notes').notNull().default(''),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique('suppliers_business_id_uq').on(t.businessId, t.id), index('suppliers_business_name_idx').on(t.businessId, t.name)],
);

export const purchases = pgTable(
  'purchases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id').notNull(),
    outletId: uuid('outlet_id').notNull(),
    supplierId: uuid('supplier_id').notNull(),
    number: text('number').notNull(),
    purchaseDate: text('purchase_date').notNull(),
    status: text('status').notNull().default('draft'), // draft | received | cancelled
    paymentStatus: text('payment_status').notNull().default('unpaid'),
    total: money('total').notNull().default(0),
    /** GST included in `total` (input tax), from the supplier's tax invoice. */
    tax: money('tax').notNull().default(0),
    paidAmount: money('paid_amount').notNull().default(0),
    reference: text('reference').notNull().default(''),
    notes: text('notes').notNull().default(''),
    receivedAt: ts('received_at'),
    createdBy: uuid('created_by'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique('purchases_business_id_uq').on(t.businessId, t.id),
    uniqueIndex('purchases_business_number_uq').on(t.businessId, t.number),
    index('purchases_business_supplier_idx').on(t.businessId, t.supplierId),
    tenantFk('purchases_supplier_fk', t, t.supplierId, suppliers),
    tenantFk('purchases_outlet_fk', t, t.outletId, outlets),
  ],
);

export const purchaseItems = pgTable(
  'purchase_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id').notNull(),
    purchaseId: uuid('purchase_id').notNull(),
    productId: uuid('product_id').notNull(),
    nameSnapshot: text('name_snapshot').notNull(),
    quantity: qty('quantity').notNull(),
    unitCost: money('unit_cost').notNull(),
    total: money('total').notNull(),
  },
  (t) => [
    index('purchase_items_p_idx').on(t.purchaseId),
    tenantFk('purchase_items_p_fk', t, t.purchaseId, purchases).onDelete('cascade'),
    tenantFk('purchase_items_product_fk', t, t.productId, products),
  ],
);

export const expenses = pgTable(
  'expenses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id').notNull(),
    outletId: uuid('outlet_id').notNull(),
    category: text('category').notNull(),
    amount: money('amount').notNull(),
    /** GST included in `amount` (input tax), from the supplier's tax invoice. */
    tax: money('tax').notNull().default(0),
    /** TIN on the supplier's tax invoice (input tax statement). */
    supplierTin: text('supplier_tin').notNull().default(''),
    expenseDate: text('expense_date').notNull(),
    paymentMethod: text('payment_method').notNull(),
    payee: text('payee').notNull().default(''),
    reference: text('reference').notNull().default(''),
    notes: text('notes').notNull().default(''),
    attachmentPath: text('attachment_path'),
    createdBy: uuid('created_by'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: ts('deleted_at'),
  },
  (t) => [
    unique('expenses_business_id_uq').on(t.businessId, t.id),
    index('expenses_business_date_idx').on(t.businessId, t.expenseDate),
    tenantFk('expenses_outlet_fk', t, t.outletId, outlets),
  ],
);

export const stockTransfers = pgTable(
  'stock_transfers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id').notNull(),
    fromOutletId: uuid('from_outlet_id').notNull(),
    toOutletId: uuid('to_outlet_id').notNull(),
    items: jsonb('items').$type<{ productId: string; name: string; quantity: number }[]>().notNull(),
    notes: text('notes').notNull().default(''),
    createdBy: uuid('created_by'),
    createdAt: createdAt(),
  },
  (t) => [
    index('stock_transfers_business_idx').on(t.businessId, t.createdAt),
    tenantFk('stock_transfers_from_fk', t, t.fromOutletId, outlets),
    tenantFk('stock_transfers_to_fk', t, t.toOutletId, outlets),
  ],
);

export const karaokeRooms = pgTable(
  'karaoke_rooms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id').notNull(),
    outletId: uuid('outlet_id').notNull(),
    name: text('name').notNull(),
    capacity: integer('capacity').notNull(),
    hourlyRate: money('hourly_rate').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    notes: text('notes').notNull().default(''),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique('karaoke_rooms_business_id_uq').on(t.businessId, t.id), tenantFk('karaoke_rooms_outlet_fk', t, t.outletId, outlets)],
);

export const karaokeBookings = pgTable(
  'karaoke_bookings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id').notNull(),
    outletId: uuid('outlet_id').notNull(),
    roomId: uuid('room_id').notNull(),
    customerId: uuid('customer_id'),
    customerName: text('customer_name').notNull(),
    customerPhone: text('customer_phone').notNull().default(''),
    startAt: ts('start_at').notNull(),
    endAt: ts('end_at').notNull(),
    hourlyRate: money('hourly_rate').notNull(),
    total: money('total').notNull(),
    deposit: money('deposit').notNull().default(0),
    paidAmount: money('paid_amount').notNull().default(0),
    status: text('status').notNull().default('booked'),
    notes: text('notes').notNull().default(''),
    createdBy: uuid('created_by'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('karaoke_bookings_room_time_idx').on(t.roomId, t.startAt),
    tenantFk('karaoke_bookings_room_fk', t, t.roomId, karaokeRooms).onDelete('cascade'),
    tenantFk('karaoke_bookings_customer_fk', t, t.customerId, customers),
  ],
);

export const reservations = pgTable(
  'reservations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id').notNull(),
    outletId: uuid('outlet_id').notNull(),
    tableId: uuid('table_id'),
    customerName: text('customer_name').notNull(),
    phone: text('phone').notNull().default(''),
    partySize: integer('party_size').notNull(),
    reservedAt: ts('reserved_at').notNull(),
    durationMinutes: integer('duration_minutes').notNull().default(90),
    status: text('status').notNull().default('booked'),
    notes: text('notes').notNull().default(''),
    createdBy: uuid('created_by'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('reservations_outlet_time_idx').on(t.businessId, t.outletId, t.reservedAt),
    tenantFk('reservations_table_fk', t, t.tableId, diningTables).onDelete('set null'),
  ],
);

export const loyaltyTransactions = pgTable(
  'loyalty_transactions',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    businessId: uuid('business_id').notNull(),
    customerId: uuid('customer_id').notNull(),
    points: integer('points').notNull(),
    balanceAfter: integer('balance_after').notNull(),
    reason: text('reason').notNull(),
    saleId: uuid('sale_id'),
    createdBy: uuid('created_by'),
    createdAt: createdAt(),
  },
  (t) => [index('loyalty_tx_customer_idx').on(t.businessId, t.customerId, t.createdAt), tenantFk('loyalty_tx_customer_fk', t, t.customerId, customers).onDelete('cascade')],
);

export const notifications = pgTable(
  'notifications',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    businessId: uuid('business_id').notNull(),
    userId: uuid('user_id').notNull(),
    key: text('key').notNull(),
    params: jsonb('params').notNull().default({}),
    link: text('link'),
    readAt: ts('read_at'),
    createdAt: createdAt(),
  },
  (t) => [
    index('notifications_user_idx').on(t.userId, t.readAt, t.createdAt),
    foreignKey({ columns: [t.businessId, t.userId], foreignColumns: [users.businessId, users.id], name: 'notifications_user_fk' }).onDelete('cascade'),
  ],
);

// ---------------------------------------------------------------- file storage (optional DB backend)
const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' });

/**
 * Uploaded files when STORAGE_DRIVER=db (serverless deployments without a persistent disk).
 * `path` is the same server-generated relative path the filesystem backend uses
 * (businesses/<businessId>/<kind>-<random>.<ext>); reads are authorised by the owning row first.
 */
export const storedFiles = pgTable('stored_files', {
  path: text('path').primaryKey(),
  data: bytea('data').notNull(),
  size: integer('size').notNull(),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------- outbound messages (Viber credit notifications)
/** Every Viber credit message attempt, for audit and troubleshooting. Body is exactly what was sent. */
export const messageLog = pgTable(
  'message_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    saleId: uuid('sale_id'),
    customerId: uuid('customer_id'),
    channel: text('channel').notNull(), // viber
    recipient: text('recipient').notNull(),
    body: text('body').notNull(),
    status: text('status').notNull(), // queued | sent | failed
    providerMessageId: text('provider_message_id'),
    error: text('error'),
    createdAt: createdAt(),
    sentAt: ts('sent_at'),
  },
  (t) => [index('message_log_business_idx').on(t.businessId, t.createdAt), uniqueIndex('message_log_sale_channel_uq').on(t.saleId, t.channel)],
);

// ================================================================ add-on requests (business → Super Admin)
/** A business asking the platform to enable an add-on. Removed when the add-on is granted. */
export const addonRequests = pgTable(
  'addon_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    addonId: uuid('addon_id')
      .notNull()
      .references(() => addons.id, { onDelete: 'cascade' }),
    requestedBy: uuid('requested_by'),
    note: text('note').notNull().default(''),
    createdAt: createdAt(),
  },
  (t) => [unique('addon_requests_uq').on(t.businessId, t.addonId)],
);

// ================================================================ staff, payroll (add-on) and duty rota (add-on)
/** People who work at the business (they do not need a login). Shared by payroll and the duty rota. */
export const staffMembers = pgTable(
  'staff_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    position: text('position').notNull().default(''),
    phone: text('phone').notNull().default(''),
    basicSalary: money('basic_salary').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    notes: text('notes').notNull().default(''),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: ts('deleted_at'),
  },
  (t) => [unique('staff_members_business_id_uq').on(t.businessId, t.id), index('staff_members_business_idx').on(t.businessId)],
);

/** One salary sheet per business per month (period YYYY-MM). Finalized sheets are locked. */
export const payrollRuns = pgTable(
  'payroll_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    period: text('period').notNull(),
    status: text('status').notNull().default('draft'), // draft | finalized
    notes: text('notes').notNull().default(''),
    totalNet: money('total_net').notNull().default(0),
    expenseId: uuid('expense_id'),
    createdBy: uuid('created_by'),
    finalizedAt: ts('finalized_at'),
    finalizedBy: uuid('finalized_by'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique('payroll_runs_business_id_uq').on(t.businessId, t.id), unique('payroll_runs_business_period_uq').on(t.businessId, t.period)],
);

export const payrollLines = pgTable(
  'payroll_lines',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id').notNull(),
    runId: uuid('run_id').notNull(),
    staffId: uuid('staff_id'),
    name: text('name').notNull(),
    position: text('position').notNull().default(''),
    basic: money('basic').notNull().default(0),
    allowances: money('allowances').notNull().default(0),
    overtime: money('overtime').notNull().default(0),
    deductions: money('deductions').notNull().default(0),
    advance: money('advance').notNull().default(0),
    net: money('net').notNull().default(0),
    notes: text('notes').notNull().default(''),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [
    index('payroll_lines_run_idx').on(t.runId),
    tenantFk('payroll_lines_run_fk', t, t.runId, payrollRuns).onDelete('cascade'),
    tenantFk('payroll_lines_staff_fk', t, t.staffId, staffMembers).onDelete('set null'),
  ],
);

/** Shift templates for the duty rota (e.g. Morning 08:00–16:00). */
export const rotaShifts = pgTable(
  'rota_shifts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    startTime: text('start_time').notNull(),
    endTime: text('end_time').notNull(),
    color: text('color').notNull().default('sky'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique('rota_shifts_business_id_uq').on(t.businessId, t.id)],
);

/** One cell of the duty rota: what a staff member does on a date (a shift, day off or leave). */
export const rotaEntries = pgTable(
  'rota_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id').notNull(),
    staffId: uuid('staff_id').notNull(),
    date: text('date').notNull(),
    kind: text('kind').notNull(), // shift | off | leave
    shiftId: uuid('shift_id'),
    note: text('note').notNull().default(''),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('rota_entries_staff_date_uq').on(t.businessId, t.staffId, t.date),
    index('rota_entries_business_date_idx').on(t.businessId, t.date),
    tenantFk('rota_entries_staff_fk', t, t.staffId, staffMembers).onDelete('cascade'),
    tenantFk('rota_entries_shift_fk', t, t.shiftId, rotaShifts).onDelete('cascade'),
  ],
);

// ============================================================================================
// OceanX Hub: the company's main office (Super Admin). Leads, clients, services, quotes and
// invoices for any service, projects and tasks, and support tickets. Platform-level data: no
// business tenant; only Super Admin team members can read or change it.
// ============================================================================================

/**
 * OceanX's own projects / business lines (OceanX POS, websites, design studio...). Everything in the
 * Hub can belong to one, so each project has its own leads, clients, prices, documents, jobs and
 * tickets. The built-in POS project (kind 'pos') also opens the POS console.
 */
export const hubVentures = pgTable(
  'hub_ventures',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    /** pos | gravity (built in, one each: they open that product's console) | custom */
    kind: text('kind').notNull().default('custom'),
    description: text('description').notNull().default(''),
    /** Accent colour key (blue, violet, green, amber, rose, slate). */
    color: text('color').notNull().default('blue'),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  // One built-in project per product (pos, gravity); any number of custom ones.
  (t) => [uniqueIndex('hub_ventures_builtin_uq').on(t.kind).where(sql`${t.kind} <> 'custom'`)],
);

/** What OceanX sells (POS plans are separate; this is the price list for everything else too). */
export const hubServices = pgTable('hub_services', {
  id: uuid('id').primaryKey().defaultRandom(),
  ventureId: uuid('venture_id').references(() => hubVentures.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  /** pos | websites | design | marketing | hardware | it_support | software | other */
  category: text('category').notNull().default('other'),
  description: text('description').notNull().default(''),
  unit: text('unit').notNull().default('job'),
  price: money('price').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** One client list for everything OceanX does; optionally linked to their POS business. */
export const hubClients = pgTable(
  'hub_clients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ventureId: uuid('venture_id').references(() => hubVentures.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    company: text('company').notNull().default(''),
    /** person | company | government */
    kind: text('kind').notNull().default('company'),
    phone: text('phone').notNull().default(''),
    email: text('email').notNull().default(''),
    address: text('address').notNull().default(''),
    taxNumber: text('tax_number').notNull().default(''),
    notes: text('notes').notNull().default(''),
    businessId: uuid('business_id').references(() => businesses.id, { onDelete: 'set null' }),
    createdBy: uuid('created_by').references(() => superAdmins.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('hub_clients_name_idx').on(t.name)],
);

/** People who showed interest (DMs, calls, walk-ins, sign-ups) until they become clients. */
export const hubLeads = pgTable(
  'hub_leads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ventureId: uuid('venture_id').references(() => hubVentures.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    company: text('company').notNull().default(''),
    phone: text('phone').notNull().default(''),
    email: text('email').notNull().default(''),
    /** tiktok | instagram | facebook | whatsapp | viber | email | phone | walk_in | website | referral | other */
    source: text('source').notNull().default('other'),
    serviceId: uuid('service_id').references(() => hubServices.id, { onDelete: 'set null' }),
    interest: text('interest').notNull().default(''),
    /** new | contacted | demo | proposal | won | lost */
    status: text('status').notNull().default('new'),
    nextFollowUp: text('next_follow_up'),
    assignedTo: uuid('assigned_to').references(() => superAdmins.id, { onDelete: 'set null' }),
    notes: text('notes').notNull().default(''),
    clientId: uuid('client_id').references(() => hubClients.id, { onDelete: 'set null' }),
    createdBy: uuid('created_by').references(() => superAdmins.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('hub_leads_status_idx').on(t.status), index('hub_leads_follow_up_idx').on(t.nextFollowUp)],
);

/** A job for a client: a website, a design package, a POS installation… */
export const hubProjects = pgTable(
  'hub_projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ventureId: uuid('venture_id').references(() => hubVentures.id, { onDelete: 'set null' }),
    clientId: uuid('client_id').references(() => hubClients.id, { onDelete: 'set null' }),
    serviceId: uuid('service_id').references(() => hubServices.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    /** planned | in_progress | review | done | cancelled */
    status: text('status').notNull().default('planned'),
    startDate: text('start_date'),
    dueDate: text('due_date'),
    value: money('value').notNull().default(0),
    assignedTo: uuid('assigned_to').references(() => superAdmins.id, { onDelete: 'set null' }),
    createdBy: uuid('created_by').references(() => superAdmins.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('hub_projects_status_idx').on(t.status)],
);

/** Team to-dos, on a project or on their own. */
export const hubTasks = pgTable(
  'hub_tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ventureId: uuid('venture_id').references(() => hubVentures.id, { onDelete: 'set null' }),
    projectId: uuid('project_id').references(() => hubProjects.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    notes: text('notes').notNull().default(''),
    /** todo | doing | done */
    status: text('status').notNull().default('todo'),
    /** low | normal | high */
    priority: text('priority').notNull().default('normal'),
    dueDate: text('due_date'),
    assignedTo: uuid('assigned_to').references(() => superAdmins.id, { onDelete: 'set null' }),
    createdBy: uuid('created_by').references(() => superAdmins.id, { onDelete: 'set null' }),
    completedAt: ts('completed_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('hub_tasks_status_idx').on(t.status), index('hub_tasks_project_idx').on(t.projectId)],
);

/** Support requests from clients and POS businesses. */
export const hubTickets = pgTable(
  'hub_tickets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ventureId: uuid('venture_id').references(() => hubVentures.id, { onDelete: 'set null' }),
    number: text('number').notNull(),
    clientId: uuid('client_id').references(() => hubClients.id, { onDelete: 'set null' }),
    businessId: uuid('business_id').references(() => businesses.id, { onDelete: 'set null' }),
    subject: text('subject').notNull(),
    description: text('description').notNull().default(''),
    /** phone | whatsapp | email | social | visit | other */
    channel: text('channel').notNull().default('phone'),
    /** low | normal | high | urgent */
    priority: text('priority').notNull().default('normal'),
    /** open | in_progress | waiting | resolved | closed */
    status: text('status').notNull().default('open'),
    assignedTo: uuid('assigned_to').references(() => superAdmins.id, { onDelete: 'set null' }),
    createdBy: uuid('created_by').references(() => superAdmins.id, { onDelete: 'set null' }),
    resolvedAt: ts('resolved_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('hub_tickets_number_uq').on(t.number), index('hub_tickets_status_idx').on(t.status)],
);

export const hubTicketNotes = pgTable(
  'hub_ticket_notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => hubTickets.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    authorId: uuid('author_id').references(() => superAdmins.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('hub_ticket_notes_ticket_idx').on(t.ticketId)],
);

export interface HubDocItem {
  serviceId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

/** OceanX's own quotations and invoices for any service (POS subscriptions keep their own receipts). */
export const hubDocuments = pgTable(
  'hub_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ventureId: uuid('venture_id').references(() => hubVentures.id, { onDelete: 'set null' }),
    /** quote | invoice */
    kind: text('kind').notNull(),
    number: text('number').notNull(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => hubClients.id, { onDelete: 'restrict' }),
    projectId: uuid('project_id').references(() => hubProjects.id, { onDelete: 'set null' }),
    issueDate: text('issue_date').notNull(),
    /** Valid until (quote) / due date (invoice). */
    dueDate: text('due_date'),
    /** quote: draft | sent | accepted | rejected | converted ; invoice: draft | issued | partially_paid | paid | void */
    status: text('status').notNull().default('draft'),
    currency: text('currency').notNull().default('MVR'),
    items: jsonb('items').$type<HubDocItem[]>().notNull().default([]),
    subtotal: money('subtotal').notNull().default(0),
    discount: money('discount').notNull().default(0),
    total: money('total').notNull().default(0),
    paidAmount: money('paid_amount').notNull().default(0),
    notes: text('notes').notNull().default(''),
    terms: text('terms').notNull().default(''),
    sourceQuoteId: uuid('source_quote_id'),
    createdBy: uuid('created_by').references(() => superAdmins.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('hub_documents_number_uq').on(t.number), index('hub_documents_client_idx').on(t.clientId), index('hub_documents_kind_status_idx').on(t.kind, t.status)],
);

export const hubPayments = pgTable(
  'hub_payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => hubDocuments.id, { onDelete: 'cascade' }),
    amount: money('amount').notNull(),
    /** cash | bank_transfer | card | cheque | other */
    method: text('method').notNull().default('bank_transfer'),
    reference: text('reference').notNull().default(''),
    paidAt: text('paid_at').notNull(),
    voidedAt: ts('voided_at'),
    receivedBy: uuid('received_by').references(() => superAdmins.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('hub_payments_document_idx').on(t.documentId)],
);

/**
 * Emails the OceanX office sent to business owners from Super Admin (trial reminders, notices, custom):
 * who it went to, what it said, and whether each one was delivered.
 */
export const platformEmails = pgTable(
  'platform_emails',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    subject: text('subject').notNull(),
    body: text('body').notNull(),
    /** The group it was sent to: { product, segment, hours?, businessIds? }. */
    audience: jsonb('audience').$type<Record<string, unknown>>().notNull(),
    recipients: jsonb('recipients').$type<{ email: string; business: string; ok: boolean }[]>().notNull(),
    sentCount: integer('sent_count').notNull().default(0),
    failedCount: integer('failed_count').notNull().default(0),
    sentBy: uuid('sent_by').references(() => superAdmins.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('platform_emails_created_idx').on(t.createdAt)],
);

/**
 * Gravity Flow: income and expense categories, per account. Starter categories are added the first time
 * the account opens Flow; the owner renames, adds or removes them.
 */
export const financeCategories = pgTable(
  'finance_categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    /** income | expense */
    kind: text('kind').notNull(),
    name: text('name').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: ts('deleted_at'),
  },
  (t) => [
    unique('finance_categories_business_id_uq').on(t.businessId, t.id),
    uniqueIndex('finance_categories_name_uq')
      .on(t.businessId, t.kind, sql`lower(${t.name})`)
      .where(sql`${t.deletedAt} IS NULL`),
  ],
);

/**
 * Gravity Flow: one income or expense. Amounts are whole minor units (laari/cents) of the account's
 * currency, always positive; the kind says which way the money went. occurredOn is the calendar day in
 * the account's time zone. Deleting keeps the row (deleted_at) so history stays explainable.
 */
export const financeTransactions = pgTable(
  'finance_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    categoryId: uuid('category_id'),
    amount: money('amount').notNull(),
    occurredOn: text('occurred_on').notNull(),
    description: text('description').notNull().default(''),
    reference: text('reference').notNull().default(''),
    createdBy: uuid('created_by'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: ts('deleted_at'),
  },
  (t) => [
    index('finance_transactions_business_day_idx').on(t.businessId, t.occurredOn),
    tenantFk('finance_transactions_category_fk', t, t.categoryId, financeCategories),
    check('finance_transactions_kind_ck', sql`${t.kind} IN ('income','expense')`),
    check('finance_transactions_amount_ck', sql`${t.amount} > 0`),
  ],
);

/**
 * Gravity Budget: a person's income and spending categories. Spending categories may have a monthly limit
 * (the budget). Starter categories are added the first time the account opens Budget; the person renames,
 * adds or removes them.
 */
export const budgetCategories = pgTable(
  'budget_categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    /** income | expense */
    kind: text('kind').notNull(),
    name: text('name').notNull(),
    /** Set-up category (food, rent, salary…): shown in the person's language until they rename it. */
    key: text('key'),
    emoji: text('emoji').notNull().default(''),
    /** The most to spend in this category in a month (minor units); null = no limit. */
    monthlyLimit: money('monthly_limit'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: ts('deleted_at'),
  },
  (t) => [
    unique('budget_categories_business_id_uq').on(t.businessId, t.id),
    uniqueIndex('budget_categories_name_uq')
      .on(t.businessId, t.kind, sql`lower(${t.name})`)
      .where(sql`${t.deletedAt} IS NULL`),
    check('budget_categories_kind_ck', sql`${t.kind} IN ('income','expense')`),
    check('budget_categories_limit_ck', sql`${t.monthlyLimit} IS NULL OR ${t.monthlyLimit} > 0`),
  ],
);

/** Gravity Budget: a bill paid every month and the day of the month it is due. */
export const budgetBills = pgTable(
  'budget_bills',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    amount: money('amount').notNull(),
    dueDay: integer('due_day').notNull(),
    categoryId: uuid('category_id'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: ts('deleted_at'),
  },
  (t) => [
    unique('budget_bills_business_id_uq').on(t.businessId, t.id),
    tenantFk('budget_bills_category_fk', t, t.categoryId, budgetCategories),
    check('budget_bills_amount_ck', sql`${t.amount} > 0`),
    check('budget_bills_due_day_ck', sql`${t.dueDay} BETWEEN 1 AND 31`),
  ],
);

/**
 * Gravity Budget: one income or spending record. Amounts are whole minor units, always positive; the kind says
 * which way the money went. occurredOn is the day in the account's time zone. A paid bill links to its bill.
 * Deleting keeps the row (deleted_at).
 */
export const budgetEntries = pgTable(
  'budget_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    categoryId: uuid('category_id'),
    amount: money('amount').notNull(),
    occurredOn: text('occurred_on').notNull(),
    note: text('note').notNull().default(''),
    /** cash | card | transfer | other */
    paidWith: text('paid_with').notNull().default('cash'),
    billId: uuid('bill_id'),
    createdBy: uuid('created_by'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: ts('deleted_at'),
  },
  (t) => [
    index('budget_entries_business_day_idx').on(t.businessId, t.occurredOn),
    tenantFk('budget_entries_category_fk', t, t.categoryId, budgetCategories),
    tenantFk('budget_entries_bill_fk', t, t.billId, budgetBills),
    check('budget_entries_kind_ck', sql`${t.kind} IN ('income','expense')`),
    check('budget_entries_amount_ck', sql`${t.amount} > 0`),
  ],
);

/** Gravity Budget: something the person is saving for, with an optional date it is needed by. */
export const budgetGoals = pgTable(
  'budget_goals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    emoji: text('emoji').notNull().default(''),
    /** 'goal', or 'emergency': the person's one emergency fund (money kept for sudden needs). */
    kind: text('kind').notNull().default('goal'),
    target: money('target').notNull(),
    targetDate: text('target_date'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: ts('deleted_at'),
  },
  (t) => [
    unique('budget_goals_business_id_uq').on(t.businessId, t.id),
    check('budget_goals_target_ck', sql`${t.target} > 0`),
    check('budget_goals_kind_ck', sql`${t.kind} IN ('goal','emergency')`),
    uniqueIndex('budget_goals_one_emergency_uq').on(t.businessId).where(sql`${t.kind} = 'emergency' AND ${t.deletedAt} IS NULL`),
  ],
);

/** Money put into a goal (positive) or taken out of it (negative). The goal's saved amount is their sum. */
export const budgetGoalMoves = pgTable(
  'budget_goal_moves',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    goalId: uuid('goal_id').notNull(),
    amount: money('amount').notNull(),
    occurredOn: text('occurred_on').notNull(),
    note: text('note').notNull().default(''),
    createdAt: createdAt(),
  },
  (t) => [
    index('budget_goal_moves_goal_idx').on(t.businessId, t.goalId),
    tenantFk('budget_goal_moves_goal_fk', t, t.goalId, budgetGoals).onDelete('cascade'),
    check('budget_goal_moves_amount_ck', sql`${t.amount} <> 0`),
  ],
);

/**
 * Every self sign-up, kept for Super Admin even after the account itself is deleted (an unpaid trial is
 * removed 48 hours after it ends). No foreign key to businesses on purpose: the row outlives the account.
 */
export const signups = pgTable(
  'signups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id').notNull(),
    product: text('product').notNull(),
    businessName: text('business_name').notNull(),
    ownerName: text('owner_name').notNull(),
    email: text('email').notNull(),
    phone: text('phone'),
    currency: text('currency'),
    language: text('language'),
    createdAt: createdAt(),
    /** When the owner was told their trial ended and the account will be deleted unless they pay. */
    trialEndedNoticeAt: ts('trial_ended_notice_at'),
    deletedAt: ts('deleted_at'),
    deleteReason: text('delete_reason'),
  },
  (t) => [uniqueIndex('signups_business_uq').on(t.businessId), index('signups_created_idx').on(t.createdAt)],
);

/**
 * Super Admin asks the users of one app (or every app) for a review: a popup in the app, with "Later".
 * Stopping a request (closed_at) ends the popup; the reviews already written stay.
 */
export const reviewRequests = pgTable(
  'review_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** pos, gravity, flow or budget; null = every app. */
    product: text('product'),
    /** Shown above the stars; null = the app's own wording. */
    message: text('message'),
    createdBy: uuid('created_by'),
    createdAt: createdAt(),
    closedAt: ts('closed_at'),
  },
  (t) => [index('review_requests_open_idx').on(t.closedAt)],
);

/**
 * A review: stars and words from a user, answering a request or written on their own.
 * Kept with the business and person's names, so it stays after an account is deleted.
 */
export const reviews = pgTable(
  'reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id').references(() => businesses.id, { onDelete: 'set null' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    product: text('product').notNull(),
    businessName: text('business_name').notNull(),
    userName: text('user_name').notNull(),
    rating: integer('rating').notNull(),
    comment: text('comment'),
    /** The request it answers; null = written by the user on their own. */
    requestId: uuid('request_id').references(() => reviewRequests.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [
    index('reviews_created_idx').on(t.createdAt),
    index('reviews_product_idx').on(t.product),
    check('reviews_rating_ck', sql`${t.rating} BETWEEN 1 AND 5`),
  ],
);

/** Where a user stands with a review request: answered, or "later" (asked again after remind_at). */
export const reviewPromptStates = pgTable(
  'review_prompt_states',
  {
    requestId: uuid('request_id')
      .notNull()
      .references(() => reviewRequests.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: text('status').notNull(),
    remindAt: ts('remind_at'),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.requestId, t.userId] })],
);

/**
 * Gravity Budget loans: a person the user lent money to, or borrowed from. Their loans and repayments are
 * budget_loan_entries; what is still owed is worked out from those (never stored).
 */
export const budgetLoanPeople = pgTable(
  'budget_loan_people',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    phone: text('phone').notNull().default(''),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('budget_loan_people_business_idx').on(t.businessId)],
);

/**
 * One movement with a person: gave (lent to them), received (they paid back), took (borrowed from them) or
 * repaid (paid them back). Loans are kept apart from spending and income, so the monthly budget is not changed.
 */
export const budgetLoanEntries = pgTable(
  'budget_loan_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    personId: uuid('person_id')
      .notNull()
      .references(() => budgetLoanPeople.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    amount: money('amount').notNull(),
    occurredOn: text('occurred_on').notNull(),
    /** Gave / took: the day it should be returned (optional). */
    dueOn: text('due_on'),
    note: text('note').notNull().default(''),
    createdBy: uuid('created_by'),
    createdAt: createdAt(),
  },
  (t) => [index('budget_loan_entries_person_idx').on(t.personId), index('budget_loan_entries_business_idx').on(t.businessId), check('budget_loan_entries_amount_ck', sql`${t.amount} > 0`)],
);

/**
 * Every email that has had a free trial, per app. Kept after an account is deleted, so signing up again with
 * the same email starts without a new free trial (pay to use).
 */
export const trialUses = pgTable(
  'trial_uses',
  {
    email: text('email').notNull(),
    product: text('product').notNull(),
    firstAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.email, t.product] })],
);
