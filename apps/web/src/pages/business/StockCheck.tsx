import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { PackageSearch, ScanBarcode, Store } from 'lucide-react';
import { api } from '../../lib/api';
import { useMoney } from '../../lib/money';
import { Badge, Card, EmptyState, Ltr, PageHeader, SkeletonRows } from '../../components/ui/Card';

type Availability = 'in_stock' | 'low' | 'out' | 'untracked';
interface StockItem {
  id: string;
  name: string;
  sku: string;
  unit: string;
  sellingPrice: number;
  hasImage: boolean;
  exact: boolean;
  trackStock: boolean;
  quantity: number;
  status: Availability;
  outlets: { outletId: string; outletName: string; quantity: number; status: Availability }[];
}

const TONE = { in_stock: 'green', low: 'amber', out: 'red', untracked: 'gray' } as const;
const BIG = {
  in_stock: 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:ring-emerald-900',
  low: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-900',
  out: 'bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-950 dark:text-rose-200 dark:ring-rose-900',
  untracked: 'bg-slate-50 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700',
};

/**
 * Shops: "do we have it?". Scan a barcode or type a name; see In stock / Low / Out of stock here,
 * and how many each other outlet has.
 */
export default function StockCheckPage() {
  const { t } = useTranslation();
  const money = useMoney();
  const ref = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  // Typing searches after a short pause; a scanner's Enter searches at once.
  useEffect(() => {
    const id = setTimeout(() => setQ(text.trim()), 300);
    return () => clearTimeout(id);
  }, [text]);
  const res = useQuery({
    queryKey: ['biz', 'stock-check', q],
    queryFn: () => api.get<{ currentOutletId: string | null; items: StockItem[] }>(`/stock-check?q=${encodeURIComponent(q)}`),
    enabled: q.length > 0,
    placeholderData: keepPreviousData,
  });
  const items = res.data?.items ?? [];
  const multi = (items[0]?.outlets.length ?? 0) > 1;
  return (
    <div className="space-y-6">
      <PageHeader title={t('stock_check.title')} description={t('stock_check.subtitle')} />
      <div className="relative">
        <ScanBarcode className="pointer-events-none absolute start-4 top-1/2 size-6 -translate-y-1/2 text-slate-400" />
        <input
          ref={ref}
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setQ(text.trim());
              // Ready for the next scan: select the code so the next scan replaces it.
              requestAnimationFrame(() => ref.current?.select());
            }
            if (e.key === 'Escape') setText('');
          }}
          placeholder={t('stock_check.placeholder')}
          aria-label={t('stock_check.placeholder')}
          className="h-16 w-full rounded-2xl border-0 bg-white ps-14 pe-4 text-lg shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-brand-600 focus:outline-none dark:bg-slate-900 dark:ring-slate-700"
        />
      </div>
      {!q ? (
        <Card>
          <EmptyState icon={<PackageSearch className="size-7" />} title={t('stock_check.empty_title')} description={t('stock_check.empty_body')} />
        </Card>
      ) : res.isLoading ? (
        <SkeletonRows rows={4} />
      ) : items.length === 0 ? (
        <Card>
          <EmptyState icon={<PackageSearch className="size-7" />} title={t('stock_check.not_found')} description={t('stock_check.not_found_body', { q })} />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((it) => (
            <Card key={it.id} className={clsx(it.exact && 'ring-2 ring-brand-500')}>
              <div className="flex gap-4">
                {it.hasImage ? (
                  <img src={`/api/products/${it.id}/image`} alt="" className="size-20 shrink-0 rounded-xl object-cover" />
                ) : (
                  <div className="flex size-20 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-slate-800">
                    <PackageSearch className="size-8" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-lg leading-snug font-semibold" dir="auto">
                    {it.name}
                  </p>
                  <p className="text-sm text-slate-500">
                    {it.sku && (
                      <>
                        <Ltr>{it.sku}</Ltr> ·{' '}
                      </>
                    )}
                    <span className="font-medium text-slate-800 dark:text-slate-100">{money(it.sellingPrice)}</span>
                  </p>
                </div>
              </div>
              <div className={clsx('mt-4 flex items-center justify-between rounded-xl px-4 py-3 ring-1', BIG[it.status])}>
                <span className="text-base font-bold">{t(`stock_check.status_${it.status}`)}</span>
                {it.trackStock && (
                  <span className="text-xl font-bold tabular-nums">
                    <Ltr>{`${it.quantity} ${it.unit}`}</Ltr>
                  </span>
                )}
              </div>
              {multi && it.trackStock && (
                <ul className="mt-3 space-y-1.5 text-sm">
                  {it.outlets
                    .filter((o) => o.outletId !== res.data?.currentOutletId)
                    .map((o) => (
                      <li key={o.outletId} className="flex items-center justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-2 text-slate-600 dark:text-slate-300">
                          <Store className="size-4 shrink-0" />
                          <span className="truncate" dir="auto">
                            {o.outletName}
                          </span>
                        </span>
                        <Badge tone={TONE[o.status]}>
                          <Ltr>{`${o.quantity} ${it.unit}`}</Ltr>
                        </Badge>
                      </li>
                    ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
