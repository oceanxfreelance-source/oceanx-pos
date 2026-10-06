import type { ApiErrorBody, ErrorCode } from '@oceanx/shared';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | 'network_error',
    message: string,
    readonly fields: NonNullable<ApiErrorBody['error']['fields']> = {},
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

type Domain = 'business' | 'superadmin';

const csrf: Record<Domain, string | null> = { business: null, superadmin: null };
const unauthorizedHandlers: Record<Domain, (() => void) | null> = { business: null, superadmin: null };

export function setCsrfToken(domain: Domain, token: string | null) {
  csrf[domain] = token;
}

export function onUnauthorized(domain: Domain, handler: () => void) {
  unauthorizedHandlers[domain] = handler;
}

async function request<T>(domain: Domain, method: string, path: string, body?: unknown, init: { raw?: Blob; contentType?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' };
  const token = csrf[domain];
  if (method !== 'GET' && token) headers['x-csrf-token'] = token;
  let payload: BodyInit | undefined;
  if (init.raw) {
    payload = init.raw;
    headers['content-type'] = init.contentType ?? init.raw.type;
  } else if (body !== undefined) {
    payload = JSON.stringify(body);
    headers['content-type'] = 'application/json';
  }
  let res: Response;
  try {
    res = await fetch(path, { method, headers, body: payload, credentials: 'same-origin' });
  } catch {
    throw new ApiError(0, 'network_error', 'Network error');
  }
  if (res.status === 204) return undefined as T;
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    const err = (data as ApiErrorBody | null)?.error;
    const apiErr = new ApiError(res.status, err?.code ?? 'internal_error', err?.message ?? res.statusText, err?.fields, err?.details);
    if (res.status === 401 && !path.includes('/auth/login') && !path.includes('/auth/mfa')) unauthorizedHandlers[domain]?.();
    throw apiErr;
  }
  if (data && typeof (data as { csrfToken?: unknown }).csrfToken === 'string') csrf[domain] = (data as { csrfToken: string }).csrfToken;
  return data as T;
}

function client(domain: Domain, prefix: string) {
  return {
    get: <T>(p: string) => request<T>(domain, 'GET', prefix + p),
    post: <T>(p: string, body: unknown = {}) => request<T>(domain, 'POST', prefix + p, body),
    put: <T>(p: string, body: unknown = {}) => request<T>(domain, 'PUT', prefix + p, body),
    patch: <T>(p: string, body: unknown = {}) => request<T>(domain, 'PATCH', prefix + p, body),
    delete: <T>(p: string) => request<T>(domain, 'DELETE', prefix + p),
    upload: <T>(p: string, file: Blob) => request<T>(domain, 'PUT', prefix + p, undefined, { raw: file }),
  };
}

/** Business-user API (/api/*). */
export const api = client('business', '/api');
/** Super Admin API (/api/superadmin/*) — separate CSRF token and 401 handling. */
export const saApi = client('superadmin', '/api/superadmin');

export function qs(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}
