import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import clsx from 'clsx';
import { Lock, Printer, Wallet } from 'lucide-react';
import { api } from '../../lib/api';
import { parseAmount, useMoney } from '../../lib/money';
import { useFormat } from '../../lib/format';
import { useFieldErrors } from '../../lib/useApiError';
import { useBiz } from '../../auth/business';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Input } from '../../components/ui/Form';
import { Card, EmptyState, PageHeader, SkeletonRows } from '../../components/ui/Card';

export interface ClosingFigures {
  number: number;
  periodStart: string;
  periodEnd: string;
  salesCount: number;
  salesTotal: number;
  byMethod: Record<string, number>;
  openingFloat: number;
  cashIn: number;
  changeGiven: number;
  cashRefunds: number;
  expectedCash: number;
}
export interface CashClosing extends ClosingFigures {
  id: string;
  countedCash: number;
  difference: number;
  keptFloat: number;
  note: string;
  outletName: string | null;
  closedByName: string | null;
  createdAt: string;
}

const METHOD_ORDER = ['cash', 'card', 'bank_transfer', 'other'];

/** Over (green), short (red) or exact. */
export function DifferenceText({ value, className }: { value: number; className?: string }) {
  const { t } = useTranslation();
  const money = useMoney();
  return (
    <span className={clsx('font-semibold tabular-nums', value < 0 ? 'text-rose-600 dark:text-rose-400' : value > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400', className)}>
      {value === 0 ? t('closing.exact') : value < 0 ? t('closing.short', { amount: money(-value) }) : t('closing.over', { amount: money(value) })}
    </span>
  );
}

const Row = ({ label, value, strong, minus }: { label: string; value: string; strong?: boolean; minus?: boolean }) => (
  <div className={clsx('flex items-center justify-between gap-3 py-1.5 text-sm', strong && 'border-t border-slate-200 pt-2 font-semibold dark:border-slate-700')}>
    <span className={strong ? '' : 'text-slate-600 dark:text-slate-400'}>{label}</span>
    <span className="tabular-nums">
      {minus ? '− ' : ''}
      {value}
    </span>
  </div>
);

/** End of the day at the till: what came in, the cash that should be in the drawer, count it, close. */
export function CloseDayDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const money = useMoney();
  const f = useFormat();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['biz', 'closing', 'now'], queryFn: () => api.get<ClosingFigures>('/pos/closing'), refetchOnWindowFocus: false });
  const [counted, setCounted] = useState('');
  const [kept, setKept] = useState('');
  const [note, setNote] = useState('');
  const save = useMutation({
    mutationFn: () => api.post<CashClosing>('/pos/closing', { countedCash: parseAmount(counted), keptFloat: kept.trim() ? parseAmount(kept) : 0, note }),
    onSuccess: (c) => {
      toast.success(t('closing.closed_toast', { number: c.number }));
      void qc.invalidateQueries({ queryKey: ['biz', 'closing'] });
      window.open(`/print/closing/${c.id}`, '_blank', 'noopener');
      onClose();
    },
  });
  const fieldErr = useFieldErrors(save.error);
  const d = q.data;
  const countedMinor = counted.trim() ? Math.round(parseAmount(counted) * 100) : null;
  const diff = d && countedMinor !== null ? countedMinor - d.expectedCash : null;
  return (
    <Dialog
      open
      onClose={onClose}
      title={t('closing.title')}
      description={d ? t('closing.period', { from: f.dateTime(d.periodStart), to: f.dateTime(d.periodEnd) }) : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button icon={<Lock className="size-4" />} onClick={() => save.mutate()} loading={save.isPending} disabled={!d || countedMinor === null}>
            {t('closing.close_now')}
          </Button>
        </>
      }
    >
      {!d ? (
        <SkeletonRows rows={6} />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
              <p className="text-xs text-slate-500">{t('closing.sales')}</p>
              <p className="text-lg font-semibold tabular-nums">{d.salesCount}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
              <p className="text-xs text-slate-500">{t('closing.sales_total')}</p>
              <p className="text-lg font-semibold tabular-nums">{money(d.salesTotal)}</p>
            </div>
          </div>
          <div>
            <h3 className="mb-1 text-sm font-medium">{t('closing.money_in')}</h3>
            {METHOD_ORDER.filter((m) => d.byMethod[m]).length === 0 ? (
              <p className="text-sm text-slate-500">{t('closing.nothing_yet')}</p>
            ) : (
              METHOD_ORDER.filter((m) => d.byMethod[m]).map((m) => <Row key={m} label={t(`payment_methods.${m}`)} value={money(d.byMethod[m]!)} />)
            )}
          </div>
          <div className="rounded-xl ring-1 ring-slate-200 px-3 py-2 dark:ring-slate-700">
            <h3 className="mb-1 text-sm font-medium">{t('closing.cash_drawer')}</h3>
            <Row label={t('closing.opening_float')} value={money(d.openingFloat)} />
            <Row label={t('closing.cash_taken')} value={money(d.cashIn)} />
            <Row label={t('closing.change_given')} value={money(d.changeGiven)} minus />
            {d.cashRefunds > 0 && <Row label={t('closing.cash_refunds')} value={money(d.cashRefunds)} minus />}
            <Row label={t('closing.expected_cash')} value={money(d.expectedCash)} strong />
          </div>
          <Input label={t('closing.counted_cash')} inputMode="decimal" value={counted} onChange={(e) => setCounted(e.target.value)} error={fieldErr('countedCash')} hint={t('closing.counted_hint')} autoFocus />
          {diff !== null && (
            <p className="text-sm">
              {t('closing.difference')}: <DifferenceText value={diff} />
            </p>
          )}
          <Input label={t('closing.kept_float')} inputMode="decimal" value={kept} onChange={(e) => setKept(e.target.value)} error={fieldErr('keptFloat')} hint={t('closing.kept_hint')} />
          <Input label={t('closing.note')} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
        </div>
      )}
    </Dialog>
  );
}

