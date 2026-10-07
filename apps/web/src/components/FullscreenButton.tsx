import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Maximize, Minimize } from 'lucide-react';

/** Full screen on/off for counter screens (works in browsers and in the Windows app; Esc also exits). */
export function FullscreenButton() {
  const { t } = useTranslation();
  const [on, setOn] = useState(() => typeof document !== 'undefined' && !!document.fullscreenElement);
  useEffect(() => {
    const sync = () => setOn(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);
  if (typeof document === 'undefined' || !document.fullscreenEnabled) return null;
  const label = on ? t('common.exit_fullscreen') : t('common.fullscreen');
  const Icon = on ? Minimize : Maximize;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={on}
      onClick={() => void (on ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => undefined)}
      className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      <Icon className="size-5" />
    </button>
  );
}
