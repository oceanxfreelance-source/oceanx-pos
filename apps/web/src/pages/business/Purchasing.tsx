import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PackagePlus, Plus, Trash2, Truck } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { useBiz } from '../../auth/business';
import { useFormat } from '../../lib/format';
import { parseAmount, useMoney } from '../../lib/money';
import { useList } from '../../lib/useList';
import { useErrorMessage, useFieldErrors, useToastError } from '../../lib/useApiError';
import { Alert, Card, EmptyState, Ltr, PageHeader, SkeletonRows } from '../../components/ui/Card';
import { Button, IconButton } from '../../components/ui/Button';
import { Input, Select, Switch, Textarea } from '../../components/ui/Form';
import { ConfirmDialog, Dialog } from '../../components/ui/Dialog';
import { DataTable, Pagination, type Column } from '../../components/ui/Table';
import { Tabs } from '../../components/ui/Tabs';
import { ListToolbar } from '../../components/ListToolbar';
import { StatusBadge } from '../../components/StatusBadge';
import { ProductPicker, SupplierPicker } from '../../components/Pickers';

interface Purchase {
  id: string;
  number: string;
  supplierId: string;
  supplierName: string;
  purchaseDate: string;
  status: string;
  paymentStatus: string;
  total: number;
  paidAmount: number;
  reference: string;
  notes: string;
}
interface Supplier {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  isActive: boolean;
  purchaseTotal: number;
  unpaid: number;
}

export default function PurchasingPage({ initialTab = 'purchases' }: { initialTab?: 'purchases' | 'suppliers' }) {
  const { t } = useTranslation();
  const { can } = useBiz();
  const [tab, setTab] = useState(initialTab);
  const tabs: { value: 'purchases' | 'suppliers'; label: string }[] = [];
  if (can('purchases.view')) tabs.push({ value: 'purchases', label: t('purchases.title') });
  if (can('suppliers.view')) tabs.push({ value: 'suppliers', label: t('suppliers.title') });
  const active = tabs.some((x) => x.value === tab) ? tab : tabs[0]?.value;
  return (
    <div className="space-y-6">
      <PageHeader title={t('purchases.page_title')} description={t('purchases.subtitle')} />
      {tabs.length > 1 && <Tabs tabs={tabs} value={active!} onChange={setTab} />}
      {active === 'purchases' && <PurchaseList />}
      {active === 'suppliers' && <SupplierList />}
    </div>
  );
}

