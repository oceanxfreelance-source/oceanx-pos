import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Share } from 'lucide-react';
import { android, desktop } from '../lib/desktop';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/**
 * "Install app" for tablets and phones: one tap where the browser supports it (Android Chrome, Edge),
 * the two Safari steps on iPad/iPhone. Hidden once installed and inside the Windows/Android apps.
 */
export function InstallApp() {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [showIos, setShowIos] = useState(false);
  const hidden = !!desktop || !!android || standalone();

  useEffect(() => {
    if (hidden) return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPromptEvent);
    };
    const onInstalled = () => setPrompt(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [hidden]);

  if (hidden) return null;
  if (prompt) {
    return (
      <button
        type="button"
        onClick={() => {
          void prompt.prompt();
          void prompt.userChoice.then(() => setPrompt(null));
        }}
        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50 dark:text-brand-300 dark:ring-brand-800 dark:hover:bg-brand-950"
      >
        <Download className="size-4" /> {t('app.install')}
      </button>
    );
  }
  if (!isIos()) return null;
  return (
    <div className="text-sm">
      <button type="button" onClick={() => setShowIos((v) => !v)} className="inline-flex items-center gap-2 font-medium text-brand-700 hover:underline dark:text-brand-300">
        <Download className="size-4" /> {t('app.install')}
      </button>
      {showIos && (
        <p className="mt-2 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
          <Share className="mt-0.5 size-4 shrink-0" />
          <span>{t('app.install_ios')}</span>
        </p>
      )}
    </div>
  );
}
