import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { isLanguageCode, languageDir } from '@oceanx/shared';
import i18n, { ensureLoaded } from '../../i18n';
import { api, qs } from '../../lib/api';
import { localeFor } from '../../lib/format';
import { pdfName } from '../../lib/pdf';
import { useErrorMessage } from '../../lib/useApiError';
import { Alert, SkeletonRows } from '../../components/ui/Card';
import { SignatureBlock, type DocBranding } from '../../components/SignatureBlock';
import { PrintFrame } from './PrintFrame';

interface Statement {
  customer: { name: string; company: string; phone: string; email: string; address: string; taxNumber: string; creditLimit: number | null; creditDays: number | null };
  period: { from: string | null; to: string };
  openingBalance: number;
  entries: { date: string; kind: string; reference: string | null; debit: number; credit: number; balance: number }[];
  totals: { debit: number; credit: number };
  closingBalance: number;
  openItems: { kind: string; reference: string | null; date: string; dueDate: string; total: number; due: number; daysOverdue: number }[];
  outstanding: number;
  overdue: number;
  business: { name: string; address: string; phone: string; email: string; hasLogo: boolean };
  settings: { regional: { currency: string; currencySymbol: string; currencyDecimals: number }; tax: { taxName: string; taxNumber: string } };
  documentLanguage: string;
  generatedAt: string;
  branding?: DocBranding | null;
}

