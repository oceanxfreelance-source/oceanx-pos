import { useTranslation } from 'react-i18next';
import { CheckCircle2, Fuel } from 'lucide-react';
import { useBizSession } from '../../auth/business';
import { useFormat } from '../../lib/format';
import { Card } from '../../components/ui/Card';
import { FuelMark } from '../auth/AuthLayout';

/**
 * Theyo Fihaara (fuel sheds): the system is being built. Super Admin opens each shed's account, so an owner who
 * signs in sees their account is ready, their plan and what comes first.
 */
export function FuelHome() {
  const { t } = useTranslation();
  const f = useFormat();
  const session = useBizSession();
  const sub = session.subscription;
  const steps = ['fuel.home.step_till', 'fuel.home.step_tanks', 'fuel.home.step_credit', 'fuel.home.step_quotes', 'fuel.home.step_reports'];
  return (
    <div className="mx-auto max-w-2xl py-4">
      <Card>
        <div className="flex items-center gap-3">
          <FuelMark className="size-12 shrink-0" />
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold" dir="auto">
              {session.business.name}
            </p>
            <p className="text-sm text-slate-500">{t('fuel.name')}</p>
          </div>
        </div>
        <h1 className="mt-6 text-xl font-semibold">{t('fuel.home.title')}</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{t('fuel.home.body')}</p>
        {sub && (
          <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm ring-1 ring-slate-200 dark:bg-slate-800/40 dark:ring-slate-700">
            {t('fuel.home.plan', { plan: sub.planName, date: f.date(sub.currentPeriodEnd) })}
          </p>
        )}
        <h2 className="mt-6 flex items-center gap-2 text-sm font-semibold">
          <Fuel className="size-4 text-slate-500" />
          {t('fuel.home.coming')}
        </h2>
        <ul className="mt-3 space-y-2 text-sm">
          {steps.map((k) => (
            <li key={k} className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-slate-400" />
              <span>{t(k)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
