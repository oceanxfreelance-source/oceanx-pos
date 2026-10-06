import { useEffect, useRef, useState, type ReactNode } from 'react';
import clsx from 'clsx';

export function Dropdown({ trigger, children, align = 'end' }: { trigger: (open: boolean) => ReactNode; children: (close: () => void) => ReactNode; align?: 'start' | 'end' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <div onClick={() => setOpen((o) => !o)}>{trigger(open)}</div>
      {open && (
        <div
          className={clsx(
            'animate-pop-in absolute z-40 mt-2 min-w-56 rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800',
            align === 'end' ? 'end-0' : 'start-0',
          )}
          role="menu"
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function DropdownItem({ onClick, children, icon, active, danger }: { onClick: () => void; children: ReactNode; icon?: ReactNode; active?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={clsx(
        'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-start text-sm transition-colors',
        danger ? 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800',
        active && 'bg-brand-50 font-medium text-brand-800 dark:bg-brand-950 dark:text-brand-200',
      )}
    >
      {icon}
      {children}
    </button>
  );
}
