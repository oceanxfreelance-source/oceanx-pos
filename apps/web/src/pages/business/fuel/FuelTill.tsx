import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import clsx from 'clsx';
import { api } from '../../../lib/api';
import { useBiz } from '../../../auth/business';
import { useFormat } from '../../../lib/format';
import { useErrorMessage } from '../../../lib/useApiError';
import { Button } from '../../../components/ui/Button';
import { Card, CardHeader, PageHeader, SkeletonRows } from '../../../components/ui/Card';
import { Segmented } from '../FuelSetup';
import { FUEL_INVALIDATE, FUEL_KEYS, useMvr, type FuelSale } from './data';
import { SellFuel } from './SellFuel';
import { FUEL_COLOR } from './TankGauge';

/** One sale in a list: nozzle and fuel, litres, how it was paid, when and by whom. */
export function SaleRow({ sale, onVoid }: { sale: FuelSale; onVoid?: () => void }) {
  const { t } = useTranslation();
  const f = useFormat();
  const mvr = useMvr();
  const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date(sale.createdAt));
  return (
    <li className={clsx('flex items-center gap-3 px-5 py-3 text-sm', sale.voided && 'opacity-50')}>
      <span className="size-2.5 shrink-0 rounded-full" style={{ background: FUEL_COLOR[sale.fuel] }} />
      <div className="min-w-0 flex-1">
        <p className={clsx('font-medium tabular-nums', sale.voided && 'line-through')}>
          {f.number(sale.litres, 2)} L {t(`fuel.${sale.fuel}`)}
          {sale.nozzleName && <span className="font-normal text-slate-500"> · {sale.nozzleName}</span>}
        </p>
        <p className="truncate text-xs text-slate-500" dir="auto">
          <span dir="ltr">{time}</span> · {t(`fuel.pay.${sale.payment}`)}
          {sale.customerName && ` · ${sale.customerName}`}
          {sale.vehicle && ` · ${sale.vehicle}`}
          {sale.createdByName && ` · ${sale.createdByName}`}
          {sale.voided && ` · ${t('fuel.till.voided')}`}
        </p>
      </div>
      <p className="font-semibold tabular-nums">{mvr(sale.total)}</p>
      {onVoid && !sale.voided && (
        <Button variant="ghost" size="sm" onClick={onVoid}>
          {t('fuel.till.void')}
        </Button>
      )}
    </li>
  );
}

/** The till: sell on the left, the day's sales on the right (owner can cancel a wrong one). */
export default function FuelTillPage() {
  const { t } = useTranslation();
  const mvr = useMvr();
  const f = useFormat();
  const qc = useQueryClient();
  const errMsg = useErrorMessage();
  const { can } = useBiz();
  const [daysAgo, setDaysAgo] = useState(0);
  const sales = useQuery({ queryKey: FUEL_KEYS.sales(daysAgo), queryFn: () => api.get<{ sales: FuelSale[] }>(`/fuel/sales?daysAgo=${daysAgo}`) });
  const voidSale = useMutation({
    mutationFn: (id: string) => api.post(`/fuel/sales/${id}/void`),
    onSuccess: () => {
      toast.success(t('fuel.till.voided_toast'));
      void qc.invalidateQueries(FUEL_INVALIDATE);
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const live = (sales.data?.sales ?? []).filter((s) => !s.voided);
  const total = live.reduce((a, s) => a + s.total, 0);
  const litres = live.reduce((a, s) => a + s.litres, 0);
  return (
    <div className="space-y-4">
      <PageHeader title={t('fuel.nav_till')} description={t('fuel.till.subtitle')} />
      <div className="grid gap-4 lg:grid-cols-5">
        {can('fuel.sell') && (
          <Card className="lg:col-span-3">
            <SellFuel />
          </Card>
        )}
        <Card className={can('fuel.sell') ? 'lg:col-span-2' : 'lg:col-span-5'} padded={false}>
          <div className="space-y-3 p-5 pb-2">
            <CardHeader title={daysAgo === 0 ? t('fuel.till.today') : t('fuel.till.yesterday')} description={`${mvr(total)} · ${f.number(litres, 0)} L · ${t('fuel.dash.sales_count', { count: live.length })}`} />
            <Segmented
              value={String(daysAgo)}
              onChange={(v) => setDaysAgo(Number(v))}
              options={[
                ['0', t('fuel.till.today')],
                ['1', t('fuel.till.yesterday')],
              ]}
            />
          </div>
          {!sales.data ? (
            <div className="p-5">
              <SkeletonRows rows={4} />
            </div>
          ) : sales.data.sales.length ? (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {sales.data.sales.map((s) => (
                <SaleRow
                  key={s.id}
                  sale={s}
                  onVoid={
                    can('fuel.manage')
                      ? () => {
                          if (window.confirm(t('fuel.till.void_confirm', { total: mvr(s.total) }))) voidSale.mutate(s.id);
                        }
                      : undefined
                  }
                />
              ))}
            </ul>
          ) : (
            <p className="px-5 pb-6 text-sm text-slate-500">{t('fuel.dash.no_sales')}</p>
          )}
        </Card>
      </div>
    </div>
  );
}
