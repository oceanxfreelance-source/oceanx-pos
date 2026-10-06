import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Users } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { useBiz } from '../../auth/business';
import { useFormat } from '../../lib/format';
import { parseAmount, useMoney } from '../../lib/money';
import { useList } from '../../lib/useList';
import { useErrorMessage, useFieldErrors, useToastError } from '../../lib/useApiError';
import { Alert, Badge, Card, EmptyState, Ltr, PageHeader, SkeletonRows, StatCard } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select, Textarea } from '../../components/ui/Form';
import { ConfirmDialog, Dialog } from '../../components/ui/Dialog';
import { DataTable, Pagination, type Column } from '../../components/ui/Table';
import { Tabs } from '../../components/ui/Tabs';
import { ListToolbar } from '../../components/ListToolbar';
import { StatusBadge } from '../../components/StatusBadge';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  company: string;
  address: string;
  taxNumber: string;
  notes: string;
  creditLimit: number | null;
  creditDays: number | null;
  loyaltyPoints: number;
  outstanding: number;
  overdue: number;
}

export default function CustomersPage() {
  const { t } = useTranslation();
  const { can } = useBiz();
  const money = useMoney();
  const [editing, setEditing] = useState<Customer | 'new' | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setEditing('new');
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);
  const [profile, setProfile] = useState<string | null>(null);
  const { query, page, setPage, search, setSearch, pageSize } = useList<Customer>('customers', '/customers');
  const columns: Column<Customer>[] = [
    {
      key: 'n',
      header: t('common.name'),
      cell: (c) => (
        <div className="min-w-0">
          <p className="truncate font-medium" dir="auto">
            {c.name}
          </p>
          <p className="truncate text-xs text-slate-500">
            {c.company && <span dir="auto">{c.company} · </span>}
            <Ltr>{c.phone || c.email}</Ltr>
          </p>
        </div>
      ),
    },
    { key: 'limit', header: t('credit.limit'), hideOnMobile: true, cell: (c) => (c.creditLimit === null ? '—' : money(c.creditLimit)) },
    { key: 'pts', header: t('loyalty.points'), hideOnMobile: true, cell: (c) => (c.loyaltyPoints ? <Ltr>{c.loyaltyPoints}</Ltr> : '—') },
    {
      key: 'due',
      header: t('credit.outstanding'),
      className: 'text-end',
      cell: (c) =>
        c.outstanding > 0 ? (
          <span className={`font-semibold tabular-nums ${c.overdue > 0 ? 'text-rose-600' : ''}`}>{money(c.outstanding)}</span>
        ) : (
          <span className="text-slate-400">{money(0)}</span>
        ),
    },
  ];
  return (
    <div className="space-y-6">
      <PageHeader
        title={t('customers.title')}
        description={t('customers.subtitle')}
        actions={
          can('customers.create') && (
            <Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
              {t('customers.create')}
            </Button>
          )
        }
      />
      <Card padded={false}>
        <ListToolbar search={search} onSearch={setSearch} placeholder={t('customers.search')} />
        {query.isLoading ? (
          <SkeletonRows />
        ) : !query.data?.items.length ? (
          <EmptyState icon={<Users className="size-6" />} title={t('customers.empty_title')} description={t('customers.empty_body')} />
        ) : (
          <>
            <DataTable columns={columns} rows={query.data.items} rowKey={(c) => c.id} onRowClick={(c) => setProfile(c.id)} />
            <Pagination page={page} pageSize={pageSize} total={query.data.total} onPage={setPage} />
          </>
        )}
      </Card>
      {editing && <CustomerDialog customer={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {profile && (
        <CustomerProfile
          id={profile}
          onClose={() => setProfile(null)}
          onEdit={(c) => {
            setProfile(null);
            setEditing(c);
          }}
        />
      )}
    </div>
  );
}

function CustomerDialog({ customer, onClose }: { customer: Customer | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { can, hasAddon } = useBiz();
  const qc = useQueryClient();
  const errMsg = useErrorMessage();
  const [form, setForm] = useState({
    name: customer?.name ?? '',
    phone: customer?.phone ?? '',
    email: customer?.email ?? '',
    company: customer?.company ?? '',
    address: customer?.address ?? '',
    taxNumber: customer?.taxNumber ?? '',
    notes: customer?.notes ?? '',
    creditLimit: customer?.creditLimit === null || customer?.creditLimit === undefined ? '' : String(customer.creditLimit / 100),
    creditDays: customer?.creditDays === null || customer?.creditDays === undefined ? '' : String(customer.creditDays),
  });
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, creditLimit: form.creditLimit === '' ? null : parseAmount(form.creditLimit), creditDays: form.creditDays === '' ? null : Math.floor(parseAmount(form.creditDays)) };
      return customer ? api.put(`/customers/${customer.id}`, body) : api.post('/customers', body);
    },
    onSuccess: () => {
      toast.success(t('common.saved'));
      void qc.invalidateQueries({ queryKey: ['biz', 'customers'] });
      void qc.invalidateQueries({ queryKey: ['biz', 'customer'] });
      onClose();
    },
  });
  const fe = useFieldErrors(save.error);
  const creditEditable = hasAddon('credit') && can('credit.manage');
  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={customer ? t('customers.edit') : t('customers.create')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!form.name.trim()}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {save.error && !(save.error instanceof ApiError && save.error.code === 'validation_failed') && <Alert tone="red">{errMsg(save.error)}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label={t('common.name')} value={form.name} onChange={set('name')} error={fe('name')} required />
          <Input label={t('customers.company')} value={form.company} onChange={set('company')} error={fe('company')} />
          <Input label={t('common.phone')} type="tel" dir="ltr" value={form.phone} onChange={set('phone')} error={fe('phone')} />
          <Input label={t('common.email')} type="email" dir="ltr" value={form.email} onChange={set('email')} error={fe('email')} />
          <Input label={t('customers.tax_number')} dir="ltr" value={form.taxNumber} onChange={set('taxNumber')} error={fe('taxNumber')} />
          {creditEditable && (
            <>
              <Input label={t('credit.limit')} type="number" min={0} step="0.01" hint={t('credit.limit_hint')} value={form.creditLimit} onChange={set('creditLimit')} error={fe('creditLimit')} />
              <Input label={t('credit.days')} type="number" min={0} max={365} value={form.creditDays} onChange={set('creditDays')} error={fe('creditDays')} />
            </>
          )}
        </div>
        <Textarea label={t('common.address')} value={form.address} onChange={set('address')} />
        <Textarea label={t('common.notes')} value={form.notes} onChange={set('notes')} />
      </div>
    </Dialog>
  );
}

