import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { isLanguageCode } from '@oceanx/shared';
import i18n, { ensureLoaded } from '../../i18n';
import { api } from '../../lib/api';
import { useErrorMessage } from '../../lib/useApiError';
import { Alert, SkeletonRows } from '../../components/ui/Card';
import { DocumentView, type DocData } from '../../components/DocumentView';
import { pdfName } from '../../lib/pdf';
import { PrintFrame } from './PrintFrame';

type Kind = 'receipt' | 'invoice' | 'quotation';

/* eslint-disable @typescript-eslint/no-explicit-any */
function toDoc(kind: Kind, d: any, t: TFunction): DocData {
  const regional = { currency: d.settings.regional.currency, currencySymbol: d.settings.regional.currencySymbol, currencyDecimals: d.settings.regional.currencyDecimals };
  const base = { kind, language: d.documentLanguage, business: d.business, regional, taxName: d.settings.tax.taxName, taxNumber: d.settings.tax.taxNumber };
  const customer = d.customer ? { name: d.customer.name, company: d.customer.company, address: d.customer.address, phone: d.customer.phone, email: d.customer.email, taxNumber: d.customer.taxNumber } : null;
  if (kind === 'receipt') {
    const s = d.sale;
    return {
      ...base,
      number: s.number,
      status: s.status === 'void' ? 'void' : undefined,
      customer,
      dates: [{ label: t('print.date'), value: s.completedAt ?? s.createdAt }],
      meta: [
        { label: t('print.order_type'), value: t(`pos.order_types.${s.orderType}`) },
        ...(s.tableName ? [{ label: t('print.table'), value: s.tableName }] : []),
        ...(s.cashierName ? [{ label: t('print.cashier'), value: s.cashierName }] : []),
      ],
      lines: d.items.map((i: any) => ({
        id: i.id,
        name: i.nameSnapshot,
        detail: [...(i.options ?? []).map((o: any) => o.choice), i.note].filter(Boolean).join(', '),
        quantity: Number(i.quantity),
        unitPrice: i.unitPrice,
        discount: i.discount,
        total: i.total,
      })),
      totals: { subtotal: s.subtotal, discount: s.discount, serviceCharge: s.serviceCharge, tax: s.tax, deliveryFee: s.deliveryFee, total: s.total, change: s.changeAmount, balanceDue: s.balanceDue },
      payments: d.payments.filter((p: any) => !p.voidedAt && p.kind === 'sale').map((p: any) => ({ method: p.method, amount: p.amount })),
      header: d.settings.receipt.header,
      footer: d.settings.receipt.footer,
      // Every printed document is A4 (receipts included).
      paperWidth: 'a4' as const,
    };
  }
  const doc = kind === 'invoice' ? d.invoice : d.quotation;
  return {
    ...base,
    number: doc.number,
    status: doc.status,
    customer,
    dates:
      kind === 'invoice'
        ? [
            { label: t('print.date'), value: doc.invoiceDate },
            { label: t('print.due_date'), value: doc.dueDate },
          ]
        : [
            { label: t('print.date'), value: doc.quotationDate },
            { label: t('print.valid_until'), value: doc.validUntil },
          ],
    meta: [
      ...(doc.customerRef ? [{ label: t('print.customer_ref'), value: doc.customerRef }] : []),
      ...(doc.salespersonName ? [{ label: t('print.salesperson'), value: doc.salespersonName }] : []),
    ],
    lines: d.items.map((i: any) => ({ id: i.id, name: i.itemNameSnapshot, detail: i.description, quantity: Number(i.quantity), unit: i.unit, unitPrice: i.unitPrice, discount: i.discount, total: i.total })),
    totals: {
      subtotal: doc.subtotal,
      discount: doc.discount,
      serviceCharge: doc.serviceCharge,
      tax: doc.tax,
      total: doc.total,
      ...(kind === 'invoice' ? { paid: doc.paidAmount, balanceDue: doc.balanceDue } : {}),
    },
    notes: doc.notes,
    terms: doc.terms,
    footer: d.settings.footer,
    paymentDetails: d.settings.paymentDetails,
    branding: d.branding ?? null,
  };
}

/** Full-screen print preview. The document renders in its own document language, not the UI language. */
export default function PrintPage() {
  const { kind, id } = useParams<{ kind: Kind; id: string }>();
  const { t: uiT } = useTranslation();
  const errMsg = useErrorMessage();
  const path = kind === 'receipt' ? `/sales/${id}` : kind === 'invoice' ? `/invoices/${id}` : `/quotations/${id}`;
  const q = useQuery({ queryKey: ['biz', 'print', kind, id], queryFn: () => api.get<any>(path), enabled: ['receipt', 'invoice', 'quotation'].includes(kind ?? '') });
  const [docT, setDocT] = useState<TFunction | null>(null);
  const lang = q.data?.documentLanguage;
  useEffect(() => {
    if (!lang) return;
    const code = isLanguageCode(lang) ? lang : 'en';
    void ensureLoaded(code).then(() => setDocT(() => i18n.getFixedT(code)));
  }, [lang]);
  // A quotation's data also carries the invoice it became (and an invoice its quotation): name the file by its own kind.
  const number = (kind === 'receipt' ? q.data?.sale?.number : kind === 'invoice' ? q.data?.invoice?.number : q.data?.quotation?.number) ?? kind;
  useEffect(() => {
    if (q.data) document.title = `${number ?? ''}`;
  }, [q.data, number]);

  return (
    <PrintFrame ready={!!q.data && !!docT} filename={pdfName(number, q.data?.customer?.name)} width="210mm">
      {q.error ? (
        <div className="p-6">
          <Alert tone="red">{errMsg(q.error)}</Alert>
        </div>
      ) : !q.data || !docT ? (
        <SkeletonRows rows={8} />
      ) : (
        <DocumentView doc={toDoc(kind!, q.data, docT)} t={docT} />
      )}
    </PrintFrame>
  );
}
