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
import { CaseQtyInput, caseTotal, fmtCases } from '../../components/CaseQty';

interface Level {
  id: string;
  name: string;
  sku: string;
  unit: string;
  type: string;
  minStock: number;
  minStoreStock: number;
  costPrice: number;
  /** On the rack (shops) / the one stock figure (restaurants). */
  quantity: number;
  /** Shops: in the stock room. */
  storeQuantity: number;
  /** Shops: pieces per case; store stock is shown in cases. */
  packSize: number;
  low: boolean;
  storeLow: boolean;
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
  const session = useBizSession();
  const retail = !!session.business.profile.retail;
  const money = useMoney();
  const [low, setLow] = useState(false);
  // Shops: '' all, 'true' low on the rack, 'store' low in the stock room.
  const [shopLow, setShopLow] = useState<'' | 'true' | 'store'>('');
  const [adjusting, setAdjusting] = useState<Level | null>(null);
  const [refilling, setRefilling] = useState<Level | null>(null);
  const [kind, setKind] = useState<'' | 'selling' | 'supplies'>('');
  const [adding, setAdding] = useState(false);
  const { query, page, setPage, search, setSearch, pageSize } = useList<Level>('inventory', '/inventory', {
    low: retail ? shopLow || undefined : low ? 'true' : undefined,
    kind: retail ? undefined : kind || undefined,
  });
  const qtyBadge = (q: number, isLow: boolean, unit: string) => <Badge tone={q <= 0 ? 'red' : isLow ? 'amber' : 'green'}>{`${q} ${unit}`}</Badge>;
  const shopColumns: Column<Level>[] = [
    {
      key: 'n',
      header: t('common.name'),
      cell: (l) => (
        <div>
          <p className="font-medium" dir="auto">
            {l.name}
          </p>
          {l.sku && (
            <p className="text-xs text-slate-500">
              <Ltr>{l.sku}</Ltr>
            </p>
          )}
        </div>
      ),
    },
    { key: 'val', header: t('inventory.value'), hideOnMobile: true, cell: (l) => money(Math.round((Math.max(0, l.quantity) + Math.max(0, l.storeQuantity)) * l.costPrice)) },
    {
      key: 'rack',
      header: t('inventory.on_rack'),
      cell: (l) => (
        <div>
          {qtyBadge(l.quantity, l.low, l.unit)}
          {l.minStock > 0 && <p className="mt-0.5 text-[11px] text-slate-500">{t('inventory.alert_at', { n: l.minStock })}</p>}
        </div>
      ),
    },
    {
      key: 'store',
      header: t('inventory.in_store'),
      cell: (l) => (
        <div>
          <Badge tone={l.storeQuantity <= 0 ? 'red' : l.storeLow && l.minStoreStock > 0 ? 'amber' : 'green'}>{fmtCases(t, l.storeQuantity, l.packSize, l.unit)}</Badge>
          {l.minStoreStock > 0 && <p className="mt-0.5 text-[11px] text-slate-500">{t('inventory.alert_at', { n: fmtCases(t, l.minStoreStock, l.packSize, l.unit) })}</p>}
        </div>
      ),
    },
    {
      key: 'act',
      header: '',
      className: 'text-end',
      cell: (l) =>
        can('inventory.adjust') && (
          <Button
            size="sm"
            variant={l.low && l.storeQuantity > 0 ? 'primary' : 'secondary'}
            disabled={l.storeQuantity <= 0}
            onClick={(e) => {
              e.stopPropagation();
              setRefilling(l);
            }}
          >
            {t('inventory.refill')}
          </Button>
        ),
    },
  ];
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
          {retail ? (
            <Select label={t('inventory.show')} value={shopLow} onChange={(e) => setShopLow(e.target.value as typeof shopLow)}>
              <option value="">{t('common.all')}</option>
              <option value="true">{t('inventory.low_on_rack')}</option>
              <option value="store">{t('inventory.low_in_store')}</option>
            </Select>
          ) : (
            <>
              <Select label={t('inventory.show')} value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
                <option value="">{t('common.all')}</option>
                <option value="selling">{t('inventory.kinds.selling')}</option>
                <option value="supplies">{t('inventory.kinds.supplies')}</option>
              </Select>
              <div className="flex items-end">
                <Checkbox checked={low} onChange={setLow} label={t('inventory.low_only')} />
              </div>
            </>
          )}
          {can('products.create') && can('inventory.adjust') && (
            <div className="flex items-end">
              <Button className="w-full" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>
                {retail ? t('inventory.add_shop_product') : t('inventory.add_supply')}
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
            <DataTable columns={retail ? shopColumns : columns} rows={query.data.items} rowKey={(l) => l.id} onRowClick={can('inventory.adjust') ? setAdjusting : undefined} />
            <Pagination page={page} pageSize={pageSize} total={query.data.total} onPage={setPage} />
          </>
        )}
      </Card>
      {adjusting && <AdjustDialog level={adjusting} retail={retail} onClose={() => setAdjusting(null)} />}
      {refilling && <RefillDialog level={refilling} onClose={() => setRefilling(null)} />}
      {adding && (retail ? <AddShopProductDialog onClose={() => setAdding(false)} /> : <AddSupplyDialog onClose={() => setAdding(false)} />)}
    </>
  );
}

