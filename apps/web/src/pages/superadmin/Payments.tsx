import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, FileText, X } from 'lucide-react';
import { BILLING_METHODS, BILLING_PERIODS } from '@oceanx/shared';
import { saApi } from '../../lib/api';
import { useFormat } from '../../lib/format';
import { useToastError } from '../../lib/useApiError';
import { Badge, Card, EmptyState, Ltr, PageHeader, SkeletonRows, StatCard } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select, Textarea } from '../../components/ui/Form';
import { ConfirmDialog, Dialog } from '../../components/ui/Dialog';
import { Tabs } from '../../components/ui/Tabs';
import { fmtAmount } from '../business/Billing';
import type { Plan } from './Businesses';

export interface SaPayment {
  id: string;
  businessId: string;
  businessName: string;
  planName: string;
  months: number;
  amount: number;
  currency: string;
  method: string;
  reference: string;
  hasSlip: boolean;
  status: 'pending' | 'approved' | 'rejected';
  receiptNumber: string | null;
  reviewNote: string;
  submittedBy: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  periodEnd: string | null;
  createdAt: string;
}

const TONE = { pending: 'amber', approved: 'green', rejected: 'red' } as const;
const invalidate = (qc: ReturnType<typeof useQueryClient>) => {
  void qc.invalidateQueries({ queryKey: ['sa', 'payments'] });
  void qc.invalidateQueries({ queryKey: ['sa', 'business'] });
  void qc.invalidateQueries({ queryKey: ['sa', 'businesses'] });
};

/** Payments table with slip link and Approve / Reject for pending ones. Also used on a business's page. */
export function PaymentsTable({ items, showBusiness = true }: { items: SaPayment[]; showBusiness?: boolean }) {
  const { t } = useTranslation();
  const f = useFormat();
  const qc = useQueryClient();
  const toastErr = useToastError();
  const [approving, setApproving] = useState<SaPayment | null>(null);
  const [rejecting, setRejecting] = useState<SaPayment | null>(null);
  const [note, setNote] = useState('');
  const approve = useMutation({
    mutationFn: (p: SaPayment) => saApi.post(`/billing/payments/${p.id}/approve`, {}),
    onSuccess: () => {
      toast.success(t('superadmin.payments.approved_toast'));
      setApproving(null);
      invalidate(qc);
    },
    onError: toastErr,
  });
  const reject = useMutation({
    mutationFn: (p: SaPayment) => saApi.post(`/billing/payments/${p.id}/reject`, { note }),
    onSuccess: () => {
      toast.success(t('superadmin.payments.rejected_toast'));
      setRejecting(null);
      setNote('');
      invalidate(qc);
    },
    onError: toastErr,
  });
  if (!items.length) return <EmptyState title={t('superadmin.payments.none')} />;
  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-800/50">
            <tr>
              <th className="px-5 py-2 text-start font-medium">{t('common.date')}</th>
              {showBusiness && <th className="px-3 py-2 text-start font-medium">{t('superadmin.payments.business')}</th>}
              <th className="px-3 py-2 text-start font-medium">{t('billing.plan')}</th>
              <th className="px-3 py-2 text-end font-medium">{t('billing.amount')}</th>
              <th className="px-3 py-2 text-start font-medium">{t('superadmin.payments.method')}</th>
              <th className="px-3 py-2 text-start font-medium">{t('billing.status')}</th>
              <th className="px-5 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((p) => (
              <tr key={p.id} className="align-top">
                <td className="px-5 py-3 whitespace-nowrap">
                  {f.dateTime(p.createdAt)}
                  {p.submittedBy && <p className="text-xs text-slate-500">{p.submittedBy}</p>}
                </td>
                {showBusiness && (
                  <td className="px-3 py-3">
                    <Link to={`/superadmin/businesses/${p.businessId}`} className="font-medium text-brand-700 hover:underline dark:text-brand-300" dir="auto">
                      {p.businessName}
                    </Link>
                  </td>
                )}
                <td className="px-3 py-3">
                  {p.planName} · {t('billing.months', { count: p.months })}
                  {p.periodEnd && <p className="text-xs text-slate-500">{t('superadmin.payments.until', { date: f.date(p.periodEnd) })}</p>}
                </td>
                <td className="px-3 py-3 text-end font-semibold tabular-nums">{fmtAmount(p.amount, p.currency)}</td>
                <td className="px-3 py-3">
                  {t(`superadmin.payments.method_${p.method}`, { defaultValue: p.method })}
                  {p.reference && (
                    <p className="text-xs text-slate-500" dir="auto">
                      {p.reference}
                    </p>
                  )}
                </td>
                <td className="px-3 py-3">
                  <Badge tone={TONE[p.status]}>{t(`billing.status_${p.status}`)}</Badge>
                  {p.receiptNumber && (
                    <p className="mt-1 text-xs text-slate-500">
                      <Ltr>{p.receiptNumber}</Ltr>
                    </p>
                  )}
                  {p.reviewedBy && <p className="text-xs text-slate-500">{p.reviewedBy}</p>}
                  {p.status === 'rejected' && p.reviewNote && (
                    <p className="text-xs text-rose-600" dir="auto">
                      {p.reviewNote}
                    </p>
                  )}
                </td>
                <td className="px-5 py-3">
                  <div className="flex flex-wrap justify-end gap-2">
                    {p.hasSlip && (
                      <a href={`/api/superadmin/billing/payments/${p.id}/slip`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-brand-700 ring-1 ring-slate-200 hover:bg-slate-50 dark:text-brand-300 dark:ring-slate-700">
                        <FileText className="size-4" /> {t('billing.view_slip')}
                      </a>
                    )}
                    {p.status === 'pending' && (
                      <>
                        <Button size="sm" icon={<Check className="size-4" />} onClick={() => setApproving(p)}>
                          {t('superadmin.payments.approve')}
                        </Button>
                        <Button size="sm" variant="ghost" className="text-rose-600" icon={<X className="size-4" />} onClick={() => setRejecting(p)}>
                          {t('superadmin.payments.reject')}
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ConfirmDialog
        open={!!approving}
        onClose={() => setApproving(null)}
        onConfirm={() => approving && approve.mutate(approving)}
        loading={approve.isPending}
        title={t('superadmin.payments.approve_title')}
        message={approving ? t('superadmin.payments.approve_body', { name: approving.businessName, amount: fmtAmount(approving.amount, approving.currency), count: approving.months }) : ''}
      />
      {rejecting && (
        <Dialog
          open
          size="sm"
          onClose={() => setRejecting(null)}
          title={t('superadmin.payments.reject_title')}
          footer={
            <>
              <Button variant="secondary" onClick={() => setRejecting(null)}>
                {t('common.cancel')}
              </Button>
              <Button variant="danger" onClick={() => reject.mutate(rejecting)} loading={reject.isPending} disabled={note.trim().length < 3}>
                {t('superadmin.payments.reject')}
              </Button>
            </>
          }
        >
          <Textarea label={t('superadmin.payments.reject_reason')} hint={t('superadmin.payments.reject_reason_hint')} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} autoFocus />
        </Dialog>
      )}
    </>
  );
}

/** Payment taken by the team (cash at the restaurant, card…): recorded and applied at once. */
export function RecordPaymentDialog({ businessId, currentPlanId, onClose }: { businessId: string; currentPlanId?: string; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toastErr = useToastError();
  const plans = useQuery({ queryKey: ['sa', 'plans'], queryFn: () => saApi.get<{ items: Plan[] }>('/plans') });
  const paid = plans.data?.items.filter((p) => p.isActive && Number(p.priceMonthly) > 0) ?? [];
  const [planId, setPlanId] = useState(currentPlanId ?? '');
  const [months, setMonths] = useState(1);
  const [method, setMethod] = useState<(typeof BILLING_METHODS)[number]>('cash');
  const [reference, setReference] = useState('');
  const plan = paid.find((p) => p.id === planId);
  const m = useMutation({
    mutationFn: () => saApi.post(`/businesses/${businessId}/billing/payments`, { planId, months, method, reference }),
    onSuccess: () => {
      toast.success(t('superadmin.payments.recorded_toast'));
      invalidate(qc);
      onClose();
    },
    onError: toastErr,
  });
  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      title={t('superadmin.payments.record')}
      description={t('superadmin.payments.record_hint')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => m.mutate()} loading={m.isPending} disabled={!plan}>
            {t('superadmin.payments.record')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select label={t('billing.plan')} value={plan ? planId : ''} onChange={(e) => setPlanId(e.target.value)}>
          <option value="" disabled>
            —
          </option>
          {paid.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.currency} {p.priceMonthly}
            </option>
          ))}
        </Select>
        <Select label={t('billing.period')} value={String(months)} onChange={(e) => setMonths(Number(e.target.value))}>
          {BILLING_PERIODS.map((n) => (
            <option key={n} value={n}>
              {t('billing.months', { count: n })}
            </option>
          ))}
        </Select>
        <Select label={t('superadmin.payments.method')} value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
          {BILLING_METHODS.map((x) => (
            <option key={x} value={x}>
              {t(`superadmin.payments.method_${x}`)}
            </option>
          ))}
        </Select>
        <Input label={t('billing.reference')} value={reference} maxLength={80} onChange={(e) => setReference(e.target.value)} />
        {plan && (
          <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm dark:bg-slate-800/50">
            {t('billing.amount')}: <span className="font-semibold">{fmtAmount(Math.round(Number(plan.priceMonthly) * 100) * months, plan.currency)}</span>
          </p>
        )}
      </div>
    </Dialog>
  );
}

