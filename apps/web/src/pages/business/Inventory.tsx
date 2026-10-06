import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Boxes, Plus, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useBiz, useBizSession } from '../../auth/business';
import { useFormat } from '../../lib/format';
import { parseAmount, useMoney } from '../../lib/money';
import { useList } from '../../lib/useList';
import { useErrorMessage, useToastError } from '../../lib/useApiError';
import { Alert, Badge, Card, EmptyState, Ltr, PageHeader, SkeletonRows, StatCard } from '../../components/ui/Card';
import { Button, IconButton } from '../../components/ui/Button';
import { Checkbox, Input, Select, Textarea } from '../../components/ui/Form';
import { Dialog } from '../../components/ui/Dialog';
import { DataTable, Pagination, type Column } from '../../components/ui/Table';
import { Tabs } from '../../components/ui/Tabs';
import { ListToolbar } from '../../components/ListToolbar';
import { ProductPicker } from '../../components/Pickers';

interface Level {
  id: string;
  name: string;
  sku: string;
  unit: string;
  type: string;
  minStock: number;
  costPrice: number;
  quantity: number;
  low: boolean;
}

type Tab = 'levels' | 'history' | 'transfers';

export default function InventoryPage() {
  const { t } = useTranslation();
  const { can, hasAddon } = useBiz();
  const session = useBizSession();
  const [tab, setTab] = useState<Tab>('levels');
  const tabs: { value: Tab; label: string }[] = [
    { value: 'levels', label: t('inventory.levels') },
    { value: 'history', label: t('inventory.history') },
  ];
  if (hasAddon('advanced_inventory') && can('transfers.manage') && session.outlets.length > 1) tabs.push({ value: 'transfers', label: t('inventory.transfers') });
  return (
    <div className="space-y-6">
      <PageHeader title={t('inventory.title')} description={t('inventory.subtitle', { outlet: session.outlet?.name ?? '' })} />
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === 'levels' && <Levels />}
      {tab === 'history' && <History />}
      {tab === 'transfers' && <Transfers />}
    </div>
  );
}

function Levels() {
  const { t } = useTranslation();
  const { can } = useBiz();
  const money = useMoney();
  const [low, setLow] = useState(false);
  const [adjusting, setAdjusting] = useState<Level | null>(null);
  const { query, page, setPage, search, setSearch, pageSize } = useList<Level>('inventory', '/inventory', { low: low ? 'true' : undefined });
  const columns: Column<Level>[] = [
    {
      key: 'n',
      header: t('common.name'),
      cell: (l) => (
        <div>
          <p className="font-medium" dir="auto">
            {l.name}
          </p>
          <p className="text-xs text-slate-500">
            {l.sku && <Ltr>{l.sku}</Ltr>} · {t(`products.types.${l.type}`)}
          </p>
        </div>
      ),
    },
    { key: 'min', header: t('products.min_stock'), hideOnMobile: true, cell: (l) => <Ltr>{`${l.minStock} ${l.unit}`}</Ltr> },
    { key: 'val', header: t('inventory.value'), hideOnMobile: true, cell: (l) => money(Math.round(Math.max(0, l.quantity) * l.costPrice)) },
    {
      key: 'q',
      header: t('inventory.stock'),
      className: 'text-end',
      cell: (l) => <Badge tone={l.quantity <= 0 ? 'red' : l.low ? 'amber' : 'green'}>{`${l.quantity} ${l.unit}`}</Badge>,
    },
  ];
  return (
    <>
      {query.data && (
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard label={t('inventory.stock_value')} value={money(query.data.stockValue as number)} />
          <StatCard label={t('inventory.tracked_items')} value={<Ltr>{query.data.total}</Ltr>} />
        </div>
      )}
      <Card padded={false}>
        <ListToolbar search={search} onSearch={setSearch} placeholder={t('products.search')}>
          <div className="flex items-end">
            <Checkbox checked={low} onChange={setLow} label={t('inventory.low_only')} />
          </div>
        </ListToolbar>
        {query.isLoading ? (
          <SkeletonRows />
        ) : !query.data?.items.length ? (
          <EmptyState icon={<Boxes className="size-6" />} title={t('inventory.empty_title')} description={t('inventory.empty_body')} />
        ) : (
          <>
            <DataTable columns={columns} rows={query.data.items} rowKey={(l) => l.id} onRowClick={can('inventory.adjust') ? setAdjusting : undefined} />
            <Pagination page={page} pageSize={pageSize} total={query.data.total} onPage={setPage} />
          </>
        )}
      </Card>
      {adjusting && <AdjustDialog level={adjusting} onClose={() => setAdjusting(null)} />}
    </>
  );
}

