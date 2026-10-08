import { and, eq } from 'drizzle-orm';
import type { Executor } from '../db/client';
import { users } from '../db/schema';
import type { BusinessContext } from '../types';
import { loadBusinessSettings } from './settings';

/**
 * Stamp and signature for a printed document: the company stamp (if uploaded and switched on) and the
 * signature of the person who prepared the document (if they added one and signatures are switched on).
 */
export async function documentBranding(db: Executor, ctx: BusinessContext, preparedBy: string | null | undefined) {
  const settings = await loadBusinessSettings(db, ctx.businessId);
  const stamp = settings.branding.showStamp && !!ctx.access.business.stampPath;
  let signer: { id: string; name: string; hasSignature: boolean } | null = null;
  if (preparedBy) {
    const [u] = await db
      .select({ id: users.id, name: users.name, signaturePath: users.signaturePath })
      .from(users)
      .where(and(eq(users.id, preparedBy), eq(users.businessId, ctx.businessId)));
    if (u) signer = { id: u.id, name: u.name, hasSignature: settings.branding.showSignature && !!u.signaturePath };
  }
  return { stamp, signer };
}