export function usePayments(params: { status?: string; businessId?: string }) {
  const search = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
  return useQuery({ queryKey: ['sa', 'payments', params], queryFn: () => saApi.get<{ items: SaPayment[] }>(`/billing/payments${search ? `?${search}` : ''}`) });
}

export default function PaymentsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const q = usePayments({ status: tab });
  const summary = useQuery({ queryKey: ['sa', 'payments', 'summary'], queryFn: () => saApi.get<{ pending: number; receivedThisMonth: { currency: string; total: number; count: number }[] }>('/billing/summary') });
  return (
    <div className="space-y-6">
      <PageHeader title={t('superadmin.payments.title')} description={t('superadmin.payments.subtitle')} />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t('superadmin.payments.waiting')} value={String(summary.data?.pending ?? '—')} tone="amber" />
        <StatCard
          label={t('superadmin.payments.received_month')}
          value={summary.data?.receivedThisMonth.length ? summary.data.receivedThisMonth.map((r) => fmtAmount(r.total, r.currency)).join(' + ') : '—'}
          tone="green"
        />
        <StatCard label={t('superadmin.payments.count_month')} value={String(summary.data?.receivedThisMonth.reduce((a, r) => a + r.count, 0) ?? '—')} tone="blue" />
      </div>
      <Tabs
        tabs={[
          { value: 'pending', label: t('billing.status_pending') },
          { value: 'approved', label: t('billing.status_approved') },
          { value: 'rejected', label: t('billing.status_rejected') },
        ]}
        value={tab}
        onChange={(v) => setTab(v as typeof tab)}
      />
      <Card padded={false}>{q.data ? <PaymentsTable items={q.data.items} /> : <SkeletonRows rows={5} />}</Card>
    </div>
  );
}
