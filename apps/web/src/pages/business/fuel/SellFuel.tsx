import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import clsx from 'clsx';
import { api } from '../../../lib/api';
import { useBiz } from '../../../auth/business';
import { useFormat } from '../../../lib/format';
import { useErrorMessage, useFieldErrors } from '../../../lib/useApiError';
import { Button } from '../../../components/ui/Button';
import { Input, Select } from '../../../components/ui/Form';
import { Alert } from '../../../components/ui/Card';
import { Segmented } from '../FuelSetup';
import { FUEL_INVALIDATE, useFuelCustomers, useFuelDashboard, useMvr, type FuelSale } from './data';
import { FUEL_COLOR } from './TankGauge';

const QUICK = { amount: [50, 100, 200, 500, 1000], litres: [5, 10, 20, 50, 100] } as const;

/**
 * Selling at the till: the nozzle, litres or rufiyaa worth, how it is paid (or on whose credit). Made for one
 * person at the pump: big targets, quick amounts, and it clears itself for the next customer.
 */
export function SellFuel({ onSold }: { onSold?: (s: FuelSale) => void }) {
  const { t } = useTranslation();
  const f = useFormat();
  const mvr = useMvr();
  const qc = useQueryClient();
  const errMsg = useErrorMessage();
  const { can } = useBiz();
  const dash = useFuelDashboard();
  const config = dash.data?.config;
  const customers = useFuelCustomers(!!config?.credit);
  const nozzles = useMemo(() => {
    const tanks = new Map((dash.data?.tanks ?? []).map((tk) => [tk.key, tk]));
    return (dash.data?.nozzles ?? []).flatMap((n) => {
      const tank = tanks.get(n.tankKey);
      return tank && config?.fuels.includes(tank.fuel) ? [{ ...n, fuel: tank.fuel, price: config.prices[tank.fuel] ?? 0 }] : [];
    });
  }, [dash.data, config]);
  const [nozzleId, setNozzleId] = useState('');
  const [by, setBy] = useState<'amount' | 'litres'>('amount');
  const [value, setValue] = useState('');
  const [payment, setPayment] = useState<FuelSale['payment']>('cash');
  const [customerId, setCustomerId] = useState('');
  const [delivery, setDelivery] = useState(false);
  const [vehicle, setVehicle] = useState('');
  useEffect(() => {
    if (!nozzles.some((n) => n.id === nozzleId) && nozzles[0]) setNozzleId(nozzles[0].id);
  }, [nozzles, nozzleId]);

  const nozzle = nozzles.find((n) => n.id === nozzleId);
  const v = Number(value) || 0;
  const litres = nozzle && nozzle.price > 0 ? (by === 'litres' ? v : v / nozzle.price) : 0;
  const fuelAmount = nozzle ? (by === 'amount' ? v : v * nozzle.price) : 0;
  const dc = config?.deliveryCharge;
  const charge = delivery && dc?.on ? (dc.type === 'fixed' ? dc.amount : dc.amount * litres) : 0;
  const total = fuelAmount + charge;

  const sell = useMutation({
    mutationFn: () =>
      api.post<FuelSale>('/fuel/sales', { nozzleId, by, value: v, payment, customerId: payment === 'credit' ? customerId || null : null, delivery, vehicle }),
    onSuccess: (s) => {
      toast.success(t('fuel.till.sold', { litres: f.number(s.litres, 2), total: mvr(s.total) }));
      setValue('');
      setVehicle('');
      setDelivery(false);
      setPayment('cash');
      setCustomerId('');
      void qc.invalidateQueries(FUEL_INVALIDATE);
      onSold?.(s);
    },
  });
  const fieldErr = useFieldErrors(sell.error);
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (v > 0 && nozzle) sell.mutate();
  };
  if (!config) return null;
  const payments: [string, string][] = [
    ['cash', t('fuel.pay.cash')],
    ['card', t('fuel.pay.card')],
    ['transfer', t('fuel.pay.transfer')],
    ...(config.credit ? ([['credit', t('fuel.pay.credit')]] as [string, string][]) : []),
  ];

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {sell.error && !fieldErr('value') && !fieldErr('customerId') && <Alert tone="red">{errMsg(sell.error)}</Alert>}
      <div>
        <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">{t('fuel.till.nozzle')}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label={t('fuel.till.nozzle')}>
          {nozzles.map((n) => (
            <button
              key={n.id}
              type="button"
              role="radio"
              aria-checked={n.id === nozzleId}
              onClick={() => setNozzleId(n.id)}
              className={clsx(
                'rounded-2xl p-3 text-start ring-1 transition focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none',
                n.id === nozzleId ? 'bg-brand-50/60 ring-2 ring-brand-600 dark:bg-brand-950/40' : 'ring-slate-200 hover:bg-slate-50 dark:ring-slate-700 dark:hover:bg-slate-800/50',
              )}
            >
              <span className="flex items-center gap-2 font-semibold">
                <span className="size-2.5 rounded-full" style={{ background: FUEL_COLOR[n.fuel] }} />
                {n.name}
              </span>
              <span className="mt-0.5 block text-xs text-slate-500 tabular-nums">
                {t(`fuel.${n.fuel}`)} · {f.number(n.price, 2)}/L
              </span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('fuel.till.how_much')}</p>
          <Segmented
            value={by}
            onChange={(x) => {
              setBy(x as 'amount' | 'litres');
              setValue('');
            }}
            options={[
              ['amount', t('fuel.till.by_amount')],
              ['litres', t('fuel.till.by_litres')],
            ]}
          />
        </div>
        <Input
          id="fuel-value"
          label={by === 'amount' ? t('fuel.till.amount_label') : t('fuel.till.litres_label')}
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, ''))}
          error={fieldErr('value')}
          className="!text-2xl !font-semibold tabular-nums"
          dir="ltr"
          autoComplete="off"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {QUICK[by].map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setValue(String(q))}
              className="rounded-xl bg-slate-100 px-3 py-1.5 text-sm font-medium tabular-nums hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
            >
              {by === 'amount' ? q : `${q} L`}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">{t('fuel.till.paid_by')}</p>
        <Segmented value={payment} onChange={(x) => setPayment(x as FuelSale['payment'])} options={payments} />
      </div>
      {payment === 'credit' && (
        <Select id="fuel-customer" label={t('fuel.till.customer')} value={customerId} onChange={(e) => setCustomerId(e.target.value)} error={fieldErr('customerId')} required>
          <option value="">{t('fuel.till.pick_customer')}</option>
          {(customers.data?.customers ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · {t('fuel.credit.owes', { amount: f.number(c.owed, 2) })}
            </option>
          ))}
        </Select>
      )}
      {payment === 'credit' && !customers.data?.customers.length && (
        <p className="text-sm text-slate-500">{can('fuel.credit') ? t('fuel.till.no_customers_owner') : t('fuel.till.no_customers')}</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input id="fuel-vehicle" label={t('fuel.till.vehicle')} hint={t('fuel.till.vehicle_hint')} value={vehicle} onChange={(e) => setVehicle(e.target.value)} />
        {dc?.on && (
          <label className="flex items-center gap-3 self-end rounded-xl p-3 ring-1 ring-slate-200 dark:ring-slate-700">
            <input type="checkbox" checked={delivery} onChange={(e) => setDelivery(e.target.checked)} className="size-4 accent-brand-600" />
            <span className="text-sm">
              {t('fuel.till.add_delivery')} <span className="text-slate-500 tabular-nums">({dc.type === 'fixed' ? mvr(dc.amount) : `${f.number(dc.amount, 2)}/L`})</span>
            </span>
          </label>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 dark:bg-slate-800/40 dark:ring-slate-700">
        <div className="tabular-nums">
          <p className="text-sm text-slate-500">
            {f.number(litres, 2)} L × {f.number(nozzle?.price ?? 0, 2)}
            {charge > 0 && ` + ${f.number(charge, 2)}`}
          </p>
          <p className="text-3xl font-semibold tracking-tight">{mvr(total)}</p>
        </div>
        <Button type="submit" size="lg" loading={sell.isPending} disabled={!(v > 0) || !nozzle || (payment === 'credit' && !customerId)}>
          {t('fuel.till.sell')}
        </Button>
      </div>
    </form>
  );
}
