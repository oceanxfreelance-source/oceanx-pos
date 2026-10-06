import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Printer, Receipt } from 'lucide-react';
import { api } from '../../lib/api';
import { useBiz } from '../../auth/business';
import { useFormat } from '../../lib/format';
import { useMoney } from '../../lib/money';
import { useList } from '../../lib/useList';
import { useToastError } from '../../lib/useApiError';
import { Card, EmptyState, Ltr, PageHeader, SkeletonRows } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select, Textarea } from '../../components/ui/Form';
import { DataTable, Pagination, type Column } from '../../components/ui/Table';
import { Dialog } from '../../components/ui/Dialog';
import { Tabs } from '../../components/ui/Tabs';
import { ListToolbar } from '../../components/ListToolbar';
import { StatusBadge } from '../../components/StatusBadge';

interface SaleRow {
  id: string;
  number: string | null;
  status: string;
  orderType: string;
  source: string;
  total: number;
  balanceDue: number;
  customerName: string | null;
  cashierName: string | null;
  tableName: string | null;
  createdAt: string;
  completedAt: string | null;
}
interface PaymentRow {
  id: string;
  kind: string;
  method: string;
  amount: number;
  reference: string;
  paidAt: string;
  customerName: string | null;
  receivedByName: string | null;
  saleNumber: string | null;
}

export default function SalesPage() {
  const { t } = useTranslation();
  const { can } = useBiz();
  const [tab, setTab] = useState<'sales' | 'payments'>('sales');
  return (
    <div className="space-y-6">
      <PageHeader title={t('sales.title')} description={t('sales.subtitle')} />
      {can('payments.view') && (
        <Tabs
          tabs={[
            { value: 'sales', label: t('sales.title') },
            { value: 'payments', label: t('payments.title') },
          ]}
          value={tab}
          onChange={setTab}
        />
      )}
      {tab === 'sales' ? <SalesList /> : <PaymentsList />}
    </div>
  );
}

function SalesList() {
  const { t } = useTranslation();
  const f = useFormat();
  const money = useMoney();
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const { query, page, setPage, search, setSearch, pageSize } = useList<SaleRow>('sales', '/sales', { status, from, to });
  const columns: Column<SaleRow>[] = [
    { key: 'n', header: t('sales.number'), cell: (s) => (s.number ? <Ltr className="font-medium">{s.number}</Ltr> : <span className="text-slate-400">—</span>) },
    { key: 'st', header: t('common.status'), cell: (s) => <StatusBadge status={s.status} /> },
    { key: 'c', header: t('customers.customer'), cell: (s) => <span dir="auto">{s.customerName ?? (s.tableName ? `${t('pos.table')} ${s.tableName}` : '—')}</span> },
    { key: 'type', header: t('pos.order_type'), hideOnMobile: true, cell: (s) => t(`pos.order_types.${s.orderType}`) },
    { key: 'cashier', header: t('sales.cashier'), hideOnMobile: true, cell: (s) => <span dir="auto">{s.cashierName ?? '—'}</span> },
    { key: 'date', header: t('common.date'), hideOnMobile: true, cell: (s) => f.dateTime(s.completedAt ?? s.createdAt) },
    { key: 'total', header: t('documents.total'), className: 'text-end', cell: (s) => <span className="font-semibold tabular-nums">{money(s.total)}</span> },
  ];
  return (
    <Card padded={false}>
      <ListToolbar search={search} onSearch={setSearch} placeholder={t('sales.search')}>
        <Select label={t('common.status')} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t('common.all')}</option>
          {['open', 'completed', 'void'].map((s) => (
            <option key={s} value={s}>
              {t(`status_labels.${s}`)}
            </option>
          ))}
        </Select>
        <Input type="date" label={t('common.from')} value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" label={t('common.to')} value={to} onChange={(e) => setTo(e.target.value)} />
      </ListToolbar>
      {query.isLoading ? (
        <SkeletonRows />
      ) : !query.data?.items.length ? (
        <EmptyState icon={<Receipt className="size-6" />} title={t('sales.empty_title')} description={t('sales.empty_body')} />
      ) : (
        <>
          <DataTable columns={columns} rows={query.data.items} rowKey={(s) => s.id} onRowClick={(s) => setOpen(s.id)} />
          <Pagination page={page} pageSize={pageSize} total={query.data.total} onPage={setPage} />
        </>
      )}
      {open && <SaleDialog id={open} onClose={() => setOpen(null)} />}
    </Card>
  );
}

function SaleDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useTranslation();
  const { can } = useBiz();
  const money = useMoney();
  const f = useFormat();
  const qc = useQueryClient();
  const toastErr = useToastError();
  const [voiding, setVoiding] = useState(false);
  const [reason, setReason] = useState('');
  const q = useQuery({
    queryKey: ['biz', 'sale', id],
    queryFn: () =>
      api.get<{
        sale: SaleRow & { subtotal: number; discount: number; serviceCharge: number; tax: number; deliveryFee: number; paidAmount: number; changeAmount: number; note: string; voidReason: string | null };
        items: { id: string; nameSnapshot: string; quantity: number; unitPrice: number; total: number; options: { choice: string }[] }[];
        payments: { id: string; method: string; amount: number; kind: string; voidedAt: string | null }[];
      }>(`/sales/${id}`),
  });
  const voidM = useMutation({
    mutationFn: () => api.post(`/sales/${id}/void`, { reason }),
    onSuccess: () => {
      toast.success(t('sales.voided'));
      void qc.invalidateQueries({ queryKey: ['biz', 'sales'] });
      void qc.invalidateQueries({ queryKey: ['biz', 'sale', id] });
      setVoiding(false);
    },
    onError: toastErr,
  });
  const s = q.data?.sale;
  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={s?.number ? <Ltr>{s.number}</Ltr> : t('sales.open_order')}
      description={s ? f.dateTime(s.completedAt ?? s.createdAt) : ''}
      footer={
        s && (
          <>
            {can('sales.void') && s.status !== 'void' && (
              <Button variant="ghost" className="text-rose-600" onClick={() => setVoiding(true)}>
                {t('sales.void')}
              </Button>
            )}
            {s.status === 'completed' && (
              <Button icon={<Printer className="size-4" />} onClick={() => window.open(`/print/receipt/${id}`, '_blank', 'noopener')}>
                {t('pos.print_receipt')}
              </Button>
            )}
          </>
        )
      }
    >
      {!q.data ? (
        <SkeletonRows rows={4} />
      ) : (
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={s!.status} />
            {s!.balanceDue > 0 && <StatusBadge status="unpaid" />}
          </div>
          {s!.voidReason && <p className="text-rose-600">{s!.voidReason}</p>}
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {q.data.items.map((i) => (
              <li key={i.id} className="flex justify-between gap-3 py-2">
                <span dir="auto">
                  {Number(i.quantity)} × {i.nameSnapshot}
                  {i.options.length > 0 && <span className="block text-xs text-slate-500">{i.options.map((o) => o.choice).join(', ')}</span>}
                </span>
                <span className="tabular-nums">{money(i.total)}</span>
              </li>
            ))}
          </ul>
          <dl className="space-y-1 border-t border-slate-100 pt-3 dark:border-slate-800">
            <Line l={t('documents.subtotal')} v={money(s!.subtotal)} />
            {s!.discount > 0 && <Line l={t('documents.discount')} v={`− ${money(s!.discount)}`} />}
            {s!.serviceCharge > 0 && <Line l={t('documents.service_charge')} v={money(s!.serviceCharge)} />}
            {s!.tax > 0 && <Line l={t('documents.tax')} v={money(s!.tax)} />}
            {s!.deliveryFee > 0 && <Line l={t('pos.delivery_fee')} v={money(s!.deliveryFee)} />}
            <Line l={t('documents.total')} v={money(s!.total)} bold />
            {q.data.payments.map((p) => (
              <Line key={p.id} l={`${t(`payment_methods.${p.method}`)}${p.kind === 'credit_payment' ? ` (${t('credit.payment')})` : ''}${p.voidedAt ? ` — ${t('status_labels.void')}` : ''}`} v={money(p.amount)} />
            ))}
            {s!.changeAmount > 0 && <Line l={t('pos.change_due')} v={money(s!.changeAmount)} />}
            {s!.balanceDue > 0 && <Line l={t('credit.balance_due')} v={money(s!.balanceDue)} bold />}
          </dl>
        </div>
      )}
      <Dialog
        open={voiding}
        onClose={() => setVoiding(false)}
        size="sm"
        title={t('sales.void_title')}
        footer={
          <Button variant="danger" loading={voidM.isPending} disabled={reason.trim().length < 3} onClick={() => voidM.mutate()}>
            {t('sales.void')}
          </Button>
        }
      >
        <Textarea label={t('documents.reason')} value={reason} onChange={(e) => setReason(e.target.value)} hint={t('sales.void_hint')} />
      </Dialog>
    </Dialog>
  );
}

function Line({ l, v, bold }: { l: string; v: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'text-base font-semibold' : 'text-slate-600 dark:text-slate-300'}`}>
      <dt>{l}</dt>
      <dd className="tabular-nums">{v}</dd>
    </div>
  );
}

function PaymentsList() {
  const { t } = useTranslation();
  const f = useFormat();
  const money = useMoney();
  const [method, setMethod] = useState('');
  const { query, page, setPage, pageSize } = useList<PaymentRow>('payments', '/payments', { method }, 25);
  const columns: Column<PaymentRow>[] = [
    { key: 'd', header: t('common.date'), cell: (p) => f.dateTime(p.paidAt) },
    { key: 'm', header: t('payments.method'), cell: (p) => t(`payment_methods.${p.method}`) },
    { key: 'k', header: t('payments.kind'), cell: (p) => t(`payments.kinds.${p.kind}`) },
    { key: 'c', header: t('customers.customer'), hideOnMobile: true, cell: (p) => <span dir="auto">{p.customerName ?? '—'}</span> },
    { key: 'r', header: t('documents.reference'), hideOnMobile: true, cell: (p) => <Ltr>{p.saleNumber ?? p.reference ?? '—'}</Ltr> },
    { key: 'a', header: t('documents.amount'), className: 'text-end', cell: (p) => <span className="font-semibold tabular-nums">{money(p.amount)}</span> },
  ];
  return (
    <Card padded={false}>
      <ListToolbar>
        <Select label={t('payments.method')} value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="">{t('common.all')}</option>
          {['cash', 'card', 'bank_transfer', 'other'].map((m) => (
            <option key={m} value={m}>
              {t(`payment_methods.${m}`)}
            </option>
          ))}
        </Select>
      </ListToolbar>
      {query.isLoading ? (
        <SkeletonRows />
      ) : !query.data?.items.length ? (
        <EmptyState icon={<Receipt className="size-6" />} title={t('payments.empty')} />
      ) : (
        <>
          <DataTable columns={columns} rows={query.data.items} rowKey={(p) => p.id} />
          <Pagination page={page} pageSize={pageSize} total={query.data.total} onPage={setPage} />
        </>
      )}
    </Card>
  );
}
