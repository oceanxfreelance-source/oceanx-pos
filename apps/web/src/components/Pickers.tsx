import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { api, qs, type Paginated } from '../lib/api';
import { useMoney } from '../lib/money';
import { Ltr } from './ui/Card';

interface Option {
  id: string;
  label: string;
  sub?: string;
}

/** Async searchable picker (customers, products, suppliers). */
function AsyncPicker<T>({
  label,
  value,
  valueLabel,
  onChange,
  fetchPath,
  toOption,
  placeholder,
  error,
  allowClear = true,
}: {
  label?: string;
  value: string | null;
  valueLabel?: string;
  onChange: (id: string | null, item: T | null) => void;
  fetchPath: string;
  toOption: (item: T) => Option;
  placeholder?: string;
  error?: string;
  allowClear?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(q), 200);
    return () => clearTimeout(id);
  }, [q]);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  const list = useQuery({
    queryKey: ['biz', 'picker', fetchPath, debounced],
    queryFn: () => api.get<Paginated<T>>(`${fetchPath}${fetchPath.includes('?') ? '&' : '?'}${qs({ q: debounced, pageSize: 20 }).slice(1)}`),
    enabled: open,
  });
  return (
    <div ref={ref} className="relative space-y-1.5">
      {label && <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</p>}
      {value && !open ? (
        <div className="flex items-center justify-between rounded-xl bg-white px-3.5 py-2.5 text-sm ring-1 ring-slate-300 dark:bg-slate-900 dark:ring-slate-700">
          <button type="button" className="min-w-0 flex-1 truncate text-start" onClick={() => setOpen(true)} dir="auto">
            {valueLabel ?? '…'}
          </button>
          {allowClear && (
            <button type="button" aria-label={t('common.clear')} onClick={() => onChange(null, null)} className="text-slate-400 hover:text-slate-700">
              <X className="size-4" />
            </button>
          )}
        </div>
      ) : (
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            placeholder={placeholder ?? t('common.search')}
            aria-invalid={!!error}
            className="w-full rounded-xl border-0 bg-white py-2.5 ps-9 pe-3 text-sm shadow-sm ring-1 ring-slate-300 focus:ring-2 focus:ring-brand-600 focus:outline-none dark:bg-slate-900 dark:ring-slate-700"
          />
        </div>
      )}
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {open && (
        <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl bg-white p-1 shadow-lg ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
          {list.isLoading && <li className="px-3 py-2 text-sm text-slate-400">{t('common.loading')}</li>}
          {list.data?.items.length === 0 && <li className="px-3 py-2 text-sm text-slate-400">{t('common.no_results')}</li>}
          {list.data?.items.map((item) => {
            const o = toOption(item);
            return (
              <li key={o.id}>
                <button
                  type="button"
                  className="w-full rounded-lg px-3 py-2 text-start text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                  onClick={() => {
                    onChange(o.id, item);
                    setOpen(false);
                    setQ('');
                  }}
                >
                  <span className="block font-medium" dir="auto">
                    {o.label}
                  </span>
                  {o.sub && <span className="block text-xs text-slate-500">{o.sub}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export interface CustomerLite {
  id: string;
  name: string;
  phone: string;
  email: string;
  outstanding?: number;
  creditLimit?: number | null;
  loyaltyPoints?: number;
  viberPhone?: string;
}

export function CustomerPicker(props: { label?: string; value: string | null; valueLabel?: string; onChange: (id: string | null, c: CustomerLite | null) => void; error?: string }) {
  const { t } = useTranslation();
  return (
    <AsyncPicker<CustomerLite>
      {...props}
      placeholder={t('customers.search')}
      fetchPath="/customers"
      toOption={(c) => ({ id: c.id, label: c.name, sub: [c.phone, c.email].filter(Boolean).join(' · ') })}
    />
  );
}

export interface ProductLite {
  id: string;
  name: string;
  sku: string;
  unit: string;
  sellingPrice: number;
  costPrice: number;
  taxRate: number | null;
  type: string;
}

export function ProductPicker(props: { label?: string; value: string | null; valueLabel?: string; onChange: (id: string | null, p: ProductLite | null) => void; type?: string; placeholder?: string }) {
  const money = useMoney();
  const { t } = useTranslation();
  return (
    <AsyncPicker<ProductLite>
      {...props}
      placeholder={props.placeholder ?? t('products.search')}
      fetchPath={`/products${props.type ? `?type=${props.type}` : ''}`}
      toOption={(p) => ({ id: p.id, label: p.name, sub: `${p.sku ? p.sku + ' · ' : ''}${money(p.sellingPrice)}` })}
    />
  );
}

export function SupplierPicker(props: { label?: string; value: string | null; valueLabel?: string; onChange: (id: string | null, s: { id: string; name: string } | null) => void; error?: string }) {
  const { t } = useTranslation();
  return <AsyncPicker<{ id: string; name: string; phone: string }> {...props} allowClear={false} placeholder={t('suppliers.search')} fetchPath="/suppliers" toOption={(s) => ({ id: s.id, label: s.name, sub: s.phone })} />;
}

export { Ltr };
