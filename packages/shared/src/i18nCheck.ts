import { ADDONS, MODULES } from './modules';
import { BUSINESS_TYPES } from './businessTypes';
import { ERROR_CODES } from './errors';
import { LANGUAGE_CODES } from './languages';
import { PERMISSIONS, SYSTEM_ROLE_KEYS } from './permissions';

export type Dict = { [k: string]: string | Dict };

export function flatten(obj: Dict, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else Object.assign(out, flatten(v, key));
  }
  return out;
}

const dot = (s: string) => s.replaceAll('.', '_');

/** Keys that must exist because they are built dynamically from the shared catalogs. */
export function requiredDynamicKeys(): string[] {
  return [
    ...PERMISSIONS.map((p) => `perm.${dot(p.key)}`),
    ...MODULES.map((m) => `modules.${m}`),
    ...ADDONS.flatMap((a) => [`addons.names.${a}`, `addons.descriptions.${a}`]),
    ...ERROR_CODES.map((c) => `errors.${c}`),
    ...BUSINESS_TYPES.map((b) => `business_types.${b}`),
    ...SYSTEM_ROLE_KEYS.flatMap((r) => [`roles.system.${r}`, `roles.system_desc.${r}`]),
  ];
}

/** A key used with i18next plurals exists as key_one/key_other. */
export function hasKey(flat: Record<string, string>, key: string): boolean {
  return key in flat || `${key}_other` in flat;
}

const placeholders = (s: string) => new Set([...s.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]));

export interface LocaleReport {
  code: string;
  missing: string[];
  extra: string[];
  placeholderMismatch: string[];
  untranslatedSameAsEnglish: string[];
}

export function compareLocales(locales: Record<string, Dict>): LocaleReport[] {
  const en = flatten(locales.en ?? {});
  return LANGUAGE_CODES.filter((c) => c !== 'en').map((code) => {
    const flat = flatten(locales[code] ?? {});
    const missing = Object.keys(en).filter((k) => !(k in flat));
    const extra = Object.keys(flat).filter((k) => !(k in en));
    const placeholderMismatch = Object.keys(en).filter((k) => {
      if (!(k in flat)) return false;
      const a = placeholders(en[k]!);
      const b = placeholders(flat[k]!);
      return [...a].some((p) => !b.has(p));
    });
    // Brand names / codes are legitimately identical; everything else should differ.
    const untranslatedSameAsEnglish = Object.keys(en).filter((k) => flat[k] === en[k] && !/^(app\.name|modules\.pos|.*\bqr_menu|perm\.pos_access)$/.test(k) && /[a-z]{3}/i.test(en[k]!));
    return { code, missing, extra, placeholderMismatch, untranslatedSameAsEnglish };
  });
}

export interface ReviewItem {
  key: string;
  english: string;
  suggested: string;
  status: 'confirmed' | 'needs_review' | 'untranslated';
  notes: string;
}
