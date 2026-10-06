import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Download, FileDown } from 'lucide-react';
import { api, qs } from '../../lib/api';
import { useBiz, useBizSession } from '../../auth/business';
import { useFormat } from '../../lib/format';
import { useMoney } from '../../lib/money';
import { useErrorMessage } from '../../lib/useApiError';
import { Alert, Card, EmptyState, Ltr, PageHeader, SkeletonRows, StatCard } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Form';

/** Report types and the extra permission (and add-on) each one needs, mirroring the API. */
export const REPORTS: { type: string; perm?: string; addon?: string }[] = [
  { type: 'sales-summary' },
  { type: 'products' },
  { type: 'categories' },
  { type: 'payment-methods' },
  { type: 'profit' },
  { type: 'expenses', perm: 'expenses.view' },
  { type: 'inventory', perm: 'inventory.view' },
  { type: 'customers' },
  { type: 'quotations', perm: 'quotations.view' },
  { type: 'invoices', perm: 'invoices.view' },
  { type: 'credit', perm: 'credit.view', addon: 'credit' },
  { type: 'staff' },
  { type: 'outlets' },
  { type: 'costing', perm: 'costing.view', addon: 'ingredient_costing' },
];

export const MONEY_COLS = new Set(['gross', 'discount', 'service_charge', 'tax', 'total', 'average', 'revenue', 'cost', 'margin', 'amount', 'unit_cost', 'value', 'spent', 'due', 'paid', 'outstanding', 'credit_limit', 'sales_due', 'invoice_due', 'price', 'recipe_cost']);

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return iso(d);
};

/** Formats one report cell (money, dates, enums translated) — shared by the screen and the PDF. */
export function useReportCell(type: string) {
  const { t } = useTranslation();
  const money = useMoney();
  const f = useFormat();
  return (key: string, v: unknown): React.ReactNode => {
    if (v === null || v === undefined || v === '') return '—';
    if (MONEY_COLS.has(key) && typeof v === 'number') return money(v);
    if (key === 'day') return f.date(String(v));
    if (key === 'method') return t(`payment_methods.${v}`);
    if (key === 'kind') return t(`payments.kinds.${v}`);
    if (key === 'status') return t(`status_labels.${v}`);
    if (key === 'source') return t(`reports.sources.${v}`);
    if (key === 'category' && type === 'expenses') return t(`expenses.categories.${v}`);
    if (typeof v === 'number') return <Ltr>{f.number(v, Number.isInteger(v) ? 0 : 3)}</Ltr>;
    return <span dir="auto">{String(v)}</span>;
  };
}

/** Columns whose totals are meaningful (money columns except unit prices / averages / limits). */
export const totalColumns = (cols: string[]) => cols.filter((c) => MONEY_COLS.has(c) && !['unit_cost', 'price', 'average', 'credit_limit'].includes(c));

export default function ReportsPage() {
  const { t } = useTranslation();
  const { can, hasAddon } = useBiz();
  const session = useBizSession();
  const money = useMoney();
  const f = useFormat();
  const errMsg = useErrorMessage();
  const available = REPORTS.filter((r) => (!r.perm || can(r.perm)) && (!r.addon || hasAddon(r.addon)));
  const [type, setType] = useState(available[0]?.type ?? 'sales-summary');
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(iso(new Date()));
  const [outletId, setOutletId] = useState('');
  const params = { from, to, outletId: outletId || undefined };
  const q = useQuery({
    queryKey: ['biz', 'report', type, from, to, outletId],
    queryFn: () => api.get<{ rows: Record<string, unknown>[]; summary: Record<string, number> }>(`/reports/${type}${qs(params)}`),
    enabled: !!from && !!to,
  });
  const setPreset = (days: number) => {
    setFrom(daysAgo(days - 1));
    setTo(iso(new Date()));
  };
  const cell = useReportCell(type);
  const rows = q.data?.rows ?? [];
  const cols = rows[0] ? Object.keys(rows[0]) : [];
  const totals = totalColumns(cols);
  return (
    <div className="space-y-6">
      <PageHeader
        title={t('reports.title')}
        description={t('reports.subtitle')}
        actions={
          can('reports.export') && (
            <div className="flex flex-wrap gap-2">
              <Button icon={<FileDown className="size-4" />} onClick={() => window.open(`/print/report/${type}${qs({ ...params, download: '1' })}`, '_blank', 'noopener')}>
                {t('reports.download_pdf')}
              </Button>
              <a href={`/api/reports/${type}${qs({ ...params, format: 'csv' })}`} download>
                <Button variant="secondary" icon={<Download className="size-4" />}>
                  {t('reports.export_csv')}
                </Button>
              </a>
            </div>
          )
        }
      />
      <Card>
        <div className="grid gap-4 md:grid-cols-4">
          <Select label={t('reports.report')} value={type} onChange={(e) => setType(e.target.value)}>
            {available.map((r) => (
              <option key={r.type} value={r.type}>
                {t(`reports.types.${r.type}`)}
              </option>
            ))}
          </Select>
          <Input type="date" label={t('common.from')} value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" label={t('common.to')} value={to} onChange={(e) => setTo(e.target.value)} />
          {session.outlets.length > 1 && (
            <Select label={t('outlets.outlet')} value={outletId} onChange={(e) => setOutletId(e.target.value)}>
              <option value="">{t('reports.all_outlets')}</option>
              {session.outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {[1, 7, 30, 90].map((d) => (
            <Button key={d} size="sm" variant="ghost" onClick={() => setPreset(d)}>
              {d === 1 ? t('reports.today') : t('reports.last_days', { count: d })}
            </Button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">{t(`reports.descriptions.${type}`)}</p>
      </Card>
      {q.error ? (
        <Alert tone="red">{errMsg(q.error)}</Alert>
      ) : q.isLoading ? (
        <SkeletonRows rows={6} />
      ) : (
        <>
          {q.data && Object.keys(q.data.summary).length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(q.data.summary).map(([k, v]) => (
                <StatCard key={k} label={t(`reports.summary.${k}`)} value={money(v)} tone={k === 'netProfit' ? (v >= 0 ? 'green' : 'red') : 'blue'} />
              ))}
            </div>
          )}
          {type !== 'profit' && (
            <Card padded={false}>
              {rows.length === 0 ? (
                <EmptyState icon={<BarChart3 className="size-6" />} title={t('reports.empty')} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-800/50">
                      <tr>
                        {cols.map((c) => (
                          <th key={c} className={`px-4 py-3 font-medium whitespace-nowrap ${MONEY_COLS.has(c) || typeof rows[0]![c] === 'number' ? 'text-end' : 'text-start'}`}>
                            {t(`reports.columns.${c}`)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {rows.map((r, i) => (
                        <tr key={i}>
                          {cols.map((c) => (
                            <td key={c} className={`px-4 py-2.5 whitespace-nowrap ${typeof r[c] === 'number' ? 'text-end tabular-nums' : ''}`}>
                              {cell(c, r[c])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                    {totals.length > 0 && rows.length > 1 && (
                      <tfoot className="border-t-2 border-slate-200 font-semibold dark:border-slate-700">
                        <tr>
                          {cols.map((c, idx) => (
                            <td key={c} className={`px-4 py-3 whitespace-nowrap ${totals.includes(c) ? 'text-end tabular-nums' : ''}`}>
                              {totals.includes(c) ? money(rows.reduce((a, r) => a + Number(r[c] ?? 0), 0)) : idx === 0 ? t('reports.total_row') : ''}
                            </td>
                          ))}
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
