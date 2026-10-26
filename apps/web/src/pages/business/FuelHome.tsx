import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { Banknote, Droplets, Fuel, HandCoins, Plus, Settings2, Truck, Users } from 'lucide-react';
import { useBiz, useBizSession } from '../../auth/business';
import { useFormat } from '../../lib/format';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, EmptyState, SkeletonRows, StatCard } from '../../components/ui/Card';
import { Dialog } from '../../components/ui/Dialog';
import { FuelSetupEditor, useFuelSetup } from './FuelSetup';
import { useFuelDashboard, useMvr, type FuelDashboard } from './fuel/data';
import { SellFuel } from './fuel/SellFuel';
import { FUEL_COLOR, TankGauge } from './fuel/TankGauge';
import { StockDialog } from './fuel/FuelTanks';
import { SaleRow } from './fuel/FuelTill';

/**
 * Theyo Fihaara dashboard. First time: the shed sets itself up (wizard). After that, the day at a glance: what
 * was sold and how it was paid, the tanks, money owed, the week, the latest sales, and a big Sell button.
 */
export function FuelHome() {
  const { can } = useBiz();
  const setup = useFuelSetup();
  if (!setup.data) return <SkeletonRows rows={5} />;
  if (!setup.data.done && can('fuel.manage')) return <FuelSetupEditor variant="wizard" />;
  return <FuelDashboardView />;
}

function FuelDashboardView() {
  const { t } = useTranslation();
  const f = useFormat();
  const mvr = useMvr();
  const session = useBizSession();
  const { can } = useBiz();
  const q = useFuelDashboard();
  const [selling, setSelling] = useState(false);
  const [stock, setStock] = useState<null | 'delivery' | 'dip'>(null);
  const d = q.data;
  if (!d) return <SkeletonRows rows={6} />;
  if (!d.setupDone)
    return (
      <Card>
        <EmptyState icon={<Fuel className="size-6" />} title={t('fuel.dash.not_set_up')} description={t('fuel.dash.not_set_up_body')} />
      </Card>
    );
  const sub = session.subscription;
  const cashLike = d.today.byPayment.cash;
  const lowTanks = d.tanks.filter((tk) => tk.measured && tk.stockL <= tk.reorderL);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-slate-500">{f.date(new Date())}</p>
          <h1 className="truncate text-2xl font-semibold tracking-tight" dir="auto">
            {session.business.name}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {can('fuel.stock') && (
            <Button variant="secondary" icon={<Truck className="size-4" />} onClick={() => setStock('delivery')}>
              {t('fuel.tanks.delivery')}
            </Button>
          )}
          {can('fuel.stock') && (
            <Button variant="secondary" icon={<Droplets className="size-4" />} onClick={() => setStock('dip')}>
              {t('fuel.tanks.dip')}
            </Button>
          )}
          {can('fuel.sell') && (
            <Button size="lg" icon={<Plus className="size-5" />} onClick={() => setSelling(true)}>
              {t('fuel.till.sell_fuel')}
            </Button>
          )}
        </div>
      </div>

      {lowTanks.length > 0 && (
        <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900">
          {t('fuel.dash.low_alert', { tanks: lowTanks.map((tk) => tk.name).join(', ') })}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t('fuel.dash.sales_today')} value={mvr(d.today.total)} hint={t('fuel.dash.sales_count', { count: d.today.count })} icon={<Banknote className="size-5" />} tone="green" />
        <StatCard
          label={t('fuel.dash.litres_today')}
          value={`${f.number(d.config.fuels.reduce((a, x) => a + (d.today.litresByFuel[x] ?? 0), 0), 0)} L`}
          hint={d.config.fuels.map((x) => `${t(`fuel.${x}`)} ${f.number(d.today.litresByFuel[x] ?? 0, 0)}`).join(' · ')}
          icon={<Fuel className="size-5" />}
          tone="amber"
        />
        <StatCard label={t('fuel.dash.cash_today')} value={mvr(cashLike)} hint={t('fuel.dash.cash_hint', { card: mvr(d.today.byPayment.card + d.today.byPayment.transfer) })} icon={<HandCoins className="size-5" />} tone="blue" />
        <StatCard label={t('fuel.dash.owed')} value={mvr(d.owed.total)} hint={t('fuel.dash.owed_hint', { count: d.owed.customers })} icon={<Users className="size-5" />} tone="red" />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader
            title={t('fuel.dash.tanks')}
            actions={
              <Link to="/fuel-tanks" className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
                {t('fuel.dash.see_tanks')}
              </Link>
            }
          />
          <div className="mt-2 grid gap-5 sm:grid-cols-2">
            {d.tanks.map((tk) => (
              <TankGauge key={tk.id} tank={tk} />
            ))}
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title={t('fuel.dash.week')} />
          <WeekBars week={d.week} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3" padded={false}>
          <div className="p-5 pb-2">
            <CardHeader
              title={t('fuel.dash.latest')}
              actions={
                <Link to="/fuel-till" className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
                  {t('fuel.dash.all_sales')}
                </Link>
              }
            />
          </div>
          {d.recent.length ? (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {d.recent.map((s) => (
                <SaleRow key={s.id} sale={s} />
              ))}
            </ul>
          ) : (
            <p className="px-5 pb-6 text-sm text-slate-500">{t('fuel.dash.no_sales')}</p>
          )}
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader
            title={t('fuel.dash.shed')}
            actions={
              can('fuel.manage') && (
                <Link to="/shed-settings" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
                  <Settings2 className="size-4" />
                  {t('fuel.nav_settings')}
                </Link>
              )
            }
          />
          <dl className="mt-3 space-y-3 text-sm">
            {d.config.fuels.map((x) => (
              <div key={x} className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ background: FUEL_COLOR[x] }} />
                  {t(`fuel.${x}`)}
                </dt>
                <dd className="font-medium tabular-nums">{t('fuel.dash.per_litre', { price: f.number(d.config.prices[x] ?? 0, 2) })}</dd>
              </div>
            ))}
            <PayBreakdown d={d} />
            <div className="flex justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
              <dt className="text-slate-500">{t('fuel.setup.mode_title')}</dt>
              <dd>{t(`fuel.setup.mode_${d.config.mode}`)}</dd>
            </div>
            {sub && (
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">{t('fuel.dash.plan')}</dt>
                <dd>{t('fuel.dash.plan_until', { date: f.date(sub.currentPeriodEnd) })}</dd>
              </div>
            )}
          </dl>
        </Card>
      </div>

      <Dialog open={selling} onClose={() => setSelling(false)} title={t('fuel.till.sell_fuel')} size="lg">
        <SellFuel onSold={() => setSelling(false)} />
      </Dialog>
      {stock && <StockDialog kind={stock} tanks={d.tanks} onClose={() => setStock(null)} />}
    </div>
  );
}

