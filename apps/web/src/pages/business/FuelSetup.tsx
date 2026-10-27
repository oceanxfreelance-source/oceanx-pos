import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import clsx from 'clsx';
import { Check, Minus, Plus, Trash2 } from 'lucide-react';
import type { Fuel, FuelShedConfig } from '@oceanx/shared';
import { api } from '../../lib/api';
import { useBiz } from '../../auth/business';
import { useErrorMessage } from '../../lib/useApiError';
import { Button } from '../../components/ui/Button';
import { Input, Switch } from '../../components/ui/Form';
import { Alert, Card, PageHeader, SkeletonRows } from '../../components/ui/Card';

interface Tank {
  id?: string;
  key: string;
  name: string;
  fuel: Fuel;
  storage: 'tank' | 'drums';
  capacityL: number | '';
  reorderL: number | '';
  drumSizeL: number;
}
interface Nozzle {
  id?: string;
  name: string;
  tankKey: string;
  openingMeter: number | '';
}
export interface FuelSetupData {
  done: boolean;
  config: FuelShedConfig;
  tanks: Tank[];
  nozzles: Nozzle[];
}

export const FUEL_SETUP_KEY = ['fuel', 'setup'] as const;
export function useFuelSetup() {
  return useQuery({ queryKey: FUEL_SETUP_KEY, queryFn: () => api.get<FuelSetupData>('/fuel/setup') });
}

const FUEL_LIST: Fuel[] = ['petrol', 'diesel'];
const STEPS = ['mode', 'fuels', 'storage', 'nozzles', 'extras'] as const;
type Step = (typeof STEPS)[number];
const newKey = () => `new-${Math.random().toString(36).slice(2, 10)}`;

/**
 * A number box that keeps what is typed ("15." or "0.0") while typing, so a decimal point can be entered.
 * Accepts a comma as the point. Gives the number back ('' when empty).
 */