const pad = (n: number) => String(n).padStart(2, '0');
const d = (iso: string | null) => {
  if (!iso) return '—';
  const x = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00`) : new Date(iso);
  return `⁦${pad(x.getDate())}/${pad(x.getMonth() + 1)}/${x.getFullYear()}⁩`;
};

/**
 * Customer statement of account for a date range — printed or downloaded as PDF to hand to the
 * customer. Rendered in the business's document language (not the manager's UI language).
 */
export default function StatementPrint() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const errMsg = useErrorMessage();
  const from = params.get('from') || undefined;
  const to = params.get('to') || undefined;
  const q = useQuery({ queryKey: ['biz', 'statement-print', id, from, to], queryFn: () => api.get<Statement>(`/customers/${id}/statement${qs({ from, to })}`) });
  const [t, setT] = useState<TFunction | null>(null);
  const lang = q.data?.documentLanguage;
  useEffect(() => {
    if (!lang) return;
    const code = isLanguageCode(lang) ? lang : 'en';
    void ensureLoaded(code).then(() => setT(() => i18n.getFixedT(code)));
  }, [lang]);
  const s = q.data;
  return (
    <PrintFrame ready={!!s && !!t} filename={pdfName('statement', s?.customer.name, s?.period.from ?? '', s?.period.to)}>
      {q.error ? (
        <div className="p-6">
          <Alert tone="red">{errMsg(q.error)}</Alert>
        </div>
      ) : !s || !t ? (
        <SkeletonRows rows={10} />
      ) : (
        <StatementDoc s={s} t={t} />
      )}
    </PrintFrame>
  );
}

function StatementDoc({ s, t }: { s: Statement; t: TFunction }) {
  const lang = s.documentLanguage;
  const dec = s.settings.regional.currencyDecimals ?? 2;
  const nf = new Intl.NumberFormat(localeFor(lang), { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const m = (minor: number) => `⁦${s.settings.regional.currencySymbol || s.settings.regional.currency} ${nf.format(minor / 100)}⁩`;
  const kind = (k: string) => t(`credit.kinds.${k}`);
  const th = 'py-2 px-2 text-xs font-semibold text-slate-600';
  const td = 'py-2 px-2 align-top';
  return (
    <article lang={lang} dir={languageDir(lang)} className="space-y-6 p-10 text-[13px] text-slate-900">
      <header className="flex items-start justify-between gap-6 border-b border-slate-200 pb-6" data-pdf-block>
        <div className="space-y-1">
          {s.business.hasLogo && <img src="/api/settings/logo" alt="" className="mb-2 max-h-14 object-contain" />}
          <p className="text-lg font-bold" dir="auto">
            {s.business.name}
          </p>
          {s.business.address && <p className="whitespace-pre-line text-slate-600" dir="auto">{s.business.address}</p>}
          <p className="text-slate-600" dir="ltr">
            {[s.business.phone, s.business.email].filter(Boolean).join(' · ')}
          </p>
          {s.settings.tax.taxNumber && (
            <p className="text-slate-600">
              {t('print.tax_number', { tax: s.settings.tax.taxName })}: <span dir="ltr">{s.settings.tax.taxNumber}</span>
            </p>
          )}
        </div>
        <div className="text-end">
          <p className="text-2xl font-bold tracking-tight">{t('print.statement')}</p>
          <p className="mt-1 text-slate-600">
            {t('print.period')}:{' '}
            <bdi dir="ltr">
              {s.period.from ? d(s.period.from) : t('print.beginning')} – {d(s.period.to)}
            </bdi>
          </p>
          <p className="text-xs text-slate-500">
            {t('print.generated_on')}: {d(s.generatedAt)}
          </p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-6" data-pdf-block>
        <div>
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{t('print.customer')}</p>
          <p className="mt-1 font-semibold" dir="auto">
            {s.customer.name}
          </p>
          {s.customer.company && <p dir="auto">{s.customer.company}</p>}
          {s.customer.address && <p className="whitespace-pre-line" dir="auto">{s.customer.address}</p>}
          <p dir="ltr" className="text-start">
            {[s.customer.phone, s.customer.email].filter(Boolean).join(' · ')}
          </p>
        </div>
        <dl className="space-y-1 justify-self-end">
          {s.customer.creditLimit !== null && (
            <div className="flex justify-between gap-6">
              <dt className="text-slate-600">{t('credit.limit')}</dt>
              <dd className="font-medium">{m(s.customer.creditLimit)}</dd>
            </div>
          )}
          {s.customer.creditDays !== null && (
            <div className="flex justify-between gap-6">
              <dt className="text-slate-600">{t('credit.days')}</dt>
              <dd className="font-medium" dir="ltr">
                {s.customer.creditDays}
              </dd>
            </div>
          )}
        </dl>
      </section>

      <section className="grid grid-cols-4 gap-3" data-pdf-block>
        {[
          ['print.opening_balance', s.openingBalance],
          ['print.charges', s.totals.debit],
          ['print.payments', s.totals.credit],
          ['print.closing_balance', s.closingBalance],
        ].map(([k, v], i) => (
          <div key={k as string} className={`rounded-lg p-3 ring-1 ${i === 3 ? 'bg-slate-900 text-white ring-slate-900' : 'ring-slate-200'}`}>
            <p className={`text-[11px] ${i === 3 ? 'text-slate-300' : 'text-slate-500'}`}>{t(k as string)}</p>
            <p className="mt-1 text-base font-bold">{m(v as number)}</p>
          </div>
        ))}
      </section>

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-y border-slate-300 text-start">
            <th className={`${th} text-start`}>{t('print.date')}</th>
            <th className={`${th} text-start`}>{t('print.description')}</th>
            <th className={`${th} text-end`}>{t('print.charges')}</th>
            <th className={`${th} text-end`}>{t('print.payments')}</th>
            <th className={`${th} text-end`}>{t('print.balance')}</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-slate-100 bg-slate-50">
            <td className={td}>{s.period.from ? d(s.period.from) : '—'}</td>
            <td className={`${td} font-medium`}>{t('print.opening_balance')}</td>
            <td className={td} />
            <td className={td} />
            <td className={`${td} text-end font-medium`}>{m(s.openingBalance)}</td>
          </tr>
          {s.entries.length === 0 && (
            <tr>
              <td colSpan={5} className="py-6 text-center text-slate-500">
                {t('print.no_activity')}
              </td>
            </tr>
          )}
          {s.entries.map((e, i) => (
            <tr key={i} className="border-b border-slate-100">
              <td className={td}>{d(e.date)}</td>
              <td className={td}>
                {kind(e.kind)} {e.reference && <span dir="ltr" className="text-slate-500">{e.reference}</span>}
              </td>
              <td className={`${td} text-end`}>{e.debit ? m(e.debit) : ''}</td>
              <td className={`${td} text-end`}>{e.credit ? m(e.credit) : ''}</td>
              <td className={`${td} text-end font-medium`}>{m(e.balance)}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-slate-300 font-bold">
            <td className={td} />
            <td className={td}>{t('print.closing_balance')}</td>
            <td className={`${td} text-end`}>{m(s.totals.debit)}</td>
            <td className={`${td} text-end`}>{m(s.totals.credit)}</td>
            <td className={`${td} text-end`}>{m(s.closingBalance)}</td>
          </tr>
        </tbody>
      </table>

      <section className="space-y-2">
        <h2 className="text-sm font-bold" data-pdf-block>
          {t('print.open_items')}
        </h2>
        {s.openItems.length === 0 ? (
          <p className="text-slate-500" data-pdf-block>
            {t('print.nothing_due')}
          </p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-y border-slate-300">
                <th className={`${th} text-start`}>{t('print.date')}</th>
                <th className={`${th} text-start`}>{t('print.description')}</th>
                <th className={`${th} text-start`}>{t('print.due_date')}</th>
                <th className={`${th} text-end`}>{t('print.days_overdue')}</th>
                <th className={`${th} text-end`}>{t('print.amount')}</th>
                <th className={`${th} text-end`}>{t('print.balance_due')}</th>
              </tr>
            </thead>
            <tbody>
              {s.openItems.map((o, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className={td}>{d(o.date)}</td>
                  <td className={td}>
                    {kind(o.kind)} {o.reference && <span dir="ltr" className="text-slate-500">{o.reference}</span>}
                  </td>
                  <td className={td}>{d(o.dueDate)}</td>
                  <td className={`${td} text-end ${o.daysOverdue > 0 ? 'font-semibold text-rose-700' : ''}`} dir="ltr">
                    {o.daysOverdue || '—'}
                  </td>
                  <td className={`${td} text-end`}>{m(o.total)}</td>
                  <td className={`${td} text-end font-medium`}>{m(o.due)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="flex justify-end pt-2" data-pdf-block>
          <dl className="w-72 space-y-1">
            <div className="flex justify-between gap-4 text-base font-bold">
              <dt>{t('print.total_outstanding')}</dt>
              <dd>{m(s.outstanding)}</dd>
            </div>
            {s.overdue > 0 && (
              <div className="flex justify-between gap-4 font-semibold text-rose-700">
                <dt>{t('print.overdue_amount')}</dt>
                <dd>{m(s.overdue)}</dd>
              </div>
            )}
          </dl>
        </div>
      </section>
      <SignatureBlock branding={s.branding} t={t} />
      <p className="border-t border-slate-200 pt-4 text-center text-xs text-slate-500" data-pdf-block>
        {t('print.statement_note')}
      </p>
    </article>
  );
}
