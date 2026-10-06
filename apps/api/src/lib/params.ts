import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { notFound } from './errors';

const uuid = z.uuid();

/** Route id parameter. Malformed ids are reported as 404 so probing reveals nothing. */
export function idParam(req: FastifyRequest, name = 'id'): string {
  const raw = (req.params as Record<string, unknown>)[name];
  const r = uuid.safeParse(raw);
  if (!r.success) throw notFound();
  return r.data;
}
