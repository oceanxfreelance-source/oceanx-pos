import { and, count, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import type { z } from 'zod';
import type { adminSetPasswordSchema, createUserSchema, PaginationQuery, updateUserSchema } from '@oceanx/shared';
import type { DB, Executor } from '../db/client';
import { outlets, rolePermissions, roles, userOutlets, userRoles, userSessions, users } from '../db/schema';
import { audit } from '../lib/audit';
import { AppError, notFound } from '../lib/errors';
import { hashPassword } from '../lib/password';
import type { BusinessContext } from '../types';
import { withinLimit } from './access';
import { emailInUse } from './provisioning';

const publicUserColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  phone: users.phone,
  language: users.language,
  isOwner: users.isOwner,
  isActive: users.isActive,
  mustChangePassword: users.mustChangePassword,
  lastLoginAt: users.lastLoginAt,
  createdAt: users.createdAt,
};

/** Every query is scoped by the business resolved from the session — never by client input. */
function tenantUser(ctx: BusinessContext, id: string) {
  return and(eq(users.businessId, ctx.businessId), eq(users.id, id), isNull(users.deletedAt));
}

async function rolePermissionSet(db: Executor, businessId: string, roleIds: string[]): Promise<{ ids: string[]; perms: Set<string> }> {
  if (!roleIds.length) return { ids: [], perms: new Set() };
  const found = await db
    .select({ id: roles.id })
    .from(roles)
    .where(and(eq(roles.businessId, businessId), inArray(roles.id, roleIds)));
  if (found.length !== new Set(roleIds).size) {
    throw new AppError('validation_failed', 'Unknown role', { fields: { roleIds: { code: 'invalid_option' } } });
  }
  const rows = await db.select({ key: rolePermissions.permissionKey }).from(rolePermissions).where(inArray(rolePermissions.roleId, roleIds));
  return { ids: found.map((f) => f.id), perms: new Set(rows.map((r) => r.key)) };
}

/** Non-owners may only grant permissions they hold themselves (prevents privilege escalation). */
export function assertCanGrant(ctx: BusinessContext, perms: Iterable<string>) {
  if (ctx.user.isOwner) return;
  const missing = [...perms].filter((p) => !ctx.rawPermissions.has(p));
  if (missing.length) throw new AppError('privilege_escalation', 'You cannot grant permissions you do not have', { details: { missing } });
}

async function assertOutlets(db: Executor, ctx: BusinessContext, outletIds: string[] | undefined) {
  if (!outletIds?.length) return;
  const found = await db
    .select({ id: outlets.id })
    .from(outlets)
    .where(and(eq(outlets.businessId, ctx.businessId), inArray(outlets.id, outletIds)));
  if (found.length !== new Set(outletIds).size) throw new AppError('validation_failed', 'Unknown outlet', { fields: { outletIds: { code: 'invalid_option' } } });
}

async function loadTarget(db: Executor, ctx: BusinessContext, id: string) {
  const [target] = await db.select().from(users).where(tenantUser(ctx, id)).limit(1);
  if (!target) throw notFound();
  return target;
}

/** Guards shared by every mutation of another user. */
async function assertCanManage(db: Executor, ctx: BusinessContext, target: typeof users.$inferSelect) {
  if (target.isOwner && !ctx.user.isOwner) throw new AppError('cannot_modify_owner', 'Only the owner can modify the owner account');
  if (!ctx.user.isOwner) {
    // A user cannot manage someone more privileged than themselves.
    const targetRoles = await db.select({ roleId: userRoles.roleId }).from(userRoles).where(eq(userRoles.userId, target.id));
    const { perms } = await rolePermissionSet(db, ctx.businessId, targetRoles.map((r) => r.roleId));
    assertCanGrant(ctx, perms);
  }
}

export async function countActiveUsers(db: Executor, businessId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(users)
    .where(and(eq(users.businessId, businessId), eq(users.isActive, true), isNull(users.deletedAt)));
  return Number(row?.n ?? 0);
}

export async function listUsers(db: DB, ctx: BusinessContext, q: PaginationQuery) {
  const where = and(
    eq(users.businessId, ctx.businessId),
    isNull(users.deletedAt),
    q.q ? or(ilike(users.name, `%${q.q}%`), ilike(users.email, `%${q.q}%`)) : undefined,
  );
  const [items, [total]] = await Promise.all([
    db
      .select(publicUserColumns)
      .from(users)
      .where(where)
      .orderBy(desc(users.isOwner), users.name)
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize),
    db.select({ n: count() }).from(users).where(where),
  ]);
  // One query for all roles on the page (no N+1).
  const ids = items.map((u) => u.id);
  const roleRows = ids.length
    ? await db
        .select({ userId: userRoles.userId, id: roles.id, name: roles.name, systemKey: roles.systemKey })
        .from(userRoles)
        .innerJoin(roles, eq(roles.id, userRoles.roleId))
        .where(and(eq(userRoles.businessId, ctx.businessId), inArray(userRoles.userId, ids)))
    : [];
  return {
    items: items.map((u) => ({ ...u, roles: roleRows.filter((r) => r.userId === u.id).map(({ userId: _u, ...r }) => r) })),
    page: q.page,
    pageSize: q.pageSize,
    total: Number(total?.n ?? 0),
  };
}

