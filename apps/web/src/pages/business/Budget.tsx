import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import clsx from 'clsx';
import { AlertTriangle, CalendarClock, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CloudOff, Download, Info, Minus, Pencil, PiggyBank, Plus, Search, Target, Trash2, Wallet, X } from 'lucide-react';
import { addMonths, decimalToMinor } from '@oceanx/shared';
import { api, ApiError } from '../../lib/api';
import { addPendingEntry, useOnline, usePendingEntries, type PendingEntry } from '../../lib/budgetOffline';
import { useBiz, useBizSession } from '../../auth/business';
import { useMoney } from '../../lib/money';
import { useFormat } from '../../lib/format';
import { useFieldErrors, useToastError } from '../../lib/useApiError';
import { Card, EmptyState, SkeletonRows } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Form';
import { ConfirmDialog, Dialog } from '../../components/ui/Dialog';

// ---------------------------------------------------------------- types
type Kind = 'income' | 'expense';
type PaidWith = 'cash' | 'card' | 'transfer' | 'other';
const PAID_WITH: PaidWith[] = ['cash', 'card', 'transfer', 'other'];

interface CategoryLine {
  id: string;
  name: string;
  key: string | null;
  emoji: string;
  limit: number | null;
  spent: number;
  lastMonth: number;
  left: number | null;
}
interface Bill {
  id: string;
  name: string;
  amount: number;
  dueDay: number;
  dueDate: string;
  categoryId: string | null;
  paid: boolean;
  paidAmount: number | null;
  paidOn: string | null;
  entryId: string | null;
  overdue: boolean;
  dueInDays: number | null;
}
interface Insight {
  code: string;
  tone: 'bad' | 'warn' | 'good' | 'info';
  params: Record<string, string | number>;
}
export interface Overview {
  month: string;
  today: string;
  currentMonth: string;
  isCurrent: boolean;
  daysInMonth: number;
  daysLeft: number;
  setUp: boolean;
  totals: { income: number; spent: number; saved: number; left: number; budgeted: number; billsUnpaid: number };
  previous: { income: number; spent: number };
  safePerDay: number | null;
  categories: CategoryLine[];
  other: { spent: number; lastMonth: number };
  incomeCategories: { id: string; name: string; key: string | null; emoji: string; total: number }[];
  bills: Bill[];
  paidWith: { paidWith: PaidWith; total: number }[];
  days: { date: string; spent: number }[];
  insights: Insight[];
}
interface Category {
  id: string;
  kind: Kind;
  name: string;
  key: string | null;
  emoji: string;
  monthlyLimit: number | null;
}
interface Entry {
  id: string;
  kind: Kind;
  amount: number;
  occurredOn: string;
  categoryId: string | null;
  categoryName: string;
  categoryKey: string | null;
  categoryEmoji: string;
  note: string;
  paidWith: PaidWith;
  billId: string | null;
  /** Written offline, waiting on the phone to be sent. */
  pending?: boolean;
}
export interface Goal {
  id: string;
  name: string;
  emoji: string;
  target: number;
  targetDate: string | null;
  saved: number;
  remaining: number;
  percent: number;
  done: boolean;
  thisMonth: number;
  monthsLeft: number | null;
  perMonth: number | null;
  late: boolean;
  onTrack: boolean | null;
}

const KEY = ['biz', 'budget'] as const;

/** A record waiting on the phone, shown like the others. */
const pendingAsEntry = (p: PendingEntry): Entry => ({
  id: p.id,
  kind: p.kind,
  amount: decimalToMinor(p.amount.replace(/,/g, '')),
  occurredOn: p.occurredOn,
  categoryId: p.categoryId,
  categoryName: p.category?.name ?? '',
  categoryKey: p.category?.key ?? null,
  categoryEmoji: p.category?.emoji ?? '',
  note: p.note,
  paidWith: p.paidWith as PaidWith,
  billId: null,
  pending: true,
});

/** The month with the records still waiting on the phone already counted in (left, spent, budgets, per day). */
function withPending(o: Overview, pending: Entry[]): Overview {
  const mine = pending.filter((p) => p.occurredOn.startsWith(o.month));
  if (!mine.length) return o;
  let { income, spent } = o.totals;
  let other = o.other.spent;
  const categories = o.categories.map((c) => ({ ...c }));
  for (const p of mine) {
    if (p.kind === 'income') income += p.amount;
    else {
      spent += p.amount;
      const c = categories.find((x) => x.id === p.categoryId);
      if (c) {
        c.spent += p.amount;
        c.left = c.limit === null ? null : c.limit - c.spent;
      } else other += p.amount;
    }
  }
  const left = income - spent - o.totals.saved;
  const safePerDay = o.isCurrent && o.daysLeft > 0 ? Math.max(0, Math.floor((left - o.totals.billsUnpaid) / o.daysLeft)) : o.safePerDay;
  return { ...o, totals: { ...o.totals, income, spent, left }, categories, other: { ...o.other, spent: other }, safePerDay };
}

/** "You're offline" — shown on top of the screens while the phone has no internet. */
function OfflineNote({ waiting }: { waiting: number }) {
  const { t } = useTranslation();
  const online = useOnline();
  if (online && !waiting) return null;
  return (
    <p className="flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-2.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      <CloudOff className="size-4 shrink-0" />
      <span>{online ? t('budget.offline.waiting', { count: waiting }) : waiting ? `${t('budget.offline.note')} ${t('budget.offline.waiting', { count: waiting })}` : t('budget.offline.note')}</span>
    </p>
  );
}
const refresh = (qc: ReturnType<typeof useQueryClient>) => void qc.invalidateQueries({ queryKey: KEY });
const toText = (minor: number | null | undefined) => (minor ? (minor / 100).toFixed(2).replace(/\.00$/, '') : '');

/** "October 2026" in the user's language (month names are shared with Gravity Flow's translations). */
export function useMonthName() {
  const { t } = useTranslation();
  return (month: string) => {
    const [y, m] = month.split('-');
    return `${t(`flow.m${Number(m)}`)} ${y}`;
  };
}

/**
 * A category's name in the person's language: set-up categories (food, rent, salary…) have a key and follow
 * the app language; a category the person named or renamed shows their own words.
 */
export function useCatName() {
  const { t } = useTranslation();
  return (c: { name: string; key?: string | null }) => (c.key ? t(`budget.starter.${c.key}`, { defaultValue: c.name }) : c.name);
}

function useOverview(month: string | null) {
  return useQuery({
    queryKey: [...KEY, 'overview', month ?? 'current'],
    queryFn: () => api.get<Overview & { currency: string }>(`/budget/overview${month ? `?month=${month}` : ''}`),
    placeholderData: keepPreviousData,
    refetchInterval: 5 * 60_000,
  });
}
function useCategories() {
  return useQuery({ queryKey: [...KEY, 'categories'], queryFn: () => api.get<{ items: Category[] }>('/budget/categories') });
}

// ---------------------------------------------------------------- small pieces
/** ‹ October 2026 › — a quiet month picker. */
function MonthSwitcher({ month, current, onChange }: { month: string; current: string; onChange: (m: string | null) => void }) {
  const { t } = useTranslation();
  const monthName = useMonthName();
  return (
    <div className="flex items-center gap-1">
      <button type="button" aria-label={t('flow.prev_month')} onClick={() => onChange(addMonths(month, -1))} className="grid size-9 place-items-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
        <ChevronLeft className="rtl-flip size-5" />
      </button>
      <button type="button" onClick={() => month !== current && onChange(null)} className="min-w-28 text-center text-sm font-semibold">
        {monthName(month)}
      </button>
      <button type="button" aria-label={t('flow.next_month')} onClick={() => onChange(addMonths(month, 1))} disabled={month >= current} className="grid size-9 place-items-center rounded-full text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800">
        <ChevronRight className="rtl-flip size-5" />
      </button>
    </div>
  );
}

