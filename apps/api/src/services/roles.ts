import { and, count, eq, inArray } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import type { z } from 'zod';
import { isPermissionKey, PERMISSIONS, type roleSchema } from '@oceanx/shared';
import type { DB, Executor } from '../db/client';
import { rolePermissions, roles, userRoles } from '../db/schema';
import { audit } from '../lib/audit';
import { AppError, notFound } from '../lib/errors';
import type { BusinessContext } from '../types';
import { isPermissionAvailable } from './access';
import { assertCanGrant } from './users';

function validatePermissionKeys(keys: string[]): string[] {
  const unique = [...new Set(keys)];
  const invalid = unique.filter((k) => !isPermissionKey(k));
  if (invalid.length) throw new AppError('validation_failed', 'Unknown permission', { fields: { permissions: { code: 'invalid_option' } }, details: { invalid } });
  return unique;
}

async function loadRole(db: Executor, ctx: BusinessContext, id: string) {
  const [role] = await db
    .select()
    .from(roles)
    .where(and(eq(roles.businessId, ctx.businessId), eq(roles.id, id)))
    .limit(1);
  if (!role) throw notFound();
  return role;
}

async function permissionsOf(db: Executor, roleId: string): Promise<string[]> {
  const rows = await db.select({ key: rolePermissions.permissionKey }).from(rolePermissions).where(eq(rolePermissions.roleId, roleId));
  return rows.map((r) => r.key);
}

export async function listRoles(db: DB, ctx: BusinessContext) {
  const rows = await db.select().from(roles).where(eq(roles.businessId, ctx.businessId)).orderBy(roles.createdAt);
  const ids = rows.map((r) => r.id);
  const [perms, counts] = ids.length
    ? await Promise.all([
        db.select().from(rolePermissions).where(inArray(rolePermissions.roleId, ids)),
        db
          .select({ roleId: userRoles.roleId, n: count() })
          .from(userRoles)
          .where(and(eq(userRoles.businessId, ctx.businessId), inArray(userRoles.roleId, ids)))
          .groupBy(userRoles.roleId),
      ])
    : [[], []];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    systemKey: r.systemKey,
    description: r.description,
    permissions: perms.filter((p) => p.roleId === r.id).map((p) => p.permissionKey),
    userCount: Number(counts.find((c) => c.roleId === r.id)?.n ?? 0),
  }));
}

export async function getRole(db: DB, ctx: BusinessContext, id: string) {
  const role = await loadRole(db, ctx, id);
  return { ...role, permissions: await permissionsOf(db, id) };
}

export async function createRole(db: DB, ctx: BusinessContext, input: z.output<typeof roleSchema>, req: FastifyRequest) {
  const keys = validatePermissionKeys(input.permissions);
  assertCanGrant(ctx, keys);
  return db.transaction(async (tx) => {
    const [role] = await tx
      .insert(roles)
      .values({ businessId: ctx.businessId, name: input.name, description: input.description })
      .returning({ id: roles.id });
    if (!role) throw new AppError('internal_error');
    if (keys.length) await tx.insert(rolePermissions).values(keys.map((permissionKey) => ({ roleId: role.id, permissionKey })));
    await audit(tx, {
      actorType: 'user',
      actorId: ctx.user.id,
      actorName: ctx.user.name,
      businessId: ctx.businessId,
      action: 'role.created',
      entityType: 'role',
      entityId: role.id,
      metadata: { name: input.name, permissions: keys },
      req,
    });
    return role;
  });
}

export async function updateRole(db: DB, ctx: BusinessContext, id: string, input: z.output<typeof roleSchema>, req: FastifyRequest) {
  const keys = validatePermissionKeys(input.permissions);
  return db.transaction(async (tx) => {
    const role = await loadRole(tx, ctx, id);
    if (role.systemKey === 'business_admin') throw new AppError('role_protected', 'The Business Admin role cannot be modified');
    const before = await permissionsOf(tx, id);
    // Cannot edit a role that is more powerful than yourself, nor add permissions you do not hold.
    assertCanGrant(ctx, before);
    assertCanGrant(ctx, keys);

    await tx.update(roles).set({ name: input.name, description: input.description, updatedAt: new Date() }).where(eq(roles.id, id));
    await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, id));
    if (keys.length) await tx.insert(rolePermissions).values(keys.map((permissionKey) => ({ roleId: id, permissionKey })));

    const added = keys.filter((k) => !before.includes(k));
    const removed = before.filter((k) => !keys.includes(k));
    if (added.length || removed.length) {
      await audit(tx, {
        actorType: 'user',
        actorId: ctx.user.id,
        actorName: ctx.user.name,
        businessId: ctx.businessId,
        action: 'permission.changed',
        entityType: 'role',
        entityId: id,
        metadata: { added, removed },
        req,
      });
    }
    return { id };
  });
}

export async function deleteRole(db: DB, ctx: BusinessContext, id: string, req: FastifyRequest) {
  await db.transaction(async (tx) => {
    const role = await loadRole(tx, ctx, id);
    if (role.systemKey) throw new AppError('role_protected', 'System roles cannot be deleted');
    assertCanGrant(ctx, await permissionsOf(tx, id));
    const [used] = await tx.select({ n: count() }).from(userRoles).where(eq(userRoles.roleId, id));
    if (Number(used?.n ?? 0) > 0) throw new AppError('role_in_use', 'Role is assigned to users');
    await tx.delete(roles).where(and(eq(roles.id, id), eq(roles.businessId, ctx.businessId)));
    await audit(tx, {
      actorType: 'user',
      actorId: ctx.user.id,
      actorName: ctx.user.name,
      businessId: ctx.businessId,
      action: 'role.deleted',
      entityType: 'role',
      entityId: id,
      metadata: { name: role.name },
      req,
    });
  });
}

/** Permission catalog annotated with availability for this business (plan modules + add-ons). */
export function permissionCatalog(ctx: BusinessContext) {
  return PERMISSIONS.map((p) => ({
    key: p.key,
    module: p.module,
    addon: 'addon' in p ? p.addon : null,
    available: isPermissionAvailable(p.key, ctx.access),
    grantable: ctx.user.isOwner || ctx.rawPermissions.has(p.key),
  }));
}
