import type { TFunction } from 'i18next';
import { languageDir } from '@oceanx/shared';
import { localeFor } from '../lib/format';
import { SignatureBlock, type DocBranding } from './SignatureBlock';

/**
 * Printable invoice / quotation / receipt. Rendered with a translation function fixed to the
 * DOCUMENT language (not the viewer's UI language), with matching text direction.
 * Amounts are integer minor units; numbers always use Western digits inside LTR isolates.
 */
export interface DocBusiness {
  name: string;
  address: string;
  phone: string;
  email: string;
  hasLogo: boolean;
  /** A fixed logo instead of the business logo (OceanX's own documents in the Hub). */
  logoUrl?: string;
}
export interface DocRegional {
  currencySymbol: string;
  currency: string;
  currencyDecimals?: number;
}
export interface DocLine {
  id: string;
  name: string;
  detail?: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  discount: number;
  total: number;
}
export interface DocData {
  kind: 'invoice' | 'quotation' | 'receipt';
  language: string;
  number: string | null;
  status?: string;
  business: DocBusiness;
  regional: DocRegional;
  taxName: string;
  taxNumber: string;
  customer: { name: string; company?: string; address?: string; phone?: string; email?: string; taxNumber?: string } | null;
  dates: { label: string; value: string | null }[];
  meta?: { label: string; value: string }[];
  lines: DocLine[];
  totals: { subtotal: number; discount: number; serviceCharge: number; tax: number; deliveryFee?: number; total: number; paid?: number; change?: number; balanceDue?: number };
  payments?: { method: string; amount: number }[];
  header?: string;
  notes?: string;
  terms?: string;
  footer?: string;
  /** Company stamp and preparer's signature (quotations and invoices). */
  branding?: DocBranding | null;
  paperWidth?: '58mm' | '80mm' | 'a4';
}