function PurchaseList() {
  const { t } = useTranslation();
  const { can } = useBiz();
  const money = useMoney();
  const f = useFormat();
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const { query, page, setPage, search, setSearch, pageSize } = useList<Purchase>('purchases', '/purchases', { status });
  const columns: Column<Purchase>[] = [
    { key: 'n', header: t('documents.number'), cell: (p) => <Ltr className="font-medium">{p.number}</Ltr> },
    { key: 's', header: t('suppliers.supplier'), cell: (p) => <span dir="auto">{p.supplierName}</span> },
    { key: 'st', header: t('common.status'), cell: (p) => <StatusBadge status={p.status} /> },
    { key: 'pay', header: t('purchases.payment'), hideOnMobile: true, cell: (p) => <StatusBadge status={p.paymentStatus} /> },
    { key: 'd', header: t('common.date'), hideOnMobile: true, cell: (p) => f.date(p.purchaseDate) },
    { key: 't', header: t('documents.total'), className: 'text-end', cell: (p) => <span className="font-semibold tabular-nums">{money(p.total)}</span> },
  ];
  return (
    <Card padded={false}>
      <ListToolbar search={search} onSearch={setSearch} placeholder={t('documents.search')}>
        <Select label={t('common.status')} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t('common.all')}</option>
          {['draft', 'received', 'cancelled'].map((s) => (
            <option key={s} value={s}>
              {t(`status_labels.${s}`)}
            </option>
          ))}
        </Select>
        {can('purchases.create') && (
          <div className="flex items-end">
            <Button className="w-full" icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
              {t('purchases.create')}
            </Button>
          </div>
        )}
      </ListToolbar>
      {query.isLoading ? (
        <SkeletonRows />
      ) : !query.data?.items.length ? (
        <EmptyState icon={<PackagePlus className="size-6" />} title={t('purchases.empty_title')} description={t('purchases.empty_body')} />
      ) : (
        <>
          <DataTable columns={columns} rows={query.data.items} rowKey={(p) => p.id} onRowClick={(p) => setEditing(p.id)} />
          <Pagination page={page} pageSize={pageSize} total={query.data.total} onPage={setPage} />
        </>
      )}
      {editing && <PurchaseDialog id={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function PurchaseDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const q = useQuery({
    queryKey: ['biz', 'purchase', id],
    queryFn: () =>
      api.get<{ purchase: Purchase; supplier: { id: string; name: string }; items: { id: string; productId: string; nameSnapshot: string; quantity: number; unitCost: number; total: number }[] }>(`/purchases/${id}`),
    enabled: !!id,
  });
  if (id && !q.data) return null;
  return <PurchaseForm data={q.data ?? null} onClose={onClose} />;
}

function PurchaseForm({
  data,
  onClose,
}: {
  data: { purchase: Purchase; supplier: { id: string; name: string }; items: { productId: string; nameSnapshot: string; quantity: number; unitCost: number; total: number }[] } | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { can } = useBiz();
  const money = useMoney();
  const qc = useQueryClient();
  const errMsg = useErrorMessage();
  const toastErr = useToastError();
  const p = data?.purchase;
  const editable = !p || p.status === 'draft';
  const [supplier, setSupplier] = useState<{ id: string; name: string } | null>(data ? data.supplier : null);
  const [form, setForm] = useState({ purchaseDate: p?.purchaseDate ?? new Date().toISOString().slice(0, 10), reference: p?.reference ?? '', notes: p?.notes ?? '' });
  const [items, setItems] = useState(data?.items.map((i) => ({ productId: i.productId, name: i.nameSnapshot, quantity: String(i.quantity), unitCost: String(i.unitCost / 100) })) ?? []);
  const [confirm, setConfirm] = useState<'receive' | 'cancel' | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['biz', 'purchases'] });
    void qc.invalidateQueries({ queryKey: ['biz', 'purchase', p?.id] });
    void qc.invalidateQueries({ queryKey: ['biz', 'suppliers'] });
  };
  const save = useMutation({
    mutationFn: () => {
      const body = { supplierId: supplier?.id, ...form, items: items.map((i) => ({ productId: i.productId, quantity: parseAmount(i.quantity), unitCost: parseAmount(i.unitCost) })) };
      return p ? api.put(`/purchases/${p.id}`, body) : api.post('/purchases', body);
    },
    onSuccess: () => {
      toast.success(t('common.saved'));
      refresh();
      onClose();
    },
  });
  const act = useMutation({
    mutationFn: (a: 'receive' | 'cancel') => api.post(`/purchases/${p!.id}/${a}`, {}),
    onSuccess: (_r, a) => {
      toast.success(t(`purchases.${a}d`));
      setConfirm(null);
      refresh();
      void qc.invalidateQueries({ queryKey: ['biz', 'inventory'] });
      onClose();
    },
    onError: toastErr,
  });
  const pay = useMutation({
    mutationFn: () => api.post(`/purchases/${p!.id}/payments`, { amount: parseAmount(payAmount), method: payMethod }),
    onSuccess: () => {
      toast.success(t('purchases.payment_recorded'));
      setPayAmount('');
      refresh();
      onClose();
    },
    onError: toastErr,
  });
  const fe = useFieldErrors(save.error);
  const total = items.reduce((a, i) => a + Math.round(parseAmount(i.unitCost) * 100 * parseAmount(i.quantity)), 0);
  return (
    <Dialog
      open
      onClose={onClose}
      size="xl"
      title={p ? <Ltr>{p.number}</Ltr> : t('purchases.create')}
      description={p && <StatusBadge status={p.status} />}
      footer={
        <>
          {p?.status === 'draft' && can('purchases.edit') && (
            <Button variant="ghost" className="me-auto text-rose-600" onClick={() => setConfirm('cancel')}>
              {t('common.cancel_document')}
            </Button>
          )}
          {p?.status === 'draft' && can('purchases.edit') && can('inventory.adjust') && (
            <Button variant="secondary" onClick={() => setConfirm('receive')}>
              {t('purchases.receive')}
            </Button>
          )}
          {editable && (
            <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!supplier || items.length === 0}>
              {t('common.save')}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {save.error && !(save.error instanceof ApiError && save.error.code === 'validation_failed') && <Alert tone="red">{errMsg(save.error)}</Alert>}
        <div className="grid gap-4 sm:grid-cols-3">
          {editable ? (
            <SupplierPicker label={t('suppliers.supplier')} value={supplier?.id ?? null} valueLabel={supplier?.name} onChange={(id, s) => setSupplier(id && s ? { id, name: s.name } : null)} error={fe('supplierId')} />
          ) : (
            <Input label={t('suppliers.supplier')} value={supplier?.name ?? ''} disabled />
          )}
          <Input type="date" label={t('common.date')} value={form.purchaseDate} disabled={!editable} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} />
          <Input label={t('purchases.reference')} value={form.reference} disabled={!editable} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
        </div>
        <div className="space-y-2">
          {items.map((i, idx) => (
            <div key={i.productId} className="grid grid-cols-[1fr_6rem_7rem_auto] items-end gap-2">
              <span className="truncate py-2.5 text-sm font-medium" dir="auto">
                {i.name}
              </span>
              <Input type="number" min={0} step="0.001" label={idx === 0 ? t('documents.quantity') : undefined} aria-label={t('documents.quantity')} value={i.quantity} disabled={!editable} onChange={(e) => setItems(items.map((x, j) => (j === idx ? { ...x, quantity: e.target.value } : x)))} />
              <Input type="number" min={0} step="0.01" label={idx === 0 ? t('purchases.unit_cost') : undefined} aria-label={t('purchases.unit_cost')} value={i.unitCost} disabled={!editable} onChange={(e) => setItems(items.map((x, j) => (j === idx ? { ...x, unitCost: e.target.value } : x)))} />
              {editable ? (
                <IconButton label={t('common.delete')} onClick={() => setItems(items.filter((_, j) => j !== idx))}>
                  <Trash2 className="size-4" />
                </IconButton>
              ) : (
                <span />
              )}
            </div>
          ))}
          {editable && <ProductPicker value={null} placeholder={t('documents.add_product')} onChange={(_id, pr) => pr && !items.some((i) => i.productId === pr.id) && setItems([...items, { productId: pr.id, name: pr.name, quantity: '1', unitCost: String(pr.costPrice / 100) }])} />}
          {fe('items') && <p className="text-sm text-rose-600">{fe('items')}</p>}
        </div>
        <Textarea label={t('common.notes')} value={form.notes} disabled={!editable} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-800/40">
          <span>
            {t('documents.total')}: <span className="font-semibold">{money(p && !editable ? p.total : total)}</span>
          </span>
          {p && (
            <span>
              {t('invoices.paid')}: <span className="font-semibold">{money(p.paidAmount)}</span> · {t('credit.balance_due')}: <span className="font-semibold">{money(p.total - p.paidAmount)}</span>
            </span>
          )}
        </div>
        {p && p.status !== 'cancelled' && p.paidAmount < p.total && can('purchases.edit') && (
          <div className="flex flex-wrap items-end gap-2">
            <Select label={t('payments.method')} value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
              {['cash', 'card', 'bank_transfer', 'other'].map((m) => (
                <option key={m} value={m}>
                  {t(`payment_methods.${m}`)}
                </option>
              ))}
            </Select>
            <Input type="number" min={0} step="0.01" label={t('purchases.pay_supplier')} value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
            <Button variant="secondary" onClick={() => pay.mutate()} loading={pay.isPending} disabled={parseAmount(payAmount) <= 0}>
              {t('purchases.record_payment')}
            </Button>
          </div>
        )}
      </div>
      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && act.mutate(confirm)}
        loading={act.isPending}
        danger={confirm === 'cancel'}
        title={confirm ? t(`purchases.confirm_${confirm}_title`) : ''}
        message={confirm ? t(`purchases.confirm_${confirm}_body`) : ''}
        confirmLabel={t('common.confirm')}
      />
    </Dialog>
  );
}

