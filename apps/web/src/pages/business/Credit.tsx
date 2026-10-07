import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { FileDown, HandCoins, Printer, Wallet } from 'lucide-react';
import { api, qs } from '../../lib/api';
import { useBiz } from '../../auth/business';
import { useFormat } from '../../lib/format';
import { useMoney } from '../../lib/money';
import { Badge, Card, EmptyState, Ltr, PageHeader, SkeletonRows, StatCard } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Form';
import { DataTable, type Column } from '../../components/ui/Table';
import { ListToolbar } from '../../components/ListToolbar';
import { CreditPaymentDialog } from './Customers';

export interface CreditCustomer {
  id: string;
  name: string;
  phone: string;
  viberPhone: string;
  creditLimit: number | null;
  creditDays: number | null;
  salesDue: number;
  invoiceDue: number;
  due: number;
  overdue: number;
  availableCredit: number | null;
  oldestDueDate: string | null;
  daysOverdue: number;
  lastPaymentAt: string | null;
}
export interface CreditOverview {
  totals: { due: number; overdue: number; customersWithDue: number; creditCustomers: number };
  customers: CreditCustomer[];
  business: { name: string; address: string; phone: string; email: string; hasLogo: boolean };
  asOf: string;
  generatedAt: string;
}

/** One place for credit: who owes what, overdue ages, statements, payments and the all-customers dues PDF. */
export default function CreditPage() {
  const { t } = useTranslation();
  const { can } = useBiz();
  const money = useMoney();
  const f = useFormat();
  const [search, setSearch] = useState('');
  const [onlyDue, setOnlyDue] = useState(true);
  const [paying, setPaying] = useState<CreditCustomer | null>(null);
  const q = useQuery({
    queryKey: ['biz', 'credit-overview', search, onlyDue],
    queryFn: () => api.get<CreditOverview>(`/credit/overview${qs({ q: search || undefined, onlyDue: onlyDue ? 'true' : 'false' })}`),
  });
  const openDues = (download: boolean) => window.open(`/print/credit-dues${qs({ onlyDue: onlyDue ? 'true' : 'false', download: download ? '1' : undefined })}`, '_blank', 'noopener');
  const statement = (id: string) => window.open(`/print/statement/${id}?download=1`, '_blank', 'noopener');
  const columns: Column<CreditCustomer>[] = [
    {
      key: 'n',
      header: t('customers.customer'),
      cell: (c) => (
        <div className="min-w-0">
          <p className="truncate font-medium" dir="auto">
            {c.name}
          </p>
          <p className="truncate text-xs text-slate-500">
            <Ltr>{c.viberPhone || c.phone || '—'}</Ltr>
          </p>
        </div>
      ),
    },
    { key: 'l', header: t('credit.limit'), hideOnMobile: true, cell: (c) => (c.creditLimit === null ? t('credit.no_limit') : money(c.creditLimit)) },
    {
      key: 'o',
      header: t('status_labels.overdue'),
      hideOnMobile: true,
      cell: (c) =>
        c.overdue > 0 ? (
          <span>
            <span className="font-medium text-rose-600">{money(c.overdue)}</span>
            <span className="block text-xs text-slate-500">{t('credit.days_overdue', { count: c.daysOverdue })}</span>
          </span>
        ) : (
          '—'
        ),
    },
    { key: 'p', header: t('credit.last_payment'), hideOnMobile: true, cell: (c) => f.date(c.lastPaymentAt) },
    {
      key: 'd',
      header: t('credit.outstanding'),
      className: 'text-end',
      cell: (c) => <span className={`font-semibold tabular-nums ${c.overdue > 0 ? 'text-rose-600' : ''}`}>{money(c.due)}</span>,
    },
    {
      key: 'a',
      header: <span className="sr-only">{t('common.actions')}</span>,
      className: 'text-end',
      cell: (c) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="ghost" icon={<FileDown className="size-4" />} onClick={() => statement(c.id)}>
            <span className="hidden xl:inline">{t('credit.statement_pdf')}</span>
          </Button>
          {can('credit.payment') && c.due > 0 && (
            <Button size="sm" variant="secondary" icon={<HandCoins className="size-4" />} onClick={() => setPaying(c)}>
              <span className="hidden sm:inline">{t('credit.receive_payment')}</span>
            </Button>
          )}
        </div>
      ),
    },
  ];
  const d = q.data;
  return (
    <div className="space-y-6">
      <PageHeader
        title={t('credit.page_title')}
        description={t('credit.page_subtitle')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={<Printer className="size-4" />} onClick={() => openDues(false)}>
              {t('print.print')}
            </Button>
            <Button icon={<FileDown className="size-4" />} onClick={() => openDues(true)}>
              {t('credit.dues_pdf')}
            </Button>
          </div>
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label={t('credit.total_due')} value={d ? money(d.totals.due) : '…'} icon={<Wallet className="size-5" />} tone="blue" />
        <StatCard label={t('status_labels.overdue')} value={d ? money(d.totals.overdue) : '…'} tone={d && d.totals.overdue > 0 ? 'red' : 'green'} />
        <StatCard label={t('credit.customers_with_due')} value={d ? <Ltr>{d.totals.customersWithDue}</Ltr> : '…'} />
        <StatCard label={t('credit.credit_customers')} value={d ? <Ltr>{d.totals.creditCustomers}</Ltr> : '…'} />
      </div>
      <Card padded={false}>
        <ListToolbar search={search} onSearch={setSearch} placeholder={t('customers.search')}>
          <div className="flex items-end">
            <Checkbox checked={onlyDue} onChange={setOnlyDue} label={t('credit.only_with_due')} />
          </div>
        </ListToolbar>
        {!d ? (
          <SkeletonRows />
        ) : d.customers.length === 0 ? (
          <EmptyState icon={<Wallet className="size-6" />} title={t('credit.nobody_owes')} description={t('credit.nobody_owes_body')} />
        ) : (
          <>
            <DataTable columns={columns} rows={d.customers} rowKey={(c) => c.id} />
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 text-sm dark:border-slate-800">
              <Badge>{t('credit.customers_count', { count: d.customers.length })}</Badge>
              <span className="font-semibold">
                {t('credit.total_due')}: <span className="tabular-nums">{money(d.totals.due)}</span>
              </span>
            </div>
          </>
        )}
      </Card>
      {paying && (
        <CreditPaymentDialog
          customerId={paying.id}
          customerName={paying.name}
          outstanding={paying.due}
          onClose={() => {
            setPaying(null);
            void q.refetch();
          }}
        />
      )}
    </div>
  );
}
