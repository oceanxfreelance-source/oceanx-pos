import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '@oceanx/shared';
import { api } from '../../lib/api';
import { applyLanguage } from '../../i18n';

/** Pre-login language choice (stored locally; after login the user's own language applies). */
export function LanguagePicker({ onChange }: { onChange?: (code: string) => void }) {
  const { i18n, t } = useTranslation();
  const q = useQuery({
    queryKey: ['public', 'languages'],
    queryFn: () => api.get<{ items: { code: string; nativeName: string }[] }>('/languages'),
    staleTime: 300_000,
  });
  const langs = q.data?.items ?? LANGUAGES.map((l) => ({ code: l.code, nativeName: l.nativeName }));
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('common.language')}>
      {langs.map((l) => (
        <button
          key={l.code}
          type="button"
          lang={l.code}
          onClick={() => {
            void applyLanguage(l.code, { persist: true });
            onChange?.(l.code);
          }}
          className={
            i18n.language === l.code
              ? 'rounded-full bg-brand-700 px-3 py-1 text-xs font-medium text-white'
              : 'rounded-full px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800'
          }
        >
          {l.nativeName}
        </button>
      ))}
    </div>
  );
}