export async function getUser(db: DB, ctx: BusinessContext, id: string) {
  const [u] = await db.select(publicUserColumns).from(users).where(tenantUser(ctx, id)).limit(1);
  if (!u) throw notFound();
  const [roleRows, outletRows] = await Promise.all([
    db
      .select({ id: roles.id, name: roles.name, systemKey: roles.systemKey })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(and(eq(userRoles.userId, id), eq(userRoles.businessId, ctx.businessId))),
    db.select({ id: userOutlets.outletId }).from(userOutlets).where(and(eq(userOutlets.userId, id), eq(userOutlets.businessId, ctx.businessId))),
  ]);
  return { ...u, roles: roleRows, outletIds: outletRows.map((o) => o.id) };
}

export async function createUser(db: DB, ctx: BusinessContext, input: z.output<typeof createUserSchema>, req: FastifyRequest) {
  const passwordHash = await hashPassword(input.password);
  return db.transaction(async (tx) => {
    // Serialize user creation per business so concurrent requests cannot exceed the plan limit.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'users:' + ctx.businessId}))`);
    if (!withinLimit(ctx.access.limits, 'max_users', await countActiveUsers(tx, ctx.businessId))) {
      throw new AppError('plan_limit_reached', 'User limit reached for your plan', { details: { limit: 'max_users', value: ctx.access.limits.max_users } });
    }
    if (await emailInUse(tx, input.email)) throw new AppError('email_taken', 'Email already in use', { fields: { email: { code: 'email_taken' } } });
    const { ids: roleIds, perms } = await rolePermissionSet(tx, ctx.businessId, input.roleIds);
    assertCanGrant(ctx, perms);
    await assertOutlets(tx, ctx, input.outletIds);

    const [created] = await tx
      .insert(users)
      .values({
        businessId: ctx.businessId,
        name: input.name,
        email: input.email,
        phone: input.phone,
        language: input.language,
        passwordHash,
        passwordChangedAt: new Date(),
        mustChangePassword: input.mustChangePassword,
        defaultOutletId: input.outletIds?.[0] ?? ctx.outletId,
        createdBy: ctx.user.id,
      })
      .returning({ id: users.id });
    if (!created) throw new AppError('internal_error');
    await tx.insert(userRoles).values(roleIds.map((roleId) => ({ businessId: ctx.businessId, userId: created.id, roleId })));
    if (input.outletIds?.length) {
      await tx.insert(userOutlets).values(input.outletIds.map((outletId) => ({ businessId: ctx.businessId, userId: created.id, outletId })));
    }
    await audit(tx, {
      actorType: 'user',
      actorId: ctx.user.id,
      actorName: ctx.user.name,
      businessId: ctx.businessId,
      action: 'user.created',
      entityType: 'user',
      entityId: created.id,
      metadata: { email: input.email, roleIds },
      req,
    });
    return created;
  });
}

