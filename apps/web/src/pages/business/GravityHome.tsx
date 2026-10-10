import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, FilePlus2, FileSpreadsheet, FileText, ImagePlus, Landmark, Send, Wallet } from 'lucide-react';
import { api } from '../../lib/api';
import { useBiz, useBizSession } from '../../auth/business';
import { useFormat } from '../../lib/format';
import { useMoney } from '../../lib/money';
import { Badge, Card, CardHeader, EmptyState, Ltr, PageHeader, SkeletonRows, StatCard } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

interface DocRow {
  id: string;
  number: string;
  status: string;
  customerName: string;
  total: number;
  balanceDue?: number;
  invoiceDate?: string;
  quotationDate?: string;
}
interface ListRes {
  items: DocRow[];
  total: number;
  summary?: { outstanding: number; overdue: number };
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

/** Gravity home: what is owed, quotations waiting for an answer, the latest documents and one-tap "new". */
export default function GravityHome() {
  const { t } = useTranslation();
  const { can } = useBiz();
  const session = useBizSession();
  const money = useMoney();
  const f = useFormat();
  const inv = useQuery({ queryKey: ['biz', 'invoices', 'home'], queryFn: () => api.get<ListRes>('/invoices?pageSize=6'), enabled: can('invoices.view') });
  const unpaid = useQuery({ queryKey: ['biz', 'invoices', 'home-unpaid'], queryFn: () => api.get<ListRes>('/invoices?status=unpaid&pageSize=1'), enabled: can('invoices.view') });
  const quo = useQuery({ queryKey: ['biz', 'quotations', 'home'], queryFn: () => api.get<ListRes>('/quotations?pageSize=6'), enabled: can('quotations.view') });
  const waiting = useQuery({ queryKey: ['biz', 'quotations', 'home-sent'], queryFn: () => api.get<ListRes>('/quotations?status=sent&pageSize=1'), enabled: can('quotations.view') });
  const settings = useQuery({ queryKey: ['biz', 'settings'], queryFn: () => api.get<{ sections: { invoice?: { paymentDetails?: string } } }>('/settings'), enabled: can('settings.view') });
  const needsLogo = !session.business.hasLogo;
  const needsPayment = settings.data && !settings.data.sections.invoice?.paymentDetails;
  return (
    <div className="space-y-6">
      <PageHeader
        title={t('gravity.home_title', { name: session.user.name.split(' ')[0] })}
        description={t('gravity.home_subtitle')}
        actions={
          <div className="flex flex-wrap gap-2">
            {can('quotations.create') && (
              <Link to="/quotations/new">
                <Button variant="secondary" icon={<FileText className="size-4" />}>
                  {t('quotations.create')}
                </Button>
              </Link>
            )}
            {can('invoices.create') && (
              <Link to="/invoices/new">
                <Button icon={<FilePlus2 className="size-4" />}>{t('invoices.create')}</Button>
              </Link>
            )}
          </div>
        }
      />
      {can('settings.manage') && (needsLogo || needsPayment) && (
        <Card>
          <p className="font-semibold">{t('gravity.setup_title')}</p>
          <p className="mt-1 text-sm text-slate-500">{t('gravity.setup_body')}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {needsLogo && (
              <Link to="/settings">
                <Button size="sm" variant="secondary" icon={<ImagePlus className="size-4" />}>
                  {t('gravity.add_logo')}
                </Button>
              </Link>
            )}
            {needsPayment && (
              <Link to="/settings?tab=invoice">
                <Button size="sm" variant="secondary" icon={<Landmark className="size-4" />}>
                  {t('gravity.add_payment_details')}
                </Button>
              </Link>
            )}
          </div>
        </Card>
      )}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Link to="/invoices?status=unpaid">
          <StatCard label={t('gravity.owed_to_you')} value={money(inv.data?.summary?.outstanding ?? 0)} hint={t('gravity.unpaid_invoices', { count: unpaid.data?.total ?? 0 })} icon={<Wallet className="size-5" />} tone="amber" />
        </Link>
        <Link to="/invoices?status=overdue">
          <StatCard label={t('gravity.overdue')} value={money(inv.data?.summary?.overdue ?? 0)} icon={<AlertTriangle className="size-5" />} tone={inv.data?.summary?.overdue ? 'red' : 'green'} />
        </Link>
        <Link to="/quotations?status=sent">
          <StatCard label={t('gravity.awaiting_reply')} value={waiting.data?.total ?? 0} icon={<Send className="size-5" />} tone="blue" />
        </Link>
        <Link to="/invoices">
          <StatCard label={t('gravity.all_invoices')} value={inv.data?.total ?? 0} hint={t('gravity.all_quotations', { count: quo.data?.total ?? 0 })} icon={<FileSpreadsheet className="size-5" />} tone="violet" />
        </Link>
      </div>
      {can('invoices.view') && <WhoOwes />}
      <div className="grid gap-6 lg:grid-cols-2">
        <RecentList title={t('nav.invoices')} base="/invoices" q={inv} date={(d) => d.invoiceDate} money={money} f={f} empty={t('gravity.no_invoices')} />
        <RecentList title={t('nav.quotations')} base="/quotations" q={quo} date={(d) => d.quotationDate} money={money} f={f} empty={t('gravity.no_quotations')} />
      </div>
    </div>
  );
}

function RecentList({
  title,
  base,
  q,
  date,
  money,
  f,
  empty,
}: {
  title: string;
  base: string;
  q: { data?: ListRes; isLoading: boolean };
  date: (d: DocRow) => string | undefined;
  money: (n: number) => string;
  f: ReturnType<typeof useFormat>;
  empty: string;
}) {
  const { t } = useTranslation();
  return (
    <Card padded={false} className="min-w-0">
      <div className="px-5 pt-4">
      <CardHeader
        title={title}
        actions={
          <Link to={base} className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
            {t('gravity.see_all')}
          </Link>
        }
      />
      </div>
      {q.isLoading ? (
        <SkeletonRows rows={4} />
      ) : !q.data?.items.length ? (
        <EmptyState icon={<FileText className="size-6" />} title={empty} />
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {q.data.items.map((d) => (
            <li key={d.id}>
              <Link to={`${base}/${d.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium" dir="auto">
                    {d.customerName}
                  </p>
                  <p className="text-xs text-slate-500">
                    <Ltr>{d.number}</Ltr> · {f.date(date(d) ?? null)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm font-semibold tabular-nums">{money(d.total)}</span>
                  <Badge tone={TONE[d.status] ?? 'gray'}>{t(`status_labels.${d.status}`)}</Badge>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

interface OwedRow {
  customerId: string;
  customerName: string;
  company: string;
  phone: string;
  invoices: number;
  outstanding: number;
  overdue: number;
  oldestDue: string;
}

/** Issued invoices not fully paid, per customer: who owes how much (and how much of it is late). */
function WhoOwes() {
  const { t } = useTranslation();
  const money = useMoney();
  const f = useFormat();
  const q = useQuery({ queryKey: ['biz', 'invoices', 'outstanding'], queryFn: () => api.get<{ items: OwedRow[]; total: number }>('/invoices/outstanding') });
  return (
    <Card padded={false} className="min-w-0">
      <div className="px-5 pt-4">
        <CardHeader title={t('gravity.who_owes')} description={q.data ? t('gravity.who_owes_total', { amount: money(q.data.total) }) : undefined} />
      </div>
      {q.isLoading ? (
        <SkeletonRows rows={3} />
      ) : !q.data?.items.length ? (
        <EmptyState icon={<Wallet className="size-6" />} title={t('gravity.nobody_owes')} description={t('gravity.nobody_owes_body')} />
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {q.data.items.map((r) => (
            <li key={r.customerId}>
              <Link to={`/invoices?status=unpaid&customerId=${r.customerId}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium" dir="auto">
                    {r.customerName}
                    {r.company && r.company !== r.customerName ? <span className="text-slate-500"> · {r.company}</span> : null}
                  </p>
                  <p className="text-xs text-slate-500">
                    {t('gravity.unpaid_invoices', { count: r.invoices })} · {t('gravity.oldest_due', { date: f.date(r.oldestDue) })}
                  </p>
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
    </Card>
  );
}
