import { platformSettingsSchema } from '@oceanx/shared';
import type { z } from 'zod';
import type { Executor } from '../db/client';
import { platformSettings } from '../db/schema';

export type PlatformSettings = Required<z.infer<typeof platformSettingsSchema>>;

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  platformName: 'OceanX',
  supportEmail: '',
  registrationMode: 'approval',
  defaultPlanCode: 'trial',
  defaultCurrency: 'MVR',
};

export async function getPlatformSettings(db: Executor): Promise<PlatformSettings> {
  const rows = await db.select().from(platformSettings);
  const out: Record<string, unknown> = { ...DEFAULT_PLATFORM_SETTINGS };
  for (const r of rows) if (r.key in out) out[r.key] = r.value;
  return out as PlatformSettings;
}
