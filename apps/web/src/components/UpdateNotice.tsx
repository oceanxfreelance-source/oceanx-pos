import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';

/** The main script this page was loaded with (e.g. /assets/index-AbC123.js); null in development. */
const loadedScript = () => document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]')?.getAttribute('src') ?? null;

/**
 * Screens that stay open all day (counter PCs, the Windows app) keep running the version they were opened
 * with. Check now and then for a newer one and offer a reload — never reload by itself mid-sale.
 */
export function UpdateNotice() {
  const { t } = useTranslation();
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    const current = loadedScript();
    if (!current) return;
    let stopped = false;
    const check = async () => {
      if (stopped || document.visibilityState !== 'visible') return;
      try {
        const html = await (await fetch('/', { cache: 'no-store', headers: { accept: 'text/html' } })).text();
        const latest = html.match(/\/assets\/index-[^"']+\.js/)?.[0];
        if (latest && latest !== current) setAvailable(true);
      } catch {
        // Offline or server busy: try again later.
      }
    };
    const timer = window.setInterval(() => void check(), 5 * 60_000);
    const onFocus = () => void check();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, []);
  if (!available) return null;
  return (
    <div role="status" className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 print:hidden">
      <div className="flex items-center gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white shadow-xl ring-1 ring-white/10 dark:bg-slate-100 dark:text-slate-900">
        <span>{t('common.update_available')}</span>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-1.5 font-semibold text-white hover:bg-brand-500"
        >
          <RefreshCw className="size-4" /> {t('common.reload')}
        </button>
      </div>
    </div>
  );
}
