import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { languageDir } from '@oceanx/shared';
import { api } from '../../lib/api';
import { useBizSession } from '../../auth/business';
import { useFormat } from '../../lib/format';
import { useMoney } from '../../lib/money';
import { pdfName } from '../../lib/pdf';
import { useErrorMessage } from '../../lib/useApiError';
import { Alert, SkeletonRows } from '../../components/ui/Card';
import { periodLabel } from '../business/Payroll';
import type { PayrollRun } from '../business/PayrollSheet';
import { PrintFrame } from './PrintFrame';

const COLS = ['basic', 'allowances', 'overtime', 'deductions', 'advance', 'net'] as const;

/** Salary sheet for one month as a printable page / PDF, with a signature column for staff. */
export default function PayrollPrint() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const session = useBizSession();
  const money = useMoney();
  const f = useFormat();
  const errMsg = useErrorMessage();
  const q = useQuery({ queryKey: ['biz', 'payroll-print', id], queryFn: () => api.get<PayrollRun>(`/payroll/${id}`) });
  const run = q.data;
  const month = run ? periodLabel(run.period, i18n.language) : '';
  const th = 'px-2 py-2 text-xs font-semibold text-slate-600';
  const td = 'px-2 py-2 align-top';
  return (
    <PrintFrame ready={!!run} filename={pdfName(session.business.name, 'salary-sheet', run?.period)} landscape width="297mm">
      {q.error ? (
        <div className="p-6">
          <Alert tone="red">{errMsg(q.error)}</Alert>
        </div>
      ) : !run ? (
        <SkeletonRows rows={8} />
      ) : (
        <article lang={i18n.language} dir={languageDir(i18n.language)} className="space-y-6 p-10 text-[13px] text-slate-900">
          <header className="flex items-start justify-between gap-6 border-b border-slate-200 pb-5" data-pdf-block>
            <div>
              {session.business.hasLogo && <img src="/api/settings/logo" alt="" className="mb-2 max-h-12 object-contain" />}
              <p className="text-lg font-bold" dir="auto">
                {session.business.name}
              </p>
            </div>
            <div className="text-end">
              <p className="text-2xl font-bold tracking-tight">{t('staff.salary_sheet')}</p>
              <p className="mt-1 text-base font-semibold">{month}</p>
              <p className="text-xs text-slate-500">
                {t(`staff.status_${run.status}`)}
                {run.finalizedAt ? ` · ${f.date(run.finalizedAt)}` : ''} · {t('print.generated_on')}: {f.dateTime(new Date())}
              </p>
            </div>
          </header>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-y border-slate-300">
                <th className={`${th} w-8 text-start`}>#</th>
                <th className={`${th} text-start`}>{t('staff.staff_member')}</th>
                {COLS.map((c) => (
                  <th key={c} className={`${th} text-end`}>
                    {t(`staff.col_${c}`)}
                  </th>
                ))}
                <th className={`${th} text-start`}>{t('common.notes')}</th>
                <th className={`${th} w-36 text-start`}>{t('staff.signature')}</th>
              </tr>
            </thead>
            <tbody>
              {run.lines.map((l, i) => (
                <tr key={l.id} className="border-b border-slate-200">
                  <td className={td}>{i + 1}</td>
                  <td className={td}>
                    <p className="font-semibold" dir="auto">
                      {l.name}
                    </p>
                    {l.position && (
                      <p className="text-xs text-slate-500" dir="auto">
                        {l.position}
                      </p>
                    )}
                  </td>
                  {COLS.map((c) => (
                    <td key={c} className={`${td} text-end tabular-nums ${c === 'net' ? 'font-bold' : ''}`}>
                      {money(l[c])}
                    </td>
                  ))}
                  <td className={td} dir="auto">
                    {l.notes}
                  </td>
                  <td className={td} />
                </tr>
              ))}
              <tr className="border-t-2 border-slate-400 font-bold">
                <td className={td} />
                <td className={td}>{t('reports.total_row')}</td>
                {COLS.map((c) => (
                  <td key={c} className={`${td} text-end tabular-nums`}>
                    {money(run.totals[c])}
                  </td>
                ))}
                <td className={td} colSpan={2} />
              </tr>
            </tbody>
          </table>
          {run.notes && (
            <p className="text-slate-700" dir="auto" data-pdf-block>
              {run.notes}
            </p>
          )}
          <footer className="grid grid-cols-2 items-end gap-16 pt-6 text-xs text-slate-600" data-pdf-block>
            <div>
              <div className="flex h-12 items-end">
                {run.branding?.signer?.hasSignature && <img src={`/api/users/${run.branding.signer.id}/signature`} alt="" className="max-h-12 max-w-36 object-contain" />}
              </div>
              <div className="border-t border-slate-400 pt-2">
                {t('staff.prepared_by')}
                {run.branding?.signer?.hasSignature && (
                  <span className="ms-1 font-semibold text-slate-800" dir="auto">
                    {run.branding.signer.name}
                  </span>
                )}
              </div>
            </div>
            <div className="relative">
              {run.branding?.stamp && <img src="/api/settings/stamp" alt="" className="absolute -top-16 end-6 h-20 w-20 rotate-[-8deg] object-contain opacity-85" />}
              <div className="h-12" />
              <div className="border-t border-slate-400 pt-2">{t('staff.approved_by')}</div>
            </div>
          </footer>
        </article>
      )}
    </PrintFrame>
  );
}
