import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Menu, MoreHorizontal, Search, X } from 'lucide-react';
import clsx from 'clsx';
import { Logo } from '../components/Logo';
import { FarumaWarning } from '../components/FarumaWarning';
import { CommandPalette, type PaletteGroup } from '../components/CommandPalette';

export interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  end?: boolean;
}
export interface NavGroup {
  label?: string;
  items: NavItem[];
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export function Shell({
  brand,
  brandSub,
  groups,
  topbar,
  footer,
  primaryAction,
  bottomNav,
  palette,
  children,
}: {
  brand: ReactNode;
  brandSub?: ReactNode;
  groups: NavGroup[];
  topbar?: ReactNode;
  footer?: ReactNode;
  /** Prominent call to action at the top of the sidebar (e.g. "Open POS"). Label is a translation key. */
  primaryAction?: NavItem;
  /** Up to four destinations for the phone tab bar; "More" opens the full menu. Labels are translation keys. */
  bottomNav?: NavItem[];
  /** Groups for the ⌘K quick search. */
  palette?: PaletteGroup[];
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (!palette) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearching((s) => !s);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [palette]);

  const nav = (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 pt-2 pb-4">
      {groups
        .filter((g) => g.items.length)
        .map((g, gi) => (
          <div key={gi}>
            {g.label && <p className="mb-1 px-3 text-[11px] font-semibold tracking-wider text-slate-400 uppercase dark:text-slate-500">{g.label}</p>}
            <ul className="space-y-0.5">
              {g.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      clsx(
                        'group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-brand-50 text-brand-800 dark:bg-brand-950/70 dark:text-brand-200'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && <span aria-hidden className="absolute inset-y-2 start-0 w-1 rounded-full bg-brand-600" />}
                        <item.icon className={clsx('size-[18px] shrink-0', isActive ? 'text-brand-700 dark:text-brand-300' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200')} />
                        <span className="truncate">{t(item.label)}</span>
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
    </nav>
  );

  const brandBlock = (
    <div className="flex h-16 items-center gap-3 px-5">
      <Logo />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{brand}</p>
        {brandSub && <p className="truncate text-xs text-slate-500">{brandSub}</p>}
      </div>
    </div>
  );

  const cta = primaryAction && (
    <div className="px-3 pb-2">
      <Link
        to={primaryAction.to}
        className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-900/20 transition hover:from-brand-500 hover:to-brand-700"
      >
        <primaryAction.icon className="size-[18px]" />
        {t(primaryAction.label)}
      </Link>
    </div>
  );

  return (
    <div className="min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-64 flex-col border-e border-slate-200 bg-white lg:flex dark:border-slate-800 dark:bg-slate-900">
        {brandBlock}
        {cta}
        {nav}
        {footer && <div className="border-t border-slate-200 p-3 dark:border-slate-800">{footer}</div>}
      </aside>
      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="animate-fade-in absolute inset-0 bg-slate-950/40" onClick={() => setOpen(false)} />
          <aside className="animate-slide-in-start rtl:animate-none absolute inset-y-0 start-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl dark:bg-slate-900">
            <div className="flex items-center justify-between pe-3">
              {brandBlock}
              <button type="button" onClick={() => setOpen(false)} aria-label={t('common.close')} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                <X className="size-5" />
              </button>
            </div>
            {cta}
            {nav}
            {footer && <div className="border-t border-slate-200 p-3 dark:border-slate-800">{footer}</div>}
          </aside>
        </div>
      )}
      <div className="lg:ps-64">
        <FarumaWarning />
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200/80 bg-white/85 px-4 backdrop-blur sm:px-6 dark:border-slate-800 dark:bg-slate-900/85">
          <button type="button" className="-ms-1 rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden dark:text-slate-300" onClick={() => setOpen(true)} aria-label={t('common.menu')}>
            <Menu className="size-5" />
          </button>
          {palette && (
            <button
              type="button"
              onClick={() => setSearching(true)}
              aria-label={t('palette.placeholder')}
              className="flex h-10 items-center gap-2.5 rounded-xl text-sm text-slate-500 ring-slate-200 transition hover:text-slate-700 sm:w-full sm:max-w-sm sm:bg-slate-100/70 sm:px-3 sm:ring-1 dark:ring-slate-700 dark:hover:text-slate-200 sm:dark:bg-slate-800/60"
            >
              <Search className="size-[18px]" />
              <span className="hidden flex-1 text-start sm:block">{t('palette.placeholder')}</span>
              <kbd className="hidden rounded-md bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200 md:block dark:bg-slate-900 dark:ring-slate-700" dir="ltr">
                {isMac ? '⌘K' : 'Ctrl K'}
              </kbd>
            </button>
          )}
          <div className="flex flex-1 items-center justify-end gap-2">{topbar}</div>
        </header>
        <main className={clsx('mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8', bottomNav?.length && 'pb-28 lg:pb-8')}>{children}</main>
      </div>
      {/* Phone tab bar */}
      {bottomNav && bottomNav.length > 0 && (
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-900/95" aria-label={t('common.menu')}>
          <ul className="mx-auto flex max-w-md">
            {bottomNav.slice(0, 4).map((item) => (
              <li key={item.to} className="flex-1">
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    clsx('flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium', isActive ? 'text-brand-700 dark:text-brand-300' : 'text-slate-500 dark:text-slate-400')
                  }
                >
                  <item.icon className="size-5" />
                  <span className="max-w-full truncate px-1">{t(item.label)}</span>
                </NavLink>
              </li>
            ))}
            <li className="flex-1">
              <button type="button" onClick={() => setOpen(true)} className="flex w-full flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <MoreHorizontal className="size-5" />
                {t('nav.more')}
              </button>
            </li>
          </ul>
        </nav>
      )}
      {palette && <CommandPalette open={searching} onClose={() => setSearching(false)} groups={palette} />}
    </div>
  );
}
