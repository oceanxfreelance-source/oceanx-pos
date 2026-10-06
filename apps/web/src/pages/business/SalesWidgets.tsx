import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChefHat, CircleDollarSign, Receipt, ShoppingBag, TrendingUp, Users, Wallet } from 'lucide-react';
import { api } from '../../lib/api';
import { useBizSession } from '../../auth/business';
import { useFormat } from '../../lib/format';
import { useMoney } from '../../lib/money';
import { Card, CardHeader, Ltr, Skeleton, StatCard } from '../../components/ui/Card';

interface SalesDash {
  today?: { orders: number; total: number; average: number };
  trend?: { day: string; total: number; orders: number }[];
  topProducts?: { name: string; quantity: number; revenue: number }[];
  topDrinks?: { name: string; quantity: number; revenue: number }[];
  recentSales?: { id: string; number: string | null; total: number; completedAt: string; orderType: string }[];
  openOrders?: number;
  customers?: number;
  outstandingDue?: number;
  lowStock?: number;
  kitchenPending?: number;
}

/**
 * Operational widgets, ordered by the business-type profile (restaurant, café, bakery…).
 * The API only returns the data the user's permissions allow; missing data hides the widget.
 */
export function SalesWidgets() {
  const { t } = useTranslation();
  const session = useBizSession();
  const money = useMoney();
  const f = useFormat();
  const q = useQuery({ queryKey: ['biz', 'dashboard', 'sales'], queryFn: () => api.get<SalesDash>('/dashboard/sales'), refetchInterval: 60_000 });
  const d = q.data;
  if (!d) return <Skeleton className="h-28 rounded-2xl" />;
  const widgets = session.business.profile.dashboardWidgets;
  const stats: React.ReactNode[] = [];
  const panels: React.ReactNode[] = [];
  for (const w of widgets) {
    if (w === 'today_sales' && d.today) stats.push(<StatCard key={w} label={t('dashboard.w.today_sales')} value={money(d.today.total)} icon={<CircleDollarSign className="size-5" />} tone="green" />);
    if (w === 'orders' && d.today)
      stats.push(<StatCard key={w} label={t('dashboard.w.orders')} value={<Ltr>{d.today.orders}</Ltr>} hint={d.openOrders ? t('dashboard.w.open_orders', { count: d.openOrders }) : undefined} icon={<ShoppingBag className="size-5" />} />);
    if (w === 'average_order_value' && d.today) stats.push(<StatCard key={w} label={t('dashboard.w.average_order_value')} value={money(d.today.average)} icon={<Receipt className="size-5" />} tone="violet" />);
    if (w === 'customers' && d.customers !== undefined) stats.push(<StatCard key={w} label={t('dashboard.w.customers')} value={<Ltr>{d.customers}</Ltr>} icon={<Users className="size-5" />} tone="violet" />);
    if (w === 'outstanding_due' && d.outstandingDue !== undefined) stats.push(<StatCard key={w} label={t('dashboard.w.outstanding_due')} value={money(d.outstandingDue)} icon={<Wallet className="size-5" />} tone={d.outstandingDue > 0 ? 'amber' : 'green'} />);
    if (w === 'low_stock' && d.lowStock !== undefined)
      stats.push(
        <Link key={w} to="/inventory">
          <StatCard label={t('dashboard.w.low_stock')} value={<Ltr>{d.lowStock}</Ltr>} icon={<AlertTriangle className="size-5" />} tone={d.lowStock > 0 ? 'red' : 'green'} />
        </Link>,
      );
    if ((w === 'top_products' && d.topProducts) || (w === 'top_drinks' && d.topDrinks?.length)) {
      const list = (w === 'top_products' ? d.topProducts : d.topDrinks)!;
      panels.push(
        <Card key={w}>
          <CardHeader title={t(`dashboard.w.${w}`)} description={t('dashboard.w.last_7_days')} />
          {list.length === 0 ? (
            <p className="text-sm text-slate-400">{t('dashboard.w.no_sales_yet')}</p>
          ) : (
            <ol className="space-y-2 text-sm">
              {list.map((p, i) => (
                <li key={p.name} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate" dir="auto">
                    <Ltr className="me-2 text-slate-400">{i + 1}</Ltr>
                    {p.name}
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">
                    <Ltr>×{p.quantity}</Ltr> · <span className="font-semibold text-slate-700 dark:text-slate-200">{money(p.revenue)}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>,
      );
    }
    if ((w === 'recent_sales' || w === 'recent_orders') && d.recentSales)
      panels.push(
        <Card key={w}>
          <CardHeader title={t(`dashboard.w.${w}`)} actions={<Link to="/sales" className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">{t('common.view_all')}</Link>} />
          {d.recentSales.length === 0 ? (
            <p className="text-sm text-slate-400">{t('dashboard.w.no_sales_yet')}</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {d.recentSales.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2">
                  <span>
                    <Ltr className="font-medium">{s.number ?? '—'}</Ltr>
                    <span className="block text-xs text-slate-500">
                      {t(`pos.order_types.${s.orderType}`)} · {f.relative(s.completedAt)}
                    </span>
                  </span>
                  <span className="font-semibold tabular-nums">{money(s.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>,
      );
    if (w === 'sales_trend' && d.trend) {
      const max = Math.max(1, ...d.trend.map((x) => x.total));
      panels.push(
        <Card key={w}>
          <CardHeader title={t('dashboard.w.sales_trend')} description={t('dashboard.w.last_14_days')} />
          <div className="flex h-36 items-end gap-1" dir="ltr" role="img" aria-label={t('dashboard.w.sales_trend')}>
            {d.trend.map((x) => (
              <div key={x.day} className="group relative flex h-full flex-1 items-end">
                <div className="w-full rounded-t bg-brand-500/80 transition-all group-hover:bg-brand-600" style={{ height: `${Math.max(2, (x.total / max) * 100)}%` }} />
                <span className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 rounded bg-slate-900 px-1.5 py-0.5 text-[10px] whitespace-nowrap text-white group-hover:block">
                  {money(x.total)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-slate-400" dir="ltr">
            <span>{f.date(d.trend[0]?.day)}</span>
            <TrendingUp className="size-3" />
            <span>{f.date(d.trend.at(-1)?.day)}</span>
          </div>
        </Card>,
      );
    }
  }
  if (d.kitchenPending !== undefined && session.business.profile.kitchen)
    stats.push(
      <Link key="kitchen" to="/kitchen">
        <StatCard label={t('dashboard.w.kitchen_pending')} value={<Ltr>{d.kitchenPending}</Ltr>} icon={<ChefHat className="size-5" />} tone={d.kitchenPending > 0 ? 'amber' : 'green'} />
      </Link>,
    );
  if (!stats.length && !panels.length) return null;
  return (
    <div className="space-y-6">
      {stats.length > 0 && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats}</div>}
      {panels.length > 0 && <div className="grid gap-6 lg:grid-cols-2">{panels}</div>}
    </div>
  );
}
