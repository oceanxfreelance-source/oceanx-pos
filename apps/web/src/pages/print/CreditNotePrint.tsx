import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { isLanguageCode, languageDir } from '@oceanx/shared';
import i18n, { ensureLoaded } from '../../i18n';
import { api } from '../../lib/api';
import { localeFor } from '../../lib/format';
import { pdfName } from '../../lib/pdf';
import { useErrorMessage } from '../../lib/useApiError';
import { Alert, SkeletonRows } from '../../components/ui/Card';
import { PrintFrame } from './PrintFrame';

interface CreditNote {
  refund: { id: string; number: string; reason: string; method: string; total: number; tax: number; createdAt: string };
  items: { id: string; nameSnapshot: string; quantity: number; taxRate: number; net: number; tax: number }[];
  sale: { id: string; number: string | null; completedAt: string | null; total: number };
  customer: { name: string; taxNumber: string; address: string; phone: string } | null;
  business: { name: string; address: string; phone: string; email: string; hasLogo: boolean };
  settings: { regional: { currency: string; currencySymbol: string; currencyDecimals: number }; tax: { taxName: string; taxNumber: string } };
  documentLanguage: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const day = (iso: string) => {
  const x = new Date(iso);
  return `⁦${pad(x.getDate())}/${pad(x.getMonth() + 1)}/${x.getFullYear()}⁩`;
};

/**
 * Credit note for a refund (Refunds & Returns add-on): the bill it corrects, the items returned and the
 * GST given back, with both TINs, in the document language. MIRA expects one when a sale's value changes.
 */
export default function CreditNotePrint() {
  const { id } = useParams<{ id: string }>();
  const errMsg = useErrorMessage();
  const q = useQuery({ queryKey: ['biz', 'credit-note', id], queryFn: () => api.get<CreditNote>(`/refunds/${id}`) });
  const [t, setT] = useState<TFunction | null>(null);
  const lang = q.data?.documentLanguage;
  useEffect(() => {
    if (!lang) return;
    const code = isLanguageCode(lang) ? lang : 'en';
    void ensureLoaded(code).then(() => setT(() => i18n.getFixedT(code)));
  }, [lang]);
  const d = q.data;
  return (
    <PrintFrame ready={!!d && !!t} filename={pdfName('credit-note', d?.refund.number, d?.refund.createdAt.slice(0, 10))} width="210mm">
      {q.error ? (
        <div className="p-6">
          <Alert tone="red">{errMsg(q.error)}</Alert>
        </div>
      ) : !d || !t ? (
        <SkeletonRows rows={6} />
      ) : (
        <Note d={d} t={t} />
      )}
    </PrintFrame>
  );
}

function Note({ d, t }: { d: CreditNote; t: TFunction }) {
  const lang = d.documentLanguage;
  const dec = d.settings.regional.currencyDecimals ?? 2;
  const nf = new Intl.NumberFormat(localeFor(lang), { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const m = (minor: number) => `⁦${d.settings.regional.currencySymbol || d.settings.regional.currency} ${nf.format(minor / 100)}⁩`;
  const itemsNet = d.items.reduce((a, i) => a + i.net, 0);
  const itemsTax = d.items.reduce((a, i) => a + i.tax, 0);
  // What is not on the item lines: the service charge (and delivery) share and its tax.
  const otherNet = d.refund.total - d.refund.tax - itemsNet;
  const otherTax = d.refund.tax - itemsTax;
  const row = 'flex justify-between gap-4 py-1';
  return (
    <article lang={lang} dir={languageDir(lang)} className="mx-auto max-w-[170mm] space-y-5 px-8 py-10 text-[13px] text-slate-900" data-pdf-block>
      <header className="flex items-start justify-between gap-6 border-b border-slate-200 pb-4">
        <div className="space-y-0.5">
          {d.business.hasLogo && <img src="/api/settings/logo" alt="" className="mb-1 max-h-12 object-contain" />}
          <p className="text-base font-bold" dir="auto">
            {d.business.name}
          </p>
          {d.business.address && (
            <p className="whitespace-pre-line text-slate-600" dir="auto">
              {d.business.address}
            </p>
          )}
          {d.business.phone && <p dir="ltr">{d.business.phone}</p>}
          {d.settings.tax.taxNumber && (
            <p>
              {t('credit_note.tin')}: <span dir="ltr">{d.settings.tax.taxNumber}</span>
            </p>
          )}
        </div>
        <div className="text-end">
          <h1 className="text-2xl font-bold tracking-tight">{t('credit_note.title')}</h1>
          <p className="mt-1 font-semibold" dir="ltr">
            {d.refund.number}
          </p>
          <p className="text-slate-600">{day(d.refund.createdAt)}</p>
        </div>
      </header>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <p className="text-xs font-semibold text-slate-500">{t('credit_note.to')}</p>
          {d.customer ? (
            <>
              <p className="font-semibold" dir="auto">
                {d.customer.name}
              </p>
              {d.customer.address && (
                <p className="whitespace-pre-line text-slate-600" dir="auto">
                  {d.customer.address}
                </p>
              )}
              {d.customer.taxNumber && (
                <p>
                  {t('credit_note.tin')}: <span dir="ltr">{d.customer.taxNumber}</span>
                </p>
              )}
            </>
          ) : (
            <p className="text-slate-600">{t('credit_note.walk_in')}</p>
          )}
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500">{t('credit_note.for_bill')}</p>
          <p className="font-semibold" dir="ltr">
            {d.sale.number ?? '—'}
          </p>
          {d.sale.completedAt && <p className="text-slate-600">{day(d.sale.completedAt)}</p>}
        </div>
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-y border-slate-300 text-xs text-slate-600">
            <th className="px-2 py-2 text-start font-semibold">{t('credit_note.item')}</th>
            <th className="px-2 py-2 text-end font-semibold">{t('credit_note.qty')}</th>
            <th className="px-2 py-2 text-end font-semibold">{t('credit_note.rate')}</th>
            <th className="px-2 py-2 text-end font-semibold">{t('credit_note.value')}</th>
            <th className="px-2 py-2 text-end font-semibold">{d.settings.tax.taxName || t('credit_note.tax')}</th>
          </tr>
        </thead>
        <tbody>
          {d.items.map((i) => (
            <tr key={i.id} className="border-b border-slate-100">
              <td className="px-2 py-1.5" dir="auto">
                {i.nameSnapshot}
              </td>
              <td className="px-2 py-1.5 text-end tabular-nums">{Number(i.quantity)}</td>
              <td className="px-2 py-1.5 text-end tabular-nums">{Number(i.taxRate)}%</td>
              <td className="px-2 py-1.5 text-end tabular-nums">{m(i.net)}</td>
              <td className="px-2 py-1.5 text-end tabular-nums">{m(i.tax)}</td>
            </tr>
          ))}
          {(otherNet !== 0 || otherTax !== 0) && (
            <tr className="border-b border-slate-100">
              <td className="px-2 py-1.5" colSpan={3}>
                {t('credit_note.service_charge_share')}
              </td>
              <td className="px-2 py-1.5 text-end tabular-nums">{m(otherNet)}</td>
              <td className="px-2 py-1.5 text-end tabular-nums">{m(otherTax)}</td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="ms-auto w-72 space-y-1">
        <p className={row}>
          <span className="text-slate-600">{t('credit_note.value_excl')}</span>
          <span className="tabular-nums">{m(d.refund.total - d.refund.tax)}</span>
        </p>
        <p className={row}>
          <span className="text-slate-600">{d.settings.tax.taxName || t('credit_note.tax')}</span>
          <span className="tabular-nums">{m(d.refund.tax)}</span>
        </p>
        <p className={`${row} border-t border-slate-900 pt-2 text-base font-bold`}>
          <span>{t('credit_note.total')}</span>
          <span className="tabular-nums">{m(d.refund.total)}</span>
        </p>
        <p className={row}>
          <span className="text-slate-600">{t('credit_note.paid_back_by')}</span>
          <span>{t(`payment_methods.${d.refund.method}`)}</span>
        </p>
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-500">{t('credit_note.reason')}</p>
        <p dir="auto">{d.refund.reason}</p>
      </div>
      <div className="grid grid-cols-2 gap-10 pt-8">
        {[t('credit_note.issued_by'), t('credit_note.received_by')].map((l) => (
          <div key={l}>
            <div className="h-10 border-b border-slate-400" />
            <p className="mt-1 text-xs text-slate-600">{l}</p>
          </div>
        ))}
      </div>
    </article>
  );
}