function NumberInput({ value, onValue, ...rest }: Omit<ComponentProps<typeof Input>, 'value' | 'onChange'> & { value: number | '' | undefined; onValue: (v: number | '') => void }) {
  const [text, setText] = useState(value === '' || value == null ? '' : String(value));
  useEffect(() => {
    const shown = text === '' ? '' : Number(text);
    if ((value ?? '') !== shown) setText(value === '' || value == null ? '' : String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <Input
      {...rest}
      inputMode="decimal"
      dir="ltr"
      value={text}
      onChange={(e) => {
        let v = e.target.value.replace(',', '.').replace(/[^0-9.]/g, '');
        const dot = v.indexOf('.');
        if (dot >= 0) v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, '');
        setText(v);
        onValue(v === '' || v === '.' ? '' : Number(v));
      }}
    />
  );
}

/** The next free nozzle name: P1, P2, … */
function nextNozzleName(nozzles: Nozzle[]) {
  const used = new Set(nozzles.map((n) => n.name.toLowerCase()));
  for (let i = 1; ; i++) if (!used.has(`p${i}`)) return `P${i}`;
}

/**
 * The shed's own set-up. `wizard`: first sign-in, one step at a time. `page`: Shed settings, every part on one
 * page. Both save the whole set-up (config, tanks or drums, nozzles).
 */
export function FuelSetupEditor({ variant }: { variant: 'wizard' | 'page' }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { can } = useBiz();
  const errMsg = useErrorMessage();
  const q = useFuelSetup();
  const [config, setConfig] = useState<FuelShedConfig | null>(null);
  const [tanks, setTanks] = useState<Tank[]>([]);
  const [nozzles, setNozzles] = useState<Nozzle[]>([]);
  const [step, setStep] = useState<Step>('mode');
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    if (!q.data || config) return;
    setConfig(q.data.config);
    setTanks(q.data.tanks);
    setNozzles(q.data.nozzles);
  }, [q.data, config]);

  const save = useMutation({
    mutationFn: () =>
      api.put<FuelSetupData>('/fuel/setup', {
        config,
        tanks: tanks.map((tk) => ({ ...tk, capacityL: Number(tk.capacityL || 0), reorderL: Number(tk.reorderL || 0) })),
        nozzles: nozzles.map((n) => ({ ...n, openingMeter: Number(n.openingMeter || 0) })),
      }),
    onSuccess: (d) => {
      qc.setQueryData(FUEL_SETUP_KEY, d);
      setTanks(d.tanks);
      setNozzles(d.nozzles);
      if (variant === 'page') toast.success(t('fuel.setup.saved'));
    },
  });

  if (!config) return <Card padded={false}>{q.error ? <Alert tone="red">{errMsg(q.error)}</Alert> : <SkeletonRows rows={5} />}</Card>;
  const readOnly = !can('fuel.manage');
  const setC = (patch: Partial<FuelShedConfig>) => setConfig((c) => ({ ...c!, ...patch }));
  const fuelName = (f: Fuel) => t(`fuel.${f}`);

  // Keep at least one tank for each fuel sold, named for its fuel.
  const ensureTanks = () => {
    setTanks((list) => {
      const out = list.filter((tk) => config.fuels.includes(tk.fuel));
      for (const f of config.fuels)
        if (!out.some((tk) => tk.fuel === f)) out.push({ key: newKey(), name: t('fuel.setup.default_tank', { fuel: fuelName(f) }), fuel: f, storage: 'tank', capacityL: '', reorderL: '', drumSizeL: 200 });
      return out;
    });
  };
  // Every tank needs a nozzle; nozzles of removed tanks go.
  const ensureNozzles = () => {
    setNozzles((list) => {
      const keys = new Set(tanks.map((tk) => tk.key));
      const out = list.filter((n) => keys.has(n.tankKey));
      for (const tk of tanks) if (!out.some((n) => n.tankKey === tk.key)) out.push({ name: nextNozzleName(out), tankKey: tk.key, openingMeter: '' });
      return out;
    });
  };

  const check = (s: Step): string | null => {
    if (s === 'fuels') {
      if (!config.fuels.length) return t('fuel.setup.need_fuel');
      if (config.fuels.some((f) => !(Number(config.prices[f]) > 0))) return t('fuel.setup.need_price');
    }
    if (s === 'storage') {
      if (config.fuels.some((f) => !tanks.some((tk) => tk.fuel === f))) return t('fuel.setup.need_tank');
      if (tanks.some((tk) => !(Number(tk.capacityL) > 0) || !tk.name.trim())) return t('fuel.setup.need_capacity');
    }
    if (s === 'nozzles' && tanks.some((tk) => !nozzles.some((n) => n.tankKey === tk.key))) return t('fuel.setup.need_nozzle');
    return null;
  };

  const sections: Record<Step, { title: string; hint?: string; body: ReactNode }> = {
    mode: {
      title: t('fuel.setup.mode_title'),
      body: (
        <div className="grid gap-3 sm:grid-cols-2">
          {(['one', 'shifts'] as const).map((m) => (
            <Choice key={m} on={config.mode === m} onClick={() => setC({ mode: m })} title={t(`fuel.setup.mode_${m}`)} hint={t(`fuel.setup.mode_${m}_hint`)} disabled={readOnly} />
          ))}
        </div>
      ),
    },
    fuels: {
      title: t('fuel.setup.fuels_title'),
      body: (
        <div className="grid gap-3 sm:grid-cols-2">
          {FUEL_LIST.map((f) => {
            const on = config.fuels.includes(f);
            return (
              <div key={f} className={clsx('rounded-2xl p-4 ring-1 transition', on ? 'bg-brand-50/60 ring-brand-500 dark:bg-brand-950/40' : 'ring-slate-200 dark:ring-slate-700')}>
                <Switch checked={on} disabled={readOnly} onChange={(v) => setC({ fuels: v ? FUEL_LIST.filter((x) => x === f || config.fuels.includes(x)) : config.fuels.filter((x) => x !== f) })} label={fuelName(f)} />
                {on && (
                  <NumberInput
                    className="mt-3"
                    label={t('fuel.setup.price')}
                    value={config.prices[f] ?? ''}
                    disabled={readOnly}
                    onValue={(v) => setC({ prices: { ...config.prices, [f]: v === '' ? undefined : v } })}
                  />
                )}
              </div>
            );
          })}
        </div>
      ),
    },
    storage: {
      title: t('fuel.setup.storage_title'),
      hint: t('fuel.setup.storage_hint'),
      body: (
        <div className="space-y-3">
          {tanks.map((tk, i) => {
            const set = (patch: Partial<Tank>) => setTanks((l) => l.map((x, j) => (j === i ? { ...x, ...patch } : x)));
            return (
              <div key={tk.key} className="rounded-2xl p-4 ring-1 ring-slate-200 dark:ring-slate-700">
                <div className="flex flex-wrap items-end gap-3">
                  <Input className="min-w-40 flex-1" label={t('fuel.setup.tank_name')} value={tk.name} disabled={readOnly} onChange={(e) => set({ name: e.target.value })} />
                  <Segmented value={tk.fuel} disabled={readOnly} options={config.fuels.map((f) => [f, fuelName(f)])} onChange={(v) => set({ fuel: v as Fuel })} />
                  <Segmented value={tk.storage} disabled={readOnly} options={[['tank', t('fuel.setup.tank')], ['drums', t('fuel.reg.drums')]]} onChange={(v) => {
                      const storage = v as Tank['storage'];
                      const defaults = [t('fuel.setup.default_tank', { fuel: fuelName(tk.fuel) }), t('fuel.setup.default_drums', { fuel: fuelName(tk.fuel) })];
                      // A name still the default follows the choice: "Petrol tank" ↔ "Petrol drums".
                      set({ storage, ...(defaults.includes(tk.name) ? { name: defaults[storage === 'drums' ? 1 : 0] } : {}) });
                    }} />
                  {!readOnly && tanks.length > 1 && (
                    <Button
                      variant="ghost"
                      icon={<Trash2 className="size-4" />}
                      aria-label={t('fuel.setup.remove')}
                      onClick={() => {
                        setTanks((l) => l.filter((_, j) => j !== i));
                        setNozzles((l) => l.filter((n) => n.tankKey !== tk.key));
                      }}
                    />
                  )}
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <NumberInput label={t(tk.storage === 'drums' ? 'fuel.setup.capacity_drums' : 'fuel.setup.capacity')} value={tk.capacityL} disabled={readOnly} onValue={(v) => set({ capacityL: v })} />
                  <NumberInput label={t('fuel.setup.reorder')} value={tk.reorderL} disabled={readOnly} onValue={(v) => set({ reorderL: v })} />
                  {tk.storage === 'drums' && <Input label={t('fuel.setup.drum_size')} inputMode="numeric" dir="ltr" value={tk.drumSizeL} disabled={readOnly} onChange={(e) => set({ drumSizeL: Number(e.target.value) || 200 })} />}
                </div>
              </div>
            );
          })}
          {!readOnly && (
            <Button
              variant="secondary"
              icon={<Plus className="size-4" />}
              onClick={() => {
                const key = newKey();
                setTanks((l) => [...l, { key, name: t('fuel.setup.default_tank', { fuel: fuelName(config.fuels[0]!) }), fuel: config.fuels[0]!, storage: 'tank', capacityL: '', reorderL: '', drumSizeL: 200 }]);
                setNozzles((l) => [...l, { name: nextNozzleName(l), tankKey: key, openingMeter: '' }]);
              }}
            >
              {t('fuel.setup.add_tank')}
            </Button>
          )}
        </div>
      ),
    },
    nozzles: {
      title: t('fuel.setup.nozzles_title'),
      hint: t('fuel.setup.nozzles_hint'),
      body: (
        <div className="space-y-3">
          {tanks.map((tk) => {
            const mine = nozzles.filter((n) => n.tankKey === tk.key);
            const add = () => setNozzles((l) => [...l, { name: nextNozzleName(l), tankKey: tk.key, openingMeter: '' }]);
            const removeLast = () => setNozzles((l) => l.filter((n) => n !== mine[mine.length - 1]));
            return (
              <div key={tk.key} className="rounded-2xl p-4 ring-1 ring-slate-200 dark:ring-slate-700">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium" dir="auto">
                    {tk.name} <span className="text-sm font-normal text-slate-500">· {fuelName(tk.fuel)}</span>
                  </p>
                  <div className="flex items-center gap-2" aria-label={t('fuel.setup.nozzle_count')}>
                    <Button variant="secondary" size="sm" icon={<Minus className="size-4" />} aria-label={t('fuel.setup.remove')} disabled={readOnly || mine.length <= 1} onClick={removeLast} />
                    <span className="w-6 text-center font-semibold tabular-nums">{mine.length}</span>
                    <Button variant="secondary" size="sm" icon={<Plus className="size-4" />} aria-label={t('fuel.setup.add_nozzle')} disabled={readOnly || nozzles.length >= 40} onClick={add} />
                  </div>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {mine.map((n) => {
                    const set = (patch: Partial<Nozzle>) => setNozzles((l) => l.map((x) => (x === n ? { ...x, ...patch } : x)));
                    return (
                      <div key={n.id ?? `${tk.key}-${nozzles.indexOf(n)}`} className="grid grid-cols-[6rem_1fr] gap-2">
                        <Input label={t('fuel.setup.nozzle_name')} value={n.name} disabled={readOnly} onChange={(e) => set({ name: e.target.value })} />
                        <NumberInput label={t('fuel.setup.meter')} value={n.openingMeter} disabled={readOnly} onValue={(v) => set({ openingMeter: v })} />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ),
    },
    extras: {
      title: t('fuel.setup.extras_title'),
      body: (
        <div className="space-y-5">
          <Switch checked={config.credit} disabled={readOnly} onChange={(v) => setC({ credit: v })} label={t('fuel.setup.credit')} description={t('fuel.setup.credit_hint')} />
          {config.credit && (
            <NumberInput label={t('fuel.setup.till_limit')} value={config.tillCustomerLimit} disabled={readOnly} onValue={(v) => setC({ tillCustomerLimit: v || 0 })} />
          )}
          <Switch checked={config.quotations} disabled={readOnly} onChange={(v) => setC({ quotations: v })} label={t('fuel.setup.quotations')} description={t('fuel.setup.quotations_hint')} />
          <Switch
            checked={config.deliveryCharge.on}
            disabled={readOnly}
            onChange={(v) => setC({ deliveryCharge: { ...config.deliveryCharge, on: v } })}
            label={t('fuel.setup.delivery')}
            description={t('fuel.setup.delivery_hint')}
          />
          {config.deliveryCharge.on && (
            <div className="flex flex-wrap items-end gap-3">
              <Segmented
                value={config.deliveryCharge.type}
                disabled={readOnly}
                options={[['fixed', t('fuel.setup.delivery_fixed')], ['per_litre', t('fuel.setup.delivery_per_litre')]]}
                onChange={(v) => setC({ deliveryCharge: { ...config.deliveryCharge, type: v as 'fixed' | 'per_litre' } })}
              />
              <NumberInput
                className="w-40"
                label={t('fuel.setup.delivery_amount')}
                value={config.deliveryCharge.amount}
                disabled={readOnly}
                onValue={(v) => setC({ deliveryCharge: { ...config.deliveryCharge, amount: v || 0 } })}
              />
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <LabeledSegmented
              label={t('fuel.setup.printer')}
              value={config.printer}
              disabled={readOnly}
              options={[['off', t('fuel.setup.printer_off')], ['80mm', t('fuel.setup.printer_80')], ['a4', 'A4']]}
              onChange={(v) => setC({ printer: v as FuelShedConfig['printer'] })}
            />
            <LabeledSegmented
              label={t('fuel.setup.receipt')}
              value={config.receiptDefault}
              disabled={readOnly}
              options={[['none', t('fuel.setup.receipt_none')], ['viber', 'Viber'], ['pdf', 'PDF']]}
              onChange={(v) => setC({ receiptDefault: v as FuelShedConfig['receiptDefault'] })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberInput label={t('fuel.setup.cash_tol')} value={config.cashTolerance} disabled={readOnly} onValue={(v) => setC({ cashTolerance: v || 0 })} />
            <NumberInput label={t('fuel.setup.variance')} value={config.variancePercent} disabled={readOnly} onValue={(v) => setC({ variancePercent: v || 0 })} />
          </div>
        </div>
      ),
    },
  };

  const trySave = () => {
    for (const s of STEPS) {
      const p = check(s);
      if (p) {
        setProblem(p);
        if (variant === 'wizard') setStep(s);
        return;
      }
    }
    setProblem(null);
    save.mutate();
  };

  if (variant === 'page') {
    return (
      <div className="mx-auto max-w-3xl space-y-4 pb-24">
        <PageHeader title={t('fuel.settings_title')} description={t('fuel.settings_subtitle')} />
        {STEPS.map((s) => (
          <Card key={s}>
            <h2 className="text-base font-semibold">{sections[s].title}</h2>
            {sections[s].hint && <p className="mt-1 text-sm text-slate-500">{sections[s].hint}</p>}
            <div className="mt-4">{sections[s].body}</div>
          </Card>
        ))}
        {!readOnly && (
          <div className="sticky bottom-[calc(1rem+var(--safe-bottom))] z-10 flex items-center justify-end gap-3 rounded-2xl bg-white/90 p-3 shadow-lg ring-1 ring-slate-200 backdrop-blur dark:bg-slate-900/90 dark:ring-slate-700">
            {(problem || save.error) && <p className="me-auto text-sm text-red-600 dark:text-red-400">{problem ?? errMsg(save.error)}</p>}
            <Button
              onClick={trySave}
              loading={save.isPending}
            >
              {t('fuel.setup.save')}
            </Button>
          </div>
        )}
      </div>
    );
  }

  const i = STEPS.indexOf(step);
  const next = () => {
    const p = check(step);
    if (p) return setProblem(p);
    setProblem(null);
    if (step === 'fuels') ensureTanks();
    if (step === 'storage') ensureNozzles();
    if (i < STEPS.length - 1) setStep(STEPS[i + 1]!);
    else trySave();
  };
  return (
    <div className="mx-auto max-w-2xl py-2">
      <h1 className="text-2xl font-semibold tracking-tight">{t('fuel.setup.title')}</h1>
      <p className="mt-1 text-sm text-slate-500">{t('fuel.setup.subtitle')}</p>
      <ol className="mt-5 flex gap-1.5" aria-label={t('fuel.setup.step', { n: i + 1, total: STEPS.length })}>
        {STEPS.map((s, j) => (
          <li key={s} className={clsx('h-1.5 flex-1 rounded-full', j <= i ? 'bg-brand-600' : 'bg-slate-200 dark:bg-slate-700')} />
        ))}
      </ol>
      <Card className="mt-5">
        <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{t('fuel.setup.step', { n: i + 1, total: STEPS.length })}</p>
        <h2 className="mt-1 text-lg font-semibold">{sections[step].title}</h2>
        {sections[step].hint && <p className="mt-1 text-sm text-slate-500">{sections[step].hint}</p>}
        <div className="mt-5">{sections[step].body}</div>
        {(problem || save.error) && (
          <div className="mt-4">
            <Alert tone="red">{problem ?? errMsg(save.error)}</Alert>
          </div>
        )}
        <div className="mt-6 flex items-center justify-between gap-3">
          <Button variant="ghost" disabled={i === 0} onClick={() => (setProblem(null), setStep(STEPS[i - 1]!))}>
            {t('fuel.setup.back')}
          </Button>
          <Button onClick={next} loading={save.isPending} icon={i === STEPS.length - 1 ? <Check className="size-4" /> : undefined}>
            {i === STEPS.length - 1 ? t('fuel.setup.finish') : t('fuel.setup.next')}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function Choice({ on, onClick, title, hint, disabled }: { on: boolean; onClick: () => void; title: string; hint: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        'rounded-2xl p-4 text-start ring-1 transition focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none',
        on ? 'bg-brand-50/60 ring-2 ring-brand-600 dark:bg-brand-950/40' : 'ring-slate-200 hover:bg-slate-50 dark:ring-slate-700 dark:hover:bg-slate-800/50',
      )}
    >
      <span className="block font-semibold">{title}</span>
      <span className="mt-1 block text-sm text-slate-500">{hint}</span>
    </button>
  );
}

export function Segmented({ value, options, onChange, disabled }: { value: string; options: [string, string][]; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800" role="radiogroup">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          disabled={disabled}
          onClick={() => onChange(v)}
          className={clsx('rounded-lg px-3 py-1.5 text-sm font-medium transition', value === v ? 'bg-white shadow-sm dark:bg-slate-700' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200')}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function LabeledSegmented(props: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">{props.label}</p>
      <Segmented {...props} />
    </div>
  );
}

/** Shed settings page. */
export default function FuelSettingsPage() {
  return <FuelSetupEditor variant="page" />;
}
