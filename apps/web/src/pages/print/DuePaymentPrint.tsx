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
import { SignatureBlock, type DocBranding } from '../../components/SignatureBlock';
import { PrintFrame } from './PrintFrame';

interface DuePayment {
  id: string;
  customer: { name: string; phone: string };
  paidAt: string;
  method: string;
  reference: string;
  amount: number;
  balanceAfter: number;
  receivedByName: string;
  lines: { kind: 'sale' | 'invoice'; number: string; amount: number }[];
  business: { name: string; address: string; phone: string; email: string; hasLogo: boolean };
  settings: { regional: { currency: string; currencySymbol: string; currencyDecimals: number }; tax: { taxName: string; taxNumber: string } };
  documentLanguage: string;
  branding?: DocBranding | null;
}

const pad = (n: number) => String(n).padStart(2, '0');
const dt = (iso: string) => {
  const x = new Date(iso);
  return `⁦${pad(x.getDate())}/${pad(x.getMonth() + 1)}/${x.getFullYear()} ${pad(x.getHours())}:${pad(x.getMinutes())}⁩`;
};

/** Receipt for money a customer paid towards their dues (full or part), in the document language. */
export default function DuePaymentPrint() {
  const { id } = useParams<{ id: string }>();
  const errMsg = useErrorMessage();
  const q = useQuery({ queryKey: ['biz', 'due-payment', id], queryFn: () => api.get<DuePayment>(`/credit-payments/${id}`) });
  const [t, setT] = useState<TFunction | null>(null);
  const lang = q.data?.documentLanguage;
  useEffect(() => {
    if (!lang) return;
    const code = isLanguageCode(lang) ? lang : 'en';
    void ensureLoaded(code).then(() => setT(() => i18n.getFixedT(code)));
  }, [lang]);
  const d = q.data;
  return (
    <PrintFrame ready={!!d && !!t} filename={pdfName('payment', d?.customer.name, d?.paidAt.slice(0, 10))} width="120mm">
      {q.error ? (
        <div className="p-6">
          <Alert tone="red">{errMsg(q.error)}</Alert>
        </div>
      ) : !d || !t ? (
        <SkeletonRows rows={6} />
      ) : (
        <Receipt d={d} t={t} />
      )}
    </PrintFrame>
  );
}

function Receipt({ d, t }: { d: DuePayment; t: TFunction }) {
  const lang = d.documentLanguage;
  const dec = d.settings.regional.currencyDecimals ?? 2;
  const nf = new Intl.NumberFormat(localeFor(lang), { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const m = (minor: number) => `⁦${d.settings.regional.currencySymbol || d.settings.regional.currency} ${nf.format(minor / 100)}⁩`;
  const row = 'flex justify-between gap-4 py-1';
  return (
    <article lang={lang} dir={languageDir(lang)} className="space-y-4 p-6 text-[13px] text-slate-900" data-pdf-block>
      <header className="space-y-1 text-center">
        {d.business.hasLogo && <img src="/api/settings/logo" alt="" className="mx-auto mb-1 max-h-12 object-contain" />}
        <p className="text-base font-bold" dir="auto">
          {d.business.name}
        </p>
        {d.business.address && (
          <p className="whitespace-pre-line text-slate-600" dir="auto">
            {d.business.address}
          </p>
        )}
        {d.business.phone && <p dir="ltr">{d.business.phone}</p>}
      </header>
      <h1 className="border-y border-dashed border-slate-300 py-2 text-center text-lg font-bold">{t('credit.payment_receipt')}</h1>
      <div>
        <p className={row}>
          <span className="text-slate-600">{t('print.date')}</span>
          <span>{dt(d.paidAt)}</span>
        </p>
        <p className={row}>
          <span className="text-slate-600">{t('print.customer')}</span>
          <span className="font-semibold" dir="auto">
            {d.customer.name}
          </span>
        </p>
        <p className={row}>
          <span className="text-slate-600">{t('payments.method')}</span>
          <span>{t(`payment_methods.${d.method}`)}</span>
        </p>
        {d.reference && (
          <p className={row}>
            <span className="text-slate-600">{t('payments.reference')}</span>
            <span dir="ltr">{d.reference}</span>
          </p>
        )}
        {d.receivedByName && (
          <p className={row}>
            <span className="text-slate-600">{t('print.cashier')}</span>
            <span dir="auto">{d.receivedByName}</span>
          </p>
        )}
      </div>
      <div className="border-t border-dashed border-slate-300 pt-2">
        <p className="pb-1 text-xs font-semibold text-slate-500">{t('credit.paid_towards')}</p>
        {d.lines.map((l, i) => (
          <p key={i} className={row}>
            <span>
              {t(l.kind === 'invoice' ? 'print.invoice' : 'print.receipt')} <span dir="ltr">{l.number}</span>
            </span>
            <span className="tabular-nums">{m(l.amount)}</span>
          </p>
        ))}
      </div>
      <div className="space-y-1 border-t border-slate-900 pt-2">
        <p className={`${row} text-base font-bold`}>
          <span>{t('credit.amount_paid')}</span>
          <span>{m(d.amount)}</span>
        </p>
        <p className={`${row} font-semibold`}>
          <span>{t('credit.still_due')}</span>
          <span>{d.balanceAfter > 0 ? m(d.balanceAfter) : t('credit.fully_paid')}</span>
        </p>
      </div>
      <SignatureBlock branding={d.branding} t={t} label={t('print.received_by')} />
      <p className="pt-2 text-center text-slate-600">{t('print.thank_you')}</p>
    </article>
  );
}
