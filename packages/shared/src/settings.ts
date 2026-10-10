import { z } from 'zod';
import { LANGUAGE_CODES } from './languages';

/**
 * Business settings are stored per business as validated JSON sections.
 * Each section has its own permission (see SETTINGS_SECTION_PERMISSIONS) so
 * e.g. a Manager can be allowed to edit invoice numbering but not tax.
 */

const shortText = (max: number) => z.string().trim().max(max);

export const numberingSchema = z.object({
  prefix: z
    .string()
    .trim()
    .min(1)
    .max(12)
    .regex(/^[A-Za-z0-9_-]+$/),
  /** First sequence number used when a new numbering period starts. */
  startNumber: z.number().int().min(1).max(999_999_999),
  padding: z.number().int().min(1).max(10),
  /** Tokens: {PREFIX} {YYYY} {YY} {MM} {SEQ} */
  format: z
    .string()
    .trim()
    .min(5)
    .max(40)
    .refine((v) => v.includes('{SEQ}'), { message: 'format_requires_seq' }),
  reset: z.enum(['never', 'yearly', 'monthly']),
});
export type NumberingSettings = z.infer<typeof numberingSchema>;

export const settingsSectionSchemas = {
  regional: z.object({
    currency: z.string().trim().length(3).toUpperCase(),
    currencySymbol: shortText(6),
    currencyDecimals: z.number().int().min(0).max(3),
    timezone: z.string().trim().min(1).max(64),
    dateFormat: z.enum(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD', 'DD MMM YYYY']),
    timeFormat: z.enum(['24h', '12h']),
    /** Default language for printed/sent documents — independent from UI language. */
    documentLanguage: z.enum(LANGUAGE_CODES),
  }),
  tax: z.object({
    taxEnabled: z.boolean(),
    taxName: shortText(30),
    taxRate: z.number().min(0).max(100),
    pricesIncludeTax: z.boolean(),
    taxNumber: shortText(50),
    serviceChargeEnabled: z.boolean(),
    serviceChargeRate: z.number().min(0).max(100),
  }),
  receipt: z.object({
    showLogo: z.boolean(),
    header: shortText(500),
    footer: shortText(500),
    paperWidth: z.enum(['58mm', '80mm', 'a4']),
    language: z.enum(LANGUAGE_CODES).nullable(),
    numbering: numberingSchema,
  }),
  invoice: z.object({
    numbering: numberingSchema,
    defaultDueDays: z.number().int().min(0).max(365),
    notes: shortText(2000),
    terms: shortText(5000),
    footer: shortText(500),
    /** How to pay: bank, account name and number, mobile pay… printed on the document. */
    paymentDetails: shortText(1000),
    language: z.enum(LANGUAGE_CODES).nullable(),
  }),
  quotation: z.object({
    numbering: numberingSchema,
    validityDays: z.number().int().min(1).max(365),
    notes: shortText(2000),
    terms: shortText(5000),
    footer: shortText(500),
    /** How to pay: bank, account name and number, mobile pay… printed on the document. */
    paymentDetails: shortText(1000),
    language: z.enum(LANGUAGE_CODES).nullable(),
  }),
  pos: z.object({
    defaultOrderType: z.enum(['dine_in', 'takeaway', 'delivery']),
    allowNegativeStock: z.boolean(),
    sendToKitchen: z.boolean(),
    requireTableForDineIn: z.boolean(),
    maxDiscountPercent: z.number().min(0).max(100),
  }),
  loyalty: z.object({
    pointsPerUnit: z.number().min(0).max(1000),
    pointValue: z.number().min(0).max(1_000_000),
    minRedeemPoints: z.number().int().min(0).max(1_000_000),
  }),
  online: z.object({
    menuEnabled: z.boolean(),
    ordersEnabled: z.boolean(),
    showPrices: z.boolean(),
    message: shortText(500),
    /** The welcome message in other languages (customer's chosen menu language). */
    messageTranslations: z.partialRecord(z.enum(LANGUAGE_CODES), shortText(500)).default({}),
  }),
  /** Company stamp and signatures on printed documents (quotations, invoices, statements, receipts, salary sheets). */
  branding: z.object({
    showStamp: z.boolean(),
    showSignature: z.boolean(),
  }),
} as const;

export type SettingsSection = keyof typeof settingsSectionSchemas;
export const SETTINGS_SECTIONS = Object.keys(settingsSectionSchemas) as SettingsSection[];

export type BusinessSettings = { [K in SettingsSection]: z.infer<(typeof settingsSectionSchemas)[K]> };

export const businessSettingsSchema = z.object(settingsSectionSchemas);

/** Permission required to VIEW / MANAGE each settings section. */
export const SETTINGS_SECTION_PERMISSIONS: Record<SettingsSection, { view: string; manage: string }> = {
  regional: { view: 'settings.view', manage: 'settings.manage' },
  tax: { view: 'settings.view', manage: 'settings.manage' },
  receipt: { view: 'settings.view', manage: 'settings.manage' },
  invoice: { view: 'invoice_settings.view', manage: 'invoice_settings.manage' },
  quotation: { view: 'quotation_settings.view', manage: 'quotation_settings.manage' },
  pos: { view: 'settings.view', manage: 'settings.manage' },
  loyalty: { view: 'loyalty.view', manage: 'loyalty.manage' },
  online: { view: 'qr_menu.manage', manage: 'qr_menu.manage' },
  branding: { view: 'branding.manage', manage: 'branding.manage' },
};

export function defaultBusinessSettings(opts: { currency?: string; timezone?: string } = {}): BusinessSettings {
  const currency = (opts.currency ?? 'MVR').toUpperCase();
  return {
    regional: {
      currency,
      currencySymbol: currency === 'MVR' ? 'Rf' : currency,
      currencyDecimals: 2,
      timezone: opts.timezone ?? 'Indian/Maldives',
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '24h',
      documentLanguage: 'en',
    },
    tax: {
      taxEnabled: false,
      taxName: 'GST',
      taxRate: 0,
      pricesIncludeTax: false,
      taxNumber: '',
      serviceChargeEnabled: false,
      serviceChargeRate: 0,
    },
    receipt: {
      showLogo: true,
      header: '',
      footer: '',
      paperWidth: 'a4',
      language: null,
      numbering: { prefix: 'RCP', startNumber: 1, padding: 6, format: '{PREFIX}-{YYYY}-{SEQ}', reset: 'yearly' },
    },
    invoice: {
      numbering: { prefix: 'INV', startNumber: 1, padding: 5, format: '{PREFIX}-{YYYY}-{SEQ}', reset: 'yearly' },
      defaultDueDays: 14,
      notes: '',
      terms: '',
      footer: '',
      paymentDetails: '',
      language: null,
    },
    quotation: {
      numbering: { prefix: 'QT', startNumber: 1, padding: 5, format: '{PREFIX}-{YYYY}-{SEQ}', reset: 'yearly' },
      validityDays: 30,
      notes: '',
      terms: '',
      footer: '',
      paymentDetails: '',
      language: null,
    },
    pos: { defaultOrderType: 'dine_in', allowNegativeStock: true, sendToKitchen: true, requireTableForDineIn: false, maxDiscountPercent: 100 },
    loyalty: { pointsPerUnit: 1, pointValue: 1, minRedeemPoints: 100 },
    online: { menuEnabled: true, ordersEnabled: false, showPrices: true, message: '', messageTranslations: {} },
    branding: { showStamp: true, showSignature: true },
  };
}

/** Merge stored (possibly partial/older) settings over defaults. */
export function mergeBusinessSettings(stored: unknown, defaults: BusinessSettings = defaultBusinessSettings()): BusinessSettings {
  const s = (stored && typeof stored === 'object' ? stored : {}) as Record<string, unknown>;
  const out = { ...defaults } as Record<string, unknown>;
  for (const section of SETTINGS_SECTIONS) {
    const val = s[section];
    if (val && typeof val === 'object') {
      out[section] = { ...(defaults[section] as object), ...(val as object) };
    }
  }
  return out as BusinessSettings;
}

export function numberingPeriodKey(reset: NumberingSettings['reset'], date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  if (reset === 'yearly') return String(y);
  if (reset === 'monthly') return `${y}-${m}`;
  return 'all';
}

export function formatDocumentNumber(n: NumberingSettings, seq: number, date: Date): string {
  const y = String(date.getUTCFullYear());
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return n.format
    .replaceAll('{PREFIX}', n.prefix)
    .replaceAll('{YYYY}', y)
    .replaceAll('{YY}', y.slice(2))
    .replaceAll('{MM}', m)
    .replaceAll('{SEQ}', String(seq).padStart(n.padding, '0'));
}
