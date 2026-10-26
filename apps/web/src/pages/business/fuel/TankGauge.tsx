import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { AlertTriangle } from 'lucide-react';
import { useFormat } from '../../../lib/format';
import type { FuelTankStock } from './data';

/** Petrol amber, diesel blue: the same everywhere in Theyo Fihaara. */
export const FUEL_COLOR = { petrol: '#f59e0b', diesel: '#0ea5e9' } as const;

export function tankLevel(t: Pick<FuelTankStock, 'stockL' | 'capacityL' | 'reorderL'>) {
  const pct = t.capacityL > 0 ? Math.max(0, Math.min(1, t.stockL / t.capacityL)) : 0;
  const status: 'ok' | 'low' | 'empty' = t.stockL <= 0 || pct < 0.1 ? 'empty' : t.stockL <= t.reorderL ? 'low' : 'ok';
  return { pct, status };
}

/** One tank: liquid at its level with a slow wave on top. */
function TankShape({ pct, color }: { pct: number; color: string }) {
  const id = useId().replace(/:/g, '');
  const top = 8 + (1 - pct) * 104;
  return (
    <svg viewBox="0 0 80 120" className="h-28 w-20 shrink-0" aria-hidden>
      <defs>
        <clipPath id={`c${id}`}>
          <rect x="6" y="8" width="68" height="104" rx="14" />
        </clipPath>
        <linearGradient id={`g${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.95" />
          <stop offset="1" stopColor={color} stopOpacity="0.7" />
        </linearGradient>
      </defs>
      <rect x="6" y="8" width="68" height="104" rx="14" className="fill-slate-100 dark:fill-slate-800" />
      <g clipPath={`url(#c${id})`}>
        <g className="fuel-level" style={{ transform: `translateY(${top}px)` }}>
          <path className="fuel-wave" d="M-80 4 Q-60 -2 -40 4 T0 4 T40 4 T80 4 T120 4 T160 4 V200 H-80 Z" fill={`url(#g${id})`} />
        </g>
      </g>
      <rect x="6" y="8" width="68" height="104" rx="14" fill="none" strokeWidth="2" className="stroke-slate-300 dark:stroke-slate-600" />
      {[0.25, 0.5, 0.75].map((m) => (
        <line key={m} x1="66" x2="74" y1={8 + m * 104} y2={8 + m * 104} strokeWidth="1.5" className="stroke-slate-400/70" />
      ))}
    </svg>
  );
}

/** Drums: each drum full, part-full or empty. */
function Drums({ tank, color }: { tank: FuelTankStock; color: string }) {
  const count = Math.max(1, Math.min(12, Math.round(tank.capacityL / Math.max(1, tank.drumSizeL))));
  const per = tank.capacityL / count;
  return (
    <div className="grid w-28 shrink-0 grid-cols-4 gap-1.5" aria-hidden>
      {Array.from({ length: count }, (_, i) => {
        const fill = Math.max(0, Math.min(1, (tank.stockL - i * per) / per));
        return (
          <div key={i} className="relative h-9 overflow-hidden rounded-md bg-slate-100 ring-1 ring-slate-300 dark:bg-slate-800 dark:ring-slate-600">
            <div className="absolute inset-x-0 bottom-0 transition-[height] duration-700" style={{ height: `${fill * 100}%`, background: color }} />
            <div className="absolute inset-x-0 top-1/3 h-px bg-slate-400/40" />
            <div className="absolute inset-x-0 top-2/3 h-px bg-slate-400/40" />
          </div>
        );
      })}
    </div>
  );
}

export function TankGauge({ tank, compact }: { tank: FuelTankStock; compact?: boolean }) {
  const { t } = useTranslation();
  const f = useFormat();
  const { pct, status } = tankLevel(tank);
  const color = FUEL_COLOR[tank.fuel];
  return (
    <div className={clsx('flex items-center gap-4', compact ? '' : 'p-1')}>
      {tank.storage === 'drums' ? <Drums tank={tank} color={color} /> : <TankShape pct={pct} color={color} />}
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-medium">
          <span className="size-2.5 shrink-0 rounded-full" style={{ background: color }} />
          <span className="truncate" dir="auto">
            {tank.name}
          </span>
        </p>
        <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
          {f.number(Math.max(0, tank.stockL), 0)} <span className="text-base font-medium text-slate-500">L</span>
        </p>
        <p className="text-xs text-slate-500 tabular-nums">
          {t('fuel.tanks.of_capacity', { pct: Math.round(pct * 100), capacity: f.number(tank.capacityL, 0) })}
        </p>
        {!tank.measured ? (
          <p className="mt-1.5 text-xs text-slate-500">{t('fuel.tanks.not_measured')}</p>
        ) : status !== 'ok' ? (
          <p className={clsx('mt-1.5 inline-flex items-center gap-1 text-xs font-medium', status === 'empty' ? 'text-red-600 dark:text-red-400' : 'text-amber-700 dark:text-amber-400')}>
            <AlertTriangle className="size-3.5" />
            {status === 'empty' ? t('fuel.tanks.almost_empty') : t('fuel.tanks.order_more')}
          </p>
        ) : null}
      </div>
    </div>
  );
}
