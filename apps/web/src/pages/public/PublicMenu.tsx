import { useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { CheckCircle2, Minus, Plus, ShoppingBag, UtensilsCrossed } from 'lucide-react';
import { LANGUAGES, type Translations } from '@oceanx/shared';
import { localized } from '../../components/TranslationFields';
import { applyLanguage } from '../../i18n';
import { localeFor } from '../../lib/format';
import { Alert, EmptyState, SkeletonRows } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select, Textarea } from '../../components/ui/Form';
import { Dialog } from '../../components/ui/Dialog';
import { LanguageMenu } from '../../layouts/BusinessLayout';

interface Choice {
  name: string;
  price: number;
}
interface Group {
  name: string;
  required: boolean;
  multiple: boolean;
  choices: Choice[];
}
interface MenuProduct {
  id: string;
  name: string;
  description: string;
  categoryId: string | null;
  price: number | null;
  options: Group[];
  hasImage: boolean;
  translations?: Translations;
}
interface Menu {
  business: {
    name: string;
    address: string;
    phone: string;
    currency: string;
    hasLogo: boolean;
  };
  currencySymbol: string;
  message: string;
  messageTranslations?: Partial<Record<string, string>>;
  showPrices: boolean;
  ordersEnabled: boolean;
  deliveryEnabled: boolean;
  categories: { id: string; name: string; description: string; translations?: Translations }[];
  products: MenuProduct[];
}
interface CartLine {
  key: string;
  product: MenuProduct;
  options: { group: string; choice: string }[];
  quantity: number;
}

class PublicError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/public${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new PublicError(body?.error?.code ?? 'internal_error');
  return body as T;
}

/**
 * Public QR menu (/menu/:slug). No login. Shows only what the business publishes; any order placed
 * here is re-priced on the server and lands in "Online orders" for staff to accept.
 */
