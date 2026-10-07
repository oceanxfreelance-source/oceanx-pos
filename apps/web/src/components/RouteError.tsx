import { useEffect } from 'react';
import { useRouteError } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';
import { isStaleChunkError, reloadForNewVersion } from '../lib/staleChunk';
import { Button } from './ui/Button';
import { Logo } from './Logo';

/** Friendly fallback for errors while loading or rendering a page (replaces the router's developer screen). */
export function RouteError() {
  const error = useRouteError();
  const { t } = useTranslation();
  const stale = isStaleChunkError(error);
  useEffect(() => {
    if (stale) reloadForNewVersion();
  }, [stale]);
  if (import.meta.env.DEV) console.error(error);
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-slate-50 p-6 text-center dark:bg-slate-950">
      <Logo className="size-12" />
      <p className="max-w-sm text-slate-700 dark:text-slate-200">{t('errors.internal_error')}</p>
      <div className="flex gap-2">
        <Button icon={<RefreshCw className="size-4" />} onClick={() => window.location.reload()}>
          {t('common.reload')}
        </Button>
        <a href="/">
          <Button variant="secondary">{t('common.go_home')}</Button>
        </a>
      </div>
    </div>
  );
}
