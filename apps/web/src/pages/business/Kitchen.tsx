import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowLeft, ChefHat, Flame } from 'lucide-react';
import { api } from '../../lib/api';
import { useBiz, useBizSession } from '../../auth/business';
import { useToastError } from '../../lib/useApiError';
import { FarumaWarning } from '../../components/FarumaWarning';
import { Badge } from '../../components/ui/Card';

interface Ticket {
  id: string;
  ticketNumber: number;
  status: 'new' | 'preparing' | 'ready' | 'completed';
  orderType: string;
  tableName: string | null;
  station: string;
  priority: number;
  note: string;
  items: { name: string; quantity: number; options: string[]; note: string }[];
  createdAt: string;
}

const NEXT: Record<string, Ticket['status']> = { new: 'preparing', preparing: 'ready', ready: 'completed' };
const COLORS: Record<string, string> = {
  new: 'ring-rose-300 bg-rose-50 dark:bg-rose-950/40 dark:ring-rose-900',
  preparing: 'ring-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:ring-amber-900',
  ready: 'ring-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 dark:ring-emerald-900',
};

/** Kitchen Display System: tablet-first, large touch targets, polling every 5 s, no slow animations. */
export default function KitchenPage() {
  const { t } = useTranslation();
  const session = useBizSession();
  const { can, hasAddon } = useBiz();
  const qc = useQueryClient();
  const toastErr = useToastError();
  const [station, setStation] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);
  const q = useQuery({
    queryKey: ['biz', 'kitchen', station],
    queryFn: () => api.get<{ items: Ticket[] }>(`/kitchen/orders${station !== null ? `?station=${encodeURIComponent(station)}` : ''}`),
    refetchInterval: 5_000,
  });
  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/kitchen/orders/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['biz', 'kitchen'] }),
    onError: toastErr,
  });
  const priority = useMutation({
    mutationFn: ({ id, value }: { id: string; value: number }) => api.patch(`/kitchen/orders/${id}/priority`, { priority: value }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['biz', 'kitchen'] }),
    onError: toastErr,
  });
  const tickets = q.data?.items ?? [];
  const stations = [...new Set(tickets.map((k) => k.station).filter(Boolean))];
  const columns: Ticket['status'][] = ['new', 'preparing', 'ready'];

  return (
    <div className="flex h-dvh flex-col bg-slate-100 dark:bg-slate-950">
      <FarumaWarning />
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-900">
        <Link to="/" className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={t('nav.dashboard')}>
          <ArrowLeft className="rtl-flip size-5" />
        </Link>
        <ChefHat className="size-5 text-brand-700" />
        <h1 className="font-semibold">{t('kitchen.title')}</h1>
        <span className="text-sm text-slate-500" dir="auto">
          {session.outlet?.name}
        </span>
        {hasAddon('advanced_kitchen') && (
          <div className="ms-auto flex gap-1 overflow-x-auto">
            {[null, ...stations].map((s) => (
              <button key={s ?? 'all'} type="button" onClick={() => setStation(s)} className={clsx('rounded-full px-3 py-1.5 text-sm', station === s ? 'bg-brand-700 text-white' : 'bg-slate-100 dark:bg-slate-800')}>
                {s ?? t('common.all')}
              </button>
            ))}
          </div>
        )}
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto p-3 md:grid-cols-3 md:overflow-hidden">
        {columns.map((col) => (
          <section key={col} className="flex min-h-0 flex-col" aria-label={t(`status_labels.${col}`)}>
            <h2 className="mb-2 flex items-center justify-between px-1 text-sm font-semibold tracking-wide text-slate-600 uppercase dark:text-slate-300">
              {t(`status_labels.${col}`)} <Badge>{tickets.filter((k) => k.status === col).length}</Badge>
            </h2>
            <div className="space-y-3 md:min-h-0 md:flex-1 md:overflow-y-auto">
              {tickets
                .filter((k) => k.status === col)
                .map((k) => {
                  const mins = Math.floor((now - new Date(k.createdAt).getTime()) / 60_000);
                  return (
                    <article key={k.id} className={clsx('rounded-2xl p-4 ring-2', COLORS[col])}>
                      <header className="mb-2 flex items-start justify-between gap-2">
                        <div>
                          <p className="text-2xl font-bold tabular-nums">#{k.ticketNumber}</p>
                          <p className="text-sm text-slate-600 dark:text-slate-300" dir="auto">
                            {k.tableName ? `${t('pos.table')} ${k.tableName}` : t(`pos.order_types.${k.orderType}`)}
                            {k.station && ` · ${k.station}`}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className={clsx('rounded-lg px-2 py-0.5 text-sm font-semibold tabular-nums', mins >= 15 ? 'bg-rose-600 text-white' : 'bg-white/70 dark:bg-slate-900/60')}>
                            {t('kitchen.minutes', { count: mins })}
                          </span>
                          {k.priority > 0 && (
                            <Badge tone="red">
                              <Flame className="size-3" />
                              {t('kitchen.rush')}
                            </Badge>
                          )}
                        </div>
                      </header>
                      <ul className="space-y-1.5 text-lg">
                        {k.items.map((it, i) => (
                          <li key={i}>
                            <span className="font-bold tabular-nums">{it.quantity}×</span>{' '}
                            <span dir="auto">{it.name}</span>
                            {it.options.length > 0 && <span className="block ps-7 text-sm text-slate-600 dark:text-slate-300">{it.options.join(', ')}</span>}
                            {it.note && <span className="block ps-7 text-sm font-medium text-rose-700 dark:text-rose-300">{it.note}</span>}
                          </li>
                        ))}
                      </ul>
                      {k.note && <p className="mt-2 rounded-lg bg-white/70 p-2 text-sm dark:bg-slate-900/60">{k.note}</p>}
                      {can('kitchen.manage') && (
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => update.mutate({ id: k.id, status: NEXT[k.status]! })}
                            className="h-14 flex-1 rounded-xl bg-slate-900 text-base font-semibold text-white active:bg-slate-700 dark:bg-white dark:text-slate-900"
                          >
                            {t(`kitchen.actions.${k.status}`)}
                          </button>
                          {k.status === 'new' && (
                            <button type="button" aria-label={t('kitchen.rush')} onClick={() => priority.mutate({ id: k.id, value: k.priority > 0 ? 0 : 1 })} className="h-14 w-14 rounded-xl bg-white/80 dark:bg-slate-900">
                              <Flame className={clsx('mx-auto size-6', k.priority > 0 ? 'text-rose-600' : 'text-slate-400')} />
                            </button>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
            </div>
          </section>
        ))}
      </div>
      {!q.isLoading && tickets.length === 0 && <p className="pb-6 text-center text-slate-500">{t('kitchen.empty')}</p>}
    </div>
  );
}
