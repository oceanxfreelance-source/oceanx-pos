import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import clsx from 'clsx';
import { ArrowLeft, CheckCircle2, ClipboardList, Minus, PauseCircle, Plus, Printer, Search, ShoppingCart, SlidersHorizontal, Trash2, User, X } from 'lucide-react';
import { ItemAvatar, tintAt, tintFor } from '../../components/ItemAvatar';
import type { OptionGroup } from '@oceanx/shared';
import { api, ApiError } from '../../lib/api';
import { useBiz, useBizSession } from '../../auth/business';
import { parseAmount, useMoney } from '../../lib/money';
import { useErrorMessage } from '../../lib/useApiError';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Input, Select, Textarea } from '../../components/ui/Form';
import { Alert, Badge } from '../../components/ui/Card';
import { CustomerPicker, type CustomerLite } from '../../components/Pickers';
import { FarumaWarning } from '../../components/FarumaWarning';

interface PosProduct {
  id: string;
  name: string;
  sku: string;
  categoryId: string | null;
  sellingPrice: number;
  trackStock: boolean;
  stock: number | null;
  hasImage: boolean;
  options: OptionGroup[];
}
interface CartLine {
  key: string;
  productId: string;
  name: string;
  quantity: number;
  options: { group: string; choice: string }[];
  discount: string;
  note: string;
}
interface Quote {
  lines: { total: number; discount: number }[];
  subtotal: number;
  discount: number;
  serviceCharge: number;
  tax: number;
  deliveryFee: number;
  total: number;
}
interface OpenOrder {
  id: string;
  total: number;
  tableId: string | null;
  tableName: string | null;
  customerId: string | null;
  customerName: string | null;
  orderType: string;
  source: string;
  createdAt: string;
  onlineCustomer: { name: string } | null;
}
interface Table {
  id: string;
  name: string;
  status: string;
  isActive: boolean;
}
type Method = 'cash' | 'card' | 'bank_transfer' | 'other' | 'credit';

let lineSeq = 0;

