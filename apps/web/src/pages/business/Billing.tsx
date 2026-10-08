import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import clsx from 'clsx';
import { CalendarClock, Check, Clock, FileUp, Landmark, Receipt } from 'lucide-react';
import { BILLING_PERIODS } from '@oceanx/shared';
import { api } from '../../lib/api';
import { useBiz } from '../../auth/business';
import { useFormat } from '../../lib/format';
import { useToastError } from '../../lib/useApiError';
import { Alert, Badge, Card, CardHeader, Ltr, PageHeader, SkeletonRows } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Form';

export interface BillingPayment {
  id: string;
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
  periodEnd: string | null;
  createdAt: string;
}
export interface BillingInfo {
  canPay: boolean;
  state: string;
  subscription: { planId: string; planName: string; planCode: string; status: string; effectiveStatus: string; currentPeriodEnd: string; daysLeft: number } | null;
  reminderDays: number;
  bankDetails: string;
  note: string;
  plans: { id: string; code: string; name: string; description: string; priceMonthly: number; currency: string }[];
  payments: BillingPayment[];
}

export const BILLING_KEY = ['biz', 'billing'] as const;
export const useBilling = (enabled = true) => useQuery({ queryKey: BILLING_KEY, queryFn: () => api.get<BillingInfo>('/billing'), enabled });

/** Amount in the plan's own currency (plans can be priced differently from the business currency). */
export const fmtAmount = (minor: number, currency: string) => `⁦${currency} ${(minor / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}⁩`;

const statusTone = { pending: 'amber', approved: 'green', rejected: 'red' } as const;

/**
 * Pay for the subscription: choose plan and period, see the bank details, upload the transfer slip.
 * Used on the "plan ended" screen and on the Billing page.
 */
