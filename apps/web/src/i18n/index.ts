import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LANGUAGE, isLanguageCode, languageDir, type LanguageCode } from '@oceanx/shared';
import en from '@oceanx/shared/locales/en.json';

const PRE_AUTH_KEY = 'ox_lang';

/** English is bundled (fallback); other languages are code-split and loaded on demand. */
const loaders: Record<Exclude<LanguageCode, 'en'>, () => Promise<{ default: object }>> = {
  dv: () => import('@oceanx/shared/locales/dv.json'),
  hi: () => import('@oceanx/shared/locales/hi.json'),
  bn: () => import('@oceanx/shared/locales/bn.json'),
  ne: () => import('@oceanx/shared/locales/ne.json'),
  si: () => import('@oceanx/shared/locales/si.json'),
};

export async function ensureLoaded(lang: LanguageCode) {
  if (lang === 'en' || i18n.hasResourceBundle(lang, 'translation')) return;
  const mod = await loaders[lang]();
  i18n.addResourceBundle(lang, 'translation', mod.default, true, true);
}

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export function readStoredLanguage(): LanguageCode {
  try {
    const v = localStorage.getItem(PRE_AUTH_KEY);
    if (v && isLanguageCode(v)) return v;
  } catch {
    /* storage unavailable */
  }
  return DEFAULT_LANGUAGE;
}

/** Apply a language to the whole document: lang, dir (RTL for Dhivehi) and font loading. */
export async function applyLanguage(code: string, opts: { persist?: boolean } = {}) {
  const lang = isLanguageCode(code) ? code : DEFAULT_LANGUAGE;
  await ensureLoaded(lang);
  if (i18n.language !== lang) await i18n.changeLanguage(lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = languageDir(lang);
  if (opts.persist) {
    try {
      localStorage.setItem(PRE_AUTH_KEY, lang);
    } catch {
      /* ignore */
    }
  }
  if (lang === 'dv') void checkFaruma();
  else farumaListeners.forEach((l) => l(true));
}

// ------------------------------------------------------------ Faruma detection
type Listener = (ok: boolean) => void;
const farumaListeners = new Set<Listener>();
let farumaResult: boolean | null = null;

/**
 * Verify that the Faruma font actually loaded (not just declared). If not, the UI
 * shows a visible warning — we never silently substitute another Thaana font.
 */
export async function checkFaruma(): Promise<boolean> {
  if (farumaResult !== null) {
    farumaListeners.forEach((l) => l(farumaResult!));
    return farumaResult;
  }
  try {
    const faces = await document.fonts.load('16px Faruma', 'ދިވެހި');
    farumaResult = faces.some((f) => f.family.replace(/["']/g, '') === 'Faruma' && f.status === 'loaded');
  } catch {
    farumaResult = false;
  }
  farumaListeners.forEach((l) => l(farumaResult!));
  return farumaResult;
}

export function onFarumaStatus(l: Listener): () => void {
  farumaListeners.add(l);
  return () => farumaListeners.delete(l);
}

export default i18n;
