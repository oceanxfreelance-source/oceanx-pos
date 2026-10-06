import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { useFormat } from '../../lib/format';

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  /** Hide on small screens (the mobile card layout shows the primary columns). */
  hideOnMobile?: boolean;
}

export function DataTable<T>({ columns, rows, rowKey, onRowClick }: { columns: Column<T>[]; rows: T[]; rowKey: (r: T) => string; onRowClick?: (r: T) => void }) {
  return (
    <>
      {/* Desktop / tablet */}
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800">
              {columns.map((c) => (
                <th key={c.key} scope="col" className={clsx('px-5 py-3 text-start text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400', c.className)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((r) => (
              <tr
                key={rowKey(r)}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                className={clsx('transition-colors', onRowClick && 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50')}
              >
                {columns.map((c) => (
                  <td key={c.key} className={clsx('px-5 py-3.5 align-middle text-slate-700 dark:text-slate-300', c.className)}>
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Mobile: stacked cards, not a shrunken table */}
      <ul className="divide-y divide-slate-100 md:hidden dark:divide-slate-800">
        {rows.map((r) => (
          <li key={rowKey(r)} onClick={onRowClick ? () => onRowClick(r) : undefined} className={clsx('space-y-1.5 px-4 py-3.5', onRowClick && 'active:bg-slate-50')}>
            {columns
              .filter((c) => !c.hideOnMobile)
              .map((c, i) => (
                <div key={c.key} className={clsx('flex items-center justify-between gap-3 text-sm', i === 0 && 'font-medium')}>
                  {i > 0 && <span className="text-xs text-slate-500">{c.header}</span>}
                  <div className={clsx('min-w-0', i > 0 && 'text-end')}>{c.cell(r)}</div>
                </div>
              ))}
          </li>
        ))}
      </ul>
    </>
  );
}

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const { t } = useTranslation();
  const f = useFormat();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-sm dark:border-slate-800">
      <p className="text-slate-500">{t('common.showing_range', { from: f.number(from), to: f.number(to), total: f.number(total) })}</p>
      <div className="flex gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label={t('common.previous')}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <ChevronLeft className="rtl-flip size-4" />
        </button>
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          aria-label={t('common.next')}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <ChevronRight className="rtl-flip size-4" />
        </button>
      </div>
    </div>
  );
}
