import { eq } from 'drizzle-orm';
import { mergeBusinessSettings, type BusinessSettings, type SettingsSection } from '@oceanx/shared';
import type { Executor } from '../db/client';
import { businessSettings, businesses } from '../db/schema';

export async function loadBusinessSettings(db: Executor, businessId: string): Promise<BusinessSettings> {
  const [b] = await db.select({ currency: businesses.currency, timezone: businesses.timezone }).from(businesses).where(eq(businesses.id, businessId));
  const [row] = await db.select({ settings: businessSettings.settings }).from(businessSettings).where(eq(businessSettings.businessId, businessId));
  const merged = mergeBusinessSettings(row?.settings);
  if (b && !row) {
    merged.regional.currency = b.currency;
    merged.regional.timezone = b.timezone;
  }
  return merged;
}

export async function saveSettingsSection<S extends SettingsSection>(
  db: Executor,
  businessId: string,
  section: S,
  value: BusinessSettings[S],
  userId: string,
): Promise<BusinessSettings> {
  const current = await loadBusinessSettings(db, businessId);
  const next = { ...current, [section]: value };
  await db
    .insert(businessSettings)
    .values({ businessId, settings: next, updatedBy: userId })
    .onConflictDoUpdate({ target: businessSettings.businessId, set: { settings: next, updatedAt: new Date(), updatedBy: userId } });
  return next;
}
