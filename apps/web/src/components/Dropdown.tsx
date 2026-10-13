import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import clsx from 'clsx';

export function Dropdown({ trigger, children, align = 'end' }: { trigger: (open: boolean) => ReactNode; children: (close: () => void) => ReactNode; align?: 'start' | 'end' }) {
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState(align);
  const ref = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  // Keep the menu on screen: e.g. in right-to-left languages an "end" menu near the left edge would open off-screen.
  // On a phone a wide menu may fit on neither side of its button: then it spans the screen just below the button.
  const [fixed, setFixed] = useState<{ top: number } | null>(null);
  useLayoutEffect(() => {
    if (!open) {
      setFixed(null);
      return setSide(align);
    }
    const r = menu.current?.getBoundingClientRect();
    const btn = ref.current?.getBoundingClientRect();
    if (!r || !btn || fixed) return;
    const w = menu.current!.offsetWidth;
    const fits = (left: number) => left >= 8 && left + w <= window.innerWidth - 8;
    const endLeft = btn.right - w;
    const startLeft = btn.left;
    const rtl = document.documentElement.dir === 'rtl';
    const [first, second] = (side === 'end') !== rtl ? [endLeft, startLeft] : [startLeft, endLeft];
    if (fits(first)) return;
    if (fits(second)) return setSide((s) => (s === 'end' ? 'start' : 'end'));
    setFixed({ top: btn.bottom + 8 });
  }, [open, align, side, fixed]);
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
          style={fixed ? { top: fixed.top } : undefined}
          className={clsx(
            'animate-pop-in z-40 min-w-56 rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800',
            fixed ? 'fixed inset-x-2 [&>*]:!w-full [&>*]:!max-w-none' : clsx('absolute mt-2', side === 'end' ? 'end-0' : 'start-0'),
          )}
          ref={menu}
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