function SupplierList() {
  const { t } = useTranslation();
  const { can } = useBiz();
  const money = useMoney();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Supplier | 'new' | null>(null);
  const { query, page, setPage, search, setSearch, pageSize } = useList<Supplier>('suppliers', '/suppliers');
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', notes: '', isActive: true });
  const open = (s: Supplier | 'new') => {
    setEditing(s);
    setForm(s === 'new' ? { name: '', phone: '', email: '', address: '', notes: '', isActive: true } : { name: s.name, phone: s.phone, email: s.email, address: s.address, notes: s.notes, isActive: s.isActive });
  };
  const save = useMutation({
    mutationFn: () => (editing === 'new' ? api.post('/suppliers', form) : api.put(`/suppliers/${(editing as Supplier).id}`, form)),
    onSuccess: () => {
      toast.success(t('common.saved'));
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ['biz', 'suppliers'] });
    },
  });
  const fe = useFieldErrors(save.error);
  const columns: Column<Supplier>[] = [
    { key: 'n', header: t('common.name'), cell: (s) => <span className="font-medium" dir="auto">{s.name}</span> },
    { key: 'p', header: t('common.phone'), hideOnMobile: true, cell: (s) => <Ltr>{s.phone || '—'}</Ltr> },
    { key: 'st', header: t('common.status'), hideOnMobile: true, cell: (s) => <StatusBadge status={s.isActive ? 'active' : 'inactive'} /> },
    { key: 'tot', header: t('suppliers.purchases_total'), hideOnMobile: true, cell: (s) => money(s.purchaseTotal) },
    { key: 'u', header: t('suppliers.unpaid'), className: 'text-end', cell: (s) => <span className={`font-semibold tabular-nums ${s.unpaid > 0 ? 'text-rose-600' : ''}`}>{money(s.unpaid)}</span> },
  ];
  return (
    <Card padded={false}>
      <ListToolbar search={search} onSearch={setSearch} placeholder={t('suppliers.search')}>
        {can('suppliers.manage') && (
          <div className="flex items-end">
            <Button className="w-full" icon={<Plus className="size-4" />} onClick={() => open('new')}>
              {t('suppliers.create')}
            </Button>
          </div>
        )}
      </ListToolbar>
      {query.isLoading ? (
        <SkeletonRows />
      ) : !query.data?.items.length ? (
        <EmptyState icon={<Truck className="size-6" />} title={t('suppliers.empty')} />
      ) : (
        <>
          <DataTable columns={columns} rows={query.data.items} rowKey={(s) => s.id} onRowClick={can('suppliers.manage') ? open : undefined} />
          <Pagination page={page} pageSize={pageSize} total={query.data.total} onPage={setPage} />
        </>
      )}
      <Dialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? t('suppliers.create') : t('suppliers.edit')}
        footer={
          <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!form.name.trim()}>
            {t('common.save')}
          </Button>
        }
      >
        <div className="space-y-4">
          <Input label={t('common.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={fe('name')} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label={t('common.phone')} dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} error={fe('phone')} />
            <Input label={t('common.email')} dir="ltr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={fe('email')} />
          </div>
          <Textarea label={t('common.address')} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <Textarea label={t('common.notes')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <Switch checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} label={t('common.active')} />
        </div>
      </Dialog>
    </Card>
  );
}
