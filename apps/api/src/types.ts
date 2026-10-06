import type { FastifyBaseLogger } from 'fastify';
import type { AppConfig } from './config';
import type { DB } from './db/client';
import type { Mailer } from './lib/mailer';
import type { Storage } from './lib/storage';
import type { BusinessAccess } from './services/access';

export interface AppDeps {
  db: DB;
  config: AppConfig;
  mailer: Mailer;
  storage: Storage;
  log: FastifyBaseLogger;
}

export interface BusinessContext {
  sessionId: string;
  csrfToken: string;
  businessId: string;
  outletId: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    language: string;
    isOwner: boolean;
    mustChangePassword: boolean;
    preferences: { reduceAnimations?: boolean; theme?: string };
  };
  access: BusinessAccess;
  /** Effective permissions = role permissions ∩ enabled modules/add-ons. */
  permissions: Set<string>;
  /** Permissions granted by roles before module/add-on filtering (used for escalation checks). */
  rawPermissions: Set<string>;
  roleIds: string[];
}

export interface SuperAdminContext {
  sessionId: string;
  csrfToken: string;
  mfaPending: boolean;
  admin: { id: string; name: string; email: string; totpEnabled: boolean };
}

declare module 'fastify' {
  interface FastifyInstance {
    deps: AppDeps;
  }
  interface FastifyRequest {
    biz: BusinessContext | null;
    sa: SuperAdminContext | null;
  }
  interface FastifyContextConfig {
    /** Business route usable even when business/subscription is not operational or a password change is pending. */
    sessionOnly?: boolean;
    /** Super admin route usable while the session still awaits the 2FA code. */
    allowMfaPending?: boolean;
  }
}