function PayBreakdown({ d }: { d: FuelDashboard }) {
  const { t } = useTranslation();
  const mvr = useMvr();
  const rows = (['cash', 'card', 'transfer', 'credit'] as const).filter((k) => k !== 'credit' || d.config.credit);
  return (
    <div className="space-y-1.5 border-t border-slate-100 pt-3 dark:border-slate-800">
      <p className="text-slate-500">{t('fuel.dash.paid_today')}</p>
      {rows.map((k) => (
        <div key={k} className="flex justify-between gap-3">
          <dt>{t(`fuel.pay.${k}`)}</dt>
          <dd className="tabular-nums">{mvr(d.today.byPayment[k])}</dd>
        </div>
      ))}
    </div>
  );
}

/** Sales for the last 7 days: one bar a day, today last; hover or focus a bar for its numbers. */
function WeekBars({ week }: { week: FuelDashboard['week'] }) {
  const { t, i18n } = useTranslation();
  const f = useFormat();
  const mvr = useMvr();
  const max = Math.max(1, ...week.map((w) => w.total));
  const [hover, setHover] = useState<number | null>(null);
  const dayName = (iso: string) => new Intl.DateTimeFormat(i18n.language === 'dv' ? 'en' : i18n.language, { weekday: 'short' }).format(new Date(`${iso}T12:00:00`));
  const shown = hover ?? week.length - 1;
  const w = week[shown]!;
  const all = week.every((x) => x.total === 0);
  return (
    <div className="mt-2">
      <p className="text-sm text-slate-500">
        {shown === week.length - 1 ? t('fuel.dash.today') : f.date(w.day)} · <span className="font-medium text-slate-900 tabular-nums dark:text-white">{mvr(w.total)}</span> ·{' '}
        <span className="tabular-nums">{f.number(w.litres, 0)} L</span>
      </p>
      <div className="mt-4 flex h-40 items-end gap-2" role="list" aria-label={t('fuel.dash.week')} onMouseLeave={() => setHover(null)}>
        {week.map((x, i) => (
          <div
            key={x.day}
            role="listitem"
            tabIndex={0}
            aria-label={`${f.date(x.day)}: ${mvr(x.total)}, ${f.number(x.litres, 0)} L`}
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            className="flex h-full flex-1 flex-col items-center justify-end gap-1.5 outline-none"
          >
            <div
              className={clsx('w-full max-w-10 rounded-t-[4px] transition-[height,background-color] duration-500', i === shown ? 'bg-brand-600' : 'bg-brand-300 dark:bg-brand-800')}
              style={{ height: x.total > 0 ? `${Math.max(3, (x.total / max) * 100)}%` : '2px' }}
            />
            <span className={clsx('text-[11px] tabular-nums', i === week.length - 1 ? 'font-semibold' : 'text-slate-500')}>{dayName(x.day)}</span>
          </div>
        ))}
      </div>
      {all && <p className="mt-3 text-xs text-slate-500">{t('fuel.dash.week_empty')}</p>}
    </div>
  );
}