/** A thin bar: how much of the limit is used. Green under 80 %, amber to 100 %, red over. */
function Meter({ used, limit, className }: { used: number; limit: number; className?: string }) {
  const pct = limit > 0 ? (used * 100) / limit : 0;
  return (
    <div className={clsx('h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800', className)}>
      <div className={clsx('h-full rounded-full transition-all', pct > 100 ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

/** One piece of advice in plain words (category names in the person's language). */
export function useInsightText() {
  const { t } = useTranslation();
  const money = useMoney();
  return (i: Insight) => {
    const p: Record<string, string | number> = { ...i.params };
    if (typeof p.amount === 'number') p.amount = money(p.amount);
    if (p.nameKey) p.name = t(`budget.starter.${p.nameKey}`, { defaultValue: String(p.name) });
    return t(`budget.insight.${i.code}`, p);
  };
}

function InsightIcon({ tone }: { tone: Insight['tone'] }) {
  const cls = 'size-4 shrink-0';
  if (tone === 'bad') return <AlertTriangle className={clsx(cls, 'text-rose-600 dark:text-rose-400')} />;
  if (tone === 'warn') return <AlertTriangle className={clsx(cls, 'text-amber-600 dark:text-amber-400')} />;
  if (tone === 'good') return <CheckCircle2 className={clsx(cls, 'text-emerald-600 dark:text-emerald-400')} />;
  return <Info className={clsx(cls, 'text-brand-600 dark:text-brand-300')} />;
}

function AmountInput({ label, value, onChange, error, autoFocus, hint, placeholder }: { label: string; value: string; onChange: (v: string) => void; error?: string; autoFocus?: boolean; hint?: string; placeholder?: string }) {
  const money = useMoney();
  return <Input label={`${label} (${money.symbol})`} inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} error={error} autoFocus={autoFocus} hint={hint} placeholder={placeholder ?? '0.00'} dir="ltr" />;
}

function PaidWithPicker({ value, onChange }: { value: PaidWith; onChange: (v: PaidWith) => void }) {
  const { t } = useTranslation();
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">{t('budget.paid_with')}</p>
      <div className="grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
        {PAID_WITH.map((p) => (
          <button key={p} type="button" onClick={() => onChange(p)} aria-pressed={value === p} className={clsx('rounded-lg px-1 py-1.5 text-xs font-medium transition sm:text-sm', value === p ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-600 dark:text-slate-300')}>
            {t(`budget.paid.${p}`)}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- add / change a record
/**
 * Add spending or income in two taps: the amount (big), then the category (a grid of icons).
 * Date, note and how it was paid are tucked under "More details" (today and cash by default).
 */
function EntryDialog({ kind: initialKind, entry, today, onClose }: { kind: Kind; entry?: Entry; today: string; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const money = useMoney();
  const f = useFormat();
  const catName = useCatName();
  const cats = useCategories();
  const [kind, setKind] = useState<Kind>(entry?.kind ?? initialKind);
  const [amount, setAmount] = useState(entry ? toText(entry.amount) : '');
  const [date, setDate] = useState(entry?.occurredOn ?? today);
  const [categoryId, setCategoryId] = useState<string>(entry?.categoryId ?? '');
  const [note, setNote] = useState(entry?.note ?? '');
  const [paidWith, setPaidWith] = useState<PaidWith>(entry?.paidWith ?? 'cash');
  const [more, setMore] = useState(!!entry && (!!entry.note || entry.occurredOn !== today || entry.paidWith !== 'cash'));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const toastError = useToastError();
  const save = useMutation({
    // Runs offline too: a new record then waits on the phone and is sent when the phone is online.
    networkMode: 'always',
    mutationFn: async () => {
      const body = { kind, amount: amount.trim(), occurredOn: date, categoryId: categoryId || null, note, paidWith };
      if (entry) return api.put(`/budget/entries/${entry.id}`, body);
      const keepOnPhone = () => {
        const text = body.amount.replace(/,/g, '');
        if (!/^\d{1,12}(\.\d{1,2})?$/.test(text) || decimalToMinor(text) <= 0) throw new ApiError(422, 'validation_failed', 'Invalid amount', { amount: { code: 'invalid' } });
        const cat = options.find((c) => c.id === categoryId);
        addPendingEntry({ ...body, amount: text, category: cat ? { name: cat.name, key: cat.key, emoji: cat.emoji } : null }, qc);
        return 'offline' as const;
      };
      if (!navigator.onLine) return keepOnPhone();
      try {
        return await api.post('/budget/entries', body);
      } catch (err) {
        if (err instanceof ApiError && err.code === 'network_error') return keepOnPhone();
        throw err;
      }
    },
    onSuccess: (r) => {
      toast.success(r === 'offline' ? t('budget.offline.saved') : t('common.saved'));
      refresh(qc);
      onClose();
    },
  });
  const remove = useMutation({
    mutationFn: () => api.delete(`/budget/entries/${entry!.id}`),
    onSuccess: () => {
      toast.success(t('flow.deleted'));
      refresh(qc);
      onClose();
    },
    onError: toastError,
  });
  const fieldErr = useFieldErrors(save.error);
  const options = (cats.data?.items ?? []).filter((c) => c.kind === kind);
  return (
    <Dialog
      open
      onClose={onClose}
      title={entry ? t('budget.edit_record') : t('budget.add')}
      footer={
        <div className="flex w-full items-center gap-2">
          {entry && <Button variant="ghost" icon={<Trash2 className="size-4" />} aria-label={t('common.delete')} onClick={() => setConfirmDelete(true)} />}
          <Button size="lg" className="flex-1" onClick={() => save.mutate()} loading={save.isPending} disabled={!amount.trim()}>
            {t('common.save')}
          </Button>
        </div>
      }
    >
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="mx-auto grid max-w-xs grid-cols-2 gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-800" role="tablist">
          {(['expense', 'income'] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={kind === k}
              onClick={() => {
                setKind(k);
                setCategoryId('');
              }}
              className={clsx('rounded-full py-1.5 text-sm font-semibold transition', kind === k ? (k === 'income' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-rose-600 text-white shadow-sm') : 'text-slate-600 dark:text-slate-300')}
            >
              {k === 'income' ? t('budget.income') : t('budget.spending')}
            </button>
          ))}
        </div>
        <div className="text-center">
          <label className="sr-only" htmlFor="budget-amount">
            {t('flow.amount')}
          </label>
          <div className="flex items-baseline justify-center gap-2" dir="ltr">
            <span className="text-lg font-medium text-slate-400">{money.symbol}</span>
            <input
              id="budget-amount"
              aria-label={t('flow.amount')}
              inputMode="decimal"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="w-44 border-0 bg-transparent p-0 text-center text-4xl font-bold tabular-nums placeholder:text-slate-300 focus:ring-0 dark:placeholder:text-slate-600"
            />
          </div>
          <div className={clsx('mx-auto mt-1 h-0.5 w-44 rounded-full', kind === 'income' ? 'bg-emerald-500' : 'bg-rose-500')} />
          {fieldErr('amount') && <p className="mt-1 text-sm text-rose-600">{fieldErr('amount')}</p>}
        </div>
        <div role="radiogroup" aria-label={t('flow.category')} className="grid grid-cols-4 gap-2">
          {options.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={categoryId === c.id}
              onClick={() => setCategoryId(categoryId === c.id ? '' : c.id)}
              className={clsx('flex min-w-0 flex-col items-center gap-1 rounded-2xl px-1 py-2 text-center transition', categoryId === c.id ? 'bg-brand-50 ring-2 ring-brand-600 dark:bg-brand-950' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60')}
            >
              <span className="text-2xl leading-none">{c.emoji || '•'}</span>
              <span className="line-clamp-2 w-full text-[11px] leading-tight text-slate-600 dark:text-slate-300" dir="auto">
                {catName(c)}
              </span>
            </button>
          ))}
        </div>
        {fieldErr('categoryId') && <p className="text-sm text-rose-600">{fieldErr('categoryId')}</p>}
        {!more ? (
          <button type="button" onClick={() => setMore(true)} className="mx-auto flex items-center gap-1 text-sm text-slate-500">
            {f.date(date)} · {t(`budget.paid.${paidWith}`)} <ChevronDown className="size-4" /> <span className="font-medium text-brand-700 dark:text-brand-300">{t('budget.more_details')}</span>
          </button>
        ) : (
          <div className="space-y-4 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/40">
            {kind === 'expense' && <PaidWithPicker value={paidWith} onChange={setPaidWith} />}
            <div className="grid grid-cols-2 gap-3">
              <Input label={t('flow.date')} type="date" value={date} onChange={(e) => setDate(e.target.value)} error={fieldErr('occurredOn')} />
              <Input label={t('flow.note')} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder={t('budget.note_hint')} />
            </div>
          </div>
        )}
      </form>
      <ConfirmDialog open={confirmDelete} onClose={() => setConfirmDelete(false)} onConfirm={() => remove.mutate()} loading={remove.isPending} danger title={t('flow.delete_title')} message={t('flow.delete_body')} confirmLabel={t('common.delete')} />
    </Dialog>
  );
}

function EntryRow({ e, onOpen }: { e: Entry; onOpen: () => void }) {
  const { t } = useTranslation();
  const money = useMoney();
  const f = useFormat();
  const catName = useCatName();
  const cat = e.categoryName ? catName({ name: e.categoryName, key: e.categoryKey }) : '';
  const title = e.note || cat || (e.kind === 'income' ? t('budget.income') : t('budget.spending'));
  return (
    <li>
      <button type="button" onClick={onOpen} disabled={e.pending} className="flex w-full items-center gap-3 px-4 py-3 text-start hover:bg-slate-50 disabled:cursor-default dark:hover:bg-slate-800/40">
        <span className={clsx('grid size-10 shrink-0 place-items-center rounded-full text-lg', e.kind === 'income' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-800')}>
          {e.categoryEmoji || (e.kind === 'income' ? <Plus className="size-4" /> : <Minus className="size-4" />)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium" dir="auto">
            {title}
          </span>
          <span className="block truncate text-xs text-slate-500" dir="auto">
            {e.pending ? (
              <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
                <CloudOff className="size-3" /> {t('budget.offline.pending_label')}
              </span>
            ) : (
              <>
                {cat && e.note ? `${cat} · ` : ''}
                {f.date(e.occurredOn)}
              </>
            )}
          </span>
        </span>
        <span className={clsx('shrink-0 text-sm font-semibold tabular-nums', e.kind === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-100')}>
          {e.kind === 'income' ? '+' : '−'}
          {money(e.amount)}
        </span>
      </button>
    </li>
  );
}

/** The one big action, always in reach of the thumb: + Add (spending; income is one tap away inside). */
function AddFab({ onAdd }: { onAdd: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onAdd}
      className="fixed end-4 bottom-[calc(5rem+var(--safe-bottom,0px))] z-30 inline-flex items-center gap-2 rounded-full bg-brand-700 px-5 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-900/25 hover:bg-brand-800 lg:bottom-8"
    >
      <Plus className="size-5" /> {t('budget.add')}
    </button>
  );
}

// ---------------------------------------------------------------- first-time set-up
const STARTER: { kind: Kind; key: string; emoji: string }[] = [
  { kind: 'income', key: 'salary', emoji: '💼' },
  { kind: 'income', key: 'side_income', emoji: '💵' },
  { kind: 'income', key: 'from_family', emoji: '🤝' },
  { kind: 'expense', key: 'food', emoji: '🛒' },
  { kind: 'expense', key: 'eating_out', emoji: '☕' },
  { kind: 'expense', key: 'rent', emoji: '🏠' },
  { kind: 'expense', key: 'utilities', emoji: '💡' },
  { kind: 'expense', key: 'phone', emoji: '📱' },
  { kind: 'expense', key: 'transport', emoji: '🛵' },
  { kind: 'expense', key: 'family', emoji: '👪' },
  { kind: 'expense', key: 'loans', emoji: '💳' },
  { kind: 'expense', key: 'shopping', emoji: '🛍️' },
  { kind: 'expense', key: 'health', emoji: '💊' },
  { kind: 'expense', key: 'education', emoji: '📚' },
  { kind: 'expense', key: 'fun', emoji: '🎉' },
  { kind: 'expense', key: 'other', emoji: '📦' },
];

/** First time: this month's income, the spending categories that fit, and a monthly limit for the ones that matter. */
function SetupWizard({ today }: { today: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const session = useBizSession();
  const [picked, setPicked] = useState<Record<string, boolean>>(() => Object.fromEntries(STARTER.map((s) => [s.key, true])));
  const [limits, setLimits] = useState<Record<string, string>>({});
  const [income, setIncome] = useState('');
  const toastError = useToastError();
  const start = useMutation({
    mutationFn: async () => {
      const categories = STARTER.filter((s) => picked[s.key]).map((s) => ({ kind: s.kind, key: s.key, name: t(`budget.starter.${s.key}`), emoji: s.emoji, monthlyLimit: s.kind === 'expense' ? (limits[s.key] ?? '').trim() || null : null }));
      await api.post('/budget/setup', { categories });
      if (income.trim()) {
        const cats = await api.get<{ items: Category[] }>('/budget/categories');
        const salary = cats.items.find((c) => c.kind === 'income' && c.key === 'salary');
        await api.post('/budget/entries', { kind: 'income', amount: income.trim(), occurredOn: today, categoryId: salary?.id ?? null, note: '' });
      }
    },
    onSuccess: () => {
      toast.success(t('budget.setup_done'));
      refresh(qc);
    },
    onError: toastError,
  });
  const first = session.user.name.split(' ')[0];
  return (
    <div className="mx-auto max-w-xl space-y-5 pb-6">
      <div className="pt-2">
        <p className="text-sm text-slate-500">{t('budget.hello', { name: first })}</p>
        <h1 className="mt-1 text-2xl font-semibold">{t('budget.setup_title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('budget.setup_body')}</p>
      </div>
      <Card>
        <h2 className="font-semibold">{t('budget.setup_income')}</h2>
        <p className="mb-3 text-sm text-slate-500">{t('budget.setup_income_hint')}</p>
        <AmountInput label={t('budget.income_this_month')} value={income} onChange={setIncome} placeholder={t('budget.optional')} />
      </Card>
      <Card>
        <h2 className="font-semibold">{t('budget.setup_spending')}</h2>
        <p className="mb-2 text-sm text-slate-500">{t('budget.setup_spending_hint')}</p>
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {STARTER.filter((s) => s.kind === 'expense').map((s) => (
            <li key={s.key} className="flex items-center gap-3 py-2">
              <button type="button" onClick={() => setPicked((p) => ({ ...p, [s.key]: !p[s.key] }))} aria-pressed={picked[s.key]} className={clsx('flex min-w-0 flex-1 items-center gap-2.5 text-start', !picked[s.key] && 'opacity-40')}>
                <span className={clsx('grid size-5 shrink-0 place-items-center rounded-md ring-1', picked[s.key] ? 'bg-brand-700 text-white ring-brand-700' : 'ring-slate-300 dark:ring-slate-600')}>{picked[s.key] && <Check className="size-3.5" />}</span>
                <span className="text-lg">{s.emoji}</span>
                <span className="truncate text-sm">{t(`budget.starter.${s.key}`)}</span>
              </button>
              <input
                inputMode="decimal"
                dir="ltr"
                aria-label={t('budget.limit_for', { name: t(`budget.starter.${s.key}`) })}
                disabled={!picked[s.key]}
                value={limits[s.key] ?? ''}
                onChange={(e) => setLimits((l) => ({ ...l, [s.key]: e.target.value }))}
                placeholder={t('budget.no_limit')}
                className="w-24 rounded-lg border-0 bg-slate-50 px-2.5 py-1.5 text-end text-sm tabular-nums ring-1 ring-slate-200 placeholder:text-xs placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500 disabled:opacity-40 dark:bg-slate-800 dark:ring-slate-700"
              />
            </li>
          ))}
        </ul>
      </Card>
      <Button size="lg" className="w-full" onClick={() => start.mutate()} loading={start.isPending} disabled={!STARTER.some((s) => s.kind === 'expense' && picked[s.key])}>
        {t('budget.setup_start')}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------- pay a bill
function PayBillDialog({ bill, today, onClose }: { bill: Bill; today: string; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [amount, setAmount] = useState(toText(bill.amount));
  const [paidWith, setPaidWith] = useState<PaidWith>('transfer');
  const [date, setDate] = useState(bill.dueDate.slice(0, 7) === today.slice(0, 7) ? today : bill.dueDate);
  const pay = useMutation({
    mutationFn: () => api.post(`/budget/bills/${bill.id}/pay`, { amount: amount.trim(), paidWith, occurredOn: date }),
    onSuccess: () => {
      toast.success(t('budget.bill_paid'));
      refresh(qc);
      onClose();
    },
  });
  const fieldErr = useFieldErrors(pay.error);
  return (
    <Dialog
      open
      onClose={onClose}
      title={t('budget.pay_bill', { name: bill.name })}
      size="sm"
      footer={
        <Button size="lg" className="w-full" onClick={() => pay.mutate()} loading={pay.isPending} disabled={!amount.trim()}>
          {t('budget.mark_paid')}
        </Button>
      }
    >
      <div className="space-y-4">
        <AmountInput label={t('flow.amount')} value={amount} onChange={setAmount} error={fieldErr('amount')} hint={t('budget.bill_amount_hint')} />
        <PaidWithPicker value={paidWith} onChange={setPaidWith} />
        <Input label={t('flow.date')} type="date" value={date} onChange={(e) => setDate(e.target.value)} error={fieldErr('occurredOn')} />
      </div>
    </Dialog>
  );
}

/** Bills not paid yet this month (soonest first). Paid ones and the full list live on My budget. */
function BillsDue({ o, manage }: { o: Overview; manage: boolean }) {
  const { t } = useTranslation();
  const money = useMoney();
  const f = useFormat();
  const [paying, setPaying] = useState<Bill | null>(null);
  const due = o.bills.filter((b) => !b.paid).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  if (!due.length) return null;
  return (
    <section>
      <h2 className="mb-2 px-1 text-sm font-semibold text-slate-500">{t('budget.bills_to_pay')}</h2>
      <Card padded={false}>
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {due.map((b) => (
            <li key={b.id} className="flex items-center gap-3 px-4 py-3">
              <CalendarClock className={clsx('size-5 shrink-0', b.overdue ? 'text-rose-500' : 'text-slate-400')} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium" dir="auto">
                  {b.name} · <span className="tabular-nums">{money(b.amount)}</span>
                </span>
                <span className={clsx('block truncate text-xs', b.overdue ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500')}>
                  {b.overdue
                    ? t('budget.overdue_since', { date: f.date(b.dueDate) })
                    : b.dueInDays === 0
                      ? t('budget.due_today')
                      : b.dueInDays !== null
                        ? t('budget.due_in', { count: b.dueInDays, date: f.date(b.dueDate) })
                        : t('budget.due_on', { date: f.date(b.dueDate) })}
                </span>
              </span>
              {manage && (
                <Button size="sm" variant="subtle" onClick={() => setPaying(b)}>
                  {t('budget.pay')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Card>
      {paying && <PayBillDialog bill={paying} today={o.today} onClose={() => setPaying(null)} />}
    </section>
  );
}

/** Where the money went: each category's share of the month's spending, biggest first. Tap one to see its records. */
function WhereItWent({ o, onPick, picked }: { o: Overview; onPick?: (id: string) => void; picked?: string }) {
  const { t } = useTranslation();
  const money = useMoney();
  const catName = useCatName();
  const rows = [...o.categories.filter((c) => c.spent > 0).map((c) => ({ key: c.id, name: catName(c), emoji: c.emoji, spent: c.spent })), ...(o.other.spent > 0 ? [{ key: '', name: t('budget.other'), emoji: '📦', spent: o.other.spent }] : [])].sort((a, b) => b.spent - a.spent);
  if (!rows.length) return <p className="py-2 text-sm text-slate-500">{t('budget.nothing_spent')}</p>;
  return (
    <ul className="space-y-1">
      {rows.map((r) => {
        const pct = o.totals.spent > 0 ? Math.round((r.spent * 100) / o.totals.spent) : 0;
        return (
          <li key={r.key || 'other'}>
            <button type="button" disabled={!onPick || !r.key} onClick={() => onPick?.(r.key)} className={clsx('w-full rounded-xl px-2 py-2 text-start disabled:cursor-default', picked === r.key ? 'bg-brand-50 dark:bg-brand-950' : onPick && r.key && 'hover:bg-slate-50 dark:hover:bg-slate-800/50')}>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-2" dir="auto">
                  <span className="text-base">{r.emoji}</span>
                  <span className="truncate">{r.name}</span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums">{money(r.spent)}</span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className="h-full rounded-full bg-brand-600 dark:bg-brand-400" style={{ width: `${Math.max(2, pct)}%` }} />
                </div>
                <span className="w-9 text-end text-xs text-slate-500 tabular-nums">{pct}%</span>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------- home
/**
 * Gravity Budget home, kept calm for a phone: what is left this month and what can be spent each day, the one most
 * useful tip, the budgets with a limit, bills still to pay, and the last few records. One "+ Add" button.
 */
export function BudgetHome() {
  const { t } = useTranslation();
  const money = useMoney();
  const session = useBizSession();
  const catName = useCatName();
  const { can } = useBiz();
  const [params, setParams] = useSearchParams();
  const month = params.get('month');
  const q = useOverview(month);
  const pending = usePendingEntries().map(pendingAsEntry);
  const o = q.data ? withPending(q.data, pending) : undefined;
  // Loaded here too, so the categories are on the phone for adding offline.
  useCategories();
  const insightText = useInsightText();
  const recent = useQuery({
    queryKey: [...KEY, 'entries', 'recent', o?.month],
    queryFn: () => api.get<{ items: Entry[]; total: number }>(`/budget/entries?month=${o!.month}&pageSize=4`),
    enabled: !!o?.setUp,
    placeholderData: keepPreviousData,
  });
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [allTips, setAllTips] = useState(false);
  if (!o) return <SkeletonRows rows={8} />;
  if (!o.setUp) return <SetupWizard today={o.today} />;
  const manage = can('budget.manage');
  const { totals } = o;
  const usedPct = totals.income > 0 ? Math.min(100, Math.round(((totals.spent + Math.max(0, totals.saved)) * 100) / totals.income)) : 0;
  const withLimit = o.categories.filter((c) => c.limit !== null);
  const tips = allTips ? o.insights : o.insights.slice(0, 1);
  const setMonth = (m: string | null) => setParams(m && m !== o.currentMonth ? { month: m } : {}, { replace: true });

  return (
    <div className="mx-auto max-w-xl space-y-5 pb-16">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-slate-500">{t('budget.hello', { name: session.user.name.split(' ')[0] })}</p>
        <MonthSwitcher month={o.month} current={o.currentMonth} onChange={setMonth} />
      </div>

      <OfflineNote waiting={pending.length} />

      {/* What is left, and what can be spent each day. */}
      <section className={clsx('rounded-3xl p-5 text-white shadow-sm', totals.left < 0 ? 'bg-rose-600' : 'gravity-surface')}>
        <p className="text-sm text-white/75">{totals.left < 0 ? t('budget.overspent') : t('budget.left_to_spend')}</p>
        <p className="mt-1 text-4xl font-bold tracking-tight tabular-nums">{money(Math.abs(totals.left))}</p>
        {o.safePerDay !== null && totals.left > 0 && (
          <p className="mt-2 text-sm text-white/90">{totals.left - totals.billsUnpaid > 0 ? t('budget.safe_per_day', { amount: money(o.safePerDay), count: o.daysLeft }) : t('budget.nothing_safe')}</p>
        )}
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/20">
          <div className="h-full rounded-full bg-white" style={{ width: `${usedPct}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-xs text-white/75">
          <span>
            {t('budget.money_in')} <span className="font-semibold text-white tabular-nums">{money(totals.income)}</span>
          </span>
          <span>
            {t('budget.spent')} <span className="font-semibold text-white tabular-nums">{money(totals.spent)}</span>
          </span>
        </div>
      </section>

      {tips.length > 0 && (
        <div className="space-y-2">
          {tips.map((i, n) => (
            <p key={`${i.code}-${n}`} className={clsx('flex items-start gap-2 rounded-2xl px-4 py-3 text-sm', i.tone === 'bad' ? 'bg-rose-50 text-rose-900 dark:bg-rose-950/40 dark:text-rose-100' : i.tone === 'warn' ? 'bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100' : i.tone === 'good' ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100' : 'bg-white text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800')}>
              <span className="mt-0.5">
                <InsightIcon tone={i.tone} />
              </span>
              <span dir="auto">{insightText(i)}</span>
            </p>
          ))}
          {o.insights.length > 1 && (
            <button type="button" onClick={() => setAllTips((v) => !v)} className="px-1 text-xs font-medium text-brand-700 dark:text-brand-300">
              {allTips ? t('budget.fewer_tips') : t('budget.more_tips', { count: o.insights.length - 1 })}
            </button>
          )}
        </div>
      )}

      <BillsDue o={o} manage={manage} />

      <section>
        <div className="mb-2 flex items-baseline justify-between px-1">
          <h2 className="text-sm font-semibold text-slate-500">{t('budget.my_budgets')}</h2>
          <Link to="/plan" className="text-xs font-medium text-brand-700 dark:text-brand-300">
            {t('budget.edit_budget')}
          </Link>
        </div>
        <Card>
          {withLimit.length === 0 ? (
            <p className="text-sm text-slate-500">
              {t('budget.no_limits_yet')}{' '}
              <Link to="/plan" className="font-medium text-brand-700 dark:text-brand-300">
                {t('budget.set_limits')}
              </Link>
            </p>
          ) : (
            <ul className="space-y-4">
              {withLimit.map((c) => (
                <li key={c.id}>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2" dir="auto">
                      <span className="text-base">{c.emoji}</span>
                      <span className="truncate">{catName(c)}</span>
                    </span>
                    <span className={clsx('shrink-0 text-xs tabular-nums', (c.left ?? 0) < 0 ? 'font-semibold text-rose-600 dark:text-rose-400' : 'text-slate-500')}>
                      {(c.left ?? 0) < 0 ? t('budget.over_by', { amount: money(-(c.left ?? 0)) }) : t('budget.left_in', { amount: money(c.left) })}
                    </span>
                  </div>
                  <Meter used={c.spent} limit={c.limit ?? 0} className="mt-2" />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section>
        <div className="mb-2 flex items-baseline justify-between px-1">
          <h2 className="text-sm font-semibold text-slate-500">{t('budget.latest')}</h2>
          <Link to={`/spending${o.isCurrent ? '' : `?month=${o.month}`}`} className="text-xs font-medium text-brand-700 dark:text-brand-300">
            {t('flow.see_all')}
          </Link>
        </div>
        <Card padded={false}>
          {!recent.data && !pending.length ? (
            <SkeletonRows rows={3} />
          ) : [...pending, ...(recent.data?.items ?? [])].length === 0 ? (
            <p className="px-4 py-5 text-sm text-slate-500">{t('budget.nothing_yet_hint')}</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {[...pending.filter((p) => p.occurredOn.startsWith(o.month)).reverse(), ...(recent.data?.items ?? [])].slice(0, 4).map((e) => (
                <EntryRow key={e.id} e={e} onOpen={() => manage && setEditing(e)} />
              ))}
            </ul>
          )}
        </Card>
      </section>

      {manage && <AddFab onAdd={() => setAdding(true)} />}
      {adding && <EntryDialog kind="expense" today={o.today} onClose={() => setAdding(false)} />}
      {editing && <EntryDialog kind={editing.kind} entry={editing} today={o.today} onClose={() => setEditing(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------- spending (every record)
/** Every record of a month, grouped by day. Tap a category in "Where your money went" to see only its records. */
export function BudgetSpendingPage() {
  const { t } = useTranslation();
  const money = useMoney();
  const f = useFormat();
  const { can } = useBiz();
  const [params, setParams] = useSearchParams();
  const ov = useOverview(params.get('month'));
  const pending = usePendingEntries().map(pendingAsEntry);
  const o = ov.data ? withPending(ov.data, pending) : undefined;
  const month = o?.month ?? null;
  const [kind, setKind] = useState<'' | Kind>('');
  const [categoryId, setCategoryId] = useState('');
  const [searching, setSearching] = useState(false);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [pages, setPages] = useState(1);
  useEffect(() => {
    const id = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);
  useEffect(() => setPages(1), [month, kind, categoryId, q]);
  const qs = new URLSearchParams({ pageSize: String(30 * pages) });
  if (month) qs.set('month', month);
  if (kind) qs.set('kind', kind);
  if (categoryId) qs.set('categoryId', categoryId);
  if (q) qs.set('q', q);
  const list = useQuery({ queryKey: [...KEY, 'entries', qs.toString()], queryFn: () => api.get<{ items: Entry[]; total: number }>(`/budget/entries?${qs}`), enabled: !!month, placeholderData: keepPreviousData });
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  const manage = can('budget.manage');
  // Records grouped by day, newest first, with each day's spending.
  const groups = useMemo(() => {
    const m = new Map<string, Entry[]>();
    const waiting = pending.filter((p) => !!month && p.occurredOn.startsWith(month) && (!kind || p.kind === kind) && (!categoryId || p.categoryId === categoryId) && !q);
    const all = [...waiting, ...(list.data?.items ?? [])].sort((a, b) => b.occurredOn.localeCompare(a.occurredOn));
    for (const e of all) m.set(e.occurredOn, [...(m.get(e.occurredOn) ?? []), e]);
    return [...m.entries()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.data, pending.length, month, kind, categoryId, q]);
  if (!o) return <SkeletonRows rows={8} />;
  const chip = (active: boolean) => clsx('rounded-full px-3.5 py-1.5 text-sm font-medium transition', active ? 'bg-brand-700 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800');
  return (
    <div className="mx-auto max-w-xl space-y-5 pb-16">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{t('budget.nav_spending')}</h1>
        <MonthSwitcher month={o.month} current={o.currentMonth} onChange={(m) => setParams(m && m !== o.currentMonth ? { month: m } : {}, { replace: true })} />
      </div>
      <div className="flex justify-between rounded-2xl bg-white px-4 py-3 text-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <span>
          <span className="block text-xs text-slate-500">{t('budget.money_in')}</span>
          <span className="font-semibold text-emerald-700 tabular-nums dark:text-emerald-300">{money(o.totals.income)}</span>
        </span>
        <span className="text-center">
          <span className="block text-xs text-slate-500">{t('budget.spent')}</span>
          <span className="font-semibold tabular-nums">{money(o.totals.spent)}</span>
        </span>
        <span className="text-end">
          <span className="block text-xs text-slate-500">{t('budget.left')}</span>
          <span className={clsx('font-semibold tabular-nums', o.totals.left < 0 && 'text-rose-600')}>{money(o.totals.left)}</span>
        </span>
      </div>
      <section>
        <h2 className="mb-2 px-1 text-sm font-semibold text-slate-500">{t('budget.where_it_went')}</h2>
        <Card className="!p-2">
          <WhereItWent o={o} picked={categoryId} onPick={(id) => setCategoryId((c) => (c === id ? '' : id))} />
        </Card>
      </section>
      <section>
        <div className="mb-2 flex items-center gap-2">
          {!searching ? (
            <>
              <button type="button" className={chip(!kind && !categoryId)} onClick={() => (setKind(''), setCategoryId(''))}>
                {t('budget.all_records')}
              </button>
              <button type="button" className={chip(kind === 'expense')} onClick={() => setKind(kind === 'expense' ? '' : 'expense')}>
                {t('budget.spending')}
              </button>
              <button type="button" className={chip(kind === 'income')} onClick={() => setKind(kind === 'income' ? '' : 'income')}>
                {t('budget.income')}
              </button>
              <button type="button" aria-label={t('common.search')} onClick={() => setSearching(true)} className="ms-auto grid size-9 place-items-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                <Search className="size-5" />
              </button>
            </>
          ) : (
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input autoFocus type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('common.search')} aria-label={t('common.search')} className="w-full rounded-full border-0 bg-white py-2.5 ps-9 pe-10 text-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-brand-500 dark:bg-slate-900 dark:ring-slate-700" />
              <button
                type="button"
                aria-label={t('common.close')}
                onClick={() => {
                  setSearching(false);
                  setSearch('');
                }}
                className="absolute end-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-slate-400"
              >
                <X className="size-4" />
              </button>
            </div>
          )}
        </div>
        <Card padded={false}>
          {!list.data && !groups.length ? (
            <SkeletonRows rows={5} />
          ) : !groups.length ? (
            <EmptyState icon={<Wallet className="size-6" />} title={t('budget.nothing_yet')} description={t('budget.nothing_yet_hint')} />
          ) : (
            <>
              {groups.map(([day, items]) => {
                const spent = items.filter((e) => e.kind === 'expense').reduce((s, e) => s + e.amount, 0);
                return (
                  <div key={day}>
                    <div className="flex items-baseline justify-between px-4 pt-3 pb-1 text-xs font-medium text-slate-500">
                      <span>{f.date(day)}</span>
                      {spent > 0 && <span className="tabular-nums">−{money(spent)}</span>}
                    </div>
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                      {items.map((e) => (
                        <EntryRow key={e.id} e={e} onOpen={() => manage && setEditing(e)} />
                      ))}
                    </ul>
                  </div>
                );
              })}
              {!!list.data && list.data.total > list.data.items.length && (
                <div className="p-3">
                  <Button variant="secondary" className="w-full" onClick={() => setPages((p) => p + 1)} loading={list.isFetching}>
                    {t('budget.load_more')}
                  </Button>
                </div>
              )}
            </>
          )}
        </Card>
      </section>
      {manage && <AddFab onAdd={() => setAdding(true)} />}
      {adding && <EntryDialog kind="expense" today={o.today} onClose={() => setAdding(false)} />}
      {editing && <EntryDialog kind={editing.kind} entry={editing} today={o.today} onClose={() => setEditing(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------- goals
function GoalDialog({ goal, onClose }: { goal?: Goal; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [name, setName] = useState(goal?.name ?? '');
  const [emoji, setEmoji] = useState(goal?.emoji ?? '🎯');
  const [target, setTarget] = useState(toText(goal?.target));
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const toastError = useToastError();
  const save = useMutation({
    mutationFn: () => {
      const body = { name, emoji, target: target.trim(), targetDate: targetDate || null };
      return goal ? api.put(`/budget/goals/${goal.id}`, body) : api.post('/budget/goals', body);
    },
    onSuccess: () => {
      toast.success(t('common.saved'));
      refresh(qc);
      onClose();
    },
  });
  const remove = useMutation({
    mutationFn: () => api.delete(`/budget/goals/${goal!.id}`),
    onSuccess: () => {
      refresh(qc);
      onClose();
    },
    onError: toastError,
  });
  const fieldErr = useFieldErrors(save.error);
  const EMOJIS = ['🎯', '🛡️', '📱', '🏍️', '🚗', '🏠', '💍', '🕋', '✈️', '🎓', '👶', '💻'];
  return (
    <Dialog
      open
      onClose={onClose}
      title={goal ? t('budget.edit_goal') : t('budget.new_goal')}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          {goal ? (
            <Button variant="ghost" icon={<Trash2 className="size-4" />} onClick={() => setConfirmDelete(true)}>
              {t('common.delete')}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!name.trim() || !target.trim()}>
              {t('common.save')}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">{t('budget.icon')}</p>
          <div className="flex flex-wrap gap-1.5">
            {EMOJIS.map((e) => (
              <button key={e} type="button" onClick={() => setEmoji(e)} aria-pressed={emoji === e} className={clsx('grid size-10 place-items-center rounded-xl text-xl ring-1', emoji === e ? 'bg-brand-50 ring-2 ring-brand-600 dark:bg-brand-950' : 'ring-slate-200 dark:ring-slate-700')}>
                {e}
              </button>
            ))}
          </div>
        </div>
        <Input label={t('budget.goal_name')} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder={t('budget.goal_name_hint')} error={fieldErr('name')} autoFocus />
        <AmountInput label={t('budget.goal_target')} value={target} onChange={setTarget} error={fieldErr('target')} />
        <Input label={t('budget.goal_date')} type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} hint={t('budget.goal_date_hint')} error={fieldErr('targetDate')} />
      </div>
      <ConfirmDialog open={confirmDelete} onClose={() => setConfirmDelete(false)} onConfirm={() => remove.mutate()} loading={remove.isPending} danger title={t('budget.delete_goal')} message={t('budget.delete_goal_body')} confirmLabel={t('common.delete')} />
    </Dialog>
  );
}

function GoalMoveDialog({ goal, direction, today, onClose }: { goal: Goal; direction: 'add' | 'take'; today: string; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const money = useMoney();
  const f = useFormat();
  const [amount, setAmount] = useState(direction === 'add' && goal.perMonth ? toText(Math.max(0, goal.perMonth - goal.thisMonth)) : '');
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const moves = useQuery({ queryKey: [...KEY, 'goal-moves', goal.id], queryFn: () => api.get<{ items: { id: string; amount: number; occurredOn: string; note: string }[] }>(`/budget/goals/${goal.id}/moves`) });
  const save = useMutation({
    mutationFn: () => api.post(`/budget/goals/${goal.id}/moves`, { direction, amount: amount.trim(), occurredOn: date, note }),
    onSuccess: () => {
      toast.success(direction === 'add' ? t('budget.goal_added', { amount: money(Math.round(Number(amount) * 100) || 0) }) : t('common.saved'));
      refresh(qc);
      onClose();
    },
  });
  const fieldErr = useFieldErrors(save.error);
  return (
    <Dialog
      open
      onClose={onClose}
      title={`${goal.emoji} ${direction === 'add' ? t('budget.put_in', { name: goal.name }) : t('budget.take_out', { name: goal.name })}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!amount.trim()} variant={direction === 'take' ? 'danger' : 'primary'}>
            {direction === 'add' ? t('budget.put_in_short') : t('budget.take_out_short')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-500">{t('budget.goal_saved_of', { saved: money(goal.saved), target: money(goal.target) })}</p>
        <AmountInput label={t('flow.amount')} value={amount} onChange={setAmount} error={fieldErr('amount')} autoFocus />
        <div className="grid grid-cols-2 gap-3">
          <Input label={t('flow.date')} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input label={t('flow.note')} value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
        </div>
        {!!moves.data?.items.length && (
          <div>
            <h3 className="mb-1 text-sm font-medium">{t('budget.goal_history')}</h3>
            <ul className="max-h-48 divide-y divide-slate-100 overflow-y-auto text-sm dark:divide-slate-800">
              {moves.data.items.map((m) => (
                <li key={m.id} className="flex justify-between gap-2 py-1.5">
                  <span className="text-slate-500" dir="auto">
                    {f.date(m.occurredOn)}
                    {m.note ? ` · ${m.note}` : ''}
                  </span>
                  <span className={clsx('tabular-nums', m.amount > 0 ? 'text-emerald-600' : 'text-rose-600')}>
                    {m.amount > 0 ? '+' : '−'}
                    {money(Math.abs(m.amount))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Dialog>
  );
}

export function BudgetGoalsPage() {
  const { t } = useTranslation();
  const money = useMoney();
  const f = useFormat();
  const { can } = useBiz();
  const q = useQuery({ queryKey: [...KEY, 'goals'], queryFn: () => api.get<{ today: string; items: Goal[] }>('/budget/goals') });
  const [editing, setEditing] = useState<Goal | 'new' | null>(null);
  const [moving, setMoving] = useState<{ goal: Goal; direction: 'add' | 'take' } | null>(null);
  const manage = can('budget.manage');
  if (!q.data) return <SkeletonRows rows={6} />;
  const goals = q.data.items;
  const total = goals.reduce((s, g) => s + g.saved, 0);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">{t('budget.nav_goals')}</h1>
          {goals.length > 0 && <p className="text-sm text-slate-500">{t('budget.goals_total', { amount: money(total) })}</p>}
        </div>
        {manage && (
          <Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
            {t('budget.new_goal')}
          </Button>
        )}
      </div>
      {goals.length === 0 ? (
        <Card>
          <EmptyState
            icon={<PiggyBank className="size-6" />}
            title={t('budget.no_goals')}
            description={t('budget.no_goals_hint')}
            action={
              manage && (
                <Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
                  {t('budget.new_goal')}
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {goals.map((g) => (
            <Card key={g.id}>
              <div className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-2xl dark:bg-brand-950">{g.emoji || <Target className="size-5" />}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="truncate font-semibold" dir="auto">
                      {g.name}
                    </h2>
                    {manage && (
                      <button type="button" aria-label={t('common.edit')} onClick={() => setEditing(g)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800">
                        <Pencil className="size-4" />
                      </button>
                    )}
                  </div>
                  <p className="text-sm tabular-nums">
                    <span className="font-semibold">{money(g.saved)}</span> <span className="text-slate-500">/ {money(g.target)}</span>
                  </p>
                </div>
              </div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className={clsx('h-full rounded-full', g.done ? 'bg-emerald-500' : 'bg-brand-600 dark:bg-brand-400')} style={{ width: `${Math.max(g.saved > 0 ? 3 : 0, g.percent)}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {g.done
                  ? t('budget.goal_done')
                  : g.late
                    ? t('budget.goal_late', { amount: money(g.remaining) })
                    : g.perMonth !== null
                      ? t('budget.goal_per_month', { amount: money(g.perMonth), date: f.date(g.targetDate) })
                      : t('budget.goal_remaining', { amount: money(g.remaining) })}
              </p>
              {g.onTrack !== null && !g.done && (
                <p className={clsx('mt-1 text-xs font-medium', g.onTrack ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')}>
                  {g.onTrack ? t('budget.goal_on_track') : t('budget.goal_behind', { amount: money(Math.max(0, (g.perMonth ?? 0) - g.thisMonth)) })}
                </p>
              )}
              {manage && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setMoving({ goal: g, direction: 'add' })}>
                    {t('budget.put_in_short')}
                  </Button>
                  <Button size="sm" variant="secondary" icon={<Minus className="size-4" />} onClick={() => setMoving({ goal: g, direction: 'take' })} disabled={g.saved <= 0}>
                    {t('budget.take_out_short')}
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
      <p className="text-center text-xs text-slate-500">{t('budget.goals_note')}</p>
      {editing && <GoalDialog goal={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {moving && <GoalMoveDialog goal={moving.goal} direction={moving.direction} today={q.data.today} onClose={() => setMoving(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------- my budget (categories, limits, bills)
function CategoryDialog({ category, kind, onClose }: { category?: Category; kind: Kind; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const catName = useCatName();
  const shownName = category ? catName(category) : '';
  const [name, setName] = useState(shownName);
  const [emoji, setEmoji] = useState(category?.emoji ?? '');
  const [limit, setLimit] = useState(toText(category?.monthlyLimit));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const toastError = useToastError();
  const save = useMutation({
    mutationFn: () => {
      const body = { name, emoji, monthlyLimit: kind === 'expense' ? limit.trim() || null : null };
      if (!category) return api.post('/budget/categories', { ...body, kind });
      // An unchanged name is not sent, so a set-up category keeps following the app language.
      return api.patch(`/budget/categories/${category.id}`, name.trim() === shownName ? { emoji: body.emoji, monthlyLimit: body.monthlyLimit } : body);
    },
    onSuccess: () => {
      toast.success(t('common.saved'));
      refresh(qc);
      onClose();
    },
  });
  const remove = useMutation({
    mutationFn: () => api.delete(`/budget/categories/${category!.id}`),
    onSuccess: () => {
      refresh(qc);
      onClose();
    },
    onError: toastError,
  });
  const fieldErr = useFieldErrors(save.error);
  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      title={category ? t('budget.edit_category') : kind === 'income' ? t('budget.new_income_category') : t('budget.new_category')}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          {category ? (
            <Button variant="ghost" icon={<Trash2 className="size-4" />} onClick={() => setConfirmDelete(true)}>
              {t('common.delete')}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!name.trim()}>
              {t('common.save')}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-[5rem_1fr] gap-3">
          <Input label={t('budget.icon')} value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={8} className="text-center text-lg" />
          <Input label={t('common.name')} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} error={fieldErr('name')} autoFocus />
        </div>
        {kind === 'expense' && <AmountInput label={t('budget.monthly_limit')} value={limit} onChange={setLimit} error={fieldErr('monthlyLimit')} hint={t('budget.monthly_limit_hint')} placeholder={t('budget.no_limit')} />}
      </div>
      <ConfirmDialog open={confirmDelete} onClose={() => setConfirmDelete(false)} onConfirm={() => remove.mutate()} loading={remove.isPending} danger title={t('budget.delete_category')} message={t('budget.delete_category_body')} confirmLabel={t('common.delete')} />
    </Dialog>
  );
}

interface BillRow {
  id: string;
  name: string;
  amount: number;
  dueDay: number;
  categoryId: string | null;
  isActive: boolean;
}

function BillDialog({ bill, categories, onClose }: { bill?: BillRow; categories: Category[]; onClose: () => void }) {
  const { t } = useTranslation();
  const catName = useCatName();
  const qc = useQueryClient();
  const [name, setName] = useState(bill?.name ?? '');
  const [amount, setAmount] = useState(toText(bill?.amount));
  const [dueDay, setDueDay] = useState(String(bill?.dueDay ?? 1));
  const [categoryId, setCategoryId] = useState(bill?.categoryId ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const toastError = useToastError();
  const save = useMutation({
    mutationFn: () => {
      const body = { name, amount: amount.trim(), dueDay: Number(dueDay), categoryId: categoryId || null, isActive: true };
      return bill ? api.put(`/budget/bills/${bill.id}`, body) : api.post('/budget/bills', body);
    },
    onSuccess: () => {
      toast.success(t('common.saved'));
      refresh(qc);
      onClose();
    },
  });
  const remove = useMutation({
    mutationFn: () => api.delete(`/budget/bills/${bill!.id}`),
    onSuccess: () => {
      refresh(qc);
      onClose();
    },
    onError: toastError,
  });
  const fieldErr = useFieldErrors(save.error);
  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      title={bill ? t('budget.edit_bill') : t('budget.new_bill')}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          {bill ? (
            <Button variant="ghost" icon={<Trash2 className="size-4" />} onClick={() => setConfirmDelete(true)}>
              {t('common.delete')}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!name.trim() || !amount.trim()}>
              {t('common.save')}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <Input label={t('budget.bill_name')} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder={t('budget.bill_name_hint')} error={fieldErr('name')} autoFocus />
        <AmountInput label={t('budget.bill_amount')} value={amount} onChange={setAmount} error={fieldErr('amount')} />
        <Select label={t('budget.due_day')} value={dueDay} onChange={(e) => setDueDay(e.target.value)} error={fieldErr('dueDay')}>
          {Array.from({ length: 31 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1}
            </option>
          ))}
        </Select>
        <Select label={t('flow.category')} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} error={fieldErr('categoryId')}>
          <option value="">{t('flow.no_category')}</option>
          {categories
            .filter((c) => c.kind === 'expense')
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {catName(c)}
              </option>
            ))}
        </Select>
      </div>
      <ConfirmDialog open={confirmDelete} onClose={() => setConfirmDelete(false)} onConfirm={() => remove.mutate()} loading={remove.isPending} danger title={t('budget.delete_bill')} message={t('budget.delete_bill_body')} confirmLabel={t('common.delete')} />
    </Dialog>
  );
}

export function BudgetPlanPage() {
  const { t } = useTranslation();
  const catName = useCatName();
  const money = useMoney();
  const { can } = useBiz();
  const cats = useCategories();
  const ov = useOverview(null);
  const bills = useQuery({ queryKey: [...KEY, 'bills'], queryFn: () => api.get<{ items: BillRow[] }>('/budget/bills') });
  const [editing, setEditing] = useState<{ kind: Kind; category?: Category } | null>(null);
  const [billEditing, setBillEditing] = useState<BillRow | 'new' | null>(null);
  const manage = can('budget.manage');
  if (!cats.data || !ov.data) return <SkeletonRows rows={8} />;
  const spending = cats.data.items.filter((c) => c.kind === 'expense');
  const income = cats.data.items.filter((c) => c.kind === 'income');
  const budgeted = spending.reduce((s, c) => s + (c.monthlyLimit ?? 0), 0);
  const billTotal = (bills.data?.items ?? []).filter((b) => b.isActive).reduce((s, b) => s + b.amount, 0);
  const spentBy = new Map(ov.data.categories.map((c) => [c.id, c.spent]));
  const incomeRef = Math.max(ov.data.totals.income, ov.data.previous.income);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">{t('budget.nav_plan')}</h1>
        <p className="text-sm text-slate-500">{t('budget.plan_hint')}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <span className="block text-xs text-slate-500">{t('budget.planned_spending')}</span>
          <span className="text-lg font-semibold tabular-nums">{money(budgeted)}</span>
        </div>
        <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <span className="block text-xs text-slate-500">{t('budget.monthly_bills')}</span>
          <span className="text-lg font-semibold tabular-nums">{money(billTotal)}</span>
        </div>
        {incomeRef > 0 && (
          <p className={clsx('col-span-2 rounded-xl px-3 py-2 text-sm', budgeted > incomeRef ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200' : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200')}>
            {budgeted > incomeRef ? t('budget.plan_over_income', { amount: money(budgeted - incomeRef), income: money(incomeRef) }) : t('budget.plan_under_income', { amount: money(incomeRef - budgeted), income: money(incomeRef) })}
          </p>
        )}
      </div>

      <Card padded={false}>
        <div className="flex items-center justify-between gap-2 p-4 pb-2">
          <h2 className="font-semibold">{t('budget.spending_limits')}</h2>
          {manage && (
            <Button size="sm" variant="subtle" icon={<Plus className="size-4" />} onClick={() => setEditing({ kind: 'expense' })}>
              {t('budget.add')}
            </Button>
          )}
        </div>
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {spending.map((c) => (
            <li key={c.id}>
              <button type="button" disabled={!manage} onClick={() => setEditing({ kind: 'expense', category: c })} className="flex w-full items-center gap-3 px-4 py-3 text-start hover:bg-slate-50 disabled:cursor-default dark:hover:bg-slate-800/40">
                <span className="text-xl">{c.emoji || '•'}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium" dir="auto">
                    {catName(c)}
                  </span>
                  <span className="block text-xs text-slate-500">{t('budget.spent_this_month', { amount: money(spentBy.get(c.id) ?? 0) })}</span>
                </span>
                <span className={clsx('shrink-0 text-sm tabular-nums', c.monthlyLimit ? 'font-semibold' : 'text-slate-400')}>{c.monthlyLimit ? money(c.monthlyLimit) : t('budget.no_limit')}</span>
                {manage && <Pencil className="size-4 shrink-0 text-slate-400" />}
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Card padded={false}>
        <div className="flex items-center justify-between gap-2 p-4 pb-2">
          <div>
            <h2 className="font-semibold">{t('budget.monthly_bills')}</h2>
            <p className="text-xs text-slate-500">{t('budget.bills_hint')}</p>
          </div>
          {manage && (
            <Button size="sm" variant="subtle" icon={<Plus className="size-4" />} onClick={() => setBillEditing('new')}>
              {t('budget.add')}
            </Button>
          )}
        </div>
        {!bills.data?.items.length ? (
          <p className="px-4 pb-5 pt-1 text-sm text-slate-500">{t('budget.no_bills')}</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {bills.data.items.map((b) => (
              <li key={b.id}>
                <button type="button" disabled={!manage} onClick={() => setBillEditing(b)} className="flex w-full items-center gap-3 px-4 py-3 text-start hover:bg-slate-50 disabled:cursor-default dark:hover:bg-slate-800/40">
                  <CalendarClock className="size-5 shrink-0 text-slate-400" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium" dir="auto">
                      {b.name}
                    </span>
                    <span className="block text-xs text-slate-500">{t('budget.every_month_on', { day: b.dueDay })}</span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">{money(b.amount)}</span>
                  {manage && <Pencil className="size-4 shrink-0 text-slate-400" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card padded={false}>
        <div className="flex items-center justify-between gap-2 p-4 pb-2">
          <h2 className="font-semibold">{t('budget.income_types')}</h2>
          {manage && (
            <Button size="sm" variant="subtle" icon={<Plus className="size-4" />} onClick={() => setEditing({ kind: 'income' })}>
              {t('budget.add')}
            </Button>
          )}
        </div>
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {income.map((c) => (
            <li key={c.id}>
              <button type="button" disabled={!manage} onClick={() => setEditing({ kind: 'income', category: c })} className="flex w-full items-center gap-3 px-4 py-3 text-start hover:bg-slate-50 disabled:cursor-default dark:hover:bg-slate-800/40">
                <span className="text-xl">{c.emoji || '•'}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium" dir="auto">
                  {catName(c)}
                </span>
                {manage && <Pencil className="size-4 shrink-0 text-slate-400" />}
              </button>
            </li>
          ))}
        </ul>
      </Card>
      {editing && <CategoryDialog kind={editing.kind} category={editing.category} onClose={() => setEditing(null)} />}
      {billEditing && <BillDialog bill={billEditing === 'new' ? undefined : billEditing} categories={cats.data.items} onClose={() => setBillEditing(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------- months
interface MonthRow {
  month: string;
  income: number;
  spent: number;
  saved: number;
  left: number;
}

/** Twelve months: money in (green) and money spent (red) side by side. */
function MonthsChart({ months }: { months: MonthRow[] }) {
  const { t } = useTranslation();
  const money = useMoney();
  const max = Math.max(1, ...months.flatMap((m) => [m.income, m.spent]));
  return (
    <div>
      <div className="flex h-36 items-end gap-1.5" role="img" aria-label={t('budget.months_chart')}>
        {months.map((m) => (
          <div key={m.month} className="flex h-full flex-1 items-end justify-center gap-[2px]">
            <div className="w-1/2 max-w-3 rounded-t-sm bg-emerald-500" style={{ height: `${Math.max(m.income ? 2 : 0, (m.income * 100) / max)}%` }} title={`${m.month}: ${money(m.income)}`} />
            <div className="w-1/2 max-w-3 rounded-t-sm bg-rose-500" style={{ height: `${Math.max(m.spent ? 2 : 0, (m.spent * 100) / max)}%` }} title={`${m.month}: ${money(m.spent)}`} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1.5 text-center text-[10px] text-slate-500">
        {months.map((m) => (
          <span key={m.month} className="flex-1">
            {t(`flow.mshort${Number(m.month.slice(5))}`)}
          </span>
        ))}
      </div>
      <div className="mt-2 flex justify-center gap-4 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1">
          <span className="size-2.5 rounded-sm bg-emerald-500" /> {t('budget.money_in')}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2.5 rounded-sm bg-rose-500" /> {t('budget.spent')}
        </span>
      </div>
    </div>
  );
}

export function BudgetMonthsPage() {
  const { t } = useTranslation();
  const money = useMoney();
  const monthName = useMonthName();
  const q = useQuery({ queryKey: [...KEY, 'months'], queryFn: () => api.get<{ items: MonthRow[] }>('/budget/months?count=12') });
  if (!q.data) return <SkeletonRows rows={8} />;
  const rows = [...q.data.items].reverse();
  const active = q.data.items.filter((m) => m.income || m.spent);
  const avgSpent = active.length ? Math.round(active.reduce((s, m) => s + m.spent, 0) / active.length) : 0;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">{t('budget.nav_months')}</h1>
        {avgSpent > 0 && <p className="text-sm text-slate-500">{t('budget.avg_spent', { amount: money(avgSpent) })}</p>}
      </div>
      <Card>
        <MonthsChart months={q.data.items} />
      </Card>
      <Card padded={false}>
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((m) => (
            <li key={m.month} className="flex items-center gap-3 px-4 py-3">
              <Link to={`/?month=${m.month}`} className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{monthName(m.month)}</span>
                <span className="block text-xs text-slate-500 tabular-nums">
                  {t('budget.money_in')} {money(m.income)} · {t('budget.spent')} {money(m.spent)}
                  {m.saved ? ` · ${t('budget.saved')} ${money(m.saved)}` : ''}
                </span>
              </Link>
              <span className={clsx('shrink-0 text-sm font-semibold tabular-nums', m.left < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400')}>{money(m.left)}</span>
              <Link to={`/print/budget/${m.month}`} aria-label={t('budget.download_month', { month: monthName(m.month) })} className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50 dark:ring-slate-700 dark:hover:bg-slate-800">
                <Download className="size-4" />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
