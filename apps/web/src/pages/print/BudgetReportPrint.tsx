import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { languageDir } from '@oceanx/shared';
import { api } from '../../lib/api';
import { useMoney } from '../../lib/money';
import { useFormat } from '../../lib/format';
import { pdfName } from '../../lib/pdf';
import { useErrorMessage } from '../../lib/useApiError';
import { Alert, SkeletonRows } from '../../components/ui/Card';
import { BudgetMark } from '../auth/AuthLayout';
import { useInsightText, useMonthName, type Goal, type Overview } from '../business/Budget';
import { PrintFrame } from './PrintFrame';

interface Report extends Overview {
  person: { name: string; account: string };
  goals: Goal[];
  entries: { id: string; kind: 'income' | 'expense'; amount: number; occurredOn: string; categoryName: string; categoryEmoji: string; note: string; paidWith: string }[];
}

/** Gravity Budget: one month on A4 (print or PDF): totals, advice, budgets, bills, goals and every record. */
export default function BudgetReportPrint() {
  const { month } = useParams<{ month: string }>();
  const errMsg = useErrorMessage();
  const q = useQuery({ queryKey: ['biz', 'budget', 'report', month], queryFn: () => api.get<Report>(`/budget/report?month=${month}`) });
  return (
    <PrintFrame ready={!!q.data} filename={pdfName('budget', month)}>
      {q.error ? (
        <div className="p-6">
          <Alert tone="red">{errMsg(q.error)}</Alert>
        </div>
      ) : !q.data ? (
        <SkeletonRows rows={8} />
      ) : (
        <Sheet r={q.data} />
      )}
    </PrintFrame>
  );
}