interface Profile {
  customer: Customer;
  stats: { salesCount: number; totalSpent: number; lastPurchaseAt: string | null };
  outstanding: number;
  overdue: number;
  availableCredit: number | null;
  sales: { id: string; number: string | null; total: number; balanceDue: number; completedAt: string | null; status: string }[];
  quotations: { id: string; number: string; total: number; status: string; date: string }[] | null;
  invoices: { id: string; number: string; total: number; balanceDue: number; status: string; date: string; dueDate: string }[] | null;
  payments: { id: string; kind: string; method: string; amount: number; paidAt: string; reference: string }[];
}

function CustomerProfile({ id, onClose, onEdit }: { id: string; onClose: () => void; onEdit: (c: Customer) => void }) {
  const { t } = useTranslation();
  const { can, hasAddon } = useBiz();
  const money = useMoney();
  const f = useFormat();
  const qc = useQueryClient();
  const toastErr = useToastError();
  const [tab, setTab] = useState<'overview' | 'statement' | 'loyalty'>('overview');
  const [paying, setPaying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const q = useQuery({ queryKey: ['biz', 'customer', id], queryFn: () => api.get<Profile>(`/customers/${id}`) });
  const del = useMutation({
    mutationFn: () => api.delete(`/customers/${id}`),
    onSuccess: () => {
      toast.success(t('customers.deleted'));
      void qc.invalidateQueries({ queryKey: ['biz', 'customers'] });
      onClose();
    },
    onError: toastErr,
  });
  const p = q.data;
  const tabs: { value: 'overview' | 'statement' | 'loyalty'; label: string }[] = [{ value: 'overview', label: t('customers.overview') }];
  if (hasAddon('credit') && can('credit.view')) tabs.push({ value: 'statement', label: t('credit.statement') });
  if (hasAddon('loyalty') && can('loyalty.view')) tabs.push({ value: 'loyalty', label: t('loyalty.title') });
  return (
    <Dialog
      open
      onClose={onClose}
      size="xl"
      title={p ? <span dir="auto">{p.customer.name}</span> : t('common.loading')}
      description={p && [p.customer.phone, p.customer.email].filter(Boolean).join(' · ')}
      footer={
        p && (
          <>
            {can('customers.delete') && (
              <Button variant="ghost" className="me-auto text-rose-600" onClick={() => setDeleting(true)}>
                {t('common.delete')}
              </Button>
            )}
            {hasAddon('credit') && can('credit.payment') && p.outstanding > 0 && <Button onClick={() => setPaying(true)}>{t('credit.receive_payment')}</Button>}
            {can('customers.edit') && (
              <Button variant="secondary" onClick={() => onEdit(p.customer)}>
                {t('common.edit')}
              </Button>
            )}
          </>
        )
      }
    >
      {!p ? (
        <SkeletonRows rows={5} />
      ) : (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-4">
            <StatCard label={t('customers.total_spent')} value={money(p.stats.totalSpent)} hint={t('customers.sales_count', { count: p.stats.salesCount })} />
            <StatCard label={t('credit.outstanding')} value={money(p.outstanding)} tone={p.overdue > 0 ? 'red' : 'blue'} hint={p.overdue > 0 ? `${t('status_labels.overdue')}: ${money(p.overdue)}` : undefined} />
            <StatCard label={t('credit.available')} value={p.availableCredit === null ? '—' : money(p.availableCredit)} hint={p.customer.creditLimit !== null ? `${t('credit.limit')}: ${money(p.customer.creditLimit)}` : t('credit.no_limit')} />
            <StatCard label={t('customers.last_purchase')} value={<span className="text-base">{f.date(p.stats.lastPurchaseAt)}</span>} />
          </div>
          {tabs.length > 1 && <Tabs tabs={tabs} value={tab} onChange={setTab} />}
          {tab === 'overview' && <Overview p={p} />}
          {tab === 'statement' && <Statement id={id} />}
          {tab === 'loyalty' && <Loyalty id={id} />}
        </div>
      )}
      {paying && p && <CreditPaymentDialog customerId={id} outstanding={p.outstanding} onClose={() => setPaying(false)} />}
      <ConfirmDialog open={deleting} onClose={() => setDeleting(false)} onConfirm={() => del.mutate()} loading={del.isPending} danger title={t('customers.delete_title')} message={t('customers.delete_body')} confirmLabel={t('common.delete')} />
    </Dialog>
  );
}

function Overview({ p }: { p: Profile }) {
  const { t } = useTranslation();
  const money = useMoney();
  const f = useFormat();
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h3>
      {children}
    </section>
  );
  const empty = <p className="text-sm text-slate-400">{t('common.no_results')}</p>;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Section title={t('sales.title')}>
        {p.sales.length === 0
          ? empty
          : p.sales.map((s) => (
              <Row key={s.id} left={<Ltr>{s.number ?? '—'}</Ltr>} mid={<StatusBadge status={s.balanceDue > 0 ? 'unpaid' : s.status} />} sub={f.dateTime(s.completedAt)} right={money(s.total)} />
            ))}
      </Section>
      {p.invoices && (
        <Section title={t('invoices.title')}>
          {p.invoices.length === 0
            ? empty
            : p.invoices.map((i) => (
                <Row key={i.id} to={`/invoices/${i.id}`} left={<Ltr>{i.number}</Ltr>} mid={<StatusBadge status={i.status} />} sub={`${f.date(i.date)} · ${t('invoices.due')} ${f.date(i.dueDate)}`} right={money(i.balanceDue > 0 ? i.balanceDue : i.total)} />
              ))}
        </Section>
      )}
      {p.quotations && (
        <Section title={t('quotations.title')}>
          {p.quotations.length === 0 ? empty : p.quotations.map((x) => <Row key={x.id} to={`/quotations/${x.id}`} left={<Ltr>{x.number}</Ltr>} mid={<StatusBadge status={x.status} />} sub={f.date(x.date)} right={money(x.total)} />)}
        </Section>
      )}
      <Section title={t('payments.title')}>
        {p.payments.length === 0
          ? empty
          : p.payments.map((x) => <Row key={x.id} left={t(`payment_methods.${x.method}`)} mid={<Badge>{t(`payments.kinds.${x.kind}`)}</Badge>} sub={f.dateTime(x.paidAt)} right={money(x.amount)} />)}
      </Section>
    </div>
  );
}

