import { sql } from 'drizzle-orm';
import {
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
    ip: text('ip'),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
    lastSeenAt: ts('last_seen_at').notNull().defaultNow(),
    expiresAt: ts('expires_at').notNull(),
    revokedAt: ts('revoked_at'),
  },
  (t) => [uniqueIndex('super_admin_sessions_token_uq').on(t.tokenHash), index('super_admin_sessions_admin_idx').on(t.superAdminId)],
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
    code: text('code').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    priceMonthly: numeric('price_monthly', { precision: 12, scale: 2 }).notNull().default('0'),
    currency: text('currency').notNull().default('USD'),
    trialDays: integer('trial_days').notNull().default(0),
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
    businessType: businessTypeEnum('business_type').notNull(),
    status: businessStatusEnum('status').notNull().default('pending'),
    email: text('email').notNull().default(''),
    phone: text('phone').notNull().default(''),
    address: text('address').notNull().default(''),
    logoPath: text('logo_path'),
    currency: text('currency').notNull().default('MVR'),
    timezone: text('timezone').notNull().default('Indian/Maldives'),
    suspensionReason: text('suspension_reason'),
    approvedAt: ts('approved_at'),
    suspendedAt: ts('suspended_at'),
    createdBySuperAdminId: uuid('created_by_super_admin_id').references(() => superAdmins.id, { onDelete: 'set null' }),
    onboardingCompletedAt: ts('onboarding_completed_at'),
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
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('subscriptions_business_uq').on(t.businessId),
    index('subscriptions_status_idx').on(t.status),
    index('subscriptions_period_end_idx').on(t.currentPeriodEnd),
  ],
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