function Sheet({ r }: { r: Report }) {
  const { t, i18n } = useTranslation();
  const money = useMoney();
  const f = useFormat();
  const monthName = useMonthName();
  const insightText = useInsightText();
  const thBase = 'px-2 py-1.5 text-[11px] font-semibold text-slate-600';
  const th = `${thBase} text-start`;
  const thEnd = `${thBase} text-end`;
  const td = 'px-2 py-1.5';
  const num = 'px-2 py-1.5 text-end tabular-nums';
  const spentRows = [...r.categories.filter((c) => c.spent > 0 || c.limit !== null), ...(r.other.spent > 0 ? [{ id: 'other', name: t('budget.other'), emoji: '📦', limit: null, spent: r.other.spent, lastMonth: r.other.lastMonth, left: null }] : [])];
  return (
    <article lang={i18n.language} dir={languageDir(i18n.language)} className="space-y-6 px-10 py-10 text-[12.5px] text-slate-900" data-pdf-block>
      <header className="flex items-start justify-between gap-6 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <BudgetMark className="size-11" />
          <div>
            <p className="text-base font-bold">{t('budget.name')}</p>
            <p className="text-slate-600" dir="auto">
              {r.person.name}
            </p>
          </div>
        </div>
        <div className="text-end">
          <h1 className="text-xl font-bold tracking-tight">{t('budget.report_title')}</h1>
          <p className="mt-0.5 font-semibold">{monthName(r.month)}</p>
          <p className="text-xs text-slate-500">{t('budget.report_made', { date: f.date(r.today) })}</p>
        </div>
      </header>

      <section className="grid grid-cols-4 gap-2">
        {[
          [t('budget.money_in'), r.totals.income, 'text-emerald-700'],
          [t('budget.spent'), r.totals.spent, 'text-rose-700'],
          [t('budget.saved'), r.totals.saved, 'text-slate-900'],
          [r.totals.left < 0 ? t('budget.overspent') : t('budget.left'), r.totals.left, r.totals.left < 0 ? 'text-rose-700' : 'text-slate-900'],
        ].map(([label, value, cls]) => (
          <div key={label as string} className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
            <p className="text-[11px] text-slate-500">{label}</p>
            <p className={`text-base font-bold tabular-nums ${cls}`}>{money(value as number)}</p>
          </div>
        ))}
      </section>

      {r.insights.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">{t('budget.advice')}</h2>
          <ul className="list-disc space-y-1 ps-5">
            {r.insights.map((i, n) => (
              <li key={n} dir="auto">
                {insightText(i)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">{t('budget.where_it_went')}</h2>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-y border-slate-300">
              <th className={th}>{t('flow.category')}</th>
              <th className={thEnd}>{t('budget.monthly_limit')}</th>
              <th className={thEnd}>{t('budget.spent')}</th>
              <th className={thEnd}>{t('budget.left')}</th>
              <th className={thEnd}>{t('budget.last_month')}</th>
            </tr>
          </thead>
          <tbody>
            {spentRows.map((c) => (
              <tr key={c.id} className="border-b border-slate-100">
                <td className={td} dir="auto">
                  {c.emoji} {c.name}
                </td>
                <td className={num}>{c.limit !== null ? money(c.limit) : '—'}</td>
                <td className={num}>{money(c.spent)}</td>
                <td className={`${num} ${c.left !== null && c.left < 0 ? 'font-semibold text-rose-700' : ''}`}>{c.left !== null ? money(c.left) : '—'}</td>
                <td className={`${num} text-slate-500`}>{money(c.lastMonth)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-900 font-bold">
              <td className={td}>{t('budget.total')}</td>
              <td className={num}>{money(r.totals.budgeted)}</td>
              <td className={num}>{money(r.totals.spent)}</td>
              <td className={num} />
              <td className={num}>{money(r.previous.spent)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {r.bills.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">{t('budget.monthly_bills')}</h2>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-y border-slate-300">
                <th className={th}>{t('budget.bill_name')}</th>
                <th className={th}>{t('budget.due_day')}</th>
                <th className={thEnd}>{t('flow.amount')}</th>
                <th className={th}>{t('budget.status')}</th>
              </tr>
            </thead>
            <tbody>
              {r.bills.map((b) => (
                <tr key={b.id} className="border-b border-slate-100">
                  <td className={td} dir="auto">
                    {b.name}
                  </td>
                  <td className={td}>{f.date(b.dueDate)}</td>
                  <td className={num}>{money(b.paidAmount ?? b.amount)}</td>
                  <td className={`${td} ${b.paid ? 'text-emerald-700' : b.overdue ? 'font-semibold text-rose-700' : 'text-slate-600'}`}>{b.paid ? t('budget.paid_on', { date: f.date(b.paidOn) }) : b.overdue ? t('budget.not_paid') : t('budget.to_pay')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {r.goals.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">{t('budget.nav_goals')}</h2>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-y border-slate-300">
                <th className={th}>{t('budget.goal_name')}</th>
                <th className={thEnd}>{t('budget.saved')}</th>
                <th className={thEnd}>{t('budget.goal_target')}</th>
                <th className={thEnd}>%</th>
                <th className={th}>{t('budget.goal_date')}</th>
              </tr>
            </thead>
            <tbody>
              {r.goals.map((g) => (
                <tr key={g.id} className="border-b border-slate-100">
                  <td className={td} dir="auto">
                    {g.emoji} {g.name}
                  </td>
                  <td className={num}>{money(g.saved)}</td>
                  <td className={num}>{money(g.target)}</td>
                  <td className={num}>{g.percent}%</td>
                  <td className={td}>{g.targetDate ? f.date(g.targetDate) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">{t('budget.all_records')}</h2>
        {r.entries.length === 0 ? (
          <p className="text-slate-500">{t('budget.nothing_yet')}</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-y border-slate-300">
                <th className={th}>{t('flow.date')}</th>
                <th className={th}>{t('flow.category')}</th>
                <th className={th}>{t('flow.note')}</th>
                <th className={th}>{t('budget.paid_with')}</th>
                <th className={thEnd}>{t('flow.amount')}</th>
              </tr>
            </thead>
            <tbody>
              {r.entries.map((e) => (
                <tr key={e.id} className="border-b border-slate-100">
                  <td className={`${td} whitespace-nowrap`}>{f.date(e.occurredOn)}</td>
                  <td className={td} dir="auto">
                    {e.categoryEmoji} {e.categoryName || '—'}
                  </td>
                  <td className={td} dir="auto">
                    {e.note}
                  </td>
                  <td className={td}>{e.kind === 'expense' ? t(`budget.paid.${e.paidWith}`) : ''}</td>
                  <td className={`${num} ${e.kind === 'income' ? 'text-emerald-700' : ''}`}>
                    {e.kind === 'income' ? '+' : '−'}
                    {money(e.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <p className="border-t border-slate-200 pt-3 text-center text-[11px] text-slate-500">{t('budget.report_footer')}</p>
    </article>
  );
}
