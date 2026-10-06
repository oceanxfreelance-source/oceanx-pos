import { useTranslation } from 'react-i18next';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import type { ThemeChoice } from '../lib/theme';
import { Dropdown, DropdownItem } from './Dropdown';

const ICONS = { light: Sun, dark: Moon, system: Monitor } as const;

/** Light / dark / follow-device switch for the top bar. */
export function ThemeToggle({ value, onChange }: { value: ThemeChoice; onChange: (t: ThemeChoice) => void }) {
  const { t } = useTranslation();
  const Icon = ICONS[value];
  return (
    <Dropdown
      trigger={() => (
        <button type="button" aria-label={t('account.theme')} title={t('account.theme')} className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
          <Icon className="size-5" />
        </button>
      )}
    >
      {(close) =>
        (['light', 'dark', 'system'] as const).map((k) => {
          const I = ICONS[k];
          return (
            <DropdownItem
              key={k}
              active={value === k}
              icon={<I className="size-4" />}
              onClick={() => {
                close();
                onChange(k);
              }}
            >
              <span className="flex flex-1 items-center justify-between gap-3">
                {t(`account.theme_${k}`)}
                {value === k && <Check className="size-4 text-brand-600" />}
              </span>
            </DropdownItem>
          );
        })
      }
    </Dropdown>
  );
}
