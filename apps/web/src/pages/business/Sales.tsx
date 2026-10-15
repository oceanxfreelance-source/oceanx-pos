import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Printer, Receipt, Undo2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useBiz } from '../../auth/business';
import { useFormat } from '../../lib/format';
import { useMoney } from '../../lib/money';
import { useList } from '../../lib/useList';
import { useToastError } from '../../lib/useApiError';
import { Card, EmptyState, Ltr, PageHeader, SkeletonRows } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select, Switch, Textarea } from '../../components/ui/Form';
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
  refundedTotal: number;
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
    {
      key: 'st',
      header: t('common.status'),
      cell: (s) => (
        <span className="flex flex-wrap gap-1">
          <StatusBadge status={s.status} />
          {s.refundedTotal > 0 && <StatusBadge status={s.refundedTotal >= s.total ? 'refunded' : 'partly_refunded'} />}
        </span>
      ),
    },
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
  const { can, hasAddon } = useBiz();
  const money = useMoney();
  const f = useFormat();
  const qc = useQueryClient();
  const toastErr = useToastError();
  const [voiding, setVoiding] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [reason, setReason] = useState('');
  const q = useQuery({
    queryKey: ['biz', 'sale', id],
    queryFn: () =>
      api.get<{
        sale: SaleRow & { subtotal: number; discount: number; serviceCharge: number; tax: number; deliveryFee: number; paidAmount: number; changeAmount: number; note: string; voidReason: string | null };
        items: SaleItem[];
        payments: { id: string; method: string; amount: number; kind: string; voidedAt: string | null }[];
        refunds?: Refund[];
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
  const canRefund = !!s && hasAddon('refunds') && can('refunds.create') && s.status === 'completed' && s.balanceDue === 0 && s.refundedTotal < s.total;
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
            {canRefund && (
              <Button variant="secondary" icon={<Undo2 className="size-4" />} onClick={() => setRefunding(true)}>
                {t('refunds.refund')}
              </Button>
            )}
            {can('sales.void') && s.status !== 'void' && s.refundedTotal === 0 && (
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
            {s!.refundedTotal > 0 && <StatusBadge status={s!.refundedTotal >= s!.total ? 'refunded' : 'partly_refunded'} />}
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
              <Line
                key={p.id}
                l={`${t(`payment_methods.${p.method}`)}${p.kind === 'credit_payment' ? ` (${t('credit.payment')})` : p.kind === 'refund' ? ` (${t('refunds.refund')})` : ''}${p.voidedAt ? ` — ${t('status_labels.void')}` : ''}`}
                v={money(p.amount)}
              />
            ))}
            {s!.changeAmount > 0 && <Line l={t('pos.change_due')} v={money(s!.changeAmount)} />}
            {s!.balanceDue > 0 && <Line l={t('credit.balance_due')} v={money(s!.balanceDue)} bold />}
            {s!.refundedTotal > 0 && <Line l={t('refunds.refunded')} v={`− ${money(s!.refundedTotal)}`} bold />}
          </dl>
          {!!q.data.refunds?.length && (
            <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{t('refunds.title')}</p>
              {q.data.refunds.map((r) => (
                <div key={r.id} className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
                  <div className="flex justify-between gap-3">
                    <span>
                      <Ltr className="font-medium">{r.number}</Ltr> · {f.dateTime(r.createdAt)}
                    </span>
                    <span className="font-semibold tabular-nums">− {money(r.total)}</span>
                  </div>
                  <p className="text-xs text-slate-500" dir="auto">
                    {r.items.map((i) => `${Number(i.quantity)} × ${i.nameSnapshot}`).join(', ')} · {t(`payment_methods.${r.method}`)}
                    {!r.restocked && ` · ${t('refunds.not_restocked')}`}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300" dir="auto">
                    {r.reason}
                  </p>
                </div>
              ))}
            </div>
          )}
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
      {refunding && q.data && <RefundDialog saleId={id} sale={q.data.sale} items={q.data.items} refunds={q.data.refunds ?? []} onClose={() => setRefunding(false)} />}
    </Dialog>
  );
}

