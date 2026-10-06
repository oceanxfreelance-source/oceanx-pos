import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ImagePlus, Pencil, Plus, Tags, Trash2, UtensilsCrossed } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { useBiz, useBizSession } from '../../auth/business';
import { parseAmount, useMoney } from '../../lib/money';
import { useList } from '../../lib/useList';
import { useErrorMessage, useFieldErrors, useToastError } from '../../lib/useApiError';
import { Alert, Badge, Card, EmptyState, Ltr, PageHeader, SkeletonRows } from '../../components/ui/Card';
import { Button, IconButton } from '../../components/ui/Button';
import { Checkbox, Input, Select, Switch, Textarea } from '../../components/ui/Form';
import { ConfirmDialog, Dialog } from '../../components/ui/Dialog';
import { DataTable, Pagination, type Column } from '../../components/ui/Table';
import { Tabs } from '../../components/ui/Tabs';
import { ListToolbar } from '../../components/ListToolbar';
import { ProductPicker } from '../../components/Pickers';

interface Category {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
  kitchenStation: string;
  productCount: number;
}
interface Product {
  id: string;
  name: string;
  sku: string;
  categoryId: string | null;
  categoryName: string | null;
  description: string;
  unit: string;
  type: 'item' | 'ingredient' | 'service';
  costPrice: number;
  sellingPrice: number;
  taxRate: number | null;
  trackStock: boolean;
  minStock: number;
  isActive: boolean;
  showInPos: boolean;
  showInMenu: boolean;
  sendToKitchen: boolean;
  options: { name: string; required: boolean; multiple: boolean; choices: { name: string; price: number }[] }[];
  imagePath: string | null;
  stock: number | null;
}

export default function ProductsPage() {
  const { t } = useTranslation();
  const session = useBizSession();
  const { can } = useBiz();
  const [tab, setTab] = useState<'products' | 'categories'>('products');
  return (
    <div className="space-y-6">
      <PageHeader title={t(session.business.profile.productsLabelKey)} description={t('products.subtitle')} />
      {can('categories.view') && (
        <Tabs
          tabs={[
            { value: 'products', label: t('products.items') },
            { value: 'categories', label: t('categories.title') },
          ]}
          value={tab}
          onChange={setTab}
        />
      )}
      {tab === 'products' ? <ProductList /> : <CategoryList />}
    </div>
  );
}

function useCategories() {
  return useQuery({ queryKey: ['biz', 'categories'], queryFn: () => api.get<{ items: Category[] }>('/categories') });
}

