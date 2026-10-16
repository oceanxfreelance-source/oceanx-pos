import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import { HOST_PRODUCT } from '../lib/product';

declare const __ANDROID_VERSIONS__: Record<string, string>;

/** "1.0.10" > "1.0.9" */
const newer = (a: string, b: string) => {
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  return false;
};

/**
 * Inside an older Gravity, Gravity Flow or Gravity Budget phone app: a bar offering the new app (one tap downloads it).
 * Everyday changes need no download — the app shows the live site — so this appears only when the app itself changed.
 */
export function AppUpdateBanner() {
  const { t } = useTranslation();
  const installed = /\bOceanXAndroid\/([\d.]+)/.exec(navigator.userAgent)?.[1];
  const latest = typeof __ANDROID_VERSIONS__ !== 'undefined' ? __ANDROID_VERSIONS__[HOST_PRODUCT] : '';
  if (!installed || !latest || !newer(latest, installed)) return null;
  return (
    <a href={`/download/${HOST_PRODUCT}.apk`} className="mb-4 flex items-center gap-3 rounded-2xl bg-brand-700 px-4 py-3 text-sm text-white shadow-sm">
      <Download className="size-5 shrink-0" />
      <span className="min-w-0 flex-1">{t('app_update.title')}</span>
      <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand-800">{t('app_update.action')}</span>
    </a>
  );
}
