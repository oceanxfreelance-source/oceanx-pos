import type { FastifyInstance } from 'fastify';
import { superAdminGuard } from '../../guards/superadmin';
import { notFound } from '../../lib/errors';
import { superAdminAuthPublicRoutes, superAdminAuthSessionRoutes } from './auth';
import { businessAdminRoutes } from './businesses';
import { platformRoutes } from './platform';
import { billingAdminRoutes } from './billing';
import { mailRoutes } from './mail';
import { hubRoutes } from './hub';
import { signupRoutes } from './signups';
import { superAdminPhonePublicRoutes, superAdminPhoneRoutes } from './phone';

/**
 * Super Admin API (/api/superadmin/*). A separate security domain:
 * separate cookie, session table, guard and routes from business users.
 */
export async function superAdminRoutes(app: FastifyInstance, opts: { authRateLimit: number }) {
  // Super Admin has its own address: from the POS or Gravity addresses it does not exist.
  const adminUrl = app.deps.config.SUPERADMIN_APP_URL;
  if (adminUrl) {
    const hosts = new Set([new URL(adminUrl).hostname, ...(app.deps.config.SUPERADMIN_HOSTS ?? '').split(',')].map((h) => h.trim().toLowerCase()).filter(Boolean));
    app.addHook('onRequest', async (req) => {
      if (!hosts.has(req.hostname.split(':')[0]!.toLowerCase())) throw notFound();
    });
  }
  await app.register(async (pub) => superAdminAuthPublicRoutes(pub, opts));
  await app.register(superAdminPhonePublicRoutes);
  await app.register(async (secured) => {
    secured.addHook('onRequest', superAdminGuard);
    await secured.register(async (s) => superAdminAuthSessionRoutes(s, opts));
    await secured.register(businessAdminRoutes);
    await secured.register(platformRoutes);
    await secured.register(billingAdminRoutes);
    await secured.register(hubRoutes);
    await secured.register(mailRoutes);
    await secured.register(signupRoutes);
    await secured.register(superAdminPhoneRoutes);
  });
}