export function PayPanel({ info }: { info: BillingInfo }) {
  const { t } = useTranslation();
  const f = useFormat();
  const qc = useQueryClient();
  const { refresh } = useBiz();
  const toastErr = useToastError();
  const current = info.plans.find((p) => p.id === info.subscription?.planId);
  // After a rejected slip, start from what the owner chose last time.
  const last = info.payments[0]?.status === 'rejected' ? info.payments[0] : null;
  const lastPlan = last && info.plans.find((p) => p.name === last.planName);
  const [planId, setPlanId] = useState(lastPlan?.id ?? current?.id ?? info.plans[0]?.id ?? '');
  const [months, setMonths] = useState<number>(last?.months ?? 1);
  const [reference, setReference] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const plan = info.plans.find((p) => p.id === planId);
  const pending = info.payments.find((p) => p.status === 'pending');
  const lastRejected = !pending && info.payments[0]?.status === 'rejected' ? info.payments[0] : null;

  const send = useMutation({
    mutationFn: () => api.postFile(`/billing/payments?planId=${planId}&months=${months}&reference=${encodeURIComponent(reference)}`, file!),
    onSuccess: () => {
      toast.success(t('billing.slip_sent'));
      setFile(null);
      void qc.invalidateQueries({ queryKey: BILLING_KEY });
      void refresh();
    },
    onError: toastErr,
  });

  if (pending) {
    return (
      <Alert tone="amber" icon={<Clock className="size-5" />} title={t('billing.under_review')}>
        <p>{t('billing.under_review_body', { date: f.dateTime(pending.createdAt) })}</p>
        <p className="mt-1">
          {pending.planName} · {t('billing.months', { count: pending.months })} · <span className="font-semibold">{fmtAmount(pending.amount, pending.currency)}</span>
        </p>
        <a className="mt-2 inline-block font-medium underline" href={`/api/billing/payments/${pending.id}/slip`} target="_blank" rel="noreferrer">
          {t('billing.view_slip')}
        </a>
      </Alert>
    );
  }
  if (!info.canPay) return <Alert tone="blue">{t('billing.ask_owner')}</Alert>;
  if (!info.plans.length) return <Alert tone="amber">{t('billing.no_plans')}</Alert>;

  return (
    <div className="space-y-5">
      {lastRejected && (
        <Alert tone="red" title={t('billing.rejected_title')}>
          <p dir="auto">{lastRejected.reviewNote}</p>
          <p className="mt-1">{t('billing.rejected_retry')}</p>
        </Alert>
      )}
      <div>
        <p className="mb-2 text-sm font-medium">{t('billing.choose_plan')}</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {info.plans.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={p.id === planId}
              onClick={() => setPlanId(p.id)}
              className={clsx(
                'rounded-xl p-3 text-start ring-1 transition',
                p.id === planId ? 'bg-brand-50 ring-2 ring-brand-600 dark:bg-brand-950' : 'ring-slate-200 hover:ring-brand-300 dark:ring-slate-700',
              )}
            >
              <span className="flex items-center justify-between gap-2 font-semibold">
                {p.name}
                {p.id === planId && <Check className="size-4 text-brand-700" />}
              </span>
              <span className="mt-1 block text-sm text-slate-600 dark:text-slate-300">
                {fmtAmount(p.priceMonthly, p.currency)} / {t('billing.month')}
              </span>
              {p.description && <span className="mt-1 block text-xs text-slate-500">{p.description}</span>}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t('billing.period')}</p>
        <div className="flex flex-wrap gap-2">
          {BILLING_PERIODS.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={m === months}
              onClick={() => setMonths(m)}
              className={clsx('rounded-full px-4 py-2 text-sm font-medium ring-1', m === months ? 'bg-brand-700 text-white ring-brand-700' : 'ring-slate-200 dark:ring-slate-700')}
            >
              {t('billing.months', { count: m })}
            </button>
          ))}
        </div>
      </div>
      {plan && (
        <div className="flex items-center justify-between rounded-xl bg-slate-900 px-5 py-4 text-white dark:bg-slate-800">
          <span className="text-sm">{t('billing.amount_to_pay')}</span>
          <span className="text-2xl font-bold tabular-nums">{fmtAmount(plan.priceMonthly * months, plan.currency)}</span>
        </div>
      )}
      <div className="rounded-xl p-4 ring-1 ring-slate-200 dark:ring-slate-700">
        <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Landmark className="size-4" /> {t('billing.bank_details')}
        </p>
        {info.bankDetails ? (
          <p className="text-sm whitespace-pre-line select-all" dir="auto">
            {info.bankDetails}
          </p>
        ) : (
          <p className="text-sm text-slate-500">{t('billing.bank_details_missing')}</p>
        )}
        {info.note && (
          <p className="mt-2 text-xs whitespace-pre-line text-slate-500" dir="auto">
            {info.note}
          </p>
        )}
      </div>
      <Input label={t('billing.reference')} hint={t('billing.reference_hint')} value={reference} maxLength={80} onChange={(e) => setReference(e.target.value)} />
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-6 text-center hover:border-brand-400 dark:border-slate-700">
        <FileUp className="size-6 text-brand-700" />
        <span className="text-sm font-medium">{file ? file.name : t('billing.upload_slip')}</span>
        <span className="text-xs text-slate-500">{t('billing.upload_slip_hint')}</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="sr-only"
          onChange={(e) => {
            const fl = e.target.files?.[0] ?? null;
            if (fl && fl.size > 5 * 1024 * 1024) {
              toast.error(t('billing.file_too_big'));
              return;
            }
            setFile(fl);
          }}
        />
      </label>
      <Button size="lg" className="w-full" disabled={!file || !plan} loading={send.isPending} onClick={() => send.mutate()}>
        {t('billing.send_slip')}
      </Button>
    </div>
  );
}

