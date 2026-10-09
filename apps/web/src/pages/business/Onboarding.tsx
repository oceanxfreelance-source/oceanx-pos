import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Circle, Rocket } from 'lucide-react';
import { api } from '../../lib/api';
import { useBiz, useBizSession } from '../../auth/business';
import { useToastError } from '../../lib/useApiError';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

interface OnboardingState {
  completed: boolean;
  categories: number;
  products: number;
  tables: number;
  users: number;
  sales: number;
  hasLogo: boolean;
}

/** First-run checklist on the dashboard. Every step links to a real screen; progress comes from real data. */
export function OnboardingCard() {
  const { t } = useTranslation();
  const { can } = useBiz();
  const session = useBizSession();
  const qc = useQueryClient();
  const toastErr = useToastError();
  const q = useQuery({ queryKey: ['biz', 'onboarding'], queryFn: () => api.get<OnboardingState>('/onboarding') });
  const done = useMutation({ mutationFn: () => api.post('/onboarding/complete', {}), onSuccess: () => qc.invalidateQueries({ queryKey: ['biz', 'onboarding'] }), onError: toastErr });
  if (!q.data || q.data.completed) return null;
  // Shops get shop wording (products and barcodes, not menu items).
  const stepNs = session.business.profile.retail ? 'onboarding.steps_retail' : 'onboarding.steps';
  const steps = [
    { key: 'profile', done: q.data.hasLogo, to: '/settings' },
    { key: 'categories', done: q.data.categories > 0, to: '/products' },
    { key: 'products', done: q.data.products > 0, to: '/products' },
    ...(session.business.profile.tableService && session.modules.includes('tables') ? [{ key: 'tables', done: q.data.tables > 0, to: '/tables' }] : []),
    { key: 'team', done: q.data.users > 1, to: '/users' },
    ...(session.modules.includes('pos') ? [{ key: 'first_sale', done: q.data.sales > 0, to: '/pos' }] : []),
  ];
  const doneCount = steps.filter((x) => x.done).length;
  if (doneCount === steps.length) return null;
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Rocket className="size-5 text-brand-600" /> {t('onboarding.title')}
          </span>
        }
        description={
          <span className="mt-1 flex items-center gap-3">
            <span className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <span className="block h-full rounded-full bg-brand-600" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
            </span>
            {t('onboarding.progress', { done: doneCount, total: steps.length })}
          </span>
        }
        actions={
          can('settings.manage') && (
            <Button size="sm" variant="ghost" onClick={() => done.mutate()} loading={done.isPending}>
              {t('onboarding.dismiss')}
            </Button>
          )
        }
      />
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((s) => (
          <li key={s.key} className={s.done ? 'hidden sm:block' : undefined}>
            <Link to={s.to} className="flex items-start gap-3 rounded-xl p-3 ring-1 ring-slate-200 hover:bg-slate-50 dark:ring-slate-800 dark:hover:bg-slate-800/50">
              {s.done ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" /> : <Circle className="mt-0.5 size-5 shrink-0 text-slate-300" />}
              <span>
                <span className="block text-sm font-medium">{t(`${stepNs}.${s.key}`, { defaultValue: t(`onboarding.steps.${s.key}`) })}</span>
                <span className="block text-xs text-slate-500">{t(`${stepNs}.${s.key}_hint`, { defaultValue: t(`onboarding.steps.${s.key}_hint`) })}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </Card>
  );
}
