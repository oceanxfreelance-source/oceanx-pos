import type { FastifyInstance } from 'fastify';
import { businessGuard } from '../../guards/business';
import { businessAuthPublicRoutes, businessAuthSessionRoutes } from './auth';
import { miscRoutes } from './misc';
import { settingsRoutes } from './settings';
import { userRoutes } from './users';
import { catalogRoutes } from './catalog';
import { customerRoutes } from './customers';
import { saleRoutes } from './sales';
import { documentRoutes } from './documents';
import { operationsRoutes } from './operations';
import { addonModuleRoutes } from './addonModules';
import { reportRoutes } from './reports';
import { IMAGE_TYPES } from '../../lib/storage';

/**
 * Business-user API (/api/*). Public auth endpoints live in their own scope;
 * everything else is behind BusinessUserGuard, which resolves the tenant from
 * the session.
 */
export async function businessRoutes(app: FastifyInstance, opts: { authRateLimit: number }) {
  await app.register(async (pub) => businessAuthPublicRoutes(pub, opts));
  await app.register(async (secured) => {
    secured.addHook('onRequest', businessGuard);
    // Raw binary uploads (images, PDF receipts); content is re-validated by magic bytes in Storage.
    secured.addContentTypeParser([...Object.keys(IMAGE_TYPES), 'application/pdf'], { parseAs: 'buffer', bodyLimit: 5_242_880 }, (_req, body, done) => done(null, body));
    await secured.register(businessAuthSessionRoutes);
    await secured.register(miscRoutes);
    await secured.register(userRoutes);
    await secured.register(settingsRoutes);
    await secured.register(catalogRoutes);
    await secured.register(customerRoutes);
    await secured.register(saleRoutes);
    await secured.register(documentRoutes);
    await secured.register(operationsRoutes);
    await secured.register(addonModuleRoutes);
    await secured.register(reportRoutes);
  });
}
