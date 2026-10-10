import { z } from 'zod';

const bool = z
  .string()
  .optional()
  .transform((v) => v === 'true' || v === '1');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1),
  APP_URL: z.string().url().default('http://localhost:5173'),
  /** Gravity's own web address (optional). Gravity e-mails link there; without it they use APP_URL. */
  GRAVITY_APP_URL: z.string().url().optional(),
  APP_ENCRYPTION_KEY: z.string().optional(),
  COOKIE_SECURE: bool,
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  BUSINESS_SESSION_IDLE_MINUTES: z.coerce.number().int().min(5).default(720),
  BUSINESS_SESSION_ABSOLUTE_HOURS: z.coerce.number().int().min(1).default(168),
  SUPERADMIN_SESSION_IDLE_MINUTES: z.coerce.number().int().min(5).default(30),
  SUPERADMIN_SESSION_ABSOLUTE_HOURS: z.coerce.number().int().min(1).default(12),
  LOGIN_MAX_FAILURES: z.coerce.number().int().min(1).default(5),
  LOGIN_LOCK_MINUTES: z.coerce.number().int().min(1).default(15),
  MAIL_TRANSPORT: z.enum(['log', 'smtp', 'memory']).default('log'),
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().default('OceanX <no-reply@example.com>'),
  RATE_LIMIT_DISABLED: bool,
  /** Demo deployments without SMTP: allow MAIL_TRANSPORT=log in production (emails are only logged). */
  ALLOW_LOG_MAIL: bool,
  STORAGE_DIR: z.string().default('./storage'),
  /** fs = STORAGE_DIR on disk; db = PostgreSQL stored_files table (serverless hosts without a persistent disk). */
  STORAGE_DRIVER: z.enum(['fs', 'db']).default('fs'),
  /** Viber credit messages transport (see services/viber/provider.ts). Credentials only via environment. */
  VIBER_PROVIDER: z.enum(['none', 'log', 'memory', 'infobip', 'webhook']).default('log'),
  VIBER_API_URL: z.string().url().optional(),
  VIBER_API_KEY: z.string().optional(),
  VIBER_SENDER: z.string().optional(),
});

export type AppConfig = z.infer<typeof envSchema> & { encryptionKey: Buffer };

export function loadConfig(overrides: Record<string, string | undefined> = {}): AppConfig {
  const parsed = envSchema.safeParse({ ...process.env, ...overrides });
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration:\n${parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n')}`);
  }
  const env = parsed.data;
  let encryptionKey: Buffer;
  if (env.APP_ENCRYPTION_KEY) {
    encryptionKey = Buffer.from(env.APP_ENCRYPTION_KEY, 'base64');
    if (encryptionKey.length !== 32) throw new Error('APP_ENCRYPTION_KEY must be 32 bytes (base64 encoded).');
  } else if (env.NODE_ENV === 'production') {
    throw new Error('APP_ENCRYPTION_KEY is required in production.');
  } else {
    // Development/test only: deterministic per-database key so restarts keep TOTP secrets readable.
    encryptionKey = Buffer.alloc(32, 0x5a);
  }
  if (env.NODE_ENV === 'production') {
    if (!env.COOKIE_SECURE) throw new Error('COOKIE_SECURE must be true in production.');
    if (env.MAIL_TRANSPORT !== 'smtp' && !(env.MAIL_TRANSPORT === 'log' && env.ALLOW_LOG_MAIL)) throw new Error('MAIL_TRANSPORT must be "smtp" in production (or "log" with ALLOW_LOG_MAIL=true for demos).');
  }
  return { ...env, encryptionKey };
}

/** Where a product's customers use the app: Gravity has its own address when GRAVITY_APP_URL is set. */
export function appUrlFor(config: { APP_URL: string; GRAVITY_APP_URL?: string }, product: string | null | undefined) {
  return product === 'gravity' && config.GRAVITY_APP_URL ? config.GRAVITY_APP_URL : config.APP_URL;
}
