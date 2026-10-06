/**
 * Translation report: npm run i18n:check
 * Prints missing keys per language, placeholder mismatches, and the Dhivehi review list status.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareLocales, flatten, hasKey, requiredDynamicKeys, type Dict, type ReviewItem } from '../src/i18nCheck';
import { LANGUAGE_CODES } from '../src/languages';

const root = path.dirname(fileURLToPath(import.meta.url));
const localeDir = path.resolve(root, '../locales');
const webSrc = path.resolve(root, '../../../apps/web/src');

const locales: Record<string, Dict> = {};
for (const c of LANGUAGE_CODES) locales[c] = JSON.parse(readFileSync(path.join(localeDir, `${c}.json`), 'utf8'));
const en = flatten(locales.en!);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(f) ? [p] : [];
  });
}
const used = new Set<string>();
for (const file of walk(webSrc)) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)) used.add(m[1]!);
  for (const m of src.matchAll(/label: '([a-z_]+\.[a-z_.]+)'/g)) used.add(m[1]!);
}
const missingStatic = [...used].filter((k) => !hasKey(en, k));
const missingDynamic = requiredDynamicKeys().filter((k) => !hasKey(en, k));

let failed = false;
console.log(`English: ${Object.keys(en).length} keys, ${used.size} static keys referenced by the UI`);
if (missingStatic.length || missingDynamic.length) {
  failed = true;
  console.log(`  Missing English keys: ${[...missingStatic, ...missingDynamic].join(', ')}`);
} else console.log('  Missing English translations: none');

for (const r of compareLocales(locales)) {
  const label = r.code.toUpperCase();
  console.log(`${label}: missing ${r.missing.length}, extra ${r.extra.length}, placeholder issues ${r.placeholderMismatch.length}, identical to English ${r.untranslatedSameAsEnglish.length}`);
  if (r.missing.length) console.log(`  missing: ${r.missing.slice(0, 40).join(', ')}${r.missing.length > 40 ? ' …' : ''}`);
  if (r.placeholderMismatch.length) console.log(`  placeholders: ${r.placeholderMismatch.join(', ')}`);
  if (r.untranslatedSameAsEnglish.length) console.log(`  same as English: ${r.untranslatedSameAsEnglish.join(', ')}`);
  if (r.missing.length || r.placeholderMismatch.length) failed = true;
}

const review: ReviewItem[] = JSON.parse(readFileSync(path.join(localeDir, 'review/dv.json'), 'utf8'));
const counts = review.reduce<Record<string, number>>((acc, i) => ((acc[i.status] = (acc[i.status] ?? 0) + 1), acc), {});
console.log(`Dhivehi review list: ${review.length} items — ${Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(', ')}`);

process.exit(failed ? 1 : 0);
