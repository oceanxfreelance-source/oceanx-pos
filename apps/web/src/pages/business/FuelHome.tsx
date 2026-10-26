import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Fuel, Settings2 } from 'lucide-react';
import { useBiz, useBizSession } from '../../auth/business';
import { useFormat } from '../../lib/format';
import { Card, SkeletonRows } from '../../components/ui/Card';
import { FuelMark } from '../auth/AuthLayout';
import { FuelSetupEditor, useFuelSetup } from './FuelSetup';

/**
 * Theyo Fihaara home. First time: the shed sets itself up (wizard). After that: what it set up, a way to change
 * it, and what comes next (the till, closing, tanks, credit, reports).
 */
export function FuelHome() {
  const { t } = useTranslation();
  const f = useFormat();
  const session = useBizSession();
  const { can } = useBiz();
  const setup = useFuelSetup();
  const sub = session.subscription;
  if (!setup.data) return <SkeletonRows rows={5} />;
  if (!setup.data.done && can('fuel.manage')) return <FuelSetupEditor variant="wizard" />;
  const { config, tanks, nozzles } = setup.data;
  const steps = ['fuel.home.step_till', 'fuel.home.step_tanks', 'fuel.home.step_credit', 'fuel.home.step_quotes', 'fuel.home.step_reports'];
  return (
    <div className="mx-auto max-w-3xl space-y-4 py-2">
      <Card>
        <div className="flex items-center gap-3">
          <FuelMark className="size-12 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold" dir="auto">
              {session.business.name}
            </p>
            <p className="text-sm text-slate-500">{t('fuel.name')}</p>
          </div>
          {can('fuel.manage') && (
            <Link to="/shed-settings" className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-brand-700 ring-1 ring-slate-200 hover:bg-slate-50 dark:text-brand-300 dark:ring-slate-700 dark:hover:bg-slate-800">
              <Settings2 className="size-4" />
              {t('fuel.nav_settings')}
            </Link>
          )}
        </div>
        <h1 className="mt-6 text-xl font-semibold">{t('fuel.home.ready_title')}</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t('fuel.home.ready_body')}</p>
        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200 dark:bg-slate-800/40 dark:ring-slate-700">
            <dt className="text-slate-500">{t('fuel.setup.mode_title')}</dt>
            <dd className="mt-0.5 font-medium">{t(`fuel.setup.mode_${config.mode}`)}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200 dark:bg-slate-800/40 dark:ring-slate-700">
            <dt className="text-slate-500">{t('fuel.setup.price')}</dt>
            <dd className="mt-0.5 font-medium tabular-nums">{config.fuels.map((x) => `${t(`fuel.${x}`)} ${f.number(config.prices[x] ?? 0, 2)}`).join(' · ')}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200 sm:col-span-2 dark:bg-slate-800/40 dark:ring-slate-700">
            <dt className="text-slate-500">{t('fuel.setup.storage_title')}</dt>
            <dd className="mt-1 space-y-1">
              {tanks.map((tk) => (
                <p key={tk.key} className="flex justify-between gap-3">
                  <span dir="auto">
                    {tk.name} · {t(`fuel.${tk.fuel}`)}
                  </span>
                  <span className="text-slate-500 tabular-nums">
                    {f.number(Number(tk.capacityL), 0)} L · {t('fuel.home.nozzles_n', { count: nozzles.filter((n) => n.tankKey === tk.key).length })}
                  </span>
                </p>
              ))}
            </dd>
          </div>
        </dl>
        {sub && <p className="mt-4 text-sm text-slate-500">{t('fuel.home.plan', { plan: sub.planName, date: f.date(sub.currentPeriodEnd) })}</p>}
      </Card>
      <Card>
        <h2 className="flex items-center gap-2 text-sm font-semibold">
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