function ProductList() {
  const { t } = useTranslation();
  const { can } = useBiz();
  const money = useMoney();
  const cats = useCategories();
  const [categoryId, setCategoryId] = useState('');
  const [type, setType] = useState('');
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const qc = useQueryClient();
  const toastErr = useToastError();
  const { query, page, setPage, search, setSearch, pageSize } = useList<Product>('products', '/products', { categoryId, type });
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => {
      toast.success(t('products.deleted'));
      setDeleting(null);
      void qc.invalidateQueries({ queryKey: ['biz', 'products'] });
    },
    onError: toastErr,
  });
  const columns: Column<Product>[] = [
    {
      key: 'n',
      header: t('common.name'),
      cell: (p) => (
        <div className="flex items-center gap-3">
          {p.imagePath ? <img src={`/api/products/${p.id}/image`} alt="" className="hidden size-10 rounded-lg object-cover sm:block" /> : <span className="hidden size-10 rounded-lg bg-slate-100 sm:block dark:bg-slate-800" />}
          <div className="min-w-0">
            <p className="truncate font-medium" dir="auto">
              {p.name} {!p.isActive && <Badge>{t('common.inactive')}</Badge>}
            </p>
            <p className="text-xs text-slate-500">
              {p.sku && <Ltr>{p.sku}</Ltr>} {p.categoryName && <span dir="auto">· {p.categoryName}</span>}
            </p>
          </div>
        </div>
      ),
    },
    { key: 'type', header: t('products.type'), hideOnMobile: true, cell: (p) => t(`products.types.${p.type}`) },
    { key: 'stock', header: t('inventory.stock'), hideOnMobile: true, cell: (p) => (p.trackStock ? <Badge tone={(p.stock ?? 0) <= p.minStock ? 'red' : 'gray'}>{`${p.stock ?? 0} ${p.unit}`}</Badge> : '—') },
    { key: 'cost', header: t('products.cost_price'), hideOnMobile: true, cell: (p) => <span className="tabular-nums">{money(p.costPrice)}</span> },
    { key: 'price', header: t('products.selling_price'), className: 'text-end', cell: (p) => <span className="font-semibold tabular-nums">{money(p.sellingPrice)}</span> },
    {
      key: 'a',
      header: <span className="sr-only">{t('common.actions')}</span>,
      className: 'text-end',
      cell: (p) => (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          {can('products.delete') && (
            <IconButton label={t('common.delete')} onClick={() => setDeleting(p)} className="hover:text-rose-600">
              <Trash2 className="size-4" />
            </IconButton>
          )}
        </div>
      ),
    },
  ];
  return (
    <Card padded={false}>
      <ListToolbar search={search} onSearch={setSearch} placeholder={t('products.search')}>
        <Select label={t('categories.category')} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">{t('common.all')}</option>
          {cats.data?.items.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select label={t('products.type')} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">{t('common.all')}</option>
          {['item', 'ingredient', 'service'].map((x) => (
            <option key={x} value={x}>
              {t(`products.types.${x}`)}
            </option>
          ))}
        </Select>
        {can('products.create') && (
          <div className="flex items-end">
            <Button className="w-full" icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
              {t('products.create')}
            </Button>
          </div>
        )}
      </ListToolbar>
      {query.isLoading ? (
        <SkeletonRows />
      ) : !query.data?.items.length ? (
        <EmptyState
          icon={<UtensilsCrossed className="size-6" />}
          title={t('products.empty_title')}
          description={t('products.empty_body')}
          action={
            can('products.create') && (
              <Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
                {t('products.create')}
              </Button>
            )
          }
        />
      ) : (
        <>
          <DataTable columns={columns} rows={query.data.items} rowKey={(p) => p.id} onRowClick={can('products.edit') ? (p) => setEditing(p) : undefined} />
          <Pagination page={page} pageSize={pageSize} total={query.data.total} onPage={setPage} />
        </>
      )}
      {editing && <ProductDialog product={editing === 'new' ? null : editing} categories={cats.data?.items ?? []} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && del.mutate(deleting.id)}
        loading={del.isPending}
        danger
        title={t('products.delete_title')}
        message={t('products.delete_body', { name: deleting?.name })}
        confirmLabel={t('common.delete')}
      />
    </Card>
  );
}

type OptionDraft = { name: string; required: boolean; multiple: boolean; choices: { name: string; price: string }[] };

