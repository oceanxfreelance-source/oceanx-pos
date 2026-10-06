import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import { and, desc, eq } from 'drizzle-orm';
import { getPermission } from '@oceanx/shared';
import { outlets, rolePermissions, userOutlets, userRoles, userSessions, users } from '../db/schema';
import { hashToken, safeEqual } from '../lib/crypto';
import { AppError } from '../lib/errors';
import { BUSINESS_COOKIE, clearBusinessCookie, LAST_SEEN_WRITE_INTERVAL_MS } from '../lib/sessions';
import { effectivePermissions, loadBusinessAccess } from '../services/access';
import type { BusinessContext } from '../types';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * BusinessUserGuard — authenticates ONLY via the business session cookie and
 * resolves the tenant (business_id / outlet_id) from the server-side session.
 */
export async function businessGuard(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  await authenticateBusiness(req, reply, { csrf: true, enforceState: !req.routeOptions.config.sessionOnly });
}

/** Load the business context from the session cookie. Used by the guard and right after login. */
export async function authenticateBusiness(
  req: FastifyRequest,
  reply: FastifyReply,
  opts: { csrf: boolean; enforceState: boolean },
): Promise<BusinessContext> {
  const { db, config } = req.server.deps;
  const token = req.cookies[BUSINESS_COOKIE];
  if (!token) throw new AppError('unauthenticated', 'Authentication required');

  const [row] = await db
    .select({ s: userSessions, u: users })
    .from(userSessions)
    .innerJoin(users, eq(users.id, userSessions.userId))
    .where(eq(userSessions.tokenHash, hashToken(token)))
    .limit(1);

  const now = Date.now();
  if (!row || row.s.revokedAt) {
    clearBusinessCookie(reply, config);
    throw new AppError('unauthenticated', 'Authentication required');
  }
  const idleMs = config.BUSINESS_SESSION_IDLE_MINUTES * 60_000;
  if (row.s.expiresAt.getTime() < now || row.s.lastSeenAt.getTime() + idleMs < now) {
    await db.update(userSessions).set({ revokedAt: new Date() }).where(eq(userSessions.id, row.s.id));
    clearBusinessCookie(reply, config);
    throw new AppError('session_expired', 'Session expired');
  }
  if (!row.u.isActive || row.u.deletedAt) {
    await db.update(userSessions).set({ revokedAt: new Date() }).where(eq(userSessions.id, row.s.id));
    clearBusinessCookie(reply, config);
    throw new AppError('account_disabled', 'Account disabled');
  }

  if (opts.csrf && !SAFE_METHODS.has(req.method)) {
    const header = req.headers['x-csrf-token'];
    if (typeof header !== 'string' || !safeEqual(header, row.s.csrfToken)) throw new AppError('csrf_invalid', 'Invalid CSRF token');
  }

  const access = await loadBusinessAccess(db, row.s.businessId);
  if (!access) throw new AppError('unauthenticated', 'Authentication required');

  const permRows = await db
    .select({ key: rolePermissions.permissionKey, roleId: userRoles.roleId })
    .from(userRoles)
    .leftJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
    .where(and(eq(userRoles.userId, row.u.id), eq(userRoles.businessId, row.s.businessId)));
  const roleIds = [...new Set(permRows.map((r) => r.roleId))];
  const rawPermissions = new Set(permRows.map((r) => r.key).filter((k): k is string => !!k));
  const permissions = effectivePermissions(rawPermissions, access);

  // Outlet scope: session outlet if still permitted, else default.
  const outletId = await resolveOutlet(req, row.s.businessId, row.u.id, row.s.currentOutletId ?? row.u.defaultOutletId);

  if (now - row.s.lastSeenAt.getTime() > LAST_SEEN_WRITE_INTERVAL_MS || outletId !== row.s.currentOutletId) {
    await db.update(userSessions).set({ lastSeenAt: new Date(), currentOutletId: outletId }).where(eq(userSessions.id, row.s.id));
  }

  req.biz = {
    sessionId: row.s.id,
    csrfToken: row.s.csrfToken,
    businessId: row.s.businessId,
    outletId,
    user: {
      id: row.u.id,
      name: row.u.name,
      email: row.u.email,
      language: row.u.language,
      isOwner: row.u.isOwner,
      mustChangePassword: row.u.mustChangePassword,
      preferences: row.u.preferences ?? {},
    },
    access,
    permissions,
    rawPermissions,
    roleIds,
  };

  if (opts.enforceState) {
    if (access.state !== 'ok') throw new AppError(access.state, 'Business is not operational');
    if (row.u.mustChangePassword) throw new AppError('password_change_required', 'Password change required');
  }
  return req.biz;
}

async function resolveOutlet(req: FastifyRequest, businessId: string, userId: string, preferred: string | null): Promise<string | null> {
  const { db } = req.server.deps;
  const assigned = await db
    .select({ id: userOutlets.outletId })
    .from(userOutlets)
    .innerJoin(outlets, and(eq(outlets.id, userOutlets.outletId), eq(outlets.isActive, true)))
    .where(and(eq(userOutlets.userId, userId), eq(userOutlets.businessId, businessId)));
  const assignedIds = assigned.map((a) => a.id);

  if (preferred) {
    if (assignedIds.length ? assignedIds.includes(preferred) : await outletActive(req, businessId, preferred)) return preferred;
  }
  if (assignedIds.length) return assignedIds[0] ?? null;
  const [def] = await db
    .select({ id: outlets.id })
    .from(outlets)
    .where(and(eq(outlets.businessId, businessId), eq(outlets.isActive, true)))
    .orderBy(desc(outlets.isDefault), outlets.createdAt)
    .limit(1);
  return def?.id ?? null;
}

async function outletActive(req: FastifyRequest, businessId: string, outletId: string): Promise<boolean> {
  const [o] = await req.server.deps.db
    .select({ id: outlets.id })
    .from(outlets)
    .where(and(eq(outlets.id, outletId), eq(outlets.businessId, businessId), eq(outlets.isActive, true)))
    .limit(1);
  return !!o;
}

/** Throws unless the context holds `key`. Distinguishes "module not in plan" / "add-on not granted" / "role lacks permission". */
export function assertPermission(ctx: BusinessContext, key: string): void {
  if (ctx.permissions.has(key)) return;
  const def = getPermission(key);
  if (def && !ctx.access.modules.has(def.module)) throw new AppError('module_not_enabled', 'Module not enabled', { details: { module: def.module } });
  if (def?.addon && !ctx.access.addons.has(def.addon)) throw new AppError('addon_not_enabled', 'Add-on not enabled', { details: { addon: def.addon } });
  throw new AppError('permission_denied', 'Permission denied', { details: { permission: key } });
}

/** Server-side permission enforcement (route preHandler). */
export function requirePermission(...keys: string[]): preHandlerHookHandler {
  return async function permissionGuard(req: FastifyRequest) {
    const ctx = req.biz;
    if (!ctx) throw new AppError('unauthenticated');
    for (const key of keys) assertPermission(ctx, key);
  };
}

/** Require at least one of the given permissions. */
export function requireAnyPermission(...keys: string[]): preHandlerHookHandler {
  return async function anyPermissionGuard(req: FastifyRequest) {
    const ctx = req.biz;
    if (!ctx) throw new AppError('unauthenticated');
    if (!keys.some((k) => ctx.permissions.has(k))) throw new AppError('permission_denied', 'Permission denied', { details: { permission: keys } });
  };
}

export function bizCtx(req: FastifyRequest) {
  if (!req.biz) throw new AppError('unauthenticated');
  return req.biz;
}