export async function updateUser(db: DB, ctx: BusinessContext, id: string, input: z.output<typeof updateUserSchema>, req: FastifyRequest) {
  return db.transaction(async (tx) => {
    const target = await loadTarget(tx, ctx, id);
    const isSelf = target.id === ctx.user.id;
    if (isSelf && (input.roleIds !== undefined || input.isActive !== undefined || input.outletIds !== undefined)) {
      throw new AppError('cannot_modify_self', 'You cannot change your own roles, outlets or status');
    }
    if (!isSelf) await assertCanManage(tx, ctx, target);
    if (target.isOwner && input.isActive === false) throw new AppError('cannot_modify_owner', 'The owner cannot be deactivated');

    if (input.email && input.email !== target.email.toLowerCase() && (await emailInUse(tx, input.email, id))) {
      throw new AppError('email_taken', 'Email already in use', { fields: { email: { code: 'email_taken' } } });
    }
    if (input.isActive === true && !target.isActive) {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'users:' + ctx.businessId}))`);
      if (!withinLimit(ctx.access.limits, 'max_users', await countActiveUsers(tx, ctx.businessId))) {
        throw new AppError('plan_limit_reached', 'User limit reached for your plan', { details: { limit: 'max_users' } });
      }
    }

    const changes: Record<string, unknown> = {};
    for (const k of ['name', 'email', 'phone', 'language', 'isActive'] as const) {
      if (input[k] !== undefined && input[k] !== target[k]) changes[k] = input[k];
    }
    if (Object.keys(changes).length) await tx.update(users).set({ ...changes, updatedAt: new Date() }).where(tenantUser(ctx, id));

    if (input.roleIds) {
      const { ids: roleIds, perms } = await rolePermissionSet(tx, ctx.businessId, input.roleIds);
      assertCanGrant(ctx, perms);
      if (target.isOwner) {
        const [adminRole] = await tx
          .select({ id: roles.id })
          .from(roles)
          .where(and(eq(roles.businessId, ctx.businessId), eq(roles.systemKey, 'business_admin')));
        if (adminRole && !roleIds.includes(adminRole.id)) throw new AppError('cannot_modify_owner', 'The owner must keep the Business Admin role');
      }
      await tx.delete(userRoles).where(and(eq(userRoles.userId, id), eq(userRoles.businessId, ctx.businessId)));
      await tx.insert(userRoles).values(roleIds.map((roleId) => ({ businessId: ctx.businessId, userId: id, roleId })));
      await audit(tx, {
        actorType: 'user',
        actorId: ctx.user.id,
        actorName: ctx.user.name,
        businessId: ctx.businessId,
        action: 'permission.changed',
        entityType: 'user',
        entityId: id,
        metadata: { roleIds },
        req,
      });
    }
    if (input.outletIds) {
      await assertOutlets(tx, ctx, input.outletIds);
      await tx.delete(userOutlets).where(and(eq(userOutlets.userId, id), eq(userOutlets.businessId, ctx.businessId)));
      if (input.outletIds.length) {
        await tx.insert(userOutlets).values(input.outletIds.map((outletId) => ({ businessId: ctx.businessId, userId: id, outletId })));
      }
    }
    if (input.isActive === false) {
      await tx.update(userSessions).set({ revokedAt: new Date() }).where(and(eq(userSessions.userId, id), isNull(userSessions.revokedAt)));
    }
    if (Object.keys(changes).length || input.outletIds) {
      await audit(tx, {
        actorType: 'user',
        actorId: ctx.user.id,
        actorName: ctx.user.name,
        businessId: ctx.businessId,
        action: 'user.updated',
        entityType: 'user',
        entityId: id,
        metadata: { changes: Object.keys(changes), outlets: input.outletIds ? input.outletIds.length : undefined },
        req,
      });
    }
    return { id };
  });
}

export async function deleteUser(db: DB, ctx: BusinessContext, id: string, req: FastifyRequest) {
  await db.transaction(async (tx) => {
    const target = await loadTarget(tx, ctx, id);
    if (target.id === ctx.user.id) throw new AppError('cannot_modify_self', 'You cannot delete your own account');
    if (target.isOwner) throw new AppError('cannot_modify_owner', 'The owner cannot be deleted');
    await assertCanManage(tx, ctx, target);
    await tx.update(users).set({ deletedAt: new Date(), isActive: false }).where(tenantUser(ctx, id));
    await tx.update(userSessions).set({ revokedAt: new Date() }).where(and(eq(userSessions.userId, id), isNull(userSessions.revokedAt)));
    await audit(tx, {
      actorType: 'user',
      actorId: ctx.user.id,
      actorName: ctx.user.name,
      businessId: ctx.businessId,
      action: 'user.deleted',
      entityType: 'user',
      entityId: id,
      metadata: { email: target.email },
      req,
    });
  });
}

export async function adminSetPassword(db: DB, ctx: BusinessContext, id: string, input: z.output<typeof adminSetPasswordSchema>, req: FastifyRequest) {
  const passwordHash = await hashPassword(input.password);
  await db.transaction(async (tx) => {
    const target = await loadTarget(tx, ctx, id);
    if (target.id === ctx.user.id) throw new AppError('cannot_modify_self', 'Use change password for your own account');
    await assertCanManage(tx, ctx, target);
    await tx
      .update(users)
      .set({ passwordHash, passwordChangedAt: new Date(), mustChangePassword: input.mustChangePassword, failedLoginCount: 0, lockedUntil: null })
      .where(tenantUser(ctx, id));
    await tx.update(userSessions).set({ revokedAt: new Date() }).where(and(eq(userSessions.userId, id), isNull(userSessions.revokedAt)));
    await audit(tx, {
      actorType: 'user',
      actorId: ctx.user.id,
      actorName: ctx.user.name,
      businessId: ctx.businessId,
      action: 'user.password_set',
      entityType: 'user',
      entityId: id,
      req,
    });
  });
}