function AdjustDialog({ level, retail, onClose }: { level: Level; retail: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const errMsg = useErrorMessage();
  const [form, setForm] = useState({ mode: 'add', quantity: '', reason: '', location: retail ? 'store' : 'shop' });
  const [cases, setCases] = useState('');
  // Shops count the store in cases (+ loose pieces); the rack and everything else in pieces.
  const inCases = retail && form.location === 'store' && level.packSize > 1;
  const qty = inCases ? caseTotal(cases, form.quantity, level.packSize) : parseAmount(form.quantity);
  const m = useMutation({
    mutationFn: () => api.post<{ balance: number }>('/inventory/adjust', { productId: level.id, mode: form.mode, quantity: qty, reason: form.reason, location: form.location }),
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
          {level.name} —{' '}
          {retail ? (
            <>
              {t('inventory.on_rack')}: <Ltr>{`${level.quantity} ${level.unit}`}</Ltr> · {t('inventory.in_store')}: <Ltr>{fmtCases(t, level.storeQuantity, level.packSize, level.unit)}</Ltr>
            </>
          ) : (
            <>
              {t('inventory.current')}: <Ltr>{`${level.quantity} ${level.unit}`}</Ltr>
            </>
          )}
        </span>
      }
      footer={
        <Button onClick={() => m.mutate()} loading={m.isPending} disabled={inCases ? !(qty > 0) && form.mode !== 'set' : form.quantity === ''}>
          {t('common.save')}
        </Button>
      }
    >
      <div className="space-y-4">
        {m.error && <Alert tone="red">{errMsg(m.error)}</Alert>}
        {retail && (
          <Select label={t('inventory.location')} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}>
            <option value="store">{t('inventory.in_store')}</option>
            <option value="shop">{t('inventory.on_rack')}</option>
          </Select>
        )}
        <Select label={t('inventory.mode')} value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
          {['add', 'remove', 'set', 'wastage'].map((x) => (
            <option key={x} value={x}>
              {t(`inventory.modes.${x}`)}
            </option>
          ))}
        </Select>
        {inCases ? (
          <CaseQtyInput packSize={level.packSize} unit={level.unit} cases={cases} pieces={form.quantity} onChange={(c, p) => (setCases(c), setForm({ ...form, quantity: p }))} />
        ) : (
          <Input type="number" min={0} step="0.001" label={t('documents.quantity')} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
        )}
        <Textarea label={t('inventory.reason')} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
      </div>
    </Dialog>
  );
}

