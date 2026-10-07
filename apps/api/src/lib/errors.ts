import type { ErrorCode } from '@oceanx/shared';

const DEFAULT_STATUS: Partial<Record<ErrorCode, number>> = {
  bad_request: 400,
  validation_failed: 422,
  unauthenticated: 401,
  session_expired: 401,
  invalid_credentials: 401,
  mfa_required: 401,
  mfa_invalid: 401,
  forbidden: 403,
  permission_denied: 403,
  csrf_invalid: 403,
  account_disabled: 403,
  password_change_required: 403,
  business_pending: 403,
  business_suspended: 403,
  business_deactivated: 403,
  module_not_enabled: 403,
  addon_not_enabled: 403,
  feature_not_enabled: 403,
  cannot_modify_self: 403,
  cannot_modify_owner: 403,
  privilege_escalation: 403,
  role_protected: 403,
  registration_closed: 403,
  subscription_expired: 402,
  subscription_cancelled: 402,
  plan_limit_reached: 402,
  not_found: 404,
  conflict: 409,
  email_taken: 409,
  slug_taken: 409,
  role_name_taken: 409,
  outlet_name_taken: 409,
  code_taken: 409,
  role_in_use: 409,
  invalid_status_transition: 409,
  last_super_admin: 409,
  rate_limited: 429,
  too_many_attempts: 429,
  insufficient_stock: 409,
  credit_limit_exceeded: 409,
  customer_required: 422,
  payment_insufficient: 422,
  payment_exceeds_balance: 422,
  already_converted: 409,
  document_locked: 409,
  booking_conflict: 409,
  product_unavailable: 422,
  points_insufficient: 422,
  online_ordering_closed: 403,
  discount_not_allowed: 403,
  table_required: 422,
  outlet_mismatch: 422,
  sku_taken: 409,
  category_name_taken: 409,
  table_name_taken: 409,
  internal_error: 500,
};

export class AppError extends Error {
  readonly statusCode: number;
  constructor(
    readonly code: ErrorCode,
    message?: string,
    readonly extra: { fields?: Record<string, { code: string; params?: Record<string, unknown> }>; details?: Record<string, unknown> } = {},
    status?: number,
  ) {
    super(message ?? code);
    this.statusCode = status ?? DEFAULT_STATUS[code] ?? 400;
  }
}

export const notFound = () => new AppError('not_found', 'Resource not found');
export const forbidden = (code: ErrorCode = 'permission_denied', details?: Record<string, unknown>) =>
  new AppError(code, 'You do not have access to this resource', { details });
