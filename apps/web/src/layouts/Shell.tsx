import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Menu, X } from 'lucide-react';
import clsx from 'clsx';
import { Logo } from '../components/Logo';
import { FarumaWarning } from '../components/FarumaWarning';

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

export function Shell({
  brand,
  brandSub,
  groups,
  topbar,
  footer,
  children,
}: {
  brand: ReactNode;
  brandSub?: ReactNode;
  groups: NavGroup[];
  topbar?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);

  const nav = (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
      {groups
        .filter((g) => g.items.length)
        .map((g, gi) => (
          <div key={gi}>
            {g.label && <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">{g.label}</p>}
            <ul className="space-y-0.5">
              {g.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      clsx(
                        'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-200'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100',
                      )
                    }
                  >
                    <item.icon className="size-[18px] shrink-0" />
                    <span className="truncate">{t(item.label)}</span>
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

  return (
    <div className="min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-64 flex-col border-e border-slate-200 bg-white lg:flex dark:border-slate-800 dark:bg-slate-900">
        {brandBlock}
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
            {nav}
            {footer && <div className="border-t border-slate-200 p-3 dark:border-slate-800">{footer}</div>}
          </aside>
        </div>
      )}
      <div className="lg:ps-64">
        <FarumaWarning />
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/85 px-4 backdrop-blur sm:px-6 dark:border-slate-800 dark:bg-slate-900/85">
          <button type="button" className="-ms-1 rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden dark:text-slate-300" onClick={() => setOpen(true)} aria-label={t('common.menu')}>
            <Menu className="size-5" />
          </button>
          <div className="flex flex-1 items-center justify-end gap-2">{topbar}</div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
