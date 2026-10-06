import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { compareLocales, flatten, hasKey, requiredDynamicKeys, type Dict, type ReviewItem } from '../src/i18nCheck';
import { LANGUAGE_CODES } from '../src/languages';

const dir = path.resolve(__dirname, '../locales');
const locales: Record<string, Dict> = Object.fromEntries(LANGUAGE_CODES.map((c) => [c, JSON.parse(readFileSync(path.join(dir, `${c}.json`), 'utf8'))]));

describe('translations', () => {
  it('English covers every catalog-driven key (permissions, modules, add-ons, errors, business types, roles)', () => {
    const en = flatten(locales.en!);
    expect(requiredDynamicKeys().filter((k) => !hasKey(en, k))).toEqual([]);
  });

  for (const report of compareLocales(locales)) {
    it(`${report.code}: has every English key with matching placeholders`, () => {
      expect(report.missing).toEqual([]);
      expect(report.extra).toEqual([]);
      expect(report.placeholderMismatch).toEqual([]);
    });
  }

  it('Dhivehi uses Thaana script for UI text', () => {
    const dv = flatten(locales.dv!);
    const thaana = Object.values(dv).filter((v) => /[ހ-޿]/.test(v)).length;
    expect(thaana / Object.keys(dv).length).toBeGreaterThan(0.9);
  });

  it('Dhivehi review list items are well-formed and reference real keys', () => {
    const review: ReviewItem[] = JSON.parse(readFileSync(path.join(dir, 'review/dv.json'), 'utf8'));
    const dv = flatten(locales.dv!);
    for (const item of review) {
      expect(['confirmed', 'needs_review', 'untranslated']).toContain(item.status);
      expect(item.key in dv || `${item.key}_other` in dv).toBe(true);
    }
  });
});