/** Big "PAID" stamp across a paid invoice, "REJECTED" across a rejected quotation (printed and in the PDF). */
function StatusStamp({ doc }: { doc: DocData }) {
  const stamp = doc.kind === 'invoice' && doc.status === 'paid' ? 'paid' : doc.kind === 'quotation' && doc.status === 'rejected' ? 'rejected' : null;
  if (!stamp) return null;
  return (
    <img
      src={`/stamps/${stamp}.png`}
      alt={stamp === 'paid' ? 'PAID' : 'REJECTED'}
      data-stamp={stamp}
      className="pointer-events-none absolute start-1/2 top-40 z-10 w-[120mm] max-w-[80%] -translate-x-1/2 opacity-80 select-none rtl:translate-x-1/2"
    />
  );
}

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: string) => {
  const x = /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T12:00:00`) : new Date(d);
  return `${pad(x.getDate())}/${pad(x.getMonth() + 1)}/${x.getFullYear()}`;
};

export function DocumentView({ doc, t }: { doc: DocData; t: TFunction }) {
  const dir = languageDir(doc.language);
  const decimals = doc.regional.currencyDecimals ?? 2;
  const nf = new Intl.NumberFormat(localeFor(doc.language), { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const m = (minor: number) => `⁦${doc.regional.currencySymbol || doc.regional.currency} ${nf.format(minor / 100)}⁩`;
  const n = (v: number) => `⁦${Number(v).toString()}⁩`;
  const narrow = doc.kind === 'receipt' && doc.paperWidth !== 'a4';
  const title = t(`print.${doc.kind}`);

  if (narrow) {
    return (
      <article lang={doc.language} dir={dir} className="doc-receipt mx-auto bg-white p-3 font-mono text-[12px] leading-snug text-black" style={{ width: doc.paperWidth === '58mm' ? '58mm' : '80mm' }}>
        <header className="space-y-0.5 text-center">
          {(doc.business.logoUrl || doc.business.hasLogo) && <img src={doc.business.logoUrl ?? "/api/settings/logo"} alt="" className="mx-auto mb-1 max-h-14 object-contain" />}
          <p className="text-[14px] font-bold" dir="auto">
            {doc.business.name}
          </p>
          {doc.business.address && <p dir="auto">{doc.business.address}</p>}
          {doc.business.phone && <p dir="ltr">{doc.business.phone}</p>}
          {doc.taxNumber && (
            <p>
              {t('print.tax_number', { tax: doc.taxName })}: <span dir="ltr">{doc.taxNumber}</span>
            </p>
          )}
          {doc.header && <p className="whitespace-pre-line" dir="auto">{doc.header}</p>}
        </header>
        <hr className="my-2 border-dashed border-black" />
        <p className="text-center font-bold">{title}</p>
        <dl className="mt-1 space-y-0.5">
          {doc.number && <KV k={t('print.number')} v={<span dir="ltr">{doc.number}</span>} />}
          {doc.dates.map((d) => d.value && <KV key={d.label} k={d.label} v={<span dir="ltr">{iso(d.value)} {new Date(d.value).toTimeString().slice(0, 5)}</span>} />)}
          {doc.meta?.map((x) => <KV key={x.label} k={x.label} v={<span dir="auto">{x.value}</span>} />)}
          {doc.customer && <KV k={t('print.customer')} v={<span dir="auto">{doc.customer.name}</span>} />}
        </dl>
        <hr className="my-2 border-dashed border-black" />
        <ul className="space-y-1">
          {doc.lines.map((l) => (
            <li key={l.id}>
              <p dir="auto">{l.name}</p>
              {l.detail && <p className="ps-2 text-[11px]" dir="auto">{l.detail}</p>}
              <p className="flex justify-between">
                <span>
                  {n(l.quantity)} × {m(l.unitPrice)}
                </span>
                <span>{m(l.total)}</span>
              </p>
            </li>
          ))}
        </ul>
        <hr className="my-2 border-dashed border-black" />
        <Totals doc={doc} t={t} m={m} />
        {doc.footer && <p className="mt-3 text-center whitespace-pre-line" dir="auto">{doc.footer}</p>}
        <p className="mt-2 text-center">{t('print.thank_you')}</p>
      </article>
    );
  }

  return (
    <article lang={doc.language} dir={dir} className="doc-a4 relative mx-auto max-w-[210mm] bg-white p-10 text-[13px] text-slate-900">
      <StatusStamp doc={doc} />
      <header className="flex items-start justify-between gap-6 border-b border-slate-200 pb-6">
        <div className="space-y-1">
          {(doc.business.logoUrl || doc.business.hasLogo) && <img src={doc.business.logoUrl ?? "/api/settings/logo"} alt="" className="mb-2 max-h-16 object-contain" />}
          <p className="text-lg font-bold" dir="auto">
            {doc.business.name}
          </p>
          {doc.business.address && <p className="whitespace-pre-line text-slate-600" dir="auto">{doc.business.address}</p>}
          <p className="text-slate-600" dir="ltr">
            {[doc.business.phone, doc.business.email].filter(Boolean).join(' · ')}
          </p>
          {doc.taxNumber && (
            <p className="text-slate-600">
              {t('print.tax_number', { tax: doc.taxName })}: <span dir="ltr">{doc.taxNumber}</span>
            </p>
          )}
        </div>
        <div className="text-end">
          <p className="text-2xl font-bold tracking-tight text-slate-800">{title}</p>
          {doc.number && (
            <p className="mt-1 text-base font-semibold" dir="ltr">
              {doc.number}
            </p>
          )}
          {doc.status && <p className="mt-1 text-xs tracking-wide text-slate-500 uppercase">{t(`status_labels.${doc.status}`)}</p>}
        </div>
      </header>
      <section className="grid grid-cols-2 gap-6 py-6">
        <div>
          {doc.customer && (
            <>
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{t(doc.kind === 'quotation' ? 'print.prepared_for' : 'print.bill_to')}</p>
              <p className="mt-1 font-semibold" dir="auto">
                {doc.customer.name}
              </p>
              {doc.customer.company && <p dir="auto">{doc.customer.company}</p>}
              {doc.customer.address && <p className="whitespace-pre-line" dir="auto">{doc.customer.address}</p>}
              <p dir="ltr" className="text-start">
                {[doc.customer.phone, doc.customer.email].filter(Boolean).join(' · ')}
              </p>
              {doc.customer.taxNumber && (
                <p>
                  {t('print.tax_number', { tax: doc.taxName })}: <span dir="ltr">{doc.customer.taxNumber}</span>
                </p>
              )}
            </>
          )}
        </div>
        <dl className="space-y-1 justify-self-end">
          {doc.dates.map((d) => d.value && <KV key={d.label} k={d.label} v={<span dir="ltr">{iso(d.value)}</span>} />)}
          {doc.meta?.map((x) => <KV key={x.label} k={x.label} v={<span dir="auto">{x.value}</span>} />)}
        </dl>
      </section>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-y border-slate-300 text-xs text-slate-600">
            <th className="py-2 text-start font-semibold">#</th>
            <th className="py-2 text-start font-semibold">{t('print.item')}</th>
            <th className="py-2 text-end font-semibold">{t('print.qty')}</th>
            <th className="py-2 text-end font-semibold">{t('print.unit_price')}</th>
            <th className="py-2 text-end font-semibold">{t('print.discount')}</th>
            <th className="py-2 text-end font-semibold">{t('print.amount')}</th>
          </tr>
        </thead>
        <tbody>
          {doc.lines.map((l, i) => (
            <tr key={l.id} className="border-b border-slate-100 align-top">
              <td className="py-2">{n(i + 1)}</td>
              <td className="py-2">
                <p dir="auto">{l.name}</p>
                {l.detail && <p className="text-xs text-slate-500" dir="auto">{l.detail}</p>}
              </td>
              <td className="py-2 text-end">
                {n(l.quantity)} {l.unit && <span className="text-slate-500">{l.unit}</span>}
              </td>
              <td className="py-2 text-end">{m(l.unitPrice)}</td>
              <td className="py-2 text-end">{l.discount ? m(l.discount) : '—'}</td>
              <td className="py-2 text-end font-medium">{m(l.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 flex justify-end">
        <div className="w-72">
          <Totals doc={doc} t={t} m={m} />
        </div>
      </div>
      {(doc.notes || doc.terms) && (
        <section className="mt-8 grid gap-6 sm:grid-cols-2">
          {doc.notes && (
            <div>
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{t('print.notes')}</p>
              <p className="mt-1 whitespace-pre-line" dir="auto">
                {doc.notes}
              </p>
            </div>
          )}
          {doc.terms && (
            <div>
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{t('print.terms')}</p>
              <p className="mt-1 whitespace-pre-line" dir="auto">
                {doc.terms}
              </p>
            </div>
          )}
        </section>
      )}
      <SignatureBlock branding={doc.branding} t={t} />
      {doc.footer && (
        <footer className="mt-10 border-t border-slate-200 pt-4 text-center text-xs whitespace-pre-line text-slate-500" dir="auto">
          {doc.footer}
        </footer>
      )}
    </article>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-600">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  );
}

function Totals({ doc, t, m }: { doc: DocData; t: TFunction; m: (n: number) => string }) {
  const x = doc.totals;
  return (
    <dl className="space-y-1">
      <KV k={t('print.subtotal')} v={m(x.subtotal)} />
      {x.discount > 0 && <KV k={t('print.discount')} v={`− ${m(x.discount)}`} />}
      {x.serviceCharge > 0 && <KV k={t('print.service_charge')} v={m(x.serviceCharge)} />}
      {x.tax > 0 && <KV k={doc.taxName || t('print.tax')} v={m(x.tax)} />}
      {!!x.deliveryFee && <KV k={t('print.delivery_fee')} v={m(x.deliveryFee)} />}
      <div className="flex justify-between gap-4 border-t border-current pt-1 text-[1.1em] font-bold">
        <dt>{t('print.total')}</dt>
        <dd>{m(x.total)}</dd>
      </div>
      {doc.payments?.map((p, i) => <KV key={i} k={t(`payment_methods.${p.method}`)} v={m(p.amount)} />)}
      {x.paid !== undefined && !doc.payments && x.paid > 0 && <KV k={t('print.paid')} v={m(x.paid)} />}
      {!!x.change && <KV k={t('print.change')} v={m(x.change)} />}
      {!!x.balanceDue && <KV k={t('print.balance_due')} v={m(x.balanceDue)} />}
    </dl>
  );
}
