import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Building2, Clock, Coffee, CreditCard, TrendingUp, Users, UtensilsCrossed, XCircle } from 'lucide-react';
import { saApi } from '../../lib/api';
import { useFormat } from '../../lib/format';
import { actionLabel, addonLabel } from '../../lib/labels';
import { Card, CardHeader, EmptyState, PageHeader, Skeleton, StatCard } from '../../components/ui/Card';

interface SaDashboard {
  businesses: { total: number; byType: Record<string, number>; byStatus: Record<string, number>; newLast30Days: number; registrationsSeries: { day: string; count: number }[] };
  subscriptions: { trialing: number; active: number; expired: number };
  mrr: Record<string, number>;
  users: { total: number; activeLast30Days: number };
  addonUsage: { code: string; name: string; businesses: number }[];
  recentActivity: { id: number; action: string; actorName: string | null; createdAt: string }[];
}

export default function SuperAdminDashboard() {
  const { t } = useTranslation();
  const f = useFormat();
  const q = useQuery({ queryKey: ['sa', 'dashboard'], queryFn: () => saApi.get<SaDashboard>('/dashboard') });
  const d = q.data;
  const mrr = d ? Object.entries(d.mrr) : [];
  return (
    <div className="space-y-6">
      <PageHeader title={t('superadmin.dashboard.title')} description={t('superadmin.dashboard.subtitle')} />
      {!d ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label={t('superadmin.dashboard.total_businesses')} value={f.number(d.businesses.total)} hint={t('superadmin.dashboard.new_30d', { count: d.businesses.newLast30Days })} icon={<Building2 className="size-5" />} />
            <StatCard label={t('superadmin.dashboard.restaurants')} value={f.number(d.businesses.byType.restaurant ?? 0)} icon={<UtensilsCrossed className="size-5" />} tone="violet" />
            <StatCard label={t('superadmin.dashboard.cafes')} value={f.number((d.businesses.byType.cafe ?? 0) + (d.businesses.byType.coffee_shop ?? 0))} hint={t('superadmin.dashboard.cafes_hint')} icon={<Coffee className="size-5" />} tone="amber" />
            <StatCard
              label={t('superadmin.dashboard.mrr')}
              value={mrr.length ? mrr.map(([c, v]) => `${c} ${f.number(v, 2)}`).join(' · ') : '—'}
              hint={t('superadmin.dashboard.mrr_hint')}
              icon={<TrendingUp className="size-5" />}
              tone="green"
            />
            <StatCard label={t('superadmin.dashboard.active_businesses')} value={f.number(d.businesses.byStatus.active ?? 0)} hint={t('superadmin.dashboard.pending_count', { count: d.businesses.byStatus.pending ?? 0 })} icon={<Building2 className="size-5" />} tone="green" />
            <StatCard label={t('superadmin.dashboard.trials')} value={f.number(d.subscriptions.trialing)} hint={t('superadmin.dashboard.active_subs', { count: d.subscriptions.active })} icon={<Clock className="size-5" />} />
            <StatCard
              label={t('superadmin.dashboard.expired_suspended')}
              value={`${f.number(d.subscriptions.expired)} / ${f.number(d.businesses.byStatus.suspended ?? 0)}`}
              icon={<XCircle className="size-5" />}
              tone="red"
            />
            <StatCard label={t('superadmin.dashboard.active_users')} value={f.number(d.users.activeLast30Days)} hint={t('superadmin.dashboard.total_users', { count: d.users.total })} icon={<Users className="size-5" />} tone="violet" />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title={t('superadmin.dashboard.registrations')} description={t('superadmin.dashboard.registrations_hint')} />
              <RegistrationsChart series={d.businesses.registrationsSeries} />
            </Card>
            <Card>
              <CardHeader title={t('superadmin.dashboard.addon_usage')} />
              <ul className="space-y-3">
                {d.addonUsage.slice(0, 8).map((a) => {
                  const max = Math.max(1, ...d.addonUsage.map((x) => x.businesses));
                  return (
                    <li key={a.code} className="text-sm">
                      <div className="mb-1 flex justify-between gap-2">
                        <span className="truncate">{addonLabel(t, a.code, a.name)}</span>
                        <span className="font-medium tabular-nums">{f.number(a.businesses)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
                        <div className="h-1.5 rounded-full bg-brand-500" style={{ width: `${(a.businesses / max) * 100}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </div>

          <Card>
            <CardHeader title={t('superadmin.dashboard.recent_activity')} />
            {d.recentActivity.length === 0 ? (
              <EmptyState icon={<CreditCard className="size-6" />} title={t('dashboard.no_activity')} />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {d.recentActivity.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span>
                      <span className="font-medium">{actionLabel(t, a.action)}</span>
                      {a.actorName && (
                        <span className="text-slate-500" dir="auto">
                          {' '}
                          · {a.actorName}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-xs text-slate-400">{f.relative(a.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

/** Real data bar chart (30 days of registrations) rendered as accessible SVG. */
function RegistrationsChart({ series }: { series: { day: string; count: number }[] }) {
  const { t } = useTranslation();
  const f = useFormat();
  const max = Math.max(1, ...series.map((s) => s.count));
  const total = series.reduce((a, b) => a + b.count, 0);
  return (
    <div>
      <div className="flex h-40 items-end gap-1" dir="ltr" role="img" aria-label={t('superadmin.dashboard.registrations_aria', { count: total })}>
        {series.map((s) => (
          <div key={s.day} className="group relative flex h-full flex-1 items-end">
            <div className="w-full rounded-t bg-brand-500/80 transition-all group-hover:bg-brand-600" style={{ height: `${Math.max(2, (s.count / max) * 100)}%`, opacity: s.count ? 1 : 0.25 }} />
            <span className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 rounded bg-slate-900 px-1.5 py-0.5 text-[10px] whitespace-nowrap text-white group-hover:block">
              {f.date(s.day)}: {s.count}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-slate-400" dir="ltr">
        <span>{f.date(series[0]?.day)}</span>
        <span>{f.date(series.at(-1)?.day)}</span>
      </div>
    </div>
  );
}