export default function PublicMenu() {
  const { slug } = useParams<{ slug: string }>();
  const { t, i18n } = useTranslation();
  const [params] = useSearchParams();
  const table = (params.get('table') ?? '').slice(0, 40);
  // Always live: re-read when the customer comes back to the page, and every few minutes while open.
  const q = useQuery({
    queryKey: ['public-menu', slug],
    queryFn: () => call<Menu>(`/menu/${slug}`),
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: 5 * 60_000,
  });
  const [cat, setCat] = useState<string | 'all'>('all');
  const [picking, setPicking] = useState<MenuProduct | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [checkout, setCheckout] = useState(false);
  const [done, setDone] = useState<{ reference: string; total: number } | null>(null);
  // Show item, category and message text in the customer's chosen language (falls back to the main text).
  const lang = i18n.language;
  const m = useMemo(() => {
    const d = q.data;
    if (!d) return d;
    return {
      ...d,
      message: d.messageTranslations?.[lang] || d.message,
      categories: d.categories.map((c) => ({ ...c, ...localized(c, lang) })),
      products: d.products.map((p) => ({ ...p, ...localized(p, lang) })),
    };
  }, [q.data, lang]);
  const money = useMemo(() => {
    const nf = new Intl.NumberFormat(localeFor(i18n.language), {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return (minor: number) => `⁦${m?.currencySymbol || m?.business.currency || ''} ${nf.format(minor / 100)}⁩`;
  }, [i18n.language, m]);
  const linePrice = (l: CartLine) =>
    ((l.product.price ?? 0) + l.options.reduce((a, o) => a + (l.product.options.find((g) => g.name === o.group)?.choices.find((c) => c.name === o.choice)?.price ?? 0), 0)) *
    l.quantity;
  const cartTotal = cart.reduce((a, l) => a + linePrice(l), 0);
  const count = cart.reduce((a, l) => a + l.quantity, 0);
  const add = (p: MenuProduct, options: { group: string; choice: string }[]) => {
    const key = `${p.id}|${JSON.stringify(options)}`;
    setCart((c) =>
      c.some((l) => l.key === key) ? c.map((l) => (l.key === key ? { ...l, quantity: Math.min(100, l.quantity + 1) } : l)) : [...c, { key, product: p, options, quantity: 1 }],
    );
  };

  if (q.isLoading)
    return (
      <div className="mx-auto max-w-3xl p-6">
        <SkeletonRows rows={8} />
      </div>
    );
  if (!m)
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <EmptyState icon={<UtensilsCrossed className="size-6" />} title={t('public_menu.not_found')} description={t('public_menu.not_found_body')} />
      </div>
    );
  const visible = m.products.filter((p) => cat === 'all' || p.categoryId === cat);
  return (
    <div className="min-h-screen bg-slate-50 pb-28 dark:bg-slate-950">
      <header className="bg-white shadow-sm dark:bg-slate-900">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          {m.business.hasLogo && <img src={`/api/public/menu/${slug}/logo`} alt="" className="size-12 rounded-xl object-contain" />}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold" dir="auto">
              {m.business.name}
            </h1>
            {m.business.address && (
              <p className="truncate text-xs text-slate-500" dir="auto">
                {m.business.address}
              </p>
            )}
          </div>
          <LanguageMenu
            current={i18n.language}
            languages={LANGUAGES.map((l) => ({
              code: l.code,
              nativeName: l.nativeName,
            }))}
            onChange={(c) => void applyLanguage(c, { persist: true })}
          />
        </div>
        {table && (
          <div className="mx-auto max-w-3xl px-4 pb-3">
            <p className="flex items-center justify-between gap-3 rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-900 dark:bg-brand-950 dark:text-brand-100">
              <span className="font-semibold" dir="auto">
                {t('public_menu.your_table', { table })}
              </span>
              {!m.ordersEnabled && <span className="text-xs">{t('public_menu.staff_will_take')}</span>}
            </p>
          </div>
        )}
        {m.message && (
          <p className="mx-auto max-w-3xl px-4 pb-3 text-sm text-slate-600 dark:text-slate-300" dir="auto">
            {m.message}
          </p>
        )}
        <nav className="mx-auto flex max-w-3xl gap-2 overflow-x-auto px-4 pb-3" aria-label={t('public_menu.categories')}>
          {[{ id: 'all', name: t('common.all') }, ...m.categories].map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCat(c.id)}
              className={clsx(
                'shrink-0 rounded-full px-4 py-1.5 text-sm font-medium',
                cat === c.id ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
              )}
            >
              <span dir="auto">{c.name}</span>
            </button>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-3xl space-y-3 px-4 py-4">
        {visible.length === 0 && <EmptyState icon={<UtensilsCrossed className="size-6" />} title={t('public_menu.empty')} />}
        {visible.map((p) => (
          <article key={p.id} className="flex gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
            {p.hasImage && <img src={`/api/public/menu/${slug}/products/${p.id}/image`} alt="" loading="lazy" className="size-24 shrink-0 rounded-xl object-cover" />}
            <div className="flex min-w-0 flex-1 flex-col">
              <h2 className="font-semibold" dir="auto">
                {p.name}
              </h2>
              {p.description && (
                <p className="line-clamp-2 text-sm text-slate-500" dir="auto">
                  {p.description}
                </p>
              )}
              <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                {p.price !== null ? <span className="font-semibold">{money(p.price)}</span> : <span />}
                {m.ordersEnabled && (
                  <Button size="sm" icon={<Plus className="size-4" />} onClick={() => (p.options.length ? setPicking(p) : add(p, []))}>
                    {t('public_menu.add')}
                  </Button>
                )}
              </div>
            </div>
          </article>
        ))}
      </main>
      {m.ordersEnabled && count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 p-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
          <div className="mx-auto max-w-3xl">
            <Button size="lg" className="w-full" icon={<ShoppingBag className="size-5" />} onClick={() => setCheckout(true)}>
              {t('public_menu.view_order', { count })} · {money(cartTotal)}
            </Button>
          </div>
        </div>
      )}
      {picking && (
        <PickOptions
          product={picking}
          money={money}
          onClose={() => setPicking(null)}
          onAdd={(o) => {
            add(picking, o);
            setPicking(null);
          }}
        />
      )}
      {checkout && (
        <Checkout
          slug={slug!}
          table={table}
          menu={m}
          cart={cart}
          setCart={setCart}
          money={money}
          linePrice={linePrice}
          onClose={() => setCheckout(false)}
          onDone={(r) => {
            setDone(r);
            setCart([]);
            setCheckout(false);
          }}
        />
      )}
      <Dialog open={!!done} onClose={() => setDone(null)} size="sm" title={t('public_menu.order_sent')}>
        <div className="space-y-3 text-center">
          <CheckCircle2 className="mx-auto size-12 text-emerald-600" />
          <p>{t('public_menu.order_sent_body')}</p>
          {done && (
            <p className="text-lg font-semibold">
              {t('public_menu.reference')}: <span dir="ltr">{done.reference}</span>
            </p>
          )}
          {done && <p className="text-sm text-slate-500">{t('public_menu.total_to_pay', { total: money(done.total) })}</p>}
        </div>
      </Dialog>
    </div>
  );
}

