import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { languageDir } from '@oceanx/shared';
import { api, qs } from '../../lib/api';
import { useBizSession } from '../../auth/business';
import { useFormat } from '../../lib/format';
import { useMoney } from '../../lib/money';
import { pdfName } from '../../lib/pdf';
import { useErrorMessage } from '../../lib/useApiError';
import { Alert, SkeletonRows } from '../../components/ui/Card';
import type { CreditOverview } from '../business/Credit';
import { PrintFrame } from './PrintFrame';

/** All credit customers with their dues and the grand total — internal report for the manager. */
export default function CreditDuesPrint() {
  const [params] = useSearchParams();
  const { t, i18n } = useTranslation();
  const session = useBizSession();
  const money = useMoney();
  const f = useFormat();
  const errMsg = useErrorMessage();
  const onlyDue = params.get('onlyDue') !== 'false';
  const q = useQuery({ queryKey: ['biz', 'credit-dues-print', onlyDue], queryFn: () => api.get<CreditOverview>(`/credit/overview${qs({ onlyDue: onlyDue ? 'true' : 'false' })}`) });
  const d = q.data;
  const th = 'px-2 py-2 text-xs font-semibold text-slate-600';
  return (
    <PrintFrame ready={!!d} filename={pdfName(session.business.name, 'credit-dues', d?.asOf)}>
      {q.error ? (
        <div className="p-6">
          <Alert tone="red">{errMsg(q.error)}</Alert>
        </div>
      ) : !d ? (
        <SkeletonRows rows={10} />
      ) : (
        <article lang={i18n.language} dir={languageDir(i18n.language)} className="space-y-6 p-10 text-[13px] text-slate-900">
          <header className="flex items-start justify-between gap-6 border-b border-slate-200 pb-5" data-pdf-block>
            <div className="space-y-1">
              {d.business.hasLogo && <img src="/api/settings/logo" alt="" className="mb-2 max-h-14 object-contain" />}
              <p className="text-lg font-bold" dir="auto">
                {d.business.name}
              </p>
              <p className="text-slate-600" dir="ltr">
                {[d.business.phone, d.business.email].filter(Boolean).join(' · ')}
              </p>
            </div>
            <div className="text-end">
              <p className="text-2xl font-bold tracking-tight">{t('credit.dues_report')}</p>
              <p className="mt-1 text-slate-600">
                {t('credit.as_of')}: {f.date(d.asOf)}
              </p>
              <p className="text-xs text-slate-500">
                {t('print.generated_on')}: {f.dateTime(d.generatedAt)} · {session.user.name}
              </p>
            </div>
          </header>
          <section className="grid grid-cols-3 gap-3" data-pdf-block>
            <div className="rounded-lg bg-slate-900 p-3 text-white">
              <p className="text-[11px] text-slate-300">{t('credit.total_due')}</p>
              <p className="mt-1 text-lg font-bold">{money(d.totals.due)}</p>
            </div>
            <div className="rounded-lg p-3 ring-1 ring-slate-200">
              <p className="text-[11px] text-slate-500">{t('status_labels.overdue')}</p>
              <p className="mt-1 text-lg font-bold text-rose-700">{money(d.totals.overdue)}</p>
            </div>
            <div className="rounded-lg p-3 ring-1 ring-slate-200">
              <p className="text-[11px] text-slate-500">{t('credit.customers_with_due')}</p>
              <p className="mt-1 text-lg font-bold" dir="ltr">
                {d.totals.customersWithDue}
              </p>
            </div>
          </section>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-y border-slate-300">
                <th className={`${th} text-start`}>#</th>
                <th className={`${th} text-start`}>{t('customers.customer')}</th>
                <th className={`${th} text-start`}>{t('common.phone')}</th>
                <th className={`${th} text-end`}>{t('credit.limit')}</th>
                <th className={`${th} text-start`}>{t('credit.oldest_due')}</th>
                <th className={`${th} text-end`}>{t('print.days_overdue')}</th>
                <th className={`${th} text-end`}>{t('status_labels.overdue')}</th>
                <th className={`${th} text-end`}>{t('credit.outstanding')}</th>
              </tr>
            </thead>
            <tbody>
              {d.customers.map((c, i) => (
                <tr key={c.id} className="border-b border-slate-100">
                  <td className="px-2 py-1.5 text-slate-500" dir="ltr">
                    {i + 1}
                  </td>
                  <td className="px-2 py-1.5 font-medium" dir="auto">
                    {c.name}
                  </td>
                  <td className="px-2 py-1.5" dir="ltr">
                    {c.viberPhone || c.phone || '—'}
                  </td>
                  <td className="px-2 py-1.5 text-end">{c.creditLimit === null ? '—' : money(c.creditLimit)}</td>
                  <td className="px-2 py-1.5">{c.oldestDueDate ? f.date(c.oldestDueDate) : '—'}</td>
                  <td className={`px-2 py-1.5 text-end ${c.daysOverdue > 0 ? 'font-semibold text-rose-700' : ''}`} dir="ltr">
                    {c.daysOverdue || '—'}
                  </td>
                  <td className="px-2 py-1.5 text-end">{c.overdue ? money(c.overdue) : '—'}</td>
                  <td className="px-2 py-1.5 text-end font-semibold">{money(c.due)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-300 text-base font-bold">
                <td className="px-2 py-2" colSpan={6}>
                  {t('credit.grand_total')}
                </td>
                <td className="px-2 py-2 text-end text-rose-700">{money(d.totals.overdue)}</td>
                <td className="px-2 py-2 text-end">{money(d.totals.due)}</td>
              </tr>
            </tbody>
          </table>
          <p className="text-xs text-slate-400" data-pdf-block>
            {t('credit.customers_count', { count: d.customers.length })}
          </p>
        </article>
      )}
    </PrintFrame>
  );
}