/** Small banner shown to owners/managers when the trial or paid period ends soon. */
export function BillingBanner() {
  const { t } = useTranslation();
  const { session, can } = useBiz();
  const allowed = !!session && (session.user.isOwner || can('settings.manage'));
  const q = useBilling(allowed);
  const info = q.data;
  const sub = info?.subscription;
  if (!info || !sub || sub.daysLeft > info.reminderDays) return null;
  const pending = info.payments.some((p) => p.status === 'pending');
  return (
    <div className={clsx('flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 py-2 text-center text-sm', pending ? 'bg-sky-50 text-sky-900 dark:bg-sky-950 dark:text-sky-100' : 'bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100')}>
      <CalendarClock className="size-4 shrink-0" />
      <span>
        {pending
          ? t('billing.banner_pending')
          : sub.effectiveStatus === 'trialing'
            ? t('billing.banner_trial', { count: Math.max(sub.daysLeft, 0) })
            : t('billing.banner_paid', { count: Math.max(sub.daysLeft, 0), plan: sub.planName })}
      </span>
      {!pending && (
        <Link to="/billing" className="rounded-full bg-amber-600 px-3 py-1 font-semibold text-white hover:bg-amber-700">
          {t('billing.pay_now')}
        </Link>
      )}
    </div>
  );
}

/** Plan, end date, pay, and the history of payments with receipts. */
export default function BillingPage() {
  const { t } = useTranslation();
  const f = useFormat();
  const q = useBilling();
  if (!q.data) return <SkeletonRows rows={6} />;
  const info = q.data;
  const sub = info.subscription;
  return (
    <div className="space-y-6">
      <PageHeader title={t('billing.title')} description={t('billing.subtitle')} />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader title={t('billing.current_plan')} />
          {sub ? (
            <div className="space-y-2 text-sm">
              <p className="text-2xl font-bold">{sub.planName}</p>
              <p>
                <Badge tone={sub.effectiveStatus === 'expired' ? 'red' : sub.effectiveStatus === 'trialing' ? 'blue' : 'green'}>{t(`billing.sub_${sub.effectiveStatus}`, { defaultValue: sub.effectiveStatus })}</Badge>
              </p>
              <p className="text-slate-600 dark:text-slate-300">
                {sub.daysLeft >= 0 ? t('billing.ends_on', { date: f.date(sub.currentPeriodEnd), count: sub.daysLeft }) : t('billing.ended_on', { date: f.date(sub.currentPeriodEnd) })}
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-500">—</p>
          )}
        </Card>
        <Card>
          <CardHeader title={t('billing.pay_title')} description={t('billing.pay_hint')} />
          <PayPanel info={info} />
        </Card>
      </div>
      <Card padded={false}>
        <div className="p-5 pb-0">
          <CardHeader title={t('billing.history')} />
        </div>
        {info.payments.length === 0 ? (
          <p className="px-5 pb-6 text-sm text-slate-500">{t('billing.no_payments')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-800/50">
                <tr>
                  <th className="px-5 py-2 text-start font-medium">{t('common.date')}</th>
                  <th className="px-3 py-2 text-start font-medium">{t('billing.plan')}</th>
                  <th className="px-3 py-2 text-end font-medium">{t('billing.amount')}</th>
                  <th className="px-3 py-2 text-start font-medium">{t('billing.status')}</th>
                  <th className="px-3 py-2 text-start font-medium">{t('billing.receipt')}</th>
                  <th className="px-5 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {info.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-5 py-2.5 whitespace-nowrap">{f.date(p.createdAt)}</td>
                    <td className="px-3 py-2.5">
                      {p.planName} · {t('billing.months', { count: p.months })}
                    </td>
                    <td className="px-3 py-2.5 text-end font-medium tabular-nums">{fmtAmount(p.amount, p.currency)}</td>
                    <td className="px-3 py-2.5">
                      <Badge tone={statusTone[p.status]}>{t(`billing.status_${p.status}`)}</Badge>
                      {p.status === 'rejected' && p.reviewNote && (
                        <p className="mt-1 text-xs text-rose-600" dir="auto">
                          {p.reviewNote}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {p.receiptNumber ? (
                        <span className="inline-flex items-center gap-1">
                          <Receipt className="size-3.5 text-slate-400" />
                          <Ltr>{p.receiptNumber}</Ltr>
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-end">
                      {p.hasSlip && (
                        <a className="text-brand-700 underline dark:text-brand-300" href={`/api/billing/payments/${p.id}/slip`} target="_blank" rel="noreferrer">
                          {t('billing.view_slip')}
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