function AdjustDialog({ level, onClose }: { level: Level; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const errMsg = useErrorMessage();
  const [form, setForm] = useState({ mode: 'add', quantity: '', reason: '' });
  const m = useMutation({
    mutationFn: () => api.post<{ balance: number }>('/inventory/adjust', { productId: level.id, mode: form.mode, quantity: parseAmount(form.quantity), reason: form.reason }),
    onSuccess: (r) => {
      toast.success(t('inventory.adjusted', { balance: r.balance, unit: level.unit }));
      void qc.invalidateQueries({ queryKey: ['biz', 'inventory'] });
      void qc.invalidateQueries({ queryKey: ['biz', 'inventory-history'] });
      onClose();
    },
  });
  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      title={t('inventory.adjust')}
      description={
        <span dir="auto">
          {level.name} — {t('inventory.current')}: <Ltr>{`${level.quantity} ${level.unit}`}</Ltr>
        </span>
      }
      footer={
        <Button onClick={() => m.mutate()} loading={m.isPending} disabled={form.quantity === ''}>
          {t('common.save')}
        </Button>
      }
    >
      <div className="space-y-4">
        {m.error && <Alert tone="red">{errMsg(m.error)}</Alert>}
        <Select label={t('inventory.mode')} value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
          {['add', 'remove', 'set', 'wastage'].map((x) => (
            <option key={x} value={x}>
              {t(`inventory.modes.${x}`)}
            </option>
          ))}
        </Select>
        <Input type="number" min={0} step="0.001" label={t('documents.quantity')} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
        <Textarea label={t('inventory.reason')} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
      </div>
    </Dialog>
  );
}

interface Txn {
  id: string;
  type: string;
  quantity: number;
  balanceAfter: number;
  note: string;
  referenceType: string | null;
  createdAt: string;
  productName: string;
  unit: string;
  outletName: string;
  userName: string | null;
}

function History() {
  const { t } = useTranslation();
  const f = useFormat();
  const [type, setType] = useState('');
  const { query, page, setPage, pageSize } = useList<Txn>('inventory-history', '/inventory/history', { type });
  const columns: Column<Txn>[] = [
    { key: 'd', header: t('common.date'), cell: (x) => f.dateTime(x.createdAt) },
    { key: 'p', header: t('products.item'), cell: (x) => <span dir="auto">{x.productName}</span> },
    { key: 't', header: t('inventory.movement'), cell: (x) => <Badge>{t(`inventory.types.${x.type}`)}</Badge> },
    { key: 'o', header: t('outlets.outlet'), hideOnMobile: true, cell: (x) => <span dir="auto">{x.outletName}</span> },
    { key: 'u', header: t('common.user'), hideOnMobile: true, cell: (x) => <span dir="auto">{x.userName ?? '—'}</span> },
    { key: 'n', header: t('inventory.reason'), hideOnMobile: true, cell: (x) => <span dir="auto">{x.note || '—'}</span> },
    {
      key: 'q',
      header: t('documents.quantity'),
      className: 'text-end',
      cell: (x) => (
        <span className="tabular-nums">
          <Ltr className={Number(x.quantity) < 0 ? 'text-rose-600' : 'text-emerald-600'}>{`${Number(x.quantity) > 0 ? '+' : ''}${Number(x.quantity)}`}</Ltr>
          <span className="block text-xs text-slate-500">
            → <Ltr>{`${Number(x.balanceAfter)} ${x.unit}`}</Ltr>
          </span>
        </span>
      ),
    },
  ];
  return (
    <Card padded={false}>
      <ListToolbar>
        <Select label={t('inventory.movement')} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">{t('common.all')}</option>
          {['sale', 'sale_void', 'recipe', 'purchase', 'adjustment', 'wastage', 'count', 'transfer_in', 'transfer_out'].map((x) => (
            <option key={x} value={x}>
              {t(`inventory.types.${x}`)}
            </option>
          ))}
        </Select>
      </ListToolbar>
      {query.isLoading ? (
        <SkeletonRows />
      ) : !query.data?.items.length ? (
        <EmptyState icon={<Boxes className="size-6" />} title={t('inventory.no_history')} />
      ) : (
        <>
          <DataTable columns={columns} rows={query.data.items} rowKey={(x) => x.id} />
          <Pagination page={page} pageSize={pageSize} total={query.data.total} onPage={setPage} />
        </>
      )}
    </Card>
  );
}

