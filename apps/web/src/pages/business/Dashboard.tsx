import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, CheckCircle2, History, Puzzle, ShieldCheck, Users } from 'lucide-react';
import { api } from '../../lib/api';
import { useBiz, useBizSession } from '../../auth/business';
import { useFormat } from '../../lib/format';
import { actionLabel, addonLabel, moduleLabel } from '../../lib/labels';
import { Badge, Card, CardHeader, EmptyState, PageHeader, Skeleton, StatCard } from '../../components/ui/Card';

interface DashboardData {
  widgets: {
    subscription: { planName: string; status: string; currentPeriodEnd: string; daysLeft: number } | null;
    team?: { activeUsers: number; limit: number | null };
    roles?: { count: number };
    recentActivity?: { id: number; action: string; actorName: string | null; createdAt: string }[];
    modules: string[];
    addons: string[];
  };
}

/**
 * Configurable dashboard: each widget is returned by the API only when the user's
 * permissions allow it, and rendered only if present. Sales/order widgets are added
 * by the POS & sales modules (Phase 2) using the business-type widget profile.
 */
export default function Dashboard() {
  const { t } = useTranslation();
  const s = useBizSession();
  const { can } = useBiz();
  const f = useFormat();
  const q = useQuery({ queryKey: ['biz', 'dashboard'], queryFn: () => api.get<DashboardData>('/dashboard') });
  const w = q.data?.widgets;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? t('dashboard.good_morning') : hour < 18 ? t('dashboard.good_afternoon') : t('dashboard.good_evening');

  return (
    <div className="space-y-6">
      <PageHeader title={`${greeting}, ${s.user.name.split(' ')[0]}`} description={t('dashboard.subtitle', { business: s.business.name })} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {!w ? (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
        ) : (
          <>
            {w.subscription && (
              <StatCard
                label={t('dashboard.plan')}
                value={w.subscription.planName}
                hint={
                  w.subscription.status === 'trialing'
                    ? t('dashboard.trial_days_left', { count: w.subscription.daysLeft })
                    : t('dashboard.renews_on', { date: f.date(w.subscription.currentPeriodEnd) })
                }
                icon={<CalendarClock className="size-5" />}
                tone={w.subscription.daysLeft <= 5 ? 'amber' : 'blue'}
              />
            )}
            {w.team && (
              <StatCard
                label={t('dashboard.active_users')}
                value={f.number(w.team.activeUsers)}
                hint={w.team.limit !== null ? t('dashboard.of_limit', { limit: f.number(w.team.limit) }) : t('common.unlimited')}
                icon={<Users className="size-5" />}
                tone="green"
              />
            )}
            {w.roles && <StatCard label={t('dashboard.roles')} value={f.number(w.roles.count)} icon={<ShieldCheck className="size-5" />} tone="violet" />}
            <StatCard label={t('dashboard.addons_enabled')} value={f.number(w.addons.length)} icon={<Puzzle className="size-5" />} tone="amber" />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" padded={false}>
          <div className="p-5 sm:p-6">
            <CardHeader
              title={t('dashboard.recent_activity')}
              actions={
                can('audit.view') && (
                  <Link to="/activity" className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
                    {t('common.view_all')}
                  </Link>
                )
              }
            />
            {!w ? (
              <Skeleton className="h-40" />
            ) : !w.recentActivity ? (
              <p className="text-sm text-slate-500">{t('dashboard.activity_restricted')}</p>
            ) : w.recentActivity.length === 0 ? (
              <EmptyState icon={<History className="size-6" />} title={t('dashboard.no_activity')} />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {w.recentActivity.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800 dark:text-slate-200">{actionLabel(t, a.action)}</p>
                      <p className="truncate text-xs text-slate-500" dir="auto">
                        {a.actorName ?? t('activity.system')}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-slate-400">{f.relative(a.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title={t('dashboard.your_modules')} description={t('dashboard.your_modules_hint')} />
          {!w ? (
            <Skeleton className="h-40" />
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-1.5">
                {w.modules
                  .filter((m) => !['dashboard', 'users', 'roles', 'settings', 'addons', 'audit'].includes(m))
                  .map((m) => (
                    <Badge key={m} tone="blue">
                      {moduleLabel(t, m)}
                    </Badge>
                  ))}
              </div>
              {w.addons.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">{t('nav.addons')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {w.addons.map((a) => (
                      <Badge key={a} tone="green">
                        <CheckCircle2 className="size-3" />
                        {addonLabel(t, a, a)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">{t('dashboard.phase_note')}</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
