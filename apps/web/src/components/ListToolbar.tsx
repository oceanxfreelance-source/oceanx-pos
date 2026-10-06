import type { ReactNode } from 'react';
import { Search } from 'lucide-react';

export function ListToolbar({ search, onSearch, placeholder, children }: { search?: string; onSearch?: (v: string) => void; placeholder?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-end dark:border-slate-800">
      {onSearch && (
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={placeholder}
            className="w-full rounded-xl border-0 bg-slate-50 py-2.5 ps-9 pe-3 text-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-brand-600 focus:outline-none dark:bg-slate-800 dark:ring-slate-700"
          />
        </div>
      )}
      {children && <div className="grid flex-1 gap-3 sm:auto-cols-fr sm:grid-flow-col">{children}</div>}
    </div>
  );
}
