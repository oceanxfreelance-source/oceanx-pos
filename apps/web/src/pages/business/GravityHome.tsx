import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, FilePlus2, FileSpreadsheet, FileText, Send } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../../lib/api';
import { useBiz, useBizSession } from '../../auth/business';
import { useMoney } from '../../lib/money';
import { Badge, Ltr, SkeletonRows } from '../../components/ui/Card';

interface DocRow {
  id: string;
  number: string;
  status: string;
  customerName: string;
  total: number;
  balanceDue?: number;
  invoiceDate?: string;
  quotationDate?: string;
  createdAt: string;
}
interface ListRes {
  items: DocRow[];
  total: number;
  summary?: { outstanding: number; overdue: number };
}
interface OwedRow {
  customerId: string;
  customerName: string;
  company: string;
  invoices: number;
  outstanding: number;
  overdue: number;
}
const TONE: Record<string, 'gray' | 'blue' | 'green' | 'amber' | 'red' | 'violet'> = {
  draft: 'gray',
  sent: 'blue',
  accepted: 'green',
  rejected: 'red',
  expired: 'amber',
  converted: 'violet',
  issued: 'blue',
  partially_paid: 'amber',
  paid: 'green',
  overdue: 'red',
  void: 'gray',
  cancelled: 'gray',
};

/**
 * Gravity home, phone first: what you are owed, the two things you do most (new invoice / quotation),
 * who owes you, and your latest documents. Nothing else.
 */
