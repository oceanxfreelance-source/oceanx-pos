import { BUDGET_FEATURES, type BudgetFeature } from '@oceanx/shared';
import type { Executor } from '../db/client';
import type { businesses } from '../db/schema';
import { getPlatformSettings } from './platformSettings';

/**
 * The new Gravity Budget features this account can use: those Super Admin turned on early for this account,
 * plus those turned on for every account.
 */
export async function budgetFeaturesFor(db: Executor, business: Pick<typeof businesses.$inferSelect, 'product' | 'betaFeatures'>): Promise<BudgetFeature[]> {
  if (business.product !== 'budget') return [];
  const settings = await getPlatformSettings(db);
  const on = new Set<string>(business.betaFeatures ?? []);
  if (settings.budgetLoansForAll) on.add('loans');
  return BUDGET_FEATURES.filter((f) => on.has(f));
}
