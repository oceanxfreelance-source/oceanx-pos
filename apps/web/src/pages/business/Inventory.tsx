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
  const [kind, setKind] = useState<'' | 'selling' | 'supplies'>('');
  const [adding, setAdding] = useState(false);
  const { query, page, setPage, search, setSearch, pageSize } = useList<Level>('inventory', '/inventory', { low: low ? 'true' : undefined, kind: kind || undefined });
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
          <Select label={t('inventory.show')} value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="">{t('common.all')}</option>
            <option value="selling">{t('inventory.kinds.selling')}</option>
            <option value="supplies">{t('inventory.kinds.supplies')}</option>
          </Select>
          <div className="flex items-end">
            <Checkbox checked={low} onChange={setLow} label={t('inventory.low_only')} />
          </div>
          {can('products.create') && can('inventory.adjust') && (
            <div className="flex items-end">
              <Button className="w-full" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>
                {t('inventory.add_supply')}
              </Button>
            </div>
          )}
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
      {adding && <AddSupplyDialog onClose={() => setAdding(false)} />}
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

/**
 * Add something you use but don't sell (milk powder packet, cups, syrup…): created as an ingredient /
 * supply item that is tracked in stock, hidden from the POS and the QR menu. It can be bought through
 * Purchases and consumed automatically through recipes.
 */
function AddSupplyDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const errMsg = useErrorMessage();
  const cats = useQuery({ queryKey: ['biz', 'categories'], queryFn: () => api.get<{ items: { id: string; name: string }[] }>('/categories') });
  const [form, setForm] = useState({ name: '', unit: 'pkt', costPrice: '', openingStock: '', totalPaid: '', minStock: '', categoryId: '', sku: '' });
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  // Bulk buys: enter what was paid for the whole lot and the cost per unit is worked out (and the other way round).
  const round2 = (v: number) => String(Math.round(v * 100) / 100);
  const setCost = (field: 'costPrice' | 'openingStock' | 'totalPaid') => (e: { target: { value: string } }) =>
    setForm((f) => {
      const n = { ...f, [field]: e.target.value };
      const q = parseAmount(n.openingStock);
      if (field === 'totalPaid' || (field === 'openingStock' && f.totalPaid !== '' && f.costPrice === '')) {
        if (q > 0 && n.totalPaid !== '') n.costPrice = round2(parseAmount(n.totalPaid) / q);
      } else if (n.costPrice !== '' && q > 0) n.totalPaid = round2(parseAmount(n.costPrice) * q);
      return n;
    });
  const save = useMutation({
    mutationFn: async () => {
      const p = await api.post<{ id: string }>('/products', {
        name: form.name,
        sku: form.sku,
        type: 'ingredient',
        unit: form.unit || 'pcs',
        categoryId: form.categoryId || null,
        costPrice: parseAmount(form.costPrice),
        sellingPrice: 0,
        trackStock: true,
        minStock: parseAmount(form.minStock),
        showInPos: false,
        showInMenu: false,
        sendToKitchen: false,
        isActive: true,
      });
      const qty = parseAmount(form.openingStock);
      if (qty > 0) await api.post('/inventory/adjust', { productId: p.id, mode: 'add', quantity: qty, reason: t('inventory.opening_stock') });
      return p;
    },
    onSuccess: () => {
      toast.success(t('inventory.supply_added'));
      void qc.invalidateQueries({ queryKey: ['biz', 'inventory'] });
      void qc.invalidateQueries({ queryKey: ['biz', 'products'] });
      onClose();
    },
  });
  return (
    <Dialog
      open
      onClose={onClose}
      title={t('inventory.add_supply')}
      description={t('inventory.add_supply_hint')}
      footer={
        <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!form.name.trim()}>
          {t('common.save')}
        </Button>
      }
    >
      <div className="space-y-4">
        {save.error && <Alert tone="red">{errMsg(save.error)}</Alert>}
        <Input label={t('common.name')} placeholder={t('inventory.supply_placeholder')} value={form.name} onChange={set('name')} autoFocus />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Input label={t('products.unit')} value={form.unit} onChange={set('unit')} list="supply-units" />
            <datalist id="supply-units">
              {['pkt', 'pcs', 'kg', 'g', 'L', 'ml', 'box', 'bottle', 'can', 'bag', 'tray'].map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </div>
          <Input type="number" min={0} step="0.001" label={t('inventory.opening_stock')} value={form.openingStock} onChange={setCost('openingStock')} />
          <Input type="number" min={0} step="0.01" label={t('inventory.cost_per_unit')} value={form.costPrice} onChange={setCost('costPrice')} />
          <Input type="number" min={0} step="0.01" label={t('inventory.total_paid')} hint={t('inventory.total_paid_hint')} value={form.totalPaid} onChange={setCost('totalPaid')} />
          <Input type="number" min={0} step="0.001" label={t('products.min_stock')} hint={t('inventory.min_stock_hint')} value={form.minStock} onChange={set('minStock')} />
          <Select label={t('categories.category')} value={form.categoryId} onChange={set('categoryId')}>
            <option value="">—</option>
            {cats.data?.items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Input label={t('products.sku')} dir="ltr" value={form.sku} onChange={set('sku')} />
        </div>
      </div>
    </Dialog>
  );
}
