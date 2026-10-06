import { useTranslation } from 'react-i18next';
import { Logo } from './Logo';

/** Full-screen branded loader shown while the session or a top-level chunk loads. */
export function AppLoader() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-slate-50 dark:bg-slate-950" role="status" aria-live="polite">
      <Logo className="size-12 animate-pulse" />
      <div className="h-1 w-32 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div className="animate-loader h-full w-1/3 rounded-full bg-brand-600" />
      </div>
      <span className="sr-only">{t('common.loading')}</span>
    </div>
  );
}