function ProductDialog({ product, categories, onClose }: { product: Product | null; categories: Category[]; onClose: () => void }) {
  const { t } = useTranslation();
  const { can, hasAddon } = useBiz();
  const qc = useQueryClient();
  const errMsg = useErrorMessage();
  const toastErr = useToastError();
  const [tab, setTab] = useState<'details' | 'options' | 'recipe'>('details');
  const [form, setForm] = useState({
    name: product?.name ?? '',
    sku: product?.sku ?? '',
    categoryId: product?.categoryId ?? '',
    description: product?.description ?? '',
    unit: product?.unit ?? 'pcs',
    type: product?.type ?? 'item',
    costPrice: product ? (product.costPrice / 100).toString() : '',
    sellingPrice: product ? (product.sellingPrice / 100).toString() : '',
    taxRate: product?.taxRate === null || product?.taxRate === undefined ? '' : String(product.taxRate),
    trackStock: product?.trackStock ?? false,
    minStock: String(product?.minStock ?? 0),
    isActive: product?.isActive ?? true,
    showInPos: product?.showInPos ?? true,
    showInMenu: product?.showInMenu ?? true,
    sendToKitchen: product?.sendToKitchen ?? true,
  });
  const [options, setOptions] = useState<OptionDraft[]>(product?.options.map((g) => ({ ...g, choices: g.choices.map((c) => ({ name: c.name, price: (c.price / 100).toString() })) })) ?? []);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const save = useMutation({
    mutationFn: async () => {
      const body = {
        ...form,
        categoryId: form.categoryId || null,
        costPrice: parseAmount(form.costPrice),
        sellingPrice: parseAmount(form.sellingPrice),
        taxRate: form.taxRate === '' ? null : parseAmount(form.taxRate),
        minStock: parseAmount(form.minStock),
        options: options.map((g) => ({ ...g, choices: g.choices.filter((c) => c.name.trim()).map((c) => ({ name: c.name, price: parseAmount(c.price) })) })).filter((g) => g.name.trim() && g.choices.length),
      };
      return product ? api.put<Product>(`/products/${product.id}`, body) : api.post<Product>('/products', body);
    },
    onSuccess: () => {
      toast.success(t('common.saved'));
      void qc.invalidateQueries({ queryKey: ['biz', 'products'] });
      void qc.invalidateQueries({ queryKey: ['biz', 'pos'] });
      onClose();
    },
  });
  const upload = useMutation({
    mutationFn: (file: File) => api.upload(`/products/${product!.id}/image`, file),
    onSuccess: () => {
      toast.success(t('products.image_updated'));
      void qc.invalidateQueries({ queryKey: ['biz', 'products'] });
    },
    onError: toastErr,
  });
  const fieldErr = useFieldErrors(save.error);
  const tabs: { value: 'details' | 'options' | 'recipe'; label: string }[] = [
    { value: 'details', label: t('products.details') },
    { value: 'options', label: t('products.options') },
  ];
  if (product && hasAddon('recipes') && can('recipes.view')) tabs.push({ value: 'recipe', label: t('products.recipe') });

  return (
    <Dialog
      open
      onClose={onClose}
      size="xl"
      title={product ? t('products.edit') : t('products.create')}
      footer={
        tab !== 'recipe' && (
          <>
            <Button variant="secondary" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!form.name.trim()}>
              {t('common.save')}
            </Button>
          </>
        )
      }
    >
      <div className="space-y-5">
        <Tabs tabs={tabs} value={tab} onChange={setTab} />
        {save.error && !(save.error instanceof ApiError && save.error.code === 'validation_failed') && <Alert tone="red">{errMsg(save.error)}</Alert>}
        {tab === 'details' && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Input className="sm:col-span-2" label={t('common.name')} value={form.name} onChange={set('name')} error={fieldErr('name')} required />
              <Input label={t('products.sku')} value={form.sku} dir="ltr" onChange={set('sku')} error={fieldErr('sku')} />
              <Select label={t('categories.category')} value={form.categoryId} onChange={set('categoryId')}>
                <option value="">—</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <Select label={t('products.type')} value={form.type} onChange={set('type')}>
                {['item', 'ingredient', 'service'].map((x) => (
                  <option key={x} value={x}>
                    {t(`products.types.${x}`)}
                  </option>
                ))}
              </Select>
              <Input label={t('products.unit')} value={form.unit} onChange={set('unit')} error={fieldErr('unit')} />
              <Input type="number" step="0.01" min={0} label={t('products.selling_price')} value={form.sellingPrice} onChange={set('sellingPrice')} error={fieldErr('sellingPrice')} />
              <Input type="number" step="0.01" min={0} label={t('products.cost_price')} value={form.costPrice} onChange={set('costPrice')} error={fieldErr('costPrice')} />
              <Input type="number" step="0.01" min={0} max={100} label={t('products.tax_rate')} placeholder={t('products.tax_default')} value={form.taxRate} onChange={set('taxRate')} hint={t('products.tax_hint')} />
            </div>
            <Textarea label={t('common.description')} value={form.description} onChange={set('description')} />
            <div className="grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2 dark:bg-slate-800/40">
              <Switch checked={form.trackStock} onChange={(v) => setForm({ ...form, trackStock: v })} label={t('products.track_stock')} description={t('products.track_stock_hint')} />
              {form.trackStock && <Input type="number" min={0} step="0.001" label={t('products.min_stock')} value={form.minStock} onChange={set('minStock')} />}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Checkbox checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} label={t('common.active')} />
              <Checkbox checked={form.showInPos} onChange={(v) => setForm({ ...form, showInPos: v })} label={t('products.show_in_pos')} />
              <Checkbox checked={form.sendToKitchen} onChange={(v) => setForm({ ...form, sendToKitchen: v })} label={t('products.send_to_kitchen')} />
              {hasAddon('qr_menu') && <Checkbox checked={form.showInMenu} onChange={(v) => setForm({ ...form, showInMenu: v })} label={t('products.show_in_menu')} />}
            </div>
            {product && can('products.edit') && (
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-brand-700 ring-1 ring-slate-200 hover:bg-slate-50 dark:text-brand-300 dark:ring-slate-700">
                <ImagePlus className="size-4" />
                {t('products.upload_image')}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])} />
              </label>
            )}
          </div>
        )}
        {tab === 'options' && <OptionsEditor value={options} onChange={setOptions} />}
        {tab === 'recipe' && product && <RecipeEditor productId={product.id} canEdit={can('recipes.manage')} />}
      </div>
    </Dialog>
  );
}

