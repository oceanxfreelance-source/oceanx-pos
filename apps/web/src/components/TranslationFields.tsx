import { useTranslation } from 'react-i18next';
import { LANGUAGES, languageDir, type LanguageCode, type Translations } from '@oceanx/shared';
import { Input, Textarea } from './ui/Form';

const OTHER = LANGUAGES.filter((l) => l.code !== 'en' && l.code !== 'dv');
const DV = LANGUAGES.find((l) => l.code === 'dv')!;

/**
 * Menu names in other languages: Dhivehi always visible, the rest under "More languages".
 * Customers see these on the QR menu when they switch language; empty means the main name is shown.
 */
export function TranslationFields({ value, onChange, withDescription = false }: { value: Translations; onChange: (v: Translations) => void; withDescription?: boolean }) {
  const { t } = useTranslation();
  const get = (code: LanguageCode) => value[code] ?? { name: '', description: '' };
  const set = (code: LanguageCode, k: 'name' | 'description', v: string) => onChange({ ...value, [code]: { ...get(code), [k]: v } });
  const fields = (l: (typeof LANGUAGES)[number]) => (
    <div key={l.code} className="space-y-3">
      <Input
        label={t('menu_i18n.name_in', { language: l.nativeName })}
        lang={l.code}
        dir={languageDir(l.code)}
        value={get(l.code).name}
        onChange={(e) => set(l.code, 'name', e.target.value)}
        maxLength={120}
      />
      {withDescription && (
        <Textarea
          label={t('menu_i18n.description_in', { language: l.nativeName })}
          lang={l.code}
          dir={languageDir(l.code)}
          rows={2}
          value={get(l.code).description}
          onChange={(e) => set(l.code, 'description', e.target.value)}
          maxLength={1000}
        />
      )}
    </div>
  );
  const filledOthers = OTHER.filter((l) => get(l.code).name || get(l.code).description).length;
  return (
    <div className="space-y-3">
      {fields(DV)}
      <p className="text-xs text-slate-500">{t('menu_i18n.hint')}</p>
      <details className="rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700" open={filledOthers > 0}>
        <summary className="cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-200">
          {t('menu_i18n.more_languages')} <span className="text-slate-400">({OTHER.map((l) => l.nativeName).join(', ')})</span>
        </summary>
        <div className="mt-3 space-y-4">{OTHER.map(fields)}</div>
      </details>
    </div>
  );
}

/** Pick the customer's language, falling back to the main text. */
export function localized(base: { name: string; description?: string; translations?: Translations | null }, lang: string) {
  const tr = base.translations?.[lang as LanguageCode];
  return { name: tr?.name || base.name, description: tr?.description || base.description || '' };
}
