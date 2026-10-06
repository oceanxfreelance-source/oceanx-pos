import { useTranslation } from 'react-i18next';

/**
 * Locale-aware formatting. Western (latn) digits are used in every language so
 * invoice numbers, amounts, SKUs and phone numbers stay unambiguous — this is
 * also the norm for Dhivehi business documents.
 */
const LOCALE: Record<string, string> = { en: 'en-GB', dv: 'dv-MV', hi: 'hi-IN', bn: 'bn-BD', ne: 'ne-NP', si: 'si-LK' };

export function localeFor(lang: string) {
  return `${LOCALE[lang] ?? 'en-GB'}-u-nu-latn`;
}

/** Wrap in Unicode LTR isolate (LRI…PDI) so numeric dates/times keep their order inside RTL text. */
const ltr = (s: string) => `⁦${s}⁩`;
const pad = (n: number) => String(n).padStart(2, '0');

/** Browsers ship no CLDR data for some locales (e.g. Dhivehi); never show English month names there. */
function intlSupports(locale: string): boolean {
  try {
    return Intl.DateTimeFormat.supportedLocalesOf([locale.split('-u-')[0]!]).length > 0;
  } catch {
    return false;
  }
}

export function useFormat() {
  const { t, i18n } = useTranslation();
  const locale = localeFor(i18n.language);
  const native = intlSupports(locale);
  const numericDate = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  return {
    locale,
    number: (n: number, digits = 0) => new Intl.NumberFormat(locale, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n),
    money: (n: number | string, currency: string, symbol?: string, decimals = 2) => {
      const v = typeof n === 'string' ? Number(n) : n;
      const formatted = new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v);
      return ltr(`${symbol || currency} ${formatted}`);
    },
    date: (d: string | Date | null | undefined) => {
      if (!d) return '—';
      const date = new Date(d);
      return native ? new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(date) : ltr(numericDate(date));
    },
    dateTime: (d: string | Date | null | undefined) => {
      if (!d) return '—';
      const date = new Date(d);
      return native
        ? new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
        : ltr(`${numericDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`);
    },
    /** Relative time from translation keys, so every supported language reads naturally. */
    relative: (d: string | Date | null | undefined) => {
      if (!d) return '—';
      const diffSec = (new Date(d).getTime() - Date.now()) / 1000;
      const abs = Math.abs(diffSec);
      if (diffSec > 60) return t('time.in_days', { count: Math.max(1, Math.round(abs / 86400)) });
      if (abs < 60) return t('time.just_now');
      if (abs < 3600) return t('time.minutes_ago', { count: Math.round(abs / 60) });
      if (abs < 86400) return t('time.hours_ago', { count: Math.round(abs / 3600) });
      return t('time.days_ago', { count: Math.round(abs / 86400) });
    },
  };
}
