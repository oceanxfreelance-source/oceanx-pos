import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import clsx from 'clsx';
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Minus, Pencil, Plus, Search, Tags, Trash2 } from 'lucide-react';
import { addMonths } from '@oceanx/shared';
import { api } from '../../lib/api';
import { useBiz } from '../../auth/business';
import { useMoney } from '../../lib/money';
import { useFormat } from '../../lib/format';
import { useFieldErrors, useToastError } from '../../lib/useApiError';
import { Card, EmptyState, PageHeader, SkeletonRows } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Form';
import { ConfirmDialog, Dialog } from '../../components/ui/Dialog';

// ---------------------------------------------------------------- types
type Kind = 'income' | 'expense';
interface Day {
  date: string;
  income: number;
  expense: number;
  profit: number;
  cumulative: number;
}
interface Totals {
  income: number;
  expense: number;
  net: number;
  margin: number | null;
}
interface Summary {
  month: string;
  today: string;
  currentMonth: string;
  totals: Totals;
  previous: Totals;
  days: Day[];
}
interface MonthRow extends Totals {
  month: string;
  count?: number;
}
interface Category {
  id: string;
  kind: Kind;
  name: string;
  transactions: number;
}
interface Tx {
  id: string;
  kind: Kind;
  amount: number;
  occurredOn: string;
  categoryId: string | null;
  categoryName: string;
  description: string;
}

const FLOW = ['biz', 'flow'] as const;
const invalidateFlow = (qc: ReturnType<typeof useQueryClient>) => void qc.invalidateQueries({ queryKey: FLOW });

/** "October 2026" in the user's language (month names come from the translations, so Dhivehi works too). */
function useMonthName() {
  const { t } = useTranslation();
  return (month: string, short = false) => {
    const [y, m] = month.split('-');
    return `${t(`flow.${short ? 'mshort' : 'm'}${Number(m)}`)} ${y}`;
  };
}

/** Big numbers on chart axes: 1.2k, 35k, 1.5M. */
function compact(minor: number) {
  const v = minor / 100;
  const a = Math.abs(v);
  const s = a >= 1_000_000 ? `${(a / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1)}M` : a >= 1000 ? `${(a / 1000).toFixed(a >= 10_000 ? 0 : 1)}k` : `${Math.round(a)}`;
  return `${v < 0 ? '−' : ''}${s.replace('.0', '')}`;
}

/** Nice axis bounds and ticks covering min..max, always including zero. */
function scale(values: number[]) {
  let lo = Math.min(0, ...values);
  let hi = Math.max(0, ...values);
  if (lo === hi) hi = lo + 10_000;
  const span = hi - lo;
  const step0 = span / 4;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) ?? step0;
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v));
  return { lo, hi, ticks };
}

// ---------------------------------------------------------------- charts
const PAD = { l: 44, r: 8, t: 10, b: 26 };

/** Charts are drawn at their real on-screen width, so labels stay readable on phones. */
function useChartBox() {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [w, setW] = useState(640);
  useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setW(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return { ref: setEl, W: w, H: Math.round(Math.min(260, Math.max(190, w * 0.42))) };
}

/** Each day's profit (income − expenses): green bars up, red bars down, from the zero line. Every day of the month is shown. */
function DailyProfitChart({ days, today, selected, onSelect }: { days: Day[]; today: string; selected: string | null; onSelect: (d: string) => void }) {
  const box = useChartBox();
  const { W, H } = box;
  const { t } = useTranslation();
  const money = useMoney();
  const { lo, hi, ticks } = scale(days.map((d) => d.profit));
  const pw = W - PAD.l - PAD.r;
  const ph = H - PAD.t - PAD.b;
  const y = (v: number) => PAD.t + ((hi - v) / (hi - lo)) * ph;
  const slot = pw / days.length;
  const bw = Math.max(2, slot * 0.66);
  return (
    <div ref={box.ref}>
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full touch-manipulation" role="img" aria-label={t('flow.daily_chart')}>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className={v === 0 ? 'stroke-slate-500 dark:stroke-slate-400' : 'stroke-slate-200 dark:stroke-slate-800'} strokeWidth={v === 0 ? 1.5 : 1} />
          <text x={PAD.l - 6} y={y(v) + 4} textAnchor="end" className="fill-slate-500 text-[11px]">
            {compact(v)}
          </text>
        </g>
      ))}
      {days.map((d, i) => {
        const x = PAD.l + i * slot + (slot - bw) / 2;
        const top = y(Math.max(0, d.profit));
        const h = Math.max(d.profit === 0 ? 0 : 1.5, Math.abs(y(d.profit) - y(0)));
        const day = Number(d.date.slice(8));
        const future = d.date > today;
        return (
          <g key={d.date} onClick={() => onSelect(d.date)} className="cursor-pointer">
            <rect x={PAD.l + i * slot} y={PAD.t} width={slot} height={ph} className={selected === d.date ? 'fill-brand-500/10' : 'fill-transparent'} />
            <rect x={x} y={top} width={bw} height={h} rx={Math.min(3, bw / 3)} className={clsx(d.profit >= 0 ? 'fill-emerald-500' : 'fill-rose-500', future && 'opacity-30')}>
              <title>{`${d.date}: ${money(d.profit)}`}</title>
            </rect>
            {(day === 1 || (day % 5 === 0 && day < days.length - 1) || day === days.length) && (
              <text x={PAD.l + i * slot + slot / 2} y={H - 8} textAnchor="middle" className={clsx('text-[11px]', d.date === today ? 'fill-brand-600 font-bold dark:fill-brand-300' : 'fill-slate-500')}>
                {day}
              </text>
            )}
          </g>
        );
      })}
    </svg>
    </div>
  );
}

