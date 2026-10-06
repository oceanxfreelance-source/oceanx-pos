import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CornerDownLeft, Search } from 'lucide-react';
import clsx from 'clsx';

export interface PaletteItem {
  to: string;
  label: string; // translation key
  icon: ComponentType<{ className?: string }>;
}
export interface PaletteGroup {
  label: string; // translation key
  items: PaletteItem[];
}

const norm = (s: string) => s.toLocaleLowerCase().normalize('NFKD').replace(/\p{M}/gu, '');

/** Keyboard-first "jump to" dialog (⌘K / Ctrl+K): every screen and quick action the user is allowed to use. */
export function CommandPalette({ open, onClose, groups }: { open: boolean; onClose: () => void; groups: PaletteGroup[] }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) {
      setQ('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);
  const filtered = useMemo(() => {
    const needle = norm(q.trim());
    const seen = new Set<string>();
    return groups
      .map((g) => ({
        label: g.label,
        items: g.items.filter((i) => {
          const key = `${g.label}|${i.to}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return !needle || norm(t(i.label)).includes(needle) || norm(i.to).includes(needle);
        }),
      }))
      .filter((g) => g.items.length);
  }, [groups, q, t]);
  const flat = filtered.flatMap((g) => g.items);
  useEffect(() => setActive(0), [q]);
  if (!open) return null;
  const go = (i: PaletteItem | undefined) => {
    if (!i) return;
    onClose();
    navigate(i.to);
  };
  let idx = -1;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label={t('palette.title')}>
      <div className="animate-fade-in absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="animate-pop-in relative w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 dark:border-slate-800">
          <Search className="size-5 shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(flat.length - 1, a + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === 'Enter') go(flat[active]);
            }}
            placeholder={t('palette.placeholder')}
            aria-label={t('palette.placeholder')}
            className="h-14 w-full border-0 bg-transparent text-base outline-none placeholder:text-slate-400"
          />
          <kbd className="hidden rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500 sm:block dark:bg-slate-800">Esc</kbd>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {flat.length === 0 && <p className="px-3 py-8 text-center text-sm text-slate-500">{t('palette.no_results')}</p>}
          {filtered.map((g) => (
            <div key={g.label} className="py-1">
              <p className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">{t(g.label)}</p>
              <ul>
                {g.items.map((i) => {
                  idx += 1;
                  const me = idx;
                  return (
                    <li key={`${g.label}${i.to}`}>
                      <button
                        type="button"
                        onMouseEnter={() => setActive(me)}
                        onClick={() => go(i)}
                        className={clsx(
                          'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-sm',
                          active === me ? 'bg-brand-50 text-brand-900 dark:bg-brand-950 dark:text-brand-100' : 'text-slate-700 dark:text-slate-200',
                        )}
                      >
                        <span className={clsx('flex size-8 items-center justify-center rounded-lg', active === me ? 'bg-white text-brand-700 dark:bg-brand-900 dark:text-brand-200' : 'bg-slate-100 text-slate-500 dark:bg-slate-800')}>
                          <i.icon className="size-4" />
                        </span>
                        <span className="flex-1 truncate font-medium">{t(i.label)}</span>
                        {active === me && <CornerDownLeft className="size-4 text-brand-500" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