export default function PosPage() {
  const { t } = useTranslation();
  const session = useBizSession();
  const { can, hasAddon, hasModule } = useBiz();
  const money = useMoney();
  const qc = useQueryClient();
  const errMsg = useErrorMessage();
  const searchRef = useRef<HTMLInputElement>(null);

  const catalog = useQuery({ queryKey: ['biz', 'pos', 'catalog'], queryFn: () => api.get<{ categories: { id: string; name: string }[]; products: PosProduct[] }>('/pos/catalog'), staleTime: 60_000 });
  const catIndex = new Map((catalog.data?.categories ?? []).map((c, i) => [c.id, i]));
  const catTint = (id: string | null) => (id && catIndex.has(id) ? tintAt(catIndex.get(id)!) : tintFor('uncategorised'));
  const tables = useQuery({ queryKey: ['biz', 'tables'], queryFn: () => api.get<{ items: Table[] }>('/tables'), enabled: hasModule('tables') });
  const openOrders = useQuery({ queryKey: ['biz', 'pos', 'open'], queryFn: () => api.get<{ items: OpenOrder[] }>('/pos/open-orders'), refetchInterval: 20_000 });

  const [category, setCategory] = useState<string | 'all'>('all');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [orderType, setOrderType] = useState<'dine_in' | 'takeaway' | 'delivery'>(session.pos.defaultOrderType === 'delivery' && !hasAddon('delivery') ? 'takeaway' : session.pos.defaultOrderType);
  const [tableId, setTableId] = useState<string | null>(null);
  const [customer, setCustomer] = useState<CustomerLite | null>(null);
  const [discount, setDiscount] = useState('');
  const [note, setNote] = useState('');
  const [redeemPoints, setRedeemPoints] = useState('');
  const [delivery, setDelivery] = useState({ address: '', phone: '', fee: '' });
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [optionsFor, setOptionsFor] = useState<PosProduct | null>(null);
  const [paying, setPaying] = useState(false);
  const [completed, setCompleted] = useState<{ id: string; number: string; change: number; total: number } | null>(null);
  const [showOrders, setShowOrders] = useState(false);
  const [showCart, setShowCart] = useState(false);

  const products = useMemo(() => {
    const list = catalog.data?.products ?? [];
    const s = search.trim().toLowerCase();
    return list.filter((p) => (category === 'all' || p.categoryId === category) && (!s || p.name.toLowerCase().includes(s) || p.sku.toLowerCase() === s));
  }, [catalog.data, category, search]);

  const orderBody = useCallback(
    () => ({
      orderType,
      tableId: orderType === 'dine_in' ? tableId : null,
      customerId: customer?.id ?? null,
      items: cart.map((l) => ({ productId: l.productId, quantity: l.quantity, options: l.options, discount: parseAmount(l.discount), note: l.note })),
      discount: parseAmount(discount),
      note,
      redeemPoints: Math.floor(parseAmount(redeemPoints)),
      delivery: orderType === 'delivery' ? { address: delivery.address, phone: delivery.phone, fee: parseAmount(delivery.fee) } : null,
    }),
    [orderType, tableId, customer, cart, discount, note, redeemPoints, delivery],
  );

  // Authoritative totals from the server (debounced); shown instantly as the cart changes.
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  useEffect(() => {
    if (!cart.length) {
      setQuote(null);
      setQuoteError(null);
      return;
    }
    const id = setTimeout(async () => {
      try {
        setQuote(await api.post<Quote>('/pos/quote', orderBody()));
        setQuoteError(null);
      } catch (e) {
        setQuoteError(errMsg(e));
      }
    }, 120);
    return () => clearTimeout(id);
  }, [cart, orderBody, errMsg]);

  const reset = () => {
    setCart([]);
    setDiscount('');
    setNote('');
    setRedeemPoints('');
    setCustomer(null);
    setTableId(null);
    setEditingOrderId(null);
    setDelivery({ address: '', phone: '', fee: '' });
    setQuote(null);
    setTimeout(() => searchRef.current?.focus(), 0);
  };

  const add = (p: PosProduct, options: { group: string; choice: string }[] = []) => {
    setCart((c) => {
      const same = c.find((l) => l.productId === p.id && JSON.stringify(l.options) === JSON.stringify(options) && !l.note);
      if (same) return c.map((l) => (l === same ? { ...l, quantity: l.quantity + 1 } : l));
      return [...c, { key: `l${++lineSeq}`, productId: p.id, name: p.name, quantity: 1, options, discount: '', note: '' }];
    });
  };
  const onProduct = (p: PosProduct) => (p.options.length ? setOptionsFor(p) : add(p));
  const setQty = (key: string, q: number) => setCart((c) => (q <= 0 ? c.filter((l) => l.key !== key) : c.map((l) => (l.key === key ? { ...l, quantity: Math.round(q * 1000) / 1000 } : l))));

  const refreshAfterSale = () => {
    void qc.invalidateQueries({ queryKey: ['biz', 'pos'] });
    void qc.invalidateQueries({ queryKey: ['biz', 'tables'] });
    void qc.invalidateQueries({ queryKey: ['biz', 'sales'] });
  };

  const hold = useMutation({
    mutationFn: () => (editingOrderId ? api.put(`/pos/orders/${editingOrderId}`, orderBody()) : api.post('/pos/orders', orderBody())),
    onSuccess: () => {
      toast.success(t('pos.order_held'));
      refreshAfterSale();
      reset();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const loadOrder = async (o: OpenOrder) => {
    const detail = await api.get<{ items: { productId: string; nameSnapshot: string; quantity: number; options: { group: string; choice: string }[]; note: string; discount: number }[]; sale: { note: string; discount: number } }>(`/sales/${o.id}`);
    setCart(detail.items.map((i) => ({ key: `l${++lineSeq}`, productId: i.productId, name: i.nameSnapshot, quantity: Number(i.quantity), options: i.options.map((x) => ({ group: x.group, choice: x.choice })), discount: '', note: i.note })));
    setOrderType(o.orderType as 'dine_in');
    setTableId(o.tableId);
    setCustomer(o.customerId ? { id: o.customerId, name: o.customerName ?? '', phone: '', email: '' } : null);
    setNote(detail.sale.note);
    setEditingOrderId(o.id);
    setShowOrders(false);
  };

  // Keyboard: Enter in search adds the first match; Escape clears.
  const onSearchKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && products[0]) {
      onProduct(products[0]);
      setSearch('');
    }
    if (e.key === 'Escape') setSearch('');
  };

  const cartCount = cart.reduce((a, l) => a + l.quantity, 0);
  const canDiscount = can('pos.discount');
  const onlineCount = openOrders.data?.items.filter((o) => o.source === 'online').length ?? 0;

  const cartPanel = (
    <div className="flex h-full flex-col">
      <div className="space-y-3 border-b border-slate-200 p-4 dark:border-slate-800">
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800" role="radiogroup" aria-label={t('pos.order_type')}>
          {(['dine_in', 'takeaway', 'delivery'] as const)
            .filter((ot) => ot !== 'delivery' || (hasAddon('delivery') && can('delivery.manage')))
            .map((ot) => (
              <button
                key={ot}
                type="button"
                role="radio"
                aria-checked={orderType === ot}
                onClick={() => setOrderType(ot)}
                className={clsx('flex-1 rounded-lg px-2 py-2 text-sm font-medium', orderType === ot ? 'bg-white shadow-sm dark:bg-slate-900' : 'text-slate-500')}
              >
                {t(`pos.order_types.${ot}`)}
              </button>
            ))}
        </div>
        {orderType === 'dine_in' && hasModule('tables') && (
          <Select aria-label={t('pos.table')} value={tableId ?? ''} onChange={(e) => setTableId(e.target.value || null)}>
            <option value="">{t('pos.no_table')}</option>
            {tables.data?.items
              .filter((tb) => tb.isActive)
              .map((tb) => (
                <option key={tb.id} value={tb.id}>
                  {tb.name}
                  {tb.status === 'occupied' ? ` · ${t('status_labels.occupied')}` : ''}
                </option>
              ))}
          </Select>
        )}
        <CustomerPicker value={customer?.id ?? null} valueLabel={customer?.name} onChange={(_id, c) => setCustomer(c)} />
        {customer && hasAddon('loyalty') && (customer.loyaltyPoints ?? 0) > 0 && (
          <Input type="number" inputMode="numeric" label={t('pos.redeem_points', { points: customer.loyaltyPoints })} value={redeemPoints} onChange={(e) => setRedeemPoints(e.target.value)} />
        )}
        {orderType === 'delivery' && (
          <div className="grid gap-2">
            <Input label={t('pos.delivery_address')} value={delivery.address} onChange={(e) => setDelivery({ ...delivery, address: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <Input type="tel" label={t('common.phone')} value={delivery.phone} onChange={(e) => setDelivery({ ...delivery, phone: e.target.value })} />
              <Input type="number" step="0.01" min={0} label={t('pos.delivery_fee')} value={delivery.fee} onChange={(e) => setDelivery({ ...delivery, fee: e.target.value })} />
            </div>
          </div>
        )}
      </div>

      <ul className="flex-1 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800" aria-label={t('pos.cart')}>
        {cart.length === 0 && (
          <li className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-slate-400">
            <ShoppingCart className="size-10" />
            <p className="text-sm">{t('pos.cart_empty')}</p>
          </li>
        )}
        {cart.map((l, i) => (
          <li key={l.key} className="px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium" dir="auto">
                  {l.name}
                </p>
                {l.options.length > 0 && <p className="text-xs text-slate-500">{l.options.map((o) => o.choice).join(', ')}</p>}
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums">{quote?.lines[i] ? money(quote.lines[i]!.total) : '…'}</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button type="button" aria-label={t('pos.decrease')} onClick={() => setQty(l.key, l.quantity - 1)} className="flex size-9 items-center justify-center rounded-lg bg-slate-100 active:bg-slate-200 dark:bg-slate-800">
                <Minus className="size-4" />
              </button>
              <input
                aria-label={t('pos.quantity')}
                inputMode="decimal"
                value={l.quantity}
                onChange={(e) => setQty(l.key, parseAmount(e.target.value))}
                className="w-14 rounded-lg border-0 bg-transparent text-center font-semibold tabular-nums ring-1 ring-slate-200 dark:ring-slate-700"
              />
              <button type="button" aria-label={t('pos.increase')} onClick={() => setQty(l.key, l.quantity + 1)} className="flex size-9 items-center justify-center rounded-lg bg-slate-100 active:bg-slate-200 dark:bg-slate-800">
                <Plus className="size-4" />
              </button>
              {canDiscount && (
                <input
                  aria-label={t('pos.line_discount')}
                  placeholder={t('pos.discount_short')}
                  inputMode="decimal"
                  value={l.discount}
                  onChange={(e) => setCart((c) => c.map((x) => (x.key === l.key ? { ...x, discount: e.target.value } : x)))}
                  className="w-20 rounded-lg border-0 bg-transparent px-2 py-1.5 text-sm ring-1 ring-slate-200 dark:ring-slate-700"
                />
              )}
              <button type="button" aria-label={t('common.delete')} onClick={() => setQty(l.key, 0)} className="ms-auto rounded-lg p-2 text-slate-400 hover:text-rose-600">
                <Trash2 className="size-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="space-y-3 border-t border-slate-200 p-4 dark:border-slate-800">
        {canDiscount && cart.length > 0 && (
          <Input type="number" step="0.01" min={0} label={t('pos.order_discount')} value={discount} onChange={(e) => setDiscount(e.target.value)} />
        )}
        {cart.length > 0 && <Textarea rows={1} placeholder={t('pos.order_note')} value={note} onChange={(e) => setNote(e.target.value)} aria-label={t('pos.order_note')} />}
        {quoteError && <Alert tone="red">{quoteError}</Alert>}
        <dl className="space-y-1 text-sm">
          <Row label={t('documents.subtotal')} value={money(quote?.subtotal ?? 0)} />
          {!!quote?.discount && <Row label={t('documents.discount')} value={`− ${money(quote.discount)}`} />}
          {!!quote?.serviceCharge && <Row label={t('documents.service_charge')} value={money(quote.serviceCharge)} />}
          {!!quote?.tax && <Row label={t('documents.tax')} value={money(quote.tax)} />}
          {!!quote?.deliveryFee && <Row label={t('pos.delivery_fee')} value={money(quote.deliveryFee)} />}
          <div className="flex items-baseline justify-between pt-1 text-xl font-bold">
            <dt>{t('documents.total')}</dt>
            <dd className="tabular-nums">{money(quote?.total ?? 0)}</dd>
          </div>
        </dl>
        <div className="grid grid-cols-3 gap-2">
          <Button variant="secondary" size="lg" icon={<PauseCircle className="size-5" />} disabled={!cart.length || !!quoteError} loading={hold.isPending} onClick={() => hold.mutate()}>
            {t('pos.hold')}
          </Button>
          <Button size="lg" className="col-span-2" disabled={!cart.length || !quote || !!quoteError} onClick={() => setPaying(true)}>
            {t('pos.pay')} {quote ? money(quote.total) : ''}
          </Button>
        </div>
        {(cart.length > 0 || editingOrderId) && (
          <button type="button" onClick={reset} className="w-full text-center text-sm text-slate-500 hover:text-rose-600">
            {editingOrderId ? t('pos.close_order') : t('pos.clear_cart')}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-dvh flex-col bg-slate-50 dark:bg-slate-950">
      <FarumaWarning />
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-900">
        <Link to="/" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" aria-label={t('nav.dashboard')}>
          <ArrowLeft className="rtl-flip size-5" />
        </Link>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold" dir="auto">
            {session.business.name}
          </p>
          <p className="truncate text-xs text-slate-500" dir="auto">
            {session.outlet?.name} · {session.user.name}
          </p>
        </div>
        <div className="ms-auto flex items-center gap-2">
          {editingOrderId && <Badge tone="amber">{t('pos.editing_order')}</Badge>}
          <Button variant="secondary" size="sm" icon={<ClipboardList className="size-4" />} onClick={() => setShowOrders(true)}>
            {t('pos.open_orders')}
            {(openOrders.data?.items.length ?? 0) > 0 && <Badge tone={onlineCount ? 'red' : 'amber'}>{openOrders.data!.items.length}</Badge>}
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="space-y-3 p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchRef}
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={onSearchKey}
                placeholder={t('pos.search')}
                aria-label={t('pos.search')}
                className="h-12 w-full rounded-xl border-0 bg-white ps-11 pe-4 text-base shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-brand-600 focus:outline-none dark:bg-slate-900 dark:ring-slate-700"
              />
            </div>
            <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1">
              {[{ id: 'all', name: t('common.all') }, ...(catalog.data?.categories ?? [])].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  className={clsx(
                    'shrink-0 rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap',
                    category === c.id ? 'bg-brand-700 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700',
                  )}
                >
                  <span className="flex items-center gap-2">
                    {c.id !== 'all' && <span aria-hidden className={clsx('size-2 rounded-full', catTint(c.id).bar)} />}
                    <span dir="auto">{c.name}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-24 lg:pb-3">
            {catalog.isLoading ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 12 }, (_, i) => (
                  <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
                ))}
              </div>
            ) : products.length === 0 ? (
              <p className="py-16 text-center text-sm text-slate-500">{catalog.data?.products.length ? t('common.no_results') : t('pos.no_products')}</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {products.map((p) => {
                  const out = p.trackStock && p.stock !== null && p.stock <= 0;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onProduct(p)}
                      className={clsx(
                        'group relative flex min-h-32 flex-col overflow-hidden rounded-2xl bg-white text-start shadow-sm ring-1 ring-slate-200 transition hover:shadow-md hover:ring-brand-300 active:scale-[0.98] dark:bg-slate-900 dark:ring-slate-800',
                        out && 'opacity-60',
                      )}
                    >
                      <span aria-hidden className={clsx('h-1.5 w-full', catTint(p.categoryId).bar)} />
                      <span className="flex flex-1 flex-col gap-2 p-3">
                        <span className="flex items-start gap-2.5">
                          <ItemAvatar name={p.name} tint={catTint(p.categoryId)} src={p.hasImage ? `/api/products/${p.id}/image` : null} className="size-11 text-sm" />
                          <span className="line-clamp-2 min-w-0 flex-1 pt-0.5 leading-snug font-medium" dir="auto">
                            {p.name}
                          </span>
                        </span>
                        <span className="mt-auto flex items-center justify-between gap-1">
                          <span className="rounded-lg bg-slate-50 px-2 py-1 text-sm font-semibold text-slate-900 tabular-nums dark:bg-slate-800 dark:text-white">{money(p.sellingPrice)}</span>
                          <span className="flex items-center gap-1">
                            {p.options.length > 0 && <SlidersHorizontal className="size-3.5 text-slate-400" aria-label={t('products.options')} />}
                            {p.trackStock && p.stock !== null && <Badge tone={out ? 'red' : p.stock < 5 ? 'amber' : 'gray'}>{p.stock}</Badge>}
                          </span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <aside className="hidden w-[380px] shrink-0 border-s border-slate-200 bg-white lg:block dark:border-slate-800 dark:bg-slate-900">{cartPanel}</aside>
      </div>

      {/* Mobile / tablet: cart as a bottom sheet */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white p-3 lg:hidden dark:border-slate-800 dark:bg-slate-900">
        <Button size="lg" className="w-full" icon={<ShoppingCart className="size-5" />} onClick={() => setShowCart(true)}>
          {t('pos.view_cart', { count: cartCount })} · {money(quote?.total ?? 0)}
        </Button>
      </div>
      {showCart && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-950/40" onClick={() => setShowCart(false)} />
          <div className="absolute inset-x-0 bottom-0 flex h-[90dvh] flex-col rounded-t-2xl bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between px-4 pt-3">
              <p className="font-semibold">{t('pos.cart')}</p>
              <button type="button" aria-label={t('common.close')} onClick={() => setShowCart(false)} className="rounded-lg p-2">
                <X className="size-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1">{cartPanel}</div>
          </div>
        </div>
      )}

      {optionsFor && (
        <OptionsDialog
          product={optionsFor}
          onClose={() => setOptionsFor(null)}
          onAdd={(opts) => {
            add(optionsFor, opts);
            setOptionsFor(null);
          }}
        />
      )}

      {paying && quote && (
        <PaymentDialog
          total={quote.total}
          customer={customer}
          onClose={() => setPaying(false)}
          submit={async (payments) => {
            const sale = editingOrderId
              ? await api.put(`/pos/orders/${editingOrderId}`, orderBody()).then(() => api.post<{ id: string; number: string; changeAmount: number; total: number }>(`/pos/orders/${editingOrderId}/pay`, { payments }))
              : await api.post<{ id: string; number: string; changeAmount: number; total: number }>('/pos/orders', { ...orderBody(), payments });
            setPaying(false);
            setShowCart(false);
            setCompleted({ id: sale.id, number: sale.number, change: sale.changeAmount, total: sale.total });
            refreshAfterSale();
            void qc.invalidateQueries({ queryKey: ['biz', 'pos', 'catalog'] });
          }}
        />
      )}

      {completed && (
        <Dialog
          open
          onClose={() => {
            setCompleted(null);
            reset();
          }}
          size="sm"
          title={t('pos.sale_complete')}
          footer={
            <>
              <Button variant="secondary" icon={<Printer className="size-4" />} onClick={() => window.open(`/print/receipt/${completed.id}`, '_blank', 'noopener')}>
                {t('pos.print_receipt')}
              </Button>
              <Button
                autoFocus
                onClick={() => {
                  setCompleted(null);
                  reset();
                }}
              >
                {t('pos.new_sale')}
              </Button>
            </>
          }
        >
          <div className="animate-pop-in flex flex-col items-center gap-2 py-4 text-center">
            <CheckCircle2 className="size-14 text-emerald-500" />
            <p className="text-sm text-slate-500">
              {t('pos.receipt_no')} <bdi dir="ltr">{completed.number}</bdi>
            </p>
            <p className="text-2xl font-bold tabular-nums">{money(completed.total)}</p>
            {completed.change > 0 && (
              <p className="rounded-xl bg-amber-50 px-4 py-2 text-lg font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                {t('pos.change_due')}: {money(completed.change)}
              </p>
            )}
          </div>
        </Dialog>
      )}

      {showOrders && (
        <Dialog open onClose={() => setShowOrders(false)} title={t('pos.open_orders')} size="lg">
          {!openOrders.data?.items.length ? (
            <p className="py-8 text-center text-sm text-slate-500">{t('pos.no_open_orders')}</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {openOrders.data.items.map((o) => (
                <li key={o.id}>
                  <button type="button" onClick={() => void loadOrder(o)} className="flex w-full items-center justify-between gap-3 px-1 py-3 text-start hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <span className="min-w-0">
                      <span className="block font-medium" dir="auto">
                        {o.source === 'online' && <Badge tone="red">{t('pos.online')}</Badge>} {o.tableName ?? o.onlineCustomer?.name ?? o.customerName ?? t(`pos.order_types.${o.orderType}`)}
                      </span>
                      <span className="text-xs text-slate-500">{new Date(o.createdAt).toLocaleTimeString()}</span>
                    </span>
                    <span className="font-semibold tabular-nums">{money(o.total)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Dialog>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-slate-600 dark:text-slate-300">
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

function OptionsDialog({ product, onClose, onAdd }: { product: PosProduct; onClose: () => void; onAdd: (o: { group: string; choice: string }[]) => void }) {
  const { t } = useTranslation();
  const money = useMoney();
  const [picked, setPicked] = useState<Record<string, string[]>>(() => Object.fromEntries(product.options.map((g) => [g.name, g.required && !g.multiple && g.choices[0] ? [g.choices[0].name] : []])));
  const missing = product.options.some((g) => g.required && !(picked[g.name]?.length ?? 0));
  const extra = product.options.reduce((a, g) => a + g.choices.filter((c) => picked[g.name]?.includes(c.name)).reduce((s, c) => s + c.price, 0), 0);
  return (
    <Dialog
      open
      onClose={onClose}
      title={<span dir="auto">{product.name}</span>}
      footer={
        <Button size="lg" className="w-full sm:w-auto" disabled={missing} onClick={() => onAdd(Object.entries(picked).flatMap(([group, cs]) => cs.map((choice) => ({ group, choice }))))}>
          {t('pos.add_to_cart')} · {money(product.sellingPrice + extra)}
        </Button>
      }
    >
      <div className="space-y-5">
        {product.options.map((g) => (
          <fieldset key={g.name}>
            <legend className="mb-2 text-sm font-semibold" dir="auto">
              {g.name} {g.required && <span className="text-xs font-normal text-rose-500">({t('pos.required')})</span>}
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {g.choices.map((c) => {
                const on = picked[g.name]?.includes(c.name);
                return (
                  <button
                    key={c.name}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setPicked((p) => {
                        const cur = p[g.name] ?? [];
                        if (g.multiple) return { ...p, [g.name]: on ? cur.filter((x) => x !== c.name) : [...cur, c.name] };
                        return { ...p, [g.name]: on && !g.required ? [] : [c.name] };
                      })
                    }
                    className={clsx('rounded-xl px-3 py-3 text-start text-sm ring-1', on ? 'bg-brand-50 font-semibold ring-brand-500 dark:bg-brand-950' : 'ring-slate-200 dark:ring-slate-700')}
                  >
                    <span dir="auto">{c.name}</span>
                    {c.price > 0 && <span className="block text-xs text-slate-500">+ {money(c.price)}</span>}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
    </Dialog>
  );
}

function PaymentDialog({ total, customer, onClose, submit }: { total: number; customer: CustomerLite | null; onClose: () => void; submit: (p: { method: Method; amount: number; reference: string }[]) => Promise<void> }) {
  const { t } = useTranslation();
  const money = useMoney();
  const { can, hasAddon } = useBiz();
  const errMsg = useErrorMessage();
  const [payments, setPayments] = useState<{ method: Method; amount: string; reference: string }[]>([{ method: 'cash', amount: (total / 100).toFixed(2), reference: '' }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tendered = payments.filter((p) => p.method !== 'credit').reduce((a, p) => a + Math.round(parseAmount(p.amount) * 100), 0);
  const remaining = Math.max(0, total - tendered);
  const change = Math.max(0, tendered - total);
  const creditAllowed = hasAddon('credit') && can('credit.create');
  const methods: Method[] = ['cash', 'card', 'bank_transfer', 'other', ...(creditAllowed ? (['credit'] as Method[]) : [])];
  const quick = [total, Math.ceil(total / 10000) * 10000, Math.ceil(total / 50000) * 50000, Math.ceil(total / 100000) * 100000].filter((v, i, a) => a.indexOf(v) === i).slice(0, 4);

  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      await submit(payments.filter((p) => p.method === 'credit' || parseAmount(p.amount) > 0).map((p) => ({ method: p.method, amount: p.method === 'credit' ? Math.max(0.01, remaining / 100) : parseAmount(p.amount), reference: p.reference })));
    } catch (e) {
      setError(e instanceof ApiError && e.code === 'credit_limit_exceeded' ? t('pos.credit_limit_exceeded', { available: money(Number(e.details.limit ?? 0) - Number(e.details.outstanding ?? 0)) }) : errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('pos.payment')}
      description={`${t('documents.total')}: ${money(total)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button size="lg" loading={busy} disabled={remaining > 0 && !payments.some((p) => p.method === 'credit')} onClick={() => void go()}>
            {t('pos.complete_sale')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert tone="red">{error}</Alert>}
        {payments.map((p, i) => (
          <div key={i} className="space-y-2 rounded-xl p-3 ring-1 ring-slate-200 dark:ring-slate-700">
            <div className="flex flex-wrap gap-1.5">
              {methods.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPayments((ps) => ps.map((x, j) => (j === i ? { ...x, method: m } : x)))}
                  className={clsx('rounded-lg px-3 py-2 text-sm font-medium', p.method === m ? 'bg-brand-700 text-white' : 'bg-slate-100 dark:bg-slate-800')}
                >
                  {t(`payment_methods.${m}`)}
                </button>
              ))}
              {payments.length > 1 && (
                <button type="button" aria-label={t('common.delete')} onClick={() => setPayments((ps) => ps.filter((_, j) => j !== i))} className="ms-auto rounded-lg p-2 text-slate-400 hover:text-rose-600">
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
            {p.method === 'credit' ? (
              customer ? (
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  <User className="me-1 inline size-4" />
                  {t('pos.credit_to', { name: customer.name, amount: money(remaining) })}
                </p>
              ) : (
                <Alert tone="amber">{t('errors.customer_required')}</Alert>
              )
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" step="0.01" min={0} inputMode="decimal" label={t('documents.amount')} value={p.amount} onChange={(e) => setPayments((ps) => ps.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} />
                {p.method !== 'cash' && <Input label={t('documents.reference')} value={p.reference} onChange={(e) => setPayments((ps) => ps.map((x, j) => (j === i ? { ...x, reference: e.target.value } : x)))} />}
              </div>
            )}
            {p.method === 'cash' && (
              <div className="flex flex-wrap gap-1.5">
                {quick.map((v) => (
                  <button key={v} type="button" onClick={() => setPayments((ps) => ps.map((x, j) => (j === i ? { ...x, amount: (v / 100).toFixed(2) } : x)))} className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm tabular-nums dark:bg-slate-800">
                    {money(v)}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {remaining > 0 && !payments.some((p) => p.method === 'credit') && (
          <Button variant="subtle" size="sm" icon={<Plus className="size-4" />} onClick={() => setPayments((ps) => [...ps, { method: 'card', amount: (remaining / 100).toFixed(2), reference: '' }])}>
            {t('pos.split_payment')}
          </Button>
        )}
        <dl className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-center dark:bg-slate-800/50">
          <div>
            <dt className="text-xs text-slate-500">{t('pos.remaining')}</dt>
            <dd className={clsx('text-lg font-bold tabular-nums', remaining > 0 && 'text-rose-600')}>{money(remaining)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">{t('pos.change_due')}</dt>
            <dd className="text-lg font-bold text-emerald-600 tabular-nums">{money(change)}</dd>
          </div>
        </dl>
      </div>
    </Dialog>
  );
}