/** Shops: open cases from the store and put the pieces on the rack. */
function RefillDialog({ level, onClose }: { level: Level; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const errMsg = useErrorMessage();
  const ps = level.packSize > 1 ? level.packSize : 1;
  // Suggest one case (or enough pieces to reach twice the alert level), limited by what the store has.
  const [cases, setCases] = useState(ps > 1 ? (level.storeQuantity >= ps ? '1' : '0') : '');
  const [pieces, setPieces] = useState(ps > 1 ? (level.storeQuantity >= ps ? '' : String(level.storeQuantity)) : String(Math.max(0, Math.min(level.storeQuantity, Math.max(level.minStock * 2 - level.quantity, 1)))));
  const qty = ps > 1 ? caseTotal(cases, pieces, ps) : parseAmount(pieces);
  const m = useMutation({
    mutationFn: () => api.post<{ shop: number; store: number }>('/inventory/refill', { productId: level.id, quantity: qty, note: '' }),
    onSuccess: (r) => {
      toast.success(t('inventory.refilled_cases', { shop: `${r.shop} ${level.unit}`, store: fmtCases(t, r.store, ps, level.unit) }));
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
      title={t('inventory.refill_title')}
      description={
        <span dir="auto">
          {level.name} — {t('inventory.on_rack')}: <Ltr>{`${level.quantity} ${level.unit}`}</Ltr> · {t('inventory.in_store')}: <Ltr>{fmtCases(t, level.storeQuantity, ps, level.unit)}</Ltr>
        </span>
      }
      footer={
        <Button onClick={() => m.mutate()} loading={m.isPending} disabled={!(qty > 0) || qty > level.storeQuantity}>
          {t('inventory.refill')}
        </Button>
      }
    >
      <div className="space-y-4">
        {m.error && <Alert tone="red">{errMsg(m.error)}</Alert>}
        {ps > 1 ? (
          <CaseQtyInput packSize={ps} unit={level.unit} cases={cases} pieces={pieces} casesLabel={t('inventory.cases_to_open')} onChange={(c, p) => (setCases(c), setPieces(p))} />
        ) : (
          <Input type="number" min={0} max={level.storeQuantity} step="0.001" label={t('inventory.refill_qty')} value={pieces} onChange={(e) => setPieces(e.target.value)} autoFocus />
        )}
        <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm dark:bg-slate-800/50">
          {t('inventory.refill_result', { rack: `${level.quantity + qty} ${level.unit}`, store: fmtCases(t, Math.max(0, level.storeQuantity - qty), ps, level.unit) })}
        </p>
      </div>
    </Dialog>
  );
}

/** Shops: a product for sale, with its barcode, prices, opening stock in the store and on the rack, and both alert levels. */
function AddShopProductDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const errMsg = useErrorMessage();
  const cats = useQuery({ queryKey: ['biz', 'categories'], queryFn: () => api.get<{ items: { id: string; name: string }[] }>('/categories') });
  const [form, setForm] = useState({ name: '', sku: '', unit: 'pcs', costPrice: '', sellingPrice: '', packSize: '1', storeCases: '', store: '', rack: '', minStock: '5', minStoreStock: '', categoryId: '' });
  const ps = Math.max(1, parseAmount(form.packSize) || 1);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const save = useMutation({
    mutationFn: async () => {
      const p = await api.post<{ id: string }>('/products', {
        name: form.name,
        sku: form.sku,
        type: 'item',
        unit: form.unit || 'pcs',
        categoryId: form.categoryId || null,
        costPrice: parseAmount(form.costPrice),
        sellingPrice: parseAmount(form.sellingPrice),
        trackStock: true,
        minStock: parseAmount(form.minStock),
        // The store alert is entered in cases.
        minStoreStock: parseAmount(form.minStoreStock) * ps,
        packSize: ps,
        showInPos: true,
        showInMenu: false,
        sendToKitchen: false,
        isActive: true,
      });
      const store = caseTotal(form.storeCases, form.store, ps);
      const rack = parseAmount(form.rack);
      if (store > 0) await api.post('/inventory/adjust', { productId: p.id, mode: 'add', quantity: store, reason: t('inventory.opening_stock'), location: 'store' });
      if (rack > 0) await api.post('/inventory/adjust', { productId: p.id, mode: 'add', quantity: rack, reason: t('inventory.opening_stock'), location: 'shop' });
      return p;
    },
    onSuccess: () => {
      toast.success(t('common.saved'));
      void qc.invalidateQueries({ queryKey: ['biz', 'inventory'] });
      void qc.invalidateQueries({ queryKey: ['biz', 'products'] });
      void qc.invalidateQueries({ queryKey: ['biz', 'pos'] });
      onClose();
    },
  });
  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={t('inventory.add_shop_product')}
      description={t('inventory.add_shop_product_hint')}
      footer={
        <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!form.name.trim() || form.sellingPrice === ''}>
          {t('common.save')}
        </Button>
      }
    >
      <div className="space-y-4">
        {save.error && <Alert tone="red">{errMsg(save.error)}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label={t('common.name')} value={form.name} onChange={set('name')} autoFocus required />
          <Input label={t('inventory.barcode')} dir="ltr" value={form.sku} onChange={set('sku')} hint={t('inventory.barcode_hint')} />
          <Input type="number" min={0} step="0.01" label={t('products.selling_price')} value={form.sellingPrice} onChange={set('sellingPrice')} required />
          <Input type="number" min={0} step="0.01" label={t('products.cost_price')} value={form.costPrice} onChange={set('costPrice')} />
          <Input label={t('products.unit')} value={form.unit} onChange={set('unit')} />
          <Select label={t('categories.category')} value={form.categoryId} onChange={set('categoryId')}>
            <option value="">—</option>
            {cats.data?.items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2 dark:bg-slate-800/40">
          <Input type="number" min={1} step="1" label={t('inventory.pack_size')} hint={t('inventory.pack_size_hint')} value={form.packSize} onChange={set('packSize')} />
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-sm font-medium">{t('inventory.opening_store')}</p>
            {ps > 1 ? (
              <CaseQtyInput packSize={ps} unit={form.unit || 'pcs'} cases={form.storeCases} pieces={form.store} onChange={(c, p) => setForm((f) => ({ ...f, storeCases: c, store: p }))} />
            ) : (
              <Input type="number" min={0} step="0.001" aria-label={t('inventory.opening_store')} value={form.store} onChange={set('store')} />
            )}
          </div>
          <Input type="number" min={0} step="0.001" label={t('inventory.opening_rack')} value={form.rack} onChange={set('rack')} />
          <Input type="number" min={0} step="0.001" label={t('inventory.rack_alert')} hint={t('inventory.rack_alert_hint')} value={form.minStock} onChange={set('minStock')} />
          <Input
            type="number"
            min={0}
            step="1"
            label={ps > 1 ? t('inventory.store_alert_cases') : t('inventory.store_alert')}
            hint={t('inventory.store_alert_hint')}
            value={form.minStoreStock}
            onChange={set('minStoreStock')}
          />
        </div>
      </div>
    </Dialog>
  );
}

interface Txn {
  id: string;
  location?: 'shop' | 'store';
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
  const retail = !!useBizSession().business.profile.retail;
  const { query, page, setPage, pageSize } = useList<Txn>('inventory-history', '/inventory/history', { type });
  const columns: Column<Txn>[] = [
    { key: 'd', header: t('common.date'), cell: (x) => f.dateTime(x.createdAt) },
    { key: 'p', header: t('products.item'), cell: (x) => <span dir="auto">{x.productName}</span> },
    {
      key: 't',
      header: t('inventory.movement'),
      cell: (x) => (
        <span className="inline-flex flex-wrap items-center gap-1">
          <Badge>{t(`inventory.types.${x.type}`)}</Badge>
          {/* Shops: which place the movement touched. */}
          {retail && <Badge tone={x.location === 'store' ? 'violet' : 'blue'}>{x.location === 'store' ? t('inventory.in_store') : t('inventory.on_rack')}</Badge>}
        </span>
      ),
    },
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
          {['sale', 'sale_void', ...(retail ? ['refill'] : ['recipe']), 'purchase', 'adjustment', 'wastage', 'count', 'transfer_in', 'transfer_out'].map((x) => (
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
