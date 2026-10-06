import type { FastifyRequest } from 'fastify';
import type { Executor } from '../db/client';
import { activityLogs } from '../db/schema';

const SENSITIVE = /pass(word)?|token|secret|totp|otp|hash|cookie|authorization/i;

function scrub(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[depth]';
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => scrub(v, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = SENSITIVE.test(k) ? '[redacted]' : scrub(v, depth + 1);
    return out;
  }
  return value;
}

export interface AuditEntry {
  actorType: 'super_admin' | 'user' | 'system';
  actorId?: string | null;
  actorName?: string | null;
  businessId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  req?: FastifyRequest;
}

export async function audit(db: Executor, e: AuditEntry): Promise<void> {
  await db.insert(activityLogs).values({
    actorType: e.actorType,
    actorId: e.actorId ?? null,
    actorName: e.actorName ?? null,
    businessId: e.businessId ?? null,
    action: e.action,
    entityType: e.entityType ?? null,
    entityId: e.entityId ?? null,
    metadata: (scrub(e.metadata ?? {}) as Record<string, unknown>) ?? {},
    ip: e.req?.ip ?? null,
    userAgent: e.req?.headers['user-agent']?.slice(0, 300) ?? null,
  });
}