function Transfers() {
  const { t } = useTranslation();
  const session = useBizSession();
  const f = useFormat();
  const qc = useQueryClient();
  const toastErr = useToastError();
  const list = useQuery({
    queryKey: ['biz', 'transfers'],
    queryFn: () => api.get<{ items: { id: string; fromOutletId: string; toOutletId: string; notes: string; items: { name: string; quantity: number }[]; createdAt: string }[] }>('/inventory/transfers'),
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ fromOutletId: session.outlet?.id ?? '', toOutletId: '', notes: '' });
  const [items, setItems] = useState<{ productId: string; name: string; quantity: string }[]>([]);
  const save = useMutation({
    mutationFn: () => api.post('/inventory/transfers', { ...form, items: items.map((i) => ({ productId: i.productId, quantity: parseAmount(i.quantity) })) }),
    onSuccess: () => {
      toast.success(t('inventory.transfer_done'));
      setOpen(false);
      setItems([]);
      void qc.invalidateQueries({ queryKey: ['biz', 'transfers'] });
      void qc.invalidateQueries({ queryKey: ['biz', 'inventory'] });
    },
    onError: toastErr,
  });
  const outletName = (id: string) => session.outlets.find((o) => o.id === id)?.name ?? '—';
  return (
    <Card padded={false}>
      <div className="flex justify-end border-b border-slate-100 p-4 dark:border-slate-800">
        <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>
          {t('inventory.new_transfer')}
        </Button>
      </div>
      {!list.data ? (
        <SkeletonRows />
      ) : list.data.items.length === 0 ? (
        <EmptyState icon={<Boxes className="size-6" />} title={t('inventory.no_transfers')} />
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {list.data.items.map((x) => (
            <li key={x.id} className="px-5 py-3 text-sm">
              <p className="font-medium" dir="auto">
                {outletName(x.fromOutletId)} → {outletName(x.toOutletId)}
              </p>
              <p className="text-xs text-slate-500">
                {f.dateTime(x.createdAt)} · {x.items.map((i) => `${i.name} × ${i.quantity}`).join(', ')}
              </p>
            </li>
          ))}
        </ul>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title={t('inventory.new_transfer')}
        footer={
          <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!form.fromOutletId || !form.toOutletId || items.length === 0}>
            {t('inventory.transfer')}
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {(['fromOutletId', 'toOutletId'] as const).map((k) => (
              <Select key={k} label={t(`inventory.${k === 'fromOutletId' ? 'from_outlet' : 'to_outlet'}`)} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })}>
                <option value="">—</option>
                {session.outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </Select>
            ))}
          </div>
          {items.map((i, idx) => (
            <div key={i.productId} className="flex items-end gap-2">
              <span className="flex-1 py-2.5 text-sm font-medium" dir="auto">
                {i.name}
              </span>
              <Input className="w-32" type="number" min={0} step="0.001" aria-label={t('documents.quantity')} value={i.quantity} onChange={(e) => setItems(items.map((x, j) => (j === idx ? { ...x, quantity: e.target.value } : x)))} />
              <IconButton label={t('common.delete')} onClick={() => setItems(items.filter((_, j) => j !== idx))}>
                <Trash2 className="size-4" />
              </IconButton>
            </div>
          ))}
          <ProductPicker value={null} placeholder={t('documents.add_product')} onChange={(_id, p) => p && !items.some((i) => i.productId === p.id) && setItems([...items, { productId: p.id, name: p.name, quantity: '1' }])} />
          <Textarea label={t('common.notes')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
      </Dialog>
    </Card>
  );
}
