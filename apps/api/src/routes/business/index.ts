import type { FastifyInstance } from 'fastify';
import { businessGuard } from '../../guards/business';
import { businessAuthPublicRoutes, businessAuthSessionRoutes } from './auth';
import { miscRoutes } from './misc';
import { settingsRoutes } from './settings';
import { userRoutes } from './users';

/**
 * Business-user API (/api/*). Public auth endpoints live in their own scope;
 * everything else is behind BusinessUserGuard, which resolves the tenant from
 * the session.
 */
export async function businessRoutes(app: FastifyInstance, opts: { authRateLimit: number }) {
  await app.register(async (pub) => businessAuthPublicRoutes(pub, opts));
  await app.register(async (secured) => {
    secured.addHook('onRequest', businessGuard);
    await secured.register(businessAuthSessionRoutes);
    await secured.register(miscRoutes);
    await secured.register(userRoutes);
    await secured.register(settingsRoutes);
  });
}
