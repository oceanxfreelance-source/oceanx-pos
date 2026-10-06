export const LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English', dir: 'ltr' },
  { code: 'dv', name: 'Dhivehi', nativeName: 'ދިވެހި', dir: 'rtl' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', dir: 'ltr' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', dir: 'ltr' },
  { code: 'ne', name: 'Nepali', nativeName: 'नेपाली', dir: 'ltr' },
  { code: 'si', name: 'Sinhala', nativeName: 'සිංහල', dir: 'ltr' },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];
export const LANGUAGE_CODES = LANGUAGES.map((l) => l.code) as unknown as readonly [LanguageCode, ...LanguageCode[]];
export const DEFAULT_LANGUAGE: LanguageCode = 'en';

export function isLanguageCode(code: string): code is LanguageCode {
  return (LANGUAGE_CODES as readonly string[]).includes(code);
}

export function languageDir(code: string): 'ltr' | 'rtl' {
  return LANGUAGES.find((l) => l.code === code)?.dir ?? 'ltr';
}