/** Profit so far this month: the running total from the 1st, day by day. Above the zero line = in profit, below = loss. */
function MonthProfitChart({ days, today }: { days: Day[]; today: string }) {
  const box = useChartBox();
  const { W, H } = box;
  const { t } = useTranslation();
  const money = useMoney();
  // The current month's line stops at today (the future is not known yet).
  const shown = days.filter((d) => d.date <= today);
  const { lo, hi, ticks } = scale(days.map((d) => d.cumulative));
  const pw = W - PAD.l - PAD.r;
  const ph = H - PAD.t - PAD.b;
  const y = (v: number) => PAD.t + ((hi - v) / (hi - lo)) * ph;
  const x = (i: number) => PAD.l + (days.length === 1 ? pw / 2 : (i / (days.length - 1)) * pw);
  const pts = shown.map((d, i) => [x(i), y(d.cumulative)] as const);
  const line = pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ');
  const area = pts.length ? `${line} L${pts[pts.length - 1]![0].toFixed(1)},${y(0).toFixed(1)} L${pts[0]![0].toFixed(1)},${y(0).toFixed(1)} Z` : '';
  const last = shown[shown.length - 1];
  const id = useMemo(() => `m${Math.random().toString(36).slice(2, 8)}`, []);
  return (
    <div ref={box.ref}>
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={t('flow.month_chart')}>
      <defs>
        <clipPath id={`${id}up`}>
          <rect x={0} y={0} width={W} height={y(0) + 1.5} />
        </clipPath>
        <clipPath id={`${id}down`}>
          <rect x={0} y={y(0) + 1.5} width={W} height={H} />
        </clipPath>
      </defs>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className={v === 0 ? 'stroke-slate-500 dark:stroke-slate-400' : 'stroke-slate-200 dark:stroke-slate-800'} strokeWidth={v === 0 ? 1.5 : 1} />
          <text x={PAD.l - 6} y={y(v) + 4} textAnchor="end" className="fill-slate-500 text-[11px]">
            {compact(v)}
          </text>
        </g>
      ))}
      {area && (
        <>
          <path d={area} clipPath={`url(#${id}up)`} className="fill-emerald-500/20" />
          <path d={area} clipPath={`url(#${id}down)`} className="fill-rose-500/20" />
          <path d={line} clipPath={`url(#${id}up)`} fill="none" className="stroke-emerald-500" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          <path d={line} clipPath={`url(#${id}down)`} fill="none" className="stroke-rose-500" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        </>
      )}
      {last && <circle cx={pts[pts.length - 1]![0]} cy={pts[pts.length - 1]![1]} r={4.5} className={last.cumulative >= 0 ? 'fill-emerald-500' : 'fill-rose-500'}>
        <title>{`${last.date}: ${money(last.cumulative)}`}</title>
      </circle>}
      {days.map((d, i) => {
        const day = Number(d.date.slice(8));
        return day === 1 || (day % 5 === 0 && day < days.length - 1) || day === days.length ? (
          <text key={d.date} x={x(i)} y={H - 8} textAnchor="middle" className={clsx('text-[11px]', d.date === today ? 'fill-brand-600 font-bold dark:fill-brand-300' : 'fill-slate-500')}>
            {day}
          </text>
        ) : null;
      })}
    </svg>
    </div>
  );
}