function OptionsEditor({ value, onChange }: { value: OptionDraft[]; onChange: (v: OptionDraft[]) => void }) {
  const { t } = useTranslation();
  const upd = (i: number, patch: Partial<OptionDraft>) => onChange(value.map((g, j) => (j === i ? { ...g, ...patch } : g)));
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">{t('products.options_hint')}</p>
      {value.map((g, i) => (
        <div key={i} className="space-y-3 rounded-xl p-4 ring-1 ring-slate-200 dark:ring-slate-700">
          <div className="flex flex-wrap items-end gap-3">
            <Input className="min-w-40 flex-1" label={t('products.option_group')} placeholder={t('products.option_group_placeholder')} value={g.name} onChange={(e) => upd(i, { name: e.target.value })} />
            <Checkbox checked={g.required} onChange={(v) => upd(i, { required: v })} label={t('pos.required')} />
            <Checkbox checked={g.multiple} onChange={(v) => upd(i, { multiple: v })} label={t('products.multiple')} />
            <IconButton label={t('common.delete')} onClick={() => onChange(value.filter((_, j) => j !== i))}>
              <Trash2 className="size-4" />
            </IconButton>
          </div>
          {g.choices.map((c, ci) => (
            <div key={ci} className="flex items-end gap-2">
              <Input className="flex-1" label={ci === 0 ? t('products.choice') : undefined} value={c.name} onChange={(e) => upd(i, { choices: g.choices.map((x, k) => (k === ci ? { ...x, name: e.target.value } : x)) })} />
              <Input className="w-32" type="number" step="0.01" min={0} label={ci === 0 ? t('products.extra_price') : undefined} value={c.price} onChange={(e) => upd(i, { choices: g.choices.map((x, k) => (k === ci ? { ...x, price: e.target.value } : x)) })} />
              <IconButton label={t('common.delete')} onClick={() => upd(i, { choices: g.choices.filter((_, k) => k !== ci) })}>
                <Trash2 className="size-4" />
              </IconButton>
            </div>
          ))}
          <Button size="sm" variant="ghost" icon={<Plus className="size-4" />} onClick={() => upd(i, { choices: [...g.choices, { name: '', price: '0' }] })}>
            {t('products.add_choice')}
          </Button>
        </div>
      ))}
      <Button variant="subtle" icon={<Plus className="size-4" />} onClick={() => onChange([...value, { name: '', required: false, multiple: false, choices: [{ name: '', price: '0' }] }])}>
        {t('products.add_option_group')}
      </Button>
    </div>
  );
}

function RecipeEditor({ productId, canEdit }: { productId: string; canEdit: boolean }) {
  const { t } = useTranslation();
  const money = useMoney();
  const qc = useQueryClient();
  const toastErr = useToastError();
  const q = useQuery({ queryKey: ['biz', 'product', productId], queryFn: () => api.get<{ recipe: { ingredientId: string; quantity: number; name: string; unit: string; costPrice: number }[] }>(`/products/${productId}`) });
  const [items, setItems] = useState<{ ingredientId: string; name: string; unit: string; quantity: string; costPrice: number }[] | null>(null);
  const rows = items ?? q.data?.recipe.map((r) => ({ ingredientId: r.ingredientId, name: r.name, unit: r.unit, quantity: String(r.quantity), costPrice: r.costPrice })) ?? [];
  const save = useMutation({
    mutationFn: () => api.put(`/products/${productId}/recipe`, { items: rows.map((r) => ({ ingredientId: r.ingredientId, quantity: parseAmount(r.quantity) })) }),
    onSuccess: () => {
      toast.success(t('common.saved'));
      void qc.invalidateQueries({ queryKey: ['biz', 'product', productId] });
    },
    onError: toastErr,
  });
  const cost = rows.reduce((a, r) => a + Math.round(r.costPrice * parseAmount(r.quantity)), 0);
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">{t('products.recipe_hint')}</p>
      <ul className="space-y-2">
        {rows.map((r, i) => (
          <li key={r.ingredientId} className="flex items-end gap-2">
            <span className="flex-1 truncate py-2.5 text-sm font-medium" dir="auto">
              {r.name}
            </span>
            <Input className="w-32" type="number" step="0.001" min={0} label={i === 0 ? r.unit || t('products.quantity') : undefined} value={r.quantity} disabled={!canEdit} onChange={(e) => setItems(rows.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} />
            {canEdit && (
              <IconButton label={t('common.delete')} onClick={() => setItems(rows.filter((_, j) => j !== i))}>
                <Trash2 className="size-4" />
              </IconButton>
            )}
          </li>
        ))}
      </ul>
      {canEdit && (
        <ProductPicker
          type="ingredient"
          value={null}
          placeholder={t('products.add_ingredient')}
          onChange={(_id, p) => p && !rows.some((r) => r.ingredientId === p.id) && setItems([...rows, { ingredientId: p.id, name: p.name, unit: p.unit, quantity: '1', costPrice: p.costPrice }])}
        />
      )}
      <p className="text-sm">
        {t('products.recipe_cost')}: <span className="font-semibold">{money(cost)}</span>
      </p>
      {canEdit && (
        <Button onClick={() => save.mutate()} loading={save.isPending}>
          {t('products.save_recipe')}
        </Button>
      )}
    </div>
  );
}

