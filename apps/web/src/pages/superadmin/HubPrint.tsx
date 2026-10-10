import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { saApi } from '../../lib/api';
import { useErrorMessage } from '../../lib/useApiError';
import { pdfName } from '../../lib/pdf';
import { Alert, SkeletonRows } from '../../components/ui/Card';
import { DocumentView, type DocData } from '../../components/DocumentView';
import { PrintFrame } from '../print/PrintFrame';

interface HubDoc {
  document: {
    kind: 'quote' | 'invoice';
    number: string;
    status: string;
    issueDate: string;
    dueDate: string | null;
    currency: string;
    items: { description: string; quantity: number; unitPrice: number; total: number }[];
    subtotal: number;
    discount: number;
    total: number;
    paidAmount: number;
    notes: string;
    terms: string;
  };
  client: { name: string; company: string; address: string; phone: string; email: string; taxNumber: string };
  company: { name: string; address: string; phone: string; email: string; taxNumber: string; bankDetails: string };
}

/** OceanX's own quotation / invoice (Hub), printed with the OceanX logo and company details. */
export default function HubPrint() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const errMsg = useErrorMessage();
  const q = useQuery({ queryKey: ['sa', 'hub', 'document', id], queryFn: () => saApi.get<HubDoc>(`/hub/documents/${id}`) });
  useEffect(() => {
    if (q.data) document.title = q.data.document.number;
  }, [q.data]);
  const doc = (d: HubDoc): DocData => {
    const x = d.document;
    const isInvoice = x.kind === 'invoice';
    return {
      kind: isInvoice ? 'invoice' : 'quotation',
      language: i18n.language,
      number: x.number,
      status: x.status === 'converted' ? 'accepted' : x.status,
      business: { name: d.company.name, address: d.company.address, phone: d.company.phone, email: d.company.email, hasLogo: true, logoUrl: '/brand/icon-192.png' },
      regional: { currency: x.currency, currencySymbol: x.currency, currencyDecimals: 2 },
      taxName: 'TIN',
      taxNumber: d.company.taxNumber,
      customer: { name: d.client.name, company: d.client.company, address: d.client.address, phone: d.client.phone, email: d.client.email, taxNumber: d.client.taxNumber },
      dates: [
        { label: t('print.date'), value: x.issueDate },
        { label: t(isInvoice ? 'print.due_date' : 'print.valid_until'), value: x.dueDate },
      ],
      lines: x.items.map((i, k) => ({ id: String(k), name: i.description, quantity: i.quantity, unitPrice: i.unitPrice, discount: 0, total: i.total })),
      totals: { subtotal: x.subtotal, discount: x.discount, serviceCharge: 0, tax: 0, total: x.total, ...(isInvoice ? { paid: x.paidAmount, balanceDue: x.total - x.paidAmount } : {}) },
      notes: x.notes,
      terms: x.terms,
      footer: d.company.bankDetails,
    };
  };
  return (
    <PrintFrame ready={!!q.data} filename={pdfName(q.data?.document.number ?? 'document', q.data?.client.name)} width="210mm">
      {q.error ? (
        <div className="p-6">
          <Alert tone="red">{errMsg(q.error)}</Alert>
        </div>
      ) : !q.data ? (
        <SkeletonRows rows={8} />
      ) : (
        <DocumentView doc={doc(q.data)} t={t} />
      )}
    </PrintFrame>
  );
}