/** Month by month: income (green) and expenses (red) side by side, profit as a dot. */
function MonthsChart({ months, onPick }: { months: MonthRow[]; onPick?: (m: string) => void }) {
  const box = useChartBox();
  const { W, H } = box;
  const { t } = useTranslation();
  const money = useMoney();
  const monthName = useMonthName();
  const { lo, hi, ticks } = scale(months.flatMap((m) => [m.income, m.expense, m.net]));
  const pw = W - PAD.l - PAD.r;
  const ph = H - PAD.t - PAD.b;
  const y = (v: number) => PAD.t + ((hi - v) / (hi - lo)) * ph;
  const slot = pw / months.length;
  const bw = Math.max(3, slot * 0.3);
  return (
    <div ref={box.ref}>
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={t('flow.months_chart')}>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className={v === 0 ? 'stroke-slate-500 dark:stroke-slate-400' : 'stroke-slate-200 dark:stroke-slate-800'} strokeWidth={v === 0 ? 1.5 : 1} />
          <text x={PAD.l - 6} y={y(v) + 4} textAnchor="end" className="fill-slate-500 text-[11px]">
            {compact(v)}
          </text>
        </g>
      ))}
      {months.map((m, i) => {
        const cx = PAD.l + i * slot + slot / 2;
        return (
          <g key={m.month} onClick={() => onPick?.(m.month)} className={onPick ? 'cursor-pointer' : undefined}>
            <title>{`${monthName(m.month)}\n${t('flow.income')}: ${money(m.income)}\n${t('flow.expenses')}: ${money(m.expense)}\n${t('flow.profit')}: ${money(m.net)}`}</title>
            <rect x={PAD.l + i * slot} y={PAD.t} width={slot} height={ph} className="fill-transparent" />
            <rect x={cx - bw - 1} y={y(m.income)} width={bw} height={Math.max(0, y(0) - y(m.income))} rx={2} className="fill-emerald-500" />
            <rect x={cx + 1} y={y(m.expense)} width={bw} height={Math.max(0, y(0) - y(m.expense))} rx={2} className="fill-rose-400" />
            <circle cx={cx} cy={y(m.net)} r={4} className={m.net >= 0 ? 'fill-brand-700 stroke-white dark:fill-brand-300' : 'fill-rose-700 stroke-white'} strokeWidth={1.5} />
            <text x={cx} y={H - 8} textAnchor="middle" className="fill-slate-500 text-[11px]">
              {monthName(m.month, true).split(' ')[0]}
            </text>
          </g>
        );
      })}
    </svg>
    </div>
  );
}

// ---------------------------------------------------------------- pieces
function MonthSwitcher({ month, current, onChange }: { month: string; current: string; onChange: (m: string | null) => void }) {
  const { t } = useTranslation();
  const monthName = useMonthName();
  return (
    <div className="flex items-center gap-2">
      <button type="button" aria-label={t('flow.prev_month')} onClick={() => onChange(addMonths(month, -1))} className="grid size-10 place-items-center rounded-xl bg-white shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:ring-slate-800">
        <ChevronLeft className="rtl-flip size-5" />
      </button>
      <h1 className="min-w-36 text-center text-lg font-semibold sm:text-xl">{monthName(month)}</h1>
      <button type="button" aria-label={t('flow.next_month')} onClick={() => onChange(addMonths(month, 1))} disabled={month >= current} className="grid size-10 place-items-center rounded-xl bg-white shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40 dark:bg-slate-900 dark:ring-slate-800">
        <ChevronRight className="rtl-flip size-5" />
      </button>
      {month !== current && (
        <button type="button" onClick={() => onChange(null)} className="rounded-full bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-800 dark:bg-brand-950 dark:text-brand-200">
          {t('flow.this_month')}
        </button>
      )}
    </div>
  );
}

