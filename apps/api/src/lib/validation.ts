import type { z } from 'zod';
import { AppError } from './errors';

function issueToCode(issue: z.core.$ZodIssue): { code: string; params?: Record<string, unknown> } {
  switch (issue.code) {
    case 'too_small':
      if (issue.origin === 'string') return Number(issue.minimum) <= 1 ? { code: 'required' } : { code: 'too_short', params: { min: Number(issue.minimum) } };
      if (issue.origin === 'array') return { code: 'too_few', params: { min: Number(issue.minimum) } };
      return { code: 'too_small', params: { min: Number(issue.minimum) } };
    case 'too_big':
      if (issue.origin === 'string') return { code: 'too_long', params: { max: Number(issue.maximum) } };
      if (issue.origin === 'array') return { code: 'too_many', params: { max: Number(issue.maximum) } };
      return { code: 'too_big', params: { max: Number(issue.maximum) } };
    case 'invalid_format':
      if (issue.format === 'email') return { code: 'invalid_email' };
      if (issue.format === 'uuid') return { code: 'invalid_id' };
      return { code: 'invalid_format' };
    case 'invalid_type':
      return issue.input === undefined ? { code: 'required' } : { code: 'invalid_type' };
    case 'invalid_value':
      return { code: 'invalid_option' };
    case 'unrecognized_keys':
      return { code: 'unknown_field' };
    case 'custom':
      return { code: issue.message && /^[a-z_]+$/.test(issue.message) ? issue.message : 'invalid' };
    default:
      return { code: 'invalid' };
  }
}

/** Parse untrusted input; throws a 422 with per-field codes the UI can translate. */
export function parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const r = schema.safeParse(input ?? {});
  if (r.success) return r.data;
  const fields: Record<string, { code: string; params?: Record<string, unknown> }> = {};
  for (const issue of r.error.issues) {
    const path = issue.path.length ? issue.path.join('.') : '_';
    if (!fields[path]) fields[path] = issueToCode(issue);
  }
  throw new AppError('validation_failed', 'Validation failed', { fields });
}
