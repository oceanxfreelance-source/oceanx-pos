import { useParams, useSearchParams } from 'react-router-dom';
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
import { MONEY_COLS, totalColumns, useReportCell } from '../business/Reports';
import { PrintFrame } from './PrintFrame';

/** Detailed report as a printable page / PDF, in the manager's language, with the business header. */
export default function ReportPrint() {
  const { type = 'sales-summary' } = useParams<{ type: string }>();
  const [params] = useSearchParams();
  const { t, i18n } = useTranslation();
  const session = useBizSession();
  const money = useMoney();
  const f = useFormat();
  const errMsg = useErrorMessage();
  const cell = useReportCell(type);
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const outletId = params.get('outletId') || undefined;
  const q = useQuery({
    queryKey: ['biz', 'report-print', type, from, to, outletId],
    queryFn: () => api.get<{ rows: Record<string, unknown>[]; summary: Record<string, number> }>(`/reports/${type}${qs({ from, to, outletId })}`),
  });
  const rows = q.data?.rows ?? [];
  const cols = rows[0] ? Object.keys(rows[0]) : [];
  const totals = totalColumns(cols);
  const wide = cols.length > 6;
  const outletName = outletId ? session.outlets.find((o) => o.id === outletId)?.name : t('reports.all_outlets');
  return (
    <PrintFrame ready={!!q.data} filename={pdfName(session.business.name, t(`reports.types.${type}`), from, to)} landscape={wide} width={wide ? '297mm' : '210mm'}>
      {q.error ? (
        <div className="p-6">
          <Alert tone="red">{errMsg(q.error)}</Alert>
        </div>
      ) : !q.data ? (
        <SkeletonRows rows={10} />
      ) : (
        <article lang={i18n.language} dir={languageDir(i18n.language)} className="space-y-6 p-10 text-[13px] text-slate-900">
          <header className="flex items-start justify-between gap-6 border-b border-slate-200 pb-5" data-pdf-block>
            <div>
              <p className="text-lg font-bold" dir="auto">
                {session.business.name}
              </p>
              <p className="text-slate-600" dir="auto">
                {outletName}
              </p>
            </div>
            <div className="text-end">
              <p className="text-2xl font-bold tracking-tight">{t(`reports.types.${type}`)}</p>
              <p className="mt-1 text-slate-600">
                <bdi dir="ltr">
                  {f.date(from)} – {f.date(to)}
                </bdi>
              </p>
              <p className="text-xs text-slate-500">
                {t('print.generated_on')}: {f.dateTime(new Date())} · {session.user.name}
              </p>
            </div>
          </header>
          <p className="text-slate-600" data-pdf-block>
            {t(`reports.descriptions.${type}`)}
          </p>
          {Object.keys(q.data.summary).length > 0 && (
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-pdf-block>
              {Object.entries(q.data.summary).map(([k, v]) => (
                <div key={k} className="rounded-lg p-3 ring-1 ring-slate-200">
                  <p className="text-[11px] text-slate-500">{t(`reports.summary.${k}`)}</p>
                  <p className={`mt-1 text-base font-bold ${k === 'netProfit' && v < 0 ? 'text-rose-700' : ''}`}>{money(v)}</p>
                </div>
              ))}
            </section>
          )}
          {type !== 'profit' &&
            (rows.length === 0 ? (
              <p className="py-10 text-center text-slate-500">{t('reports.empty')}</p>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-y border-slate-300">
                    {cols.map((c) => (
                      <th key={c} className={`px-2 py-2 text-xs font-semibold text-slate-600 ${MONEY_COLS.has(c) || typeof rows[0]![c] === 'number' ? 'text-end' : 'text-start'}`}>
                        {t(`reports.columns.${c}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      {cols.map((c) => (
                        <td key={c} className={`px-2 py-1.5 ${typeof r[c] === 'number' ? 'text-end tabular-nums' : ''}`}>
                          {cell(c, r[c])}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {totals.length > 0 && rows.length > 1 && (
                    <tr className="border-t-2 border-slate-300 font-bold">
                      {cols.map((c, idx) => (
                        <td key={c} className={`px-2 py-2 ${totals.includes(c) ? 'text-end tabular-nums' : ''}`}>
                          {totals.includes(c) ? money(rows.reduce((a, r) => a + Number(r[c] ?? 0), 0)) : idx === 0 ? t('reports.total_row') : ''}
                        </td>
                      ))}
                    </tr>
                  )}
                </tbody>
              </table>
            ))}
          <p className="text-xs text-slate-400" data-pdf-block>
            {t('reports.rows_count', { count: rows.length })}
          </p>
        </article>
      )}
    </PrintFrame>
  );
}