/** Change against the month before (shown under each KPI). */
function Change({ now, before, goodWhenUp = true }: { now: number; before: number; goodWhenUp?: boolean }) {
  const { t } = useTranslation();
  const money = useMoney();
  if (now === before) return <span className="text-slate-500">{t('flow.same_as_last')}</span>;
  const up = now > before;
  const good = up === goodWhenUp;
  return (
    <span className={clsx('inline-flex items-center gap-0.5', good ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
      {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
      {money(Math.abs(now - before))} {t('flow.vs_last')}
    </span>
  );
}

function Kpi({ label, value, tone, children }: { label: string; value: React.ReactNode; tone: 'green' | 'red' | 'navy' | 'loss'; children?: React.ReactNode }) {
  return (
    <div className={clsx('min-w-0 rounded-2xl p-4 shadow-sm ring-1', tone === 'navy' ? 'gravity-surface text-white ring-white/10' : tone === 'loss' ? 'bg-rose-600 text-white ring-rose-700' : 'bg-white ring-slate-200/80 dark:bg-slate-900 dark:ring-slate-800')}>
      <p className={clsx('text-xs font-medium sm:text-sm', tone === 'navy' || tone === 'loss' ? 'text-white/75' : 'text-slate-500')}>{label}</p>
      <p className={clsx('mt-1 truncate text-xl font-bold tabular-nums sm:text-2xl', tone === 'green' && 'text-emerald-600 dark:text-emerald-400', tone === 'red' && 'text-rose-600 dark:text-rose-400')}>{value}</p>
      {children && <p className={clsx('mt-1 truncate text-xs', tone === 'navy' || tone === 'loss' ? 'text-white/80 [&_*]:!text-white/90' : '')}>{children}</p>}
    </div>
  );
}

function useCategories() {
  return useQuery({ queryKey: [...FLOW, 'categories'], queryFn: () => api.get<{ items: Category[] }>('/finance/categories') });
}

/** Add or change one income or expense. Amount is typed as text and checked exactly on the server. */
function TransactionDialog({ kind: initialKind, tx, today, onClose }: { kind: Kind; tx?: Tx; today: string; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const money = useMoney();
  const cats = useCategories();
  const [kind, setKind] = useState<Kind>(tx?.kind ?? initialKind);
  const [amount, setAmount] = useState(tx ? (tx.amount / 100).toFixed(2) : '');
  const [date, setDate] = useState(tx?.occurredOn ?? today);
  const [categoryId, setCategoryId] = useState<string>(tx?.categoryId ?? '');
  const [newCat, setNewCat] = useState<string | null>(null);
  const [description, setDescription] = useState(tx?.description ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const toastError = useToastError();
  const save = useMutation({
    mutationFn: async () => {
      let cat: string | null = categoryId || null;
      if (newCat !== null && newCat.trim()) cat = (await api.post<Category>('/finance/categories', { kind, name: newCat.trim() })).id;
      const body = { kind, amount: amount.trim(), occurredOn: date, categoryId: cat, description };
      return tx ? api.put(`/finance/transactions/${tx.id}`, body) : api.post('/finance/transactions', body);
    },
    onSuccess: () => {
      toast.success(t('common.saved'));
      invalidateFlow(qc);
      onClose();
    },
  });
  const remove = useMutation({
    mutationFn: () => api.delete(`/finance/transactions/${tx!.id}`),
    onSuccess: () => {
      toast.success(t('flow.deleted'));
      invalidateFlow(qc);
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
      title={tx ? t('flow.edit') : kind === 'income' ? t('flow.add_income') : t('flow.add_expense')}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          {tx ? (
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
            <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!amount.trim()}>
              {t('common.save')}
            </Button>
          </div>
        </div>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800" role="tablist">
          {(['income', 'expense'] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={kind === k}
              onClick={() => {
                setKind(k);
                setCategoryId('');
              }}
              className={clsx('rounded-lg py-2 text-sm font-semibold transition', kind === k ? (k === 'income' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-rose-600 text-white shadow-sm') : 'text-slate-600 dark:text-slate-300')}
            >
              {k === 'income' ? t('flow.income') : t('flow.expense')}
            </button>
          ))}
        </div>
        <Input label={`${t('flow.amount')} (${money.symbol})`} inputMode="decimal" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" error={fieldErr('amount')} required dir="ltr" />
        <Input label={t('flow.date')} type="date" value={date} onChange={(e) => setDate(e.target.value)} error={fieldErr('occurredOn')} required />
        {newCat === null ? (
          <Select
            label={t('flow.category')}
            value={categoryId}
            onChange={(e) => {
              if (e.target.value === '__new') setNewCat('');
              else setCategoryId(e.target.value);
            }}
            error={fieldErr('categoryId')}
          >
            <option value="">{t('flow.no_category')}</option>
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value="__new">+ {t('flow.new_category')}</option>
          </Select>
        ) : (
          <Input label={t('flow.new_category')} value={newCat} onChange={(e) => setNewCat(e.target.value)} maxLength={60} autoFocus />
        )}
        <Input label={t('flow.note')} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} error={fieldErr('description')} />
      </form>
      <ConfirmDialog open={confirmDelete} onClose={() => setConfirmDelete(false)} onConfirm={() => remove.mutate()} loading={remove.isPending} danger title={t('flow.delete_title')} message={t('flow.delete_body')} confirmLabel={t('common.delete')} />
    </Dialog>
  );
}

function TxRow({ tx, onOpen }: { tx: Tx; onOpen: () => void }) {
  const { t } = useTranslation();
  const money = useMoney();
  const f = useFormat();
  return (
    <li>
      <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 px-4 py-3 text-start hover:bg-slate-50 dark:hover:bg-slate-800/40">
        <span className={clsx('grid size-9 shrink-0 place-items-center rounded-xl', tx.kind === 'income' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300')}>
          {tx.kind === 'income' ? <Plus className="size-4" /> : <Minus className="size-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium" dir="auto">
            {tx.description || tx.categoryName || (tx.kind === 'income' ? t('flow.income') : t('flow.expense'))}
          </span>
          <span className="block truncate text-xs text-slate-500" dir="auto">
            {f.date(tx.occurredOn)}
            {tx.categoryName && tx.description ? ` · ${tx.categoryName}` : ''}
          </span>
        </span>
        <span className={clsx('shrink-0 text-sm font-semibold tabular-nums', tx.kind === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
          {tx.kind === 'income' ? '+' : '−'}
          {money(tx.amount)}
        </span>
      </button>
    </li>
  );
}

// ---------------------------------------------------------------- home
/**
 * Gravity Flow home: one month at a time (this month unless another is chosen). Income, expenses,
 * profit (income − expenses) and margin; a bar for every day's profit and the running monthly profit.
 * A new month starts by itself on the 1st; earlier months stay one tap away.
 */
export function FlowHome() {
  const { t } = useTranslation();
  const money = useMoney();
  const f = useFormat();
  const { can } = useBiz();
  const monthName = useMonthName();
  const [params, setParams] = useSearchParams();
  const month = params.get('month');
  const setMonth = (m: string | null) => setParams(m ? { month: m } : {}, { replace: true });
  // No month in the address = this month; checked again every few minutes, so the graph moves on to a new month by itself.
  const q = useQuery({
    queryKey: [...FLOW, 'summary', month ?? 'current'],
    queryFn: () => api.get<Summary>(`/finance/summary${month ? `?month=${month}` : ''}`),
    placeholderData: keepPreviousData,
    refetchInterval: month ? false : 5 * 60_000,
  });
  const s = q.data;
  const months = useQuery({ queryKey: [...FLOW, 'months', s?.month], queryFn: () => api.get<{ items: MonthRow[] }>(`/finance/months?to=${s!.month}&count=6`), enabled: !!s });
  const latest = useQuery({ queryKey: [...FLOW, 'latest', s?.month], queryFn: () => api.get<{ items: Tx[] }>(`/finance/transactions?month=${s!.month}&pageSize=6`), enabled: !!s });
  const [adding, setAdding] = useState<Kind | null>(null);
  const [editing, setEditing] = useState<Tx | null>(null);
  const [day, setDay] = useState<string | null>(null);
  useEffect(() => setDay(null), [s?.month]);
  // A month in the future (typed into the address) goes back to this month.
  useEffect(() => {
    if (s && month && month > s.currentMonth) setMonth(null);
  });
  if (!s) return <SkeletonRows rows={8} />;
  const manage = can('finance.manage');
  const selected = day ? s.days.find((d) => d.date === day) : null;
  const tone = s.totals.net < 0 ? 'loss' : 'navy';

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthSwitcher month={s.month} current={s.currentMonth} onChange={setMonth} />
        {manage && (
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
            <button type="button" onClick={() => setAdding('income')} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700">
              <Plus className="size-4" /> {t('flow.add_income')}
            </button>
            <button type="button" onClick={() => setAdding('expense')} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-rose-700">
              <Minus className="size-4" /> {t('flow.add_expense')}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={t('flow.income')} value={money(s.totals.income)} tone="green">
          <Change now={s.totals.income} before={s.previous.income} />
        </Kpi>
        <Kpi label={t('flow.expenses')} value={money(s.totals.expense)} tone="red">
          <Change now={s.totals.expense} before={s.previous.expense} goodWhenUp={false} />
        </Kpi>
        <Kpi label={s.totals.net < 0 ? t('flow.loss') : t('flow.profit')} value={money(s.totals.net)} tone={tone}>
          <Change now={s.totals.net} before={s.previous.net} />
        </Kpi>
        <Kpi label={t('flow.margin')} value={s.totals.margin === null ? '—' : `${s.totals.margin.toFixed(1)}%`} tone={tone}>
          {t('flow.margin_hint')}
        </Kpi>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h2 className="font-semibold">{t('flow.daily_profit')}</h2>
            <span className="text-xs text-slate-500">{t('flow.tap_day')}</span>
          </div>
          <DailyProfitChart days={s.days} today={s.today} selected={day} onSelect={setDay} />
          {selected && (
            <div className="mt-2 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center text-sm dark:bg-slate-800/50">
              <p className="col-span-3 text-start text-xs font-medium text-slate-500">{f.date(selected.date)}</p>
              <p>
                <span className="block text-xs text-slate-500">{t('flow.income')}</span>
                <span className="font-semibold text-emerald-600 tabular-nums dark:text-emerald-400">{money(selected.income)}</span>
              </p>
              <p>
                <span className="block text-xs text-slate-500">{t('flow.expenses')}</span>
                <span className="font-semibold text-rose-600 tabular-nums dark:text-rose-400">{money(selected.expense)}</span>
              </p>
              <p>
                <span className="block text-xs text-slate-500">{t('flow.profit')}</span>
                <span className={clsx('font-semibold tabular-nums', selected.profit < 0 && 'text-rose-600')}>{money(selected.profit)}</span>
              </p>
            </div>
          )}
        </Card>
        <Card>
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h2 className="font-semibold">{t('flow.month_profit')}</h2>
            <span className={clsx('text-sm font-semibold tabular-nums', s.totals.net < 0 ? 'text-rose-600' : 'text-emerald-600 dark:text-emerald-400')}>{money(s.totals.net)}</span>
          </div>
          <MonthProfitChart days={s.days} today={s.month < s.currentMonth ? s.days[s.days.length - 1]!.date : s.today} />
          <p className="mt-1 text-xs text-slate-500">{t('flow.month_profit_hint')}</p>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Card padded={false}>
          <div className="flex items-center justify-between gap-2 p-4 pb-2">
            <h2 className="font-semibold">{t('flow.latest')}</h2>
            <Link to={`/transactions?month=${s.month}`} className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
              {t('flow.see_all')}
            </Link>
          </div>
          {!latest.data ? (
            <SkeletonRows rows={3} />
          ) : latest.data.items.length === 0 ? (
            <p className="px-4 pb-6 pt-2 text-sm text-slate-500">{t('flow.nothing_month', { month: monthName(s.month) })}</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {latest.data.items.map((tx) => (
                <TxRow key={tx.id} tx={tx} onOpen={() => manage && setEditing(tx)} />
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="font-semibold">{t('flow.previous_months')}</h2>
            <Link to="/months" className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
              {t('flow.see_all')}
            </Link>
          </div>
          {months.data ? <MonthsChart months={months.data.items} onPick={(m) => setMonth(m === s.currentMonth ? null : m)} /> : <SkeletonRows rows={3} />}
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <span className="size-2.5 rounded-sm bg-emerald-500" /> {t('flow.income')}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-2.5 rounded-sm bg-rose-400" /> {t('flow.expenses')}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-2.5 rounded-full bg-brand-700 dark:bg-brand-300" /> {t('flow.profit')}
            </span>
          </div>
        </Card>
      </div>

      {adding && <TransactionDialog kind={adding} today={s.month === s.currentMonth ? s.today : `${s.month}-01`} onClose={() => setAdding(null)} />}
      {editing && <TransactionDialog kind={editing.kind} tx={editing} today={s.today} onClose={() => setEditing(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------- transactions
/** Every income and expense of a month: search, filter, sort, pages; tap one to change or delete it. */
export function FlowTransactionsPage() {
  const { t } = useTranslation();
  const money = useMoney();
  const { can } = useBiz();
  const [params, setParams] = useSearchParams();
  const summary = useQuery({ queryKey: [...FLOW, 'summary', 'current'], queryFn: () => api.get<Summary>('/finance/summary') });
  const month = params.get('month') ?? summary.data?.currentMonth ?? null;
  const [kind, setKind] = useState<'' | Kind>('');
  const [categoryId, setCategoryId] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Tx | null>(null);
  const [adding, setAdding] = useState<Kind | null>(null);
  const [managing, setManaging] = useState(false);
  const cats = useCategories();
  useEffect(() => setPage(1), [month, kind, categoryId, search, sort]);
  const qs = new URLSearchParams({ ...(month ? { month } : {}), ...(kind ? { kind } : {}), ...(categoryId ? { categoryId } : {}), ...(search.trim() ? { q: search.trim() } : {}), sort, page: String(page), pageSize: '20' });
  const list = useQuery({ queryKey: [...FLOW, 'tx', qs.toString()], queryFn: () => api.get<{ items: Tx[]; total: number; page: number; pageSize: number }>(`/finance/transactions?${qs}`), enabled: !!month, placeholderData: keepPreviousData });
  const monthTotals = useQuery({ queryKey: [...FLOW, 'summary', month], queryFn: () => api.get<Summary>(`/finance/summary?month=${month}`), enabled: !!month });
  if (!month || !summary.data) return <SkeletonRows rows={8} />;
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.pageSize)) : 1;
  const manage = can('finance.manage');
  const tt = monthTotals.data?.totals;
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader
        title={t('flow.nav_transactions')}
        actions={
          manage && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" icon={<Tags className="size-4" />} onClick={() => setManaging(true)}>
                {t('flow.categories')}
              </Button>
              <Button icon={<Plus className="size-4" />} onClick={() => setAdding('income')}>
                {t('flow.add')}
              </Button>
            </div>
          )
        }
      />
      <MonthSwitcher month={month} current={summary.data.currentMonth} onChange={(m) => setParams(m ? { month: m } : {}, { replace: true })} />
      {tt && (
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-xl bg-emerald-50 p-2 dark:bg-emerald-950/40">
            <span className="block text-xs text-slate-500">{t('flow.income')}</span>
            <span className="font-semibold text-emerald-700 tabular-nums dark:text-emerald-300">{money(tt.income)}</span>
          </div>
          <div className="rounded-xl bg-rose-50 p-2 dark:bg-rose-950/40">
            <span className="block text-xs text-slate-500">{t('flow.expenses')}</span>
            <span className="font-semibold text-rose-700 tabular-nums dark:text-rose-300">{money(tt.expense)}</span>
          </div>
          <div className="rounded-xl bg-slate-100 p-2 dark:bg-slate-800">
            <span className="block text-xs text-slate-500">{tt.net < 0 ? t('flow.loss') : t('flow.profit')}</span>
            <span className={clsx('font-semibold tabular-nums', tt.net < 0 && 'text-rose-600')}>{money(tt.net)}</span>
          </div>
        </div>
      )}
      <Card padded={false}>
        <div className="grid gap-2 border-b border-slate-100 p-3 sm:grid-cols-[1fr_auto_auto_auto] dark:border-slate-800">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('flow.search')} aria-label={t('flow.search')} className="h-10 w-full rounded-xl border-0 bg-slate-100 ps-9 pe-3 text-sm outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-800" />
          </div>
          <select aria-label={t('flow.type')} value={kind} onChange={(e) => setKind(e.target.value as '' | Kind)} className="h-10 rounded-xl border-0 bg-slate-100 px-3 text-sm dark:bg-slate-800">
            <option value="">{t('flow.all')}</option>
            <option value="income">{t('flow.income')}</option>
            <option value="expense">{t('flow.expenses')}</option>
          </select>
          <select aria-label={t('flow.category')} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="h-10 rounded-xl border-0 bg-slate-100 px-3 text-sm dark:bg-slate-800">
            <option value="">{t('flow.all_categories')}</option>
            {(cats.data?.items ?? [])
              .filter((c) => !kind || c.kind === kind)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
          <select aria-label={t('flow.sort')} value={sort} onChange={(e) => setSort(e.target.value)} className="h-10 rounded-xl border-0 bg-slate-100 px-3 text-sm dark:bg-slate-800">
            {['newest', 'oldest', 'largest', 'smallest'].map((s) => (
              <option key={s} value={s}>
                {t(`flow.sort_${s}`)}
              </option>
            ))}
          </select>
        </div>
        {!list.data ? (
          <SkeletonRows rows={5} />
        ) : list.data.items.length === 0 ? (
          <EmptyState icon={<Search className="size-6" />} title={t('flow.no_results')} />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {list.data.items.map((tx) => (
              <TxRow key={tx.id} tx={tx} onOpen={() => manage && setEditing(tx)} />
            ))}
          </ul>
        )}
        {list.data && list.data.total > list.data.pageSize && (
          <div className="flex items-center justify-between gap-2 border-t border-slate-100 p-3 text-sm dark:border-slate-800">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              {t('flow.prev')}
            </Button>
            <span className="text-slate-500">{t('flow.page_of', { page, pages, total: list.data.total })}</span>
            <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              {t('flow.next')}
            </Button>
          </div>
        )}
      </Card>
      {adding && <TransactionDialog kind={adding} today={month === summary.data.currentMonth ? summary.data.today : `${month}-01`} onClose={() => setAdding(null)} />}
      {editing && <TransactionDialog kind={editing.kind} tx={editing} today={summary.data.today} onClose={() => setEditing(null)} />}
      {managing && <CategoriesDialog onClose={() => setManaging(false)} />}
    </div>
  );
}

/** Rename, add or remove categories. Removing one keeps its transactions (and every total). */
function CategoriesDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const cats = useCategories();
  const toastError = useToastError();
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [adding, setAdding] = useState<{ kind: Kind; name: string } | null>(null);
  const [removing, setRemoving] = useState<Category | null>(null);
  const done = () => {
    invalidateFlow(qc);
    setEditing(null);
    setAdding(null);
    setRemoving(null);
  };
  const rename = useMutation({ mutationFn: (c: { id: string; name: string }) => api.patch(`/finance/categories/${c.id}`, { name: c.name }), onSuccess: done, onError: toastError });
  const add = useMutation({ mutationFn: (c: { kind: Kind; name: string }) => api.post('/finance/categories', c), onSuccess: done, onError: toastError });
  const remove = useMutation({ mutationFn: (id: string) => api.delete(`/finance/categories/${id}`), onSuccess: done, onError: toastError });
  return (
    <Dialog open onClose={onClose} title={t('flow.categories')} description={t('flow.categories_hint')} footer={<Button onClick={onClose}>{t('common.done')}</Button>}>
      {!cats.data ? (
        <SkeletonRows rows={4} />
      ) : (
        <div className="space-y-5">
          {(['income', 'expense'] as const).map((kind) => (
            <div key={kind}>
              <div className="mb-2 flex items-center justify-between">
                <h3 className={clsx('text-sm font-semibold', kind === 'income' ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300')}>{kind === 'income' ? t('flow.income') : t('flow.expenses')}</h3>
                <Button size="sm" variant="ghost" icon={<Plus className="size-4" />} onClick={() => setAdding({ kind, name: '' })}>
                  {t('flow.add')}
                </Button>
              </div>
              <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200 dark:divide-slate-800 dark:ring-slate-800">
                {adding?.kind === kind && (
                  <li className="flex items-center gap-2 p-2">
                    <input autoFocus value={adding.name} onChange={(e) => setAdding({ kind, name: e.target.value })} maxLength={60} aria-label={t('flow.new_category')} placeholder={t('flow.new_category')} className="h-9 min-w-0 flex-1 rounded-lg bg-slate-100 px-3 text-sm dark:bg-slate-800" />
                    <Button size="sm" disabled={!adding.name.trim()} loading={add.isPending} onClick={() => add.mutate({ kind, name: adding.name.trim() })}>
                      {t('common.save')}
                    </Button>
                  </li>
                )}
                {cats.data.items
                  .filter((c) => c.kind === kind)
                  .map((c) => (
                    <li key={c.id} className="flex items-center gap-2 p-2">
                      {editing?.id === c.id ? (
                        <>
                          <input autoFocus value={editing.name} onChange={(e) => setEditing({ id: c.id, name: e.target.value })} maxLength={60} aria-label={t('flow.category')} className="h-9 min-w-0 flex-1 rounded-lg bg-slate-100 px-3 text-sm dark:bg-slate-800" />
                          <Button size="sm" disabled={!editing.name.trim()} loading={rename.isPending} onClick={() => rename.mutate({ id: c.id, name: editing.name.trim() })}>
                            {t('common.save')}
                          </Button>
                        </>
                      ) : (
                        <>
                          <span className="min-w-0 flex-1 truncate ps-1 text-sm" dir="auto">
                            {c.name}
                          </span>
                          <span className="text-xs text-slate-500">{c.transactions}</span>
                          <button type="button" aria-label={t('common.edit')} onClick={() => setEditing({ id: c.id, name: c.name })} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                            <Pencil className="size-4" />
                          </button>
                          <button type="button" aria-label={t('common.delete')} onClick={() => setRemoving(c)} className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950">
                            <Trash2 className="size-4" />
                          </button>
                        </>
                      )}
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      <ConfirmDialog open={!!removing} onClose={() => setRemoving(null)} onConfirm={() => removing && remove.mutate(removing.id)} loading={remove.isPending} danger title={t('flow.remove_category')} message={t('flow.remove_category_body')} confirmLabel={t('common.delete')} />
    </Dialog>
  );
}

// ---------------------------------------------------------------- months
/** Every month so far: income, expenses, profit and margin. Open one to see its days. */
export function FlowMonthsPage() {
  const { t } = useTranslation();
  const money = useMoney();
  const navigate = useNavigate();
  const monthName = useMonthName();
  const history = useQuery({ queryKey: [...FLOW, 'history'], queryFn: () => api.get<{ items: MonthRow[] }>('/finance/history') });
  const months = useQuery({ queryKey: [...FLOW, 'months', '12'], queryFn: () => api.get<{ items: MonthRow[] }>('/finance/months?count=12') });
  const current = history.data?.items[0]?.month;
  const open = (m: string) => navigate(m === current ? '/' : `/?month=${m}`);
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader title={t('flow.nav_months')} description={t('flow.months_subtitle')} />
      <Card>
        <h2 className="mb-2 font-semibold">{t('flow.last_12')}</h2>
        {months.data ? <MonthsChart months={months.data.items} onPick={open} /> : <SkeletonRows rows={4} />}
      </Card>
      <Card padded={false}>
        {!history.data ? (
          <SkeletonRows rows={5} />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {history.data.items.map((m) => (
              <li key={m.month}>
                <button type="button" onClick={() => open(m.month)} className="grid w-full grid-cols-2 items-center gap-x-3 gap-y-1 px-4 py-3 text-start hover:bg-slate-50 sm:grid-cols-[10rem_1fr_1fr_1fr_5rem] dark:hover:bg-slate-800/40">
                  <span className="font-medium">
                    {monthName(m.month)}
                    {m.month === current && <span className="ms-2 rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-800 dark:bg-brand-900 dark:text-brand-200">{t('flow.this_month')}</span>}
                  </span>
                  <span className="text-end text-sm sm:text-start">
                    <span className="text-xs text-slate-500 sm:hidden">{t('flow.profit')} </span>
                    <span className={clsx('font-semibold tabular-nums', m.net < 0 ? 'text-rose-600' : '')}>{money(m.net)}</span>
                  </span>
                  <span className="text-sm text-emerald-700 tabular-nums dark:text-emerald-300">
                    <span className="text-xs text-slate-500">{t('flow.income')} </span>
                    {money(m.income)}
                  </span>
                  <span className="text-end text-sm text-rose-700 tabular-nums sm:text-start dark:text-rose-300">
                    <span className="text-xs text-slate-500">{t('flow.expenses')} </span>
                    {money(m.expense)}
                  </span>
                  <span className="hidden text-end text-sm text-slate-500 tabular-nums sm:block">{m.margin === null ? '—' : `${m.margin.toFixed(1)}%`}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
