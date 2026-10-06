import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { Executor } from '../db/client';
import { notifications, rolePermissions, userRoles, users } from '../db/schema';

/**
 * In-app notifications. Stored as a translation key + params so each recipient sees the
 * message in their own language. Fan-out goes to every active user holding the permission.
 */
export async function notifyPermission(db: Executor, businessId: string, permission: string, key: string, params: Record<string, unknown>, link?: string) {
  const rows = await db
    .selectDistinct({ userId: users.id })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
    .where(and(eq(users.businessId, businessId), eq(users.isActive, true), isNull(users.deletedAt), inArray(rolePermissions.permissionKey, [permission])));
  if (!rows.length) return;
  await db.insert(notifications).values(rows.map((r) => ({ businessId, userId: r.userId, key, params, link: link ?? null })));
}