function PickOptions({
  product,
  money,
  onClose,
  onAdd,
}: {
  product: MenuProduct;
  money: (n: number) => string;
  onClose: () => void;
  onAdd: (o: { group: string; choice: string }[]) => void;
}) {
  const { t } = useTranslation();
  const [picked, setPicked] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(product.options.map((g) => [g.name, g.required && !g.multiple && g.choices[0] ? [g.choices[0].name] : []])),
  );
  const missing = product.options.some((g) => g.required && !(picked[g.name]?.length ?? 0));
  return (
    <Dialog
      open
      onClose={onClose}
      title={<span dir="auto">{product.name}</span>}
      footer={
        <Button className="w-full" disabled={missing} onClick={() => onAdd(Object.entries(picked).flatMap(([group, cs]) => cs.map((choice) => ({ group, choice }))))}>
          {t('public_menu.add')}
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
                        if (g.multiple)
                          return {
                            ...p,
                            [g.name]: on ? cur.filter((x) => x !== c.name) : [...cur, c.name],
                          };
                        return {
                          ...p,
                          [g.name]: on && !g.required ? [] : [c.name],
                        };
                      })
                    }
                    className={clsx(
                      'rounded-xl px-3 py-3 text-start text-sm ring-1',
                      on ? 'bg-brand-50 font-semibold ring-brand-500 dark:bg-brand-950' : 'ring-slate-200 dark:ring-slate-700',
                    )}
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

function Checkout({
  slug,
  table,
  menu,
  cart,
  setCart,
  money,
  linePrice,
  onClose,
  onDone,
}: {
  slug: string;
  table: string;
  menu: Menu;
  cart: CartLine[];
  setCart: (c: CartLine[]) => void;
  money: (n: number) => string;
  linePrice: (l: CartLine) => number;
  onClose: () => void;
  onDone: (r: { reference: string; total: number }) => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    customerName: '',
    phone: '',
    orderType: table ? 'dine_in' : 'takeaway',
    tableName: table,
    address: '',
    note: '',
  });
  const order = useMutation({
    mutationFn: () =>
      call<{ reference: string; total: number }>(`/menu/${slug}/orders`, {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          items: cart.map((l) => ({
            productId: l.product.id,
            quantity: l.quantity,
            options: l.options,
          })),
        }),
      }),
    onSuccess: onDone,
  });
  const qty = (key: string, d: number) => setCart(cart.flatMap((l) => (l.key !== key ? [l] : l.quantity + d <= 0 ? [] : [{ ...l, quantity: Math.min(100, l.quantity + d) }])));
  const types = ['takeaway', 'dine_in', ...(menu.deliveryEnabled ? ['delivery'] : [])];
  return (
    <Dialog
      open
      onClose={onClose}
      title={t('public_menu.your_order')}
      footer={
        <Button
          className="w-full"
          onClick={() => order.mutate()}
          loading={order.isPending}
          disabled={!cart.length || !form.customerName.trim() || form.phone.trim().length < 5 || (form.orderType === 'delivery' && !form.address.trim())}
        >
          {t('public_menu.place_order')}
        </Button>
      }
    >
      <div className="space-y-4">
        {order.error && (
          <Alert tone="red">
            {t(`errors.${(order.error as PublicError).code}`, {
              defaultValue: t('errors.internal_error'),
            })}
          </Alert>
        )}
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {cart.map((l) => (
            <li key={l.key} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="block font-medium" dir="auto">
                  {l.product.name}
                </span>
                {l.options.length > 0 && (
                  <span className="block text-xs text-slate-500" dir="auto">
                    {l.options.map((o) => o.choice).join(', ')}
                  </span>
                )}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <button type="button" aria-label={t('pos.decrease')} className="rounded-lg p-1 ring-1 ring-slate-200 dark:ring-slate-700" onClick={() => qty(l.key, -1)}>
                  <Minus className="size-4" />
                </button>
                <span dir="ltr" className="w-6 text-center">
                  {l.quantity}
                </span>
                <button type="button" aria-label={t('pos.increase')} className="rounded-lg p-1 ring-1 ring-slate-200 dark:ring-slate-700" onClick={() => qty(l.key, 1)}>
                  <Plus className="size-4" />
                </button>
                {menu.showPrices && <span className="w-20 text-end font-medium">{money(linePrice(l))}</span>}
              </span>
            </li>
          ))}
        </ul>
        {menu.showPrices && <p className="text-xs text-slate-500">{t('public_menu.price_note')}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label={t('common.name')} value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} autoComplete="name" />
          <Input label={t('common.phone')} type="tel" dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="tel" />
          <Select label={t('pos.order_type')} value={form.orderType} onChange={(e) => setForm({ ...form, orderType: e.target.value })}>
            {types.map((x) => (
              <option key={x} value={x}>
                {t(`pos.order_types.${x}`)}
              </option>
            ))}
          </Select>
          {form.orderType === 'dine_in' && <Input label={t('pos.table')} value={form.tableName} onChange={(e) => setForm({ ...form, tableName: e.target.value })} />}
        </div>
        {form.orderType === 'delivery' && <Textarea label={t('pos.delivery_address')} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />}
        <Textarea label={t('pos.order_note')} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
      </div>
    </Dialog>
  );
}