interface SaleItem {
  id: string;
  nameSnapshot: string;
  quantity: number;
  unitPrice: number;
  total: number;
  options: { choice: string }[];
}
interface Refund {
  id: string;
  number: string;
  reason: string;
  method: string;
  total: number;
  restocked: boolean;
  createdAt: string;
  items: { saleItemId: string; nameSnapshot: string; quantity: number }[];
}

/** Refunds & Returns add-on: pick items and quantities to give money back for. */
function RefundDialog({ saleId, sale, items, refunds, onClose }: { saleId: string; sale: { total: number; deliveryFee: number; refundedTotal: number }; items: SaleItem[]; refunds: Refund[]; onClose: () => void }) {
  const { t } = useTranslation();
  const money = useMoney();
  const qc = useQueryClient();
  const toastErr = useToastError();
  const done = new Map<string, number>();
  for (const r of refunds) for (const i of r.items) done.set(i.saleItemId, (done.get(i.saleItemId) ?? 0) + Number(i.quantity));
  const left = (i: SaleItem) => Math.round((Number(i.quantity) - (done.get(i.id) ?? 0)) * 1000) / 1000;
  const open = items.filter((i) => left(i) > 0);
  const [qty, setQty] = useState<Record<string, number>>(() => Object.fromEntries(open.map((i) => [i.id, left(i)])));
  const [method, setMethod] = useState('cash');
  const [reason, setReason] = useState('');
  const [restock, setRestock] = useState(true);
  const chosen = open.filter((i) => (qty[i.id] ?? 0) > 0);
  // Preview only: the server works out the exact amount (tax, service charge, last-item rounding).
  const itemsTotal = items.reduce((a, i) => a + i.total, 0);
  const lineTotal = chosen.reduce((a, i) => a + (i.total * (qty[i.id] ?? 0)) / Number(i.quantity), 0);
  const estimate = Math.min(itemsTotal > 0 ? Math.round(((sale.total - sale.deliveryFee) * lineTotal) / itemsTotal) : 0, sale.total - sale.refundedTotal);
  const m = useMutation({
    mutationFn: () => api.post<{ number: string; total: number }>(`/sales/${saleId}/refunds`, { items: chosen.map((i) => ({ saleItemId: i.id, quantity: qty[i.id] })), method, reason, restock }),
    onSuccess: (r) => {
      toast.success(t('refunds.done', { number: r.number, amount: money(r.total) }));
      void qc.invalidateQueries({ queryKey: ['biz', 'sales'] });
      void qc.invalidateQueries({ queryKey: ['biz', 'sale', saleId] });
      onClose();
    },
    onError: toastErr,
  });
  return (
    <Dialog
      open
      onClose={onClose}
      size="md"
      title={t('refunds.title_new')}
      description={t('refunds.subtitle')}
      footer={
        <Button variant="danger" icon={<Undo2 className="size-4" />} loading={m.isPending} disabled={!chosen.length || reason.trim().length < 3} onClick={() => m.mutate()}>
          {t('refunds.confirm', { amount: money(estimate) })}
        </Button>
      }
    >
      <div className="space-y-4">
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {open.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0 text-sm" dir="auto">
                {i.nameSnapshot}
                <span className="block text-xs text-slate-500">{t('refunds.sold_left', { sold: Number(i.quantity), left: left(i) })}</span>
              </span>
              <Input
                aria-label={t('refunds.quantity_for', { name: i.nameSnapshot })}
                type="number"
                inputMode="decimal"
                min={0}
                max={left(i)}
                step="any"
                className="w-24"
                value={qty[i.id] ?? 0}
                onChange={(e) => setQty({ ...qty, [i.id]: Math.max(0, Math.min(left(i), Number(e.target.value) || 0)) })}
              />
            </li>
          ))}
        </ul>
        <Select label={t('refunds.method')} value={method} onChange={(e) => setMethod(e.target.value)}>
          {['cash', 'card', 'bank_transfer', 'other'].map((x) => (
            <option key={x} value={x}>
              {t(`payment_methods.${x}`)}
            </option>
          ))}
        </Select>
        <Textarea label={t('documents.reason')} value={reason} onChange={(e) => setReason(e.target.value)} hint={t('refunds.reason_hint')} />
        <Switch checked={restock} onChange={setRestock} label={t('refunds.restock')} description={t('refunds.restock_hint')} />
      </div>
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
