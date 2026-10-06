import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import type { AppConfig } from './config';
import type { DB } from './db/client';
import { AppError } from './lib/errors';
import { createMailer, type Mailer } from './lib/mailer';
import { Storage } from './lib/storage';
import type { AppDeps } from './types';
import { businessRoutes } from './routes/business';
import { superAdminRoutes } from './routes/superadmin';
import './types';

export interface BuildOptions {
  config: AppConfig;
  db: DB;
  mailer?: Mailer;
  logger?: boolean;
  /** Max login/reset attempts per IP per minute (lower in production, raised in tests). */
  authRateLimit?: number;
}

const UNIQUE_CONSTRAINT_CODES: Record<string, AppError['code']> = {
  users_email_uq: 'email_taken',
  super_admins_email_uq: 'email_taken',
  businesses_slug_uq: 'slug_taken',
  roles_business_name_uq: 'role_name_taken',
  outlets_business_name_uq: 'outlet_name_taken',
  plans_code_uq: 'code_taken',
  addons_code_uq: 'code_taken',
};

export async function buildApp(opts: BuildOptions): Promise<FastifyInstance> {
  const { config } = opts;
  const app = Fastify({
    logger: opts.logger === false ? false : config.NODE_ENV === 'development' ? { transport: { target: 'pino-pretty' } } : true,
    // Trust exactly N reverse-proxy hops so req.ip (rate limiting, audit) cannot be spoofed via X-Forwarded-For.
    trustProxy: config.TRUST_PROXY > 0 ? (_addr: string, hop: number) => hop < config.TRUST_PROXY : false,
    bodyLimit: 1_048_576,
  });

  const deps: AppDeps = {
    db: opts.db,
    config,
    mailer: opts.mailer ?? createMailer(config, app.log),
    storage: new Storage(config.STORAGE_DIR),
    log: app.log,
  };
  app.decorate('deps', deps);
  app.decorateRequest('biz', null);
  app.decorateRequest('sa', null);

  await app.register(helmet, {
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
    crossOriginResourcePolicy: { policy: 'same-origin' },
  });
  await app.register(cookie);
  await app.register(rateLimit, {
    global: true,
    max: config.RATE_LIMIT_DISABLED ? 1_000_000 : 600,
    timeWindow: '1 minute',
    errorResponseBuilder: (_req, ctx) => new AppError('rate_limited', `Too many requests, retry in ${ctx.after}`),
  });

  // Never cache authenticated API responses.
  app.addHook('onSend', async (_req, reply) => {
    reply.header('cache-control', 'no-store');
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof AppError) {
      return reply.status(err.statusCode).send({ error: { code: err.code, message: err.message, ...err.extra } });
    }
    // Drizzle wraps driver errors; the PostgreSQL error is on `cause`.
    const pg = ((err as { cause?: unknown }).cause ?? err) as { code?: string; constraint?: string };
    if (pg.code === '23505') {
      const code = (pg.constraint && UNIQUE_CONSTRAINT_CODES[pg.constraint]) || 'conflict';
      return reply.status(409).send({ error: { code, message: 'Already exists' } });
    }
    const fe = err as { statusCode?: number; code?: string; message?: string };
    if (fe.statusCode === 429) return reply.status(429).send({ error: { code: 'rate_limited', message: 'Too many requests' } });
    if (fe.statusCode && fe.statusCode >= 400 && fe.statusCode < 500) {
      return reply.status(fe.statusCode).send({ error: { code: 'bad_request', message: fe.message ?? 'Bad request' } });
    }
    req.log.error({ err }, 'unhandled error');
    return reply.status(500).send({ error: { code: 'internal_error', message: 'Internal server error' } });
  });

  app.setNotFoundHandler((_req, reply) => reply.status(404).send({ error: { code: 'not_found', message: 'Not found' } }));

  app.get('/api/health', async () => ({ status: 'ok' }));

  const authRateLimit = opts.authRateLimit ?? (config.RATE_LIMIT_DISABLED ? 1_000_000 : 10);
  await app.register(superAdminRoutes, { prefix: '/api/superadmin', authRateLimit });
  await app.register(businessRoutes, { prefix: '/api', authRateLimit });

  return app;
}
