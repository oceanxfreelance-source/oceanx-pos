import type { FastifyInstance } from 'fastify';
import { superAdminGuard } from '../../guards/superadmin';
import { superAdminAuthPublicRoutes, superAdminAuthSessionRoutes } from './auth';
import { businessAdminRoutes } from './businesses';
import { platformRoutes } from './platform';
import { billingAdminRoutes } from './billing';

/**
 * Super Admin API (/api/superadmin/*). A separate security domain:
 * separate cookie, session table, guard and routes from business users.
 */
export async function superAdminRoutes(app: FastifyInstance, opts: { authRateLimit: number }) {
  await app.register(async (pub) => superAdminAuthPublicRoutes(pub, opts));
  await app.register(async (secured) => {
    secured.addHook('onRequest', superAdminGuard);
    await secured.register(async (s) => superAdminAuthSessionRoutes(s, opts));
    await secured.register(businessAdminRoutes);
    await secured.register(platformRoutes);
    await secured.register(billingAdminRoutes);
  });
}
