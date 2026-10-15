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
import { MONEY_COLS, reportTotal, totalColumns, useReportCell } from '../business/Reports';
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
    queryFn: () =>
      api.get<{ rows: Record<string, unknown>[]; summary: Record<string, number>; meta?: { taxName: string; taxNumber: string; taxRate: number } }>(`/reports/${type}${qs({ from, to, outletId })}`),
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
          {type === 'gst' ? (
            <GstWorksheet rows={rows} summary={q.data.summary} meta={q.data.meta} cell={cell} />
          ) : null}
          {type !== 'gst' && Object.keys(q.data.summary).length > 0 && (
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
            type !== 'gst' &&
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
                      {cols.map((c, idx) => {
                        const v = reportTotal(c, cols, rows);
                        return (
                          <td key={c} className={`px-2 py-2 ${v !== null ? 'text-end tabular-nums' : ''}`}>
                            {v !== null ? cell(c, v) : idx === 0 ? t('reports.total_row') : ''}
                          </td>
                        );
                      })}
                    </tr>
                  )}
                </tbody>
              </table>
            ))}
          {type !== 'gst' && (
            <p className="text-xs text-slate-400" data-pdf-block>
              {t('reports.rows_count', { count: rows.length })}
            </p>
          )}
        </article>
      )}
    </PrintFrame>
  );
}

/**
 * GST return worksheet: output tax (sales), input tax (bills) and the GST to pay, laid out to copy into the
 * MIRA GST return, with the business's TIN and lines to sign.
 */
function GstWorksheet({
  rows,
  summary,
  meta,
  cell,
}: {
  rows: Record<string, unknown>[];
  summary: Record<string, number>;
  meta?: { taxName: string; taxNumber: string; taxRate: number };
  cell: (key: string, v: unknown) => React.ReactNode;
}) {
  const { t } = useTranslation();
  const money = useMoney();
  const n = (v: unknown) => Number(v ?? 0);
  const out = rows.filter((r) => r.gst_type === 'output');
  const inp = rows.filter((r) => r.gst_type === 'input');
  const payable = summary.gstPayable ?? 0;
  const section = (title: string, list: Record<string, unknown>[], totalLabel: string) => (
    <section className="space-y-2" data-pdf-block>
      <h2 className="text-sm font-bold tracking-wide text-slate-700 uppercase">{title}</h2>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-y border-slate-300 text-xs text-slate-600">
            <th className="px-2 py-2 text-start font-semibold">{t('reports.columns.source')}</th>
            <th className="px-2 py-2 text-end font-semibold">{t('reports.columns.rate')}</th>
            <th className="px-2 py-2 text-end font-semibold">{t('reports.columns.taxable')}</th>
            <th className="px-2 py-2 text-end font-semibold">{t('reports.columns.tax')}</th>
          </tr>
        </thead>
        <tbody>
          {list.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-2 py-3 text-center text-slate-500">
                —
              </td>
            </tr>
          ) : (
            list.map((r, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="px-2 py-1.5">{cell('source', r.source)}</td>
                <td className="px-2 py-1.5 text-end tabular-nums">{r.rate === null || r.rate === undefined ? '—' : cell('rate', r.rate)}</td>
                <td className="px-2 py-1.5 text-end tabular-nums">{money(n(r.taxable))}</td>
                <td className="px-2 py-1.5 text-end tabular-nums">{money(n(r.tax))}</td>
              </tr>
            ))
          )}
          <tr className="border-t-2 border-slate-300 font-bold">
            <td className="px-2 py-2" colSpan={2}>
              {totalLabel}
            </td>
            <td className="px-2 py-2 text-end tabular-nums">{money(list.reduce((a, r) => a + n(r.taxable), 0))}</td>
            <td className="px-2 py-2 text-end tabular-nums">{money(list.reduce((a, r) => a + n(r.tax), 0))}</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
  return (
    <div className="space-y-6">
      <section className="grid grid-cols-3 gap-3 rounded-lg bg-slate-50 p-4" data-pdf-block>
        <div>
          <p className="text-[11px] text-slate-500">{t('gst.print.tin')}</p>
          <p className="font-semibold tabular-nums" dir="ltr">
            {meta?.taxNumber || '—'}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-slate-500">{t('gst.print.standard_rate')}</p>
          <p className="font-semibold tabular-nums">{meta ? `${meta.taxRate}%` : '—'}</p>
        </div>
        <div>
          <p className="text-[11px] text-slate-500">{t('gst.print.form')}</p>
          <p className="font-semibold">{t('gst.print.form_value')}</p>
        </div>
      </section>
      {section(t('gst.print.output_title'), out, t('gst.print.output_total'))}
      <p className="-mt-3 text-xs text-slate-500" data-pdf-block>
        {t('gst.print.zero_rated', { amount: money(summary.zeroRatedSupplies ?? 0) })}
      </p>
      {section(t('gst.print.input_title'), inp, t('gst.print.input_total'))}
      <section className={`flex items-center justify-between rounded-xl border-2 p-5 ${payable >= 0 ? 'border-slate-900' : 'border-emerald-700'}`} data-pdf-block>
        <div>
          <p className="text-base font-bold">{payable >= 0 ? t('gst.print.payable') : t('gst.print.refundable')}</p>
          <p className="text-xs text-slate-600">{t('gst.print.payable_formula', { output: money(summary.outputTax ?? 0), input: money(summary.inputTax ?? 0) })}</p>
        </div>
        <p className="text-3xl font-bold tabular-nums">{money(Math.abs(payable))}</p>
      </section>
      <p className="text-xs text-slate-600" data-pdf-block>
        {t('reports.gst_note')}
      </p>
      <section className="grid grid-cols-2 gap-10 pt-8" data-pdf-block>
        {[t('gst.print.prepared_by'), t('gst.print.checked_by')].map((l) => (
          <div key={l}>
            <div className="h-10 border-b border-slate-400" />
            <p className="mt-1 text-xs text-slate-600">{l}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