/** Every day closing: who closed, cash expected and counted, over / short. */
export default function CashClosingsPage() {
  const { t } = useTranslation();
  const money = useMoney();
  const f = useFormat();
  const { can } = useBiz();
  const [closing, setClosing] = useState(false);
  const q = useQuery({ queryKey: ['biz', 'closing', 'list'], queryFn: () => api.get<{ items: CashClosing[]; total: number }>('/pos/closings?pageSize=100') });
  const shortTotal = (q.data?.items ?? []).filter((c) => c.difference < 0).reduce((a, c) => a + c.difference, 0);
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        title={t('closing.list_title')}
        description={t('closing.list_subtitle')}
        actions={
          can('pos.close_day') && (
            <Button icon={<Lock className="size-4" />} onClick={() => setClosing(true)}>
              {t('closing.title')}
            </Button>
          )
        }
      />
      {shortTotal < 0 && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800 ring-1 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900">{t('closing.short_total', { amount: money(-shortTotal) })}</p>
      )}
      <Card padded={false}>
        {!q.data ? (
          <SkeletonRows rows={5} />
        ) : q.data.items.length === 0 ? (
          <EmptyState icon={<Wallet className="size-6" />} title={t('closing.none')} description={t('closing.none_hint')} />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {q.data.items.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    #{c.number} · {f.dateTime(c.periodEnd)}
                  </p>
                  <p className="text-xs text-slate-500" dir="auto">
                    {[c.outletName, c.closedByName, t('closing.sales_n', { n: c.salesCount, amount: money(c.salesTotal) })].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="text-end text-sm">
                  <p className="tabular-nums">
                    {t('closing.expected_short')}: {money(c.expectedCash)} · {t('closing.counted_short')}: {money(c.countedCash)}
                  </p>
                  <DifferenceText value={c.difference} className="text-sm" />
                </div>
                <a href={`/print/closing/${c.id}`} target="_blank" rel="noreferrer" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={t('print.print')}>
                  <Printer className="size-4" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {closing && <CloseDayDialog onClose={() => setClosing(false)} />}
    </div>
  );
}
