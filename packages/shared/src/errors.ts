/**
 * Stable API error codes. The API returns `{ error: { code, message, fields? } }`
 * and the UI translates `errors.<code>` in the user's language.
 */
export const ERROR_CODES = [
  'bad_request',
  'validation_failed',
  'unauthenticated',
  'session_expired',
  'forbidden',
  'permission_denied',
  'not_found',
  'conflict',
  'csrf_invalid',
  'rate_limited',
  'too_many_attempts',
  'invalid_credentials',
  'mfa_required',
  'mfa_invalid',
  'mfa_not_enabled',
  'mfa_already_enabled',
  'invalid_token',
  'password_reuse',
  'password_incorrect',
  'account_disabled',
  'password_change_required',
  'business_pending',
  'business_suspended',
  'business_deactivated',
  'subscription_expired',
  'subscription_cancelled',
  'module_not_enabled',
  'addon_not_enabled',
  'feature_not_enabled',
  'plan_limit_reached',
  'email_taken',
  'slug_taken',
  'role_name_taken',
  'outlet_name_taken',
  'code_taken',
  'role_in_use',
  'role_protected',
  'cannot_modify_self',
  'cannot_modify_owner',
  'privilege_escalation',
  'invalid_status_transition',
  'registration_closed',
  'last_super_admin',
  'insufficient_stock',
  'credit_limit_exceeded',
  'customer_required',
  'payment_insufficient',
  'payment_exceeds_balance',
  'already_converted',
  'document_locked',
  'booking_conflict',
  'product_unavailable',
  'points_insufficient',
  'online_ordering_closed',
  'discount_not_allowed',
  'table_required',
  'outlet_mismatch',
  'sku_taken',
  'category_name_taken',
  'table_name_taken',
  'payroll_period_exists',
  'internal_error',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    /** field path -> validation code (translated as `validation.<code>`) */
    fields?: Record<string, { code: string; params?: Record<string, unknown> }>;
    details?: Record<string, unknown>;
  };
}