export default function GravityHome() {
  const { t } = useTranslation();
  const { can } = useBiz();
  const session = useBizSession();
  const money = useMoney();
  const canInv = can('invoices.view');
  const canQuo = can('quotations.view');
  const inv = useQuery({ queryKey: ['biz', 'invoices', 'home'], queryFn: () => api.get<ListRes>('/invoices?pageSize=5'), enabled: canInv });
  const unpaid = useQuery({ queryKey: ['biz', 'invoices', 'home-unpaid'], queryFn: () => api.get<ListRes>('/invoices?status=unpaid&pageSize=1'), enabled: canInv });
  const quo = useQuery({ queryKey: ['biz', 'quotations', 'home'], queryFn: () => api.get<ListRes>('/quotations?pageSize=5'), enabled: canQuo });
  const waiting = useQuery({ queryKey: ['biz', 'quotations', 'home-sent'], queryFn: () => api.get<ListRes>('/quotations?status=sent&pageSize=1'), enabled: canQuo });
  const settings = useQuery({ queryKey: ['biz', 'settings'], queryFn: () => api.get<{ sections: { invoice?: { paymentDetails?: string } } }>('/settings'), enabled: can('settings.view') });
  const needsSetup = can('settings.manage') && (!session.business.hasLogo || (settings.data && !settings.data.sections.invoice?.paymentDetails));
  const owed = inv.data?.summary?.outstanding ?? 0;
  const overdue = inv.data?.summary?.overdue ?? 0;
  const recent = [...(inv.data?.items ?? []).map((d) => ({ ...d, kind: 'invoice' as const })), ...(quo.data?.items ?? []).map((d) => ({ ...d, kind: 'quotation' as const }))]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="sr-only">{t('nav.dashboard')}</h1>

      {/* What you are owed */}
      {canInv && (
        <Link
          to="/invoices?status=unpaid"
          className="block rounded-3xl bg-gradient-to-br from-violet-700 to-violet-900 p-5 text-white shadow-sm active:scale-[0.99] sm:p-6"
        >
          <p className="text-sm text-violet-100">{t('gravity.owed_to_you')}</p>
          <p className="mt-1 text-4xl font-bold tracking-tight tabular-nums">{money(owed)}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-white/15 px-2.5 py-1">{t('gravity.unpaid_invoices', { count: unpaid.data?.total ?? 0 })}</span>
            {overdue > 0 && <span className="rounded-full bg-rose-500 px-2.5 py-1 font-medium">{t('gravity.overdue_amount', { amount: money(overdue) })}</span>}
          </div>
        </Link>
      )}

      {/* The two things you do most */}
      <div className="grid grid-cols-2 gap-3">
        {can('invoices.create') && (
          <Link to="/invoices/new" className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-violet-700 px-3 py-4 text-center font-semibold text-white shadow-sm active:scale-[0.98]">
            <FilePlus2 className="size-6" />
            {t('invoices.create')}
          </Link>
        )}
        {can('quotations.create') && (
          <Link
            to="/quotations/new"
            className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-white px-3 py-4 text-center font-semibold text-slate-800 shadow-sm ring-1 ring-slate-200 active:scale-[0.98] dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-800"
          >
            <FileText className="size-6 text-violet-700 dark:text-violet-300" />
            {t('quotations.create')}
          </Link>
        )}
      </div>

      {needsSetup && (
        <Link to="/settings?tab=invoice" className="flex items-center justify-between gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <span>{t('gravity.finish_setup')}</span>
          <ChevronRight className="rtl-flip size-4 shrink-0" />
        </Link>
      )}

      {canQuo && (waiting.data?.total ?? 0) > 0 && (
        <Link to="/quotations?status=sent" className="flex items-center justify-between gap-3 rounded-2xl bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
          <span className="flex items-center gap-2">
            <Send className="size-4 shrink-0" />
            {t('gravity.quotes_waiting', { count: waiting.data?.total ?? 0 })}
          </span>
          <ChevronRight className="rtl-flip size-4 shrink-0" />
        </Link>
      )}

      {canInv && <WhoOwes />}

      {(canInv || canQuo) && (
        <Section title={t('gravity.recent')}>
          {inv.isLoading || quo.isLoading ? (
            <SkeletonRows rows={3} />
          ) : recent.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">{t('gravity.nothing_yet')}</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {recent.map((d) => (
                <li key={`${d.kind}-${d.id}`}>
                  <Link to={`/${d.kind === 'invoice' ? 'invoices' : 'quotations'}/${d.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-slate-50 dark:active:bg-slate-800/50">
                    <span className={clsx('grid size-9 shrink-0 place-items-center rounded-xl', d.kind === 'invoice' ? 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300')}>
                      {d.kind === 'invoice' ? <FileSpreadsheet className="size-4" /> : <FileText className="size-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" dir="auto">
                        {d.customerName}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        <Ltr>{d.number}</Ltr>
                      </p>
                    </div>
                    <div className="shrink-0 text-end">
                      <p className="text-sm font-semibold tabular-nums">{money(d.total)}</p>
                      <Badge tone={TONE[d.status] ?? 'gray'}>{t(`status_labels.${d.status}`)}</Badge>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-900 dark:ring-slate-800">
      <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-2">
        <h2 className="text-base font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Issued invoices not fully paid, per customer: who owes how much (and how much of it is late). */
function WhoOwes() {
  const { t } = useTranslation();
  const money = useMoney();
  const q = useQuery({ queryKey: ['biz', 'invoices', 'outstanding'], queryFn: () => api.get<{ items: OwedRow[]; total: number }>('/invoices/outstanding') });
  const rows = q.data?.items ?? [];
  return (
    <Section
      title={t('gravity.who_owes')}
      action={
        rows.length > 5 ? (
          <Link to="/invoices?status=unpaid" className="text-sm font-medium text-brand-700 dark:text-brand-300">
            {t('gravity.see_all')}
          </Link>
        ) : undefined
      }
    >
      {q.isLoading ? (
        <SkeletonRows rows={2} />
      ) : rows.length === 0 ? (
        <p className="px-4 pb-5 pt-1 text-sm text-slate-500">{t('gravity.nobody_owes')}</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.slice(0, 5).map((r) => (
            <li key={r.customerId}>
              <Link to={`/invoices?status=unpaid&customerId=${r.customerId}`} className="flex items-center justify-between gap-3 px-4 py-3 active:bg-slate-50 dark:active:bg-slate-800/50">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium" dir="auto">
                    {r.customerName}
                  </p>
                  <p className="text-xs text-slate-500">{t('gravity.unpaid_invoices', { count: r.invoices })}</p>
                </div>
                <div className="shrink-0 text-end">
                  <p className="text-sm font-semibold tabular-nums">{money(r.outstanding)}</p>
                  {r.overdue > 0 && <p className="text-xs font-medium text-rose-600">{t('gravity.overdue_amount', { amount: money(r.overdue) })}</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