function Row({ left, mid, sub, right, to }: { left: React.ReactNode; mid?: React.ReactNode; sub?: React.ReactNode; right: React.ReactNode; to?: string }) {
  const inner = (
    <div className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm ring-1 ring-slate-100 hover:bg-slate-50 dark:ring-slate-800 dark:hover:bg-slate-800/50">
      <div className="min-w-0">
        <p className="flex items-center gap-2 font-medium">
          {left} {mid}
        </p>
        {sub && <p className="text-xs text-slate-500">{sub}</p>}
      </div>
      <span className="font-semibold tabular-nums">{right}</span>
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

function Statement({ id }: { id: string }) {
  const { t } = useTranslation();
  const money = useMoney();
  const f = useFormat();
  const q = useQuery({
    queryKey: ['biz', 'customer', id, 'statement'],
    queryFn: () => api.get<{ entries: { date: string; kind: string; reference: string | null; debit: number; credit: number; balance: number }[]; balance: number }>(`/customers/${id}/statement`),
  });
  if (!q.data) return <SkeletonRows rows={4} />;
  if (!q.data.entries.length) return <p className="text-sm text-slate-400">{t('credit.statement_empty')}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-slate-500">
          <tr>
            <th className="py-2 text-start font-medium">{t('common.date')}</th>
            <th className="py-2 text-start font-medium">{t('credit.entry')}</th>
            <th className="py-2 text-end font-medium">{t('credit.debit')}</th>
            <th className="py-2 text-end font-medium">{t('credit.credit')}</th>
            <th className="py-2 text-end font-medium">{t('credit.balance')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {q.data.entries.map((e, i) => (
            <tr key={i}>
              <td className="py-2">{f.date(e.date)}</td>
              <td className="py-2">
                {t(`credit.kinds.${e.kind}`)} {e.reference && <Ltr className="text-slate-500">{e.reference}</Ltr>}
              </td>
              <td className="py-2 text-end tabular-nums">{e.debit ? money(e.debit) : ''}</td>
              <td className="py-2 text-end tabular-nums">{e.credit ? money(e.credit) : ''}</td>
              <td className="py-2 text-end font-medium tabular-nums">{money(e.balance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Loyalty({ id }: { id: string }) {
  const { t } = useTranslation();
  const { can } = useBiz();
  const f = useFormat();
  const qc = useQueryClient();
  const toastErr = useToastError();
  const [points, setPoints] = useState('');
  const [reason, setReason] = useState('');
  const q = useQuery({
    queryKey: ['biz', 'customer', id, 'loyalty'],
    queryFn: () => api.get<{ points: number; history: { id: string; points: number; balanceAfter: number; reason: string; createdAt: string }[] }>(`/customers/${id}/loyalty`),
  });
  const adjust = useMutation({
    mutationFn: () => api.post(`/customers/${id}/loyalty`, { points: Math.trunc(parseAmount(points)), reason }),
    onSuccess: () => {
      toast.success(t('common.saved'));
      setPoints('');
      setReason('');
      void qc.invalidateQueries({ queryKey: ['biz', 'customer', id] });
    },
    onError: toastErr,
  });
  if (!q.data) return <SkeletonRows rows={3} />;
  return (
    <div className="space-y-4">
      <p className="text-2xl font-semibold">
        <Ltr>{q.data.points}</Ltr> <span className="text-sm font-normal text-slate-500">{t('loyalty.points')}</span>
      </p>
      {can('loyalty.manage') && (
        <div className="flex flex-wrap items-end gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/40">
          <Input className="w-32" type="number" step="1" label={t('loyalty.adjust_points')} hint={t('loyalty.adjust_hint')} value={points} onChange={(e) => setPoints(e.target.value)} />
          <Input className="min-w-40 flex-1" label={t('loyalty.reason')} value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button onClick={() => adjust.mutate()} loading={adjust.isPending} disabled={!points || parseAmount(points) === 0 || reason.trim().length < 2}>
            {t('common.save')}
          </Button>
        </div>
      )}
      <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
        {q.data.history.map((h) => (
          <li key={h.id} className="flex justify-between gap-3 py-2">
            <span>
              <span dir="auto">{h.reason}</span>
              <span className="block text-xs text-slate-500">{f.dateTime(h.createdAt)}</span>
            </span>
            <Ltr className={h.points < 0 ? 'text-rose-600' : 'text-emerald-600'}>{`${h.points > 0 ? '+' : ''}${h.points}`}</Ltr>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CreditPaymentDialog({ customerId, outstanding, onClose }: { customerId: string; outstanding: number; onClose: () => void }) {
  const { t } = useTranslation();
  const money = useMoney();
  const qc = useQueryClient();
  const errMsg = useErrorMessage();
  const [form, setForm] = useState({ method: 'cash', amount: (outstanding / 100).toFixed(2), reference: '', notes: '' });
  const pay = useMutation({
    mutationFn: () => api.post<{ allocated: unknown[] }>(`/customers/${customerId}/credit-payments`, { ...form, amount: parseAmount(form.amount) }),
    onSuccess: () => {
      toast.success(t('credit.payment_recorded'));
      void qc.invalidateQueries({ queryKey: ['biz', 'customer', customerId] });
      void qc.invalidateQueries({ queryKey: ['biz', 'customers'] });
      onClose();
    },
  });
  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      title={t('credit.receive_payment')}
      description={`${t('credit.outstanding')}: ${money(outstanding)}`}
      footer={
        <Button onClick={() => pay.mutate()} loading={pay.isPending} disabled={parseAmount(form.amount) <= 0}>
          {t('credit.record_payment')}
        </Button>
      }
    >
      <div className="space-y-4">
        {pay.error && <Alert tone="red">{errMsg(pay.error)}</Alert>}
        <p className="text-sm text-slate-500">{t('credit.fifo_hint')}</p>
        <Select label={t('payments.method')} value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
          {['cash', 'card', 'bank_transfer', 'other'].map((m) => (
            <option key={m} value={m}>
              {t(`payment_methods.${m}`)}
            </option>
          ))}
        </Select>
        <Input label={t('payments.amount')} type="number" min={0} step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        <Input label={t('payments.reference')} value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
      </div>
    </Dialog>
  );
}

