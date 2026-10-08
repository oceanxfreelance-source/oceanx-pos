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
import { SignatureBlock } from '../../components/SignatureBlock';
import { periodLabel } from '../business/Payroll';
import type { PayrollRun } from '../business/PayrollSheet';
import { PrintFrame } from './PrintFrame';

/** One staff member's payslip from a salary sheet, on its own A4 page, to print or send as a PDF. */
export default function PayslipPrint() {
  const { id, lineId } = useParams<{ id: string; lineId: string }>();
  const { t, i18n } = useTranslation();
  const session = useBizSession();
  const money = useMoney();
  const f = useFormat();
  const errMsg = useErrorMessage();
  const q = useQuery({ queryKey: ['biz', 'payroll-print', id], queryFn: () => api.get<PayrollRun>(`/payroll/${id}`) });
  const run = q.data;
  const line = run?.lines.find((l) => l.id === lineId);
  const month = run ? periodLabel(run.period, i18n.language) : '';
  const row = 'flex justify-between gap-4 border-b border-slate-100 py-2';
  const gross = line ? line.basic + line.allowances + line.overtime : 0;
  const taken = line ? line.deductions + line.advance : 0;
  return (
    <PrintFrame ready={!!line} filename={pdfName(line?.name, 'payslip', run?.period)}>
      {q.error ? (
        <div className="p-6">
          <Alert tone="red">{errMsg(q.error)}</Alert>
        </div>
      ) : !run ? (
        <SkeletonRows rows={8} />
      ) : !line ? (
        <div className="p-6">
          <Alert tone="red">{t('errors.not_found')}</Alert>
        </div>
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
              <p className="text-2xl font-bold tracking-tight">{t('staff.payslip')}</p>
              <p className="mt-1 text-base font-semibold">{month}</p>
              <p className="text-xs text-slate-500">
                {t('print.generated_on')}: {f.date(new Date())}
              </p>
            </div>
          </header>
          <section className="rounded-lg bg-slate-50 px-4 py-3" data-pdf-block>
            <p className="text-xs text-slate-500">{t('staff.staff_member')}</p>
            <p className="text-base font-semibold" dir="auto">
              {line.name}
            </p>
            {line.position && (
              <p className="text-slate-600" dir="auto">
                {line.position}
              </p>
            )}
          </section>
          <section className="grid gap-8 sm:grid-cols-2 print:grid-cols-2" data-pdf-block>
            <div>
              <p className="mb-1 font-semibold">{t('staff.earnings')}</p>
              {(['basic', 'allowances', 'overtime'] as const).map((k) => (
                <p key={k} className={row}>
                  <span className="text-slate-600">{t(`staff.col_${k}`)}</span>
                  <span className="tabular-nums">{money(line[k])}</span>
                </p>
              ))}
              <p className="flex justify-between gap-4 py-2 font-semibold">
                <span>{t('staff.gross_pay')}</span>
                <span className="tabular-nums">{money(gross)}</span>
              </p>
            </div>
            <div>
              <p className="mb-1 font-semibold">{t('staff.col_deductions')}</p>
              {(['deductions', 'advance'] as const).map((k) => (
                <p key={k} className={row}>
                  <span className="text-slate-600">{t(`staff.col_${k}`)}</span>
                  <span className="tabular-nums">{money(line[k])}</span>
                </p>
              ))}
              <p className="flex justify-between gap-4 py-2 font-semibold">
                <span>{t('staff.total_deductions')}</span>
                <span className="tabular-nums">{money(taken)}</span>
              </p>
            </div>
          </section>
          <section className="flex items-center justify-between rounded-lg border-2 border-slate-800 px-5 py-4" data-pdf-block>
            <span className="text-base font-bold">{t('staff.col_net')}</span>
            <span className="text-2xl font-bold tabular-nums">{money(line.net)}</span>
          </section>
          {line.notes && (
            <p className="text-slate-700" dir="auto" data-pdf-block>
              <span className="font-semibold">{t('common.notes')}: </span>
              {line.notes}
            </p>
          )}
          <div className="flex items-end justify-between gap-10 pt-4" data-pdf-block>
            <div className="w-48 pb-1">
              <div className="h-12" />
              <div className="border-t border-slate-500 pt-1 text-center text-[11px] text-slate-500">{t('staff.employee_signature')}</div>
            </div>
            <SignatureBlock branding={run.branding} t={t} />
          </div>
        </article>
      )}
    </PrintFrame>
  );
}
