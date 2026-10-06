import type { FastifyReply } from 'fastify';
import type { CookieSerializeOptions } from '@fastify/cookie';
import type { AppConfig } from '../config';

/**
 * Two completely separate session domains:
 *  - business users:  cookie `ox_session`     (path /api)       -> table user_sessions
 *  - super admins:    cookie `ox_sa_session`  (path /api/superadmin) -> table super_admin_sessions
 * Each guard reads ONLY its own cookie and its own table, so a token from
 * one domain can never authenticate in the other.
 */
export const BUSINESS_COOKIE = 'ox_session';
export const SUPERADMIN_COOKIE = 'ox_sa_session';

export function businessCookieOptions(config: AppConfig, maxAgeSeconds?: number): CookieSerializeOptions {
  return { path: '/api', httpOnly: true, secure: config.COOKIE_SECURE, sameSite: 'lax', maxAge: maxAgeSeconds };
}

export function superAdminCookieOptions(config: AppConfig, maxAgeSeconds?: number): CookieSerializeOptions {
  return { path: '/api/superadmin', httpOnly: true, secure: config.COOKIE_SECURE, sameSite: 'strict', maxAge: maxAgeSeconds };
}

export function clearBusinessCookie(reply: FastifyReply, config: AppConfig) {
  reply.clearCookie(BUSINESS_COOKIE, businessCookieOptions(config));
}

export function clearSuperAdminCookie(reply: FastifyReply, config: AppConfig) {
  reply.clearCookie(SUPERADMIN_COOKIE, superAdminCookieOptions(config));
}

export const LAST_SEEN_WRITE_INTERVAL_MS = 60_000;
