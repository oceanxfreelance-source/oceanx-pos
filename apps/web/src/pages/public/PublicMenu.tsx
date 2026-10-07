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
  topRank?: number | null;
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
      <div className="min-h-screen bg-[#2b2520] p-6">
        <SkeletonRows rows={8} />
      </div>
    );
  if (!m)
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <EmptyState icon={<UtensilsCrossed className="size-6" />} title={t('public_menu.not_found')} description={t('public_menu.not_found_body')} />
      </div>
    );
  // One scrolling page, grouped by category (items without a category last).
  const known = new Set(m.categories.map((c) => c.id));
  const sections = [
    ...m.categories.map((c) => ({ id: c.id, name: c.name, items: m.products.filter((p) => p.categoryId === c.id) })),
    { id: 'other', name: '', items: m.products.filter((p) => !p.categoryId || !known.has(p.categoryId)) },
  ].filter((x) => x.items.length > 0);
  const jump = (id: string) => {
    setCat(id);
    document.getElementById(`cat-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return (
    <div className="menu-theme min-h-screen bg-[radial-gradient(ellipse_at_top_left,#4a4038_0%,#2b2520_45%,#1a1613_100%)] pb-28 text-stone-100">
      <header className="mx-auto flex max-w-5xl items-center gap-3 px-4 pt-4">
        {m.business.hasLogo && <img src={`/api/public/menu/${slug}/logo`} alt="" className="size-10 rounded-full bg-white/90 object-contain p-1" />}
        <p className="min-w-0 flex-1 truncate text-sm font-semibold tracking-wide text-stone-200" dir="auto">
          {m.business.name}
        </p>
        <div className="rounded-xl bg-white/10 [&_button]:text-stone-100 [&_button:hover]:bg-white/10">
          <LanguageMenu current={i18n.language} languages={LANGUAGES.map((l) => ({ code: l.code, nativeName: l.nativeName }))} onChange={(c) => void applyLanguage(c, { persist: true })} />
        </div>
      </header>

      <section className="relative mx-auto max-w-5xl overflow-hidden px-4 pt-6 pb-4 text-center">
        <h1 className="text-[clamp(5rem,26vw,13rem)] leading-none font-black tracking-tighter text-black/35 uppercase select-none" style={{ textShadow: '0 1px 0 rgba(255,255,255,0.04)' }}>
          {t('public_menu.menu_title')}
        </h1>
        <p
          className="absolute inset-x-0 bottom-6 truncate px-6 text-end text-[clamp(1.75rem,8vw,3.5rem)] text-stone-100 sm:pe-16"
          style={{ fontFamily: "'Snell Roundhand', 'Segoe Script', 'Brush Script MT', 'Apple Chancery', cursive", transform: 'rotate(-6deg)' }}
          dir="auto"
        >
          {m.business.name}
        </p>
      </section>

      {(table || m.message) && (
        <div className="mx-auto max-w-5xl space-y-2 px-4 pb-4 text-center">
          {table && (
            <p className="inline-flex flex-wrap items-center justify-center gap-x-3 rounded-full bg-[#efe7dc] px-4 py-1.5 text-sm text-stone-900">
              <span className="font-bold" dir="auto">
                {t('public_menu.your_table', { table })}
              </span>
              {!m.ordersEnabled && <span>{t('public_menu.staff_will_take')}</span>}
            </p>
          )}
          {m.message && (
            <p className="text-sm text-stone-300" dir="auto">
              {m.message}
            </p>
          )}
        </div>
      )}

      {sections.length > 1 && (
        <nav className="sticky top-0 z-10 bg-[#1f1a16]/90 backdrop-blur" aria-label={t('public_menu.categories')}>
          <div className="mx-auto flex max-w-5xl gap-2 overflow-x-auto px-4 py-3">
            {sections.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => jump(c.id)}
                className={clsx(
                  'shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold tracking-wide',
                  cat === c.id ? 'bg-[#efe7dc] text-stone-900' : 'text-stone-200 ring-1 ring-white/20 hover:bg-white/10',
                )}
              >
                <span dir="auto">{c.name || t('public_menu.more')}</span>
              </button>
            ))}
          </div>
        </nav>
      )}

      <main className="mx-auto max-w-5xl space-y-10 px-3 py-6 sm:px-6">
        {sections.length === 0 && <EmptyState icon={<UtensilsCrossed className="size-6" />} title={t('public_menu.empty')} />}
        {sections.map((sec) => (
          <section key={sec.id} id={`cat-${sec.id}`} className="scroll-mt-16">
            {sections.length > 1 && (
              <h2 className="mb-6 text-center text-xl font-bold tracking-[0.2em] text-stone-200 uppercase" dir="auto">
                {sec.name || t('public_menu.more')}
              </h2>
            )}
            <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-10">
              {sec.items.map((p) => (
                <MenuCard
                  key={p.id}
                  product={p}
                  slug={slug!}
                  money={money}
                  canOrder={m.ordersEnabled}
                  onAdd={() => (p.options.length ? setPicking(p) : add(p, []))}
                />
              ))}
            </div>
          </section>
        ))}
      </main>
      {m.ordersEnabled && count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-[#1f1a16]/95 p-4 backdrop-blur">
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

/** One dish: photo on a dark round plate over an arched card, like a printed restaurant menu. */
function MenuCard({ product: p, slug, money, canOrder, onAdd }: { product: MenuProduct; slug: string; money: (n: number) => string; canOrder: boolean; onAdd: () => void }) {
  const { t } = useTranslation();
  return (
    <article className="flex flex-col">
      <div className="relative z-10 mx-auto aspect-square w-[88%] rounded-full bg-[#141110] shadow-[0_18px_40px_-12px_rgba(0,0,0,0.8)] ring-1 ring-white/5">
        {p.hasImage ? (
          <img src={`/api/public/menu/${slug}/products/${p.id}/image`} alt="" loading="lazy" className="absolute top-[6%] left-[6%] size-[88%] rounded-full object-cover" />
        ) : (
          <span aria-hidden className="absolute top-[6%] left-[6%] flex size-[88%] items-center justify-center rounded-full bg-gradient-to-br from-[#3a322b] to-[#211c18] text-stone-500">
            <UtensilsCrossed className="size-1/3" />
          </span>
        )}
        {p.topRank && (
          <span className="absolute -top-1 -start-1 flex size-[30%] items-center justify-center rounded-full bg-[#efe7dc] text-[clamp(0.6rem,2.6vw,0.85rem)] font-extrabold text-stone-900 shadow-md">
            {t('public_menu.top', { rank: p.topRank })}
          </span>
        )}
      </div>
      <div className="-mt-[46%] flex flex-1 flex-col items-center rounded-t-full rounded-b-sm bg-[#2a2420]/95 px-2 pt-[50%] pb-4 text-center shadow-lg sm:px-4">
        <h3 className="mt-3 text-[13px] leading-tight font-extrabold tracking-wide uppercase sm:text-sm" dir="auto">
          {p.name}
        </h3>
        {p.description && (
          <p className="mt-1.5 line-clamp-3 text-[11px] leading-snug text-stone-300 sm:text-xs" dir="auto">
            {p.description}
          </p>
        )}
        <div className="mt-auto flex flex-col items-center gap-2 pt-3">
          {p.price !== null && <span className="text-base font-light tracking-wide text-stone-100 sm:text-lg">{money(p.price)}</span>}
          {canOrder && (
            <button type="button" onClick={onAdd} className="inline-flex items-center gap-1 rounded-full bg-[#efe7dc] px-3 py-1 text-xs font-bold text-stone-900 hover:bg-white">
              <Plus className="size-3.5" /> {t('public_menu.add')}
            </button>
          )}
        </div>
      </div>
    </article>
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