function CategoryList() {
  const { t } = useTranslation();
  const { can, hasAddon } = useBiz();
  const qc = useQueryClient();
  const toastErr = useToastError();
  const cats = useCategories();
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const [form, setForm] = useState({ name: '', description: '', sortOrder: '0', isActive: true, kitchenStation: '' });
  const open = (c: Category | 'new') => {
    setEditing(c);
    setForm(c === 'new' ? { name: '', description: '', sortOrder: '0', isActive: true, kitchenStation: '' } : { name: c.name, description: c.description, sortOrder: String(c.sortOrder), isActive: c.isActive, kitchenStation: c.kitchenStation });
  };
  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, sortOrder: Math.floor(parseAmount(form.sortOrder)) };
      return editing === 'new' ? api.post('/categories', body) : api.patch(`/categories/${(editing as Category).id}`, body);
    },
    onSuccess: () => {
      toast.success(t('common.saved'));
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ['biz', 'categories'] });
    },
    onError: toastErr,
  });
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/categories/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['biz', 'categories'] }),
    onError: toastErr,
  });
  return (
    <Card padded={false}>
      {can('categories.manage') && (
        <div className="flex justify-end border-b border-slate-100 p-4 dark:border-slate-800">
          <Button size="sm" icon={<Plus className="size-4" />} onClick={() => open('new')}>
            {t('categories.create')}
          </Button>
        </div>
      )}
      {cats.isLoading ? (
        <SkeletonRows />
      ) : !cats.data?.items.length ? (
        <EmptyState icon={<Tags className="size-6" />} title={t('categories.empty')} />
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {cats.data.items.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="font-medium" dir="auto">
                  {c.name} {!c.isActive && <Badge>{t('common.inactive')}</Badge>}
                </p>
                <p className="text-xs text-slate-500">
                  {t('categories.product_count', { count: c.productCount })}
                  {c.kitchenStation && ` · ${t('categories.station')}: ${c.kitchenStation}`}
                </p>
              </div>
              {can('categories.manage') && (
                <div className="flex gap-1">
                  <IconButton label={t('common.edit')} onClick={() => open(c)}>
                    <Pencil className="size-4" />
                  </IconButton>
                  <IconButton label={t('common.delete')} onClick={() => del.mutate(c.id)} className="hover:text-rose-600">
                    <Trash2 className="size-4" />
                  </IconButton>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <Dialog
        open={!!editing}
        onClose={() => setEditing(null)}
        size="sm"
        title={editing === 'new' ? t('categories.create') : t('categories.edit')}
        footer={
          <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!form.name.trim()}>
            {t('common.save')}
          </Button>
        }
      >
        <div className="space-y-4">
          <Input label={t('common.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input type="number" label={t('categories.sort_order')} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
          {hasAddon('advanced_kitchen') && <Input label={t('categories.station')} hint={t('categories.station_hint')} value={form.kitchenStation} onChange={(e) => setForm({ ...form, kitchenStation: e.target.value })} />}
          <Switch checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} label={t('common.active')} />
        </div>
      </Dialog>
    </Card>
  );
}
