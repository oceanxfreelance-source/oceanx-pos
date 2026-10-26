import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Droplets, Truck } from 'lucide-react';
import { api } from '../../../lib/api';
import { useBiz } from '../../../auth/business';
import { useFormat } from '../../../lib/format';
import { useErrorMessage, useFieldErrors } from '../../../lib/useApiError';
import { Button } from '../../../components/ui/Button';
import { Input, Select } from '../../../components/ui/Form';
import { Alert, Card, CardHeader, PageHeader, SkeletonRows } from '../../../components/ui/Card';
import { Dialog } from '../../../components/ui/Dialog';
import { FUEL_INVALIDATE, FUEL_KEYS, useMvr, type FuelTankStock } from './data';
import { TankGauge } from './TankGauge';

interface Move {
  id: string;
  tankId: string;
  kind: 'delivery' | 'dip';
  litres: number;
  bookL: number | null;
  cost: number | null;
  supplier: string;
  note: string;
  createdByName: string;
  createdAt: string;
}

/** Fuel arrived (litres in), or a dip (the level measured with the stick; the stock becomes that). */
export function StockDialog({ kind, tanks, tankId, onClose }: { kind: 'delivery' | 'dip'; tanks: FuelTankStock[]; tankId?: string; onClose: () => void }) {
  const { t } = useTranslation();
  const f = useFormat();
  const qc = useQueryClient();
  const errMsg = useErrorMessage();
  const [form, setForm] = useState({ tankId: tankId ?? tanks[0]?.id ?? '', litres: '', cost: '', supplier: '', note: '' });
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((x) => ({ ...x, [k]: e.target.value }));
  const tank = tanks.find((x) => x.id === form.tankId);
  const m = useMutation({
    mutationFn: () =>
      api.post('/fuel/stock', {
        tankId: form.tankId,
        kind,
        litres: Number(form.litres),
        cost: kind === 'delivery' && form.cost ? Number(form.cost) : null,
        supplier: form.supplier,
        note: form.note,
      }),
    onSuccess: () => {
      toast.success(kind === 'delivery' ? t('fuel.tanks.delivery_saved') : t('fuel.tanks.dip_saved'));
      void qc.invalidateQueries(FUEL_INVALIDATE);
      onClose();
    },
  });
  const fieldErr = useFieldErrors(m.error);
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    m.mutate();
  };
  const after = tank && form.litres ? (kind === 'delivery' ? tank.stockL + Number(form.litres) : Number(form.litres)) : null;
  return (
    <Dialog
      open
      onClose={onClose}
      title={kind === 'delivery' ? t('fuel.tanks.delivery') : t('fuel.tanks.dip')}
      description={kind === 'delivery' ? t('fuel.tanks.delivery_hint') : t('fuel.tanks.dip_hint')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="fuel-stock-form" loading={m.isPending} disabled={!form.tankId || form.litres === ''}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form id="fuel-stock-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        {m.error && !fieldErr('litres') && <Alert tone="red">{errMsg(m.error)}</Alert>}
        <Select id="fuel-stock-tank" label={t('fuel.setup.tank')} value={form.tankId} onChange={set('tankId')}>
          {tanks.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name} · {t(`fuel.${x.fuel}`)}
            </option>
          ))}
        </Select>
        <Input
          id="fuel-stock-litres"
          label={kind === 'delivery' ? t('fuel.tanks.litres_in') : t('fuel.tanks.litres_measured')}
          inputMode="decimal"
          dir="ltr"
          value={form.litres}
          onChange={(e) => setForm((x) => ({ ...x, litres: e.target.value.replace(/[^0-9.]/g, '') }))}
          error={fieldErr('litres')}
          hint={tank ? t('fuel.tanks.now_book', { litres: f.number(Math.max(0, tank.stockL), 0), capacity: f.number(tank.capacityL, 0) }) : undefined}
          required
        />
        {kind === 'delivery' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Input id="fuel-stock-supplier" label={t('fuel.tanks.supplier')} placeholder="STO, FSM…" value={form.supplier} onChange={set('supplier')} />
            <Input id="fuel-stock-cost" label={t('fuel.tanks.cost')} inputMode="decimal" dir="ltr" value={form.cost} onChange={set('cost')} />
          </div>
        )}
        <Input id="fuel-stock-note" label={t('fuel.tanks.note')} value={form.note} onChange={set('note')} />
        {after != null && tank && (
          <p className="rounded-xl bg-slate-50 p-3 text-sm tabular-nums ring-1 ring-slate-200 dark:bg-slate-800/40 dark:ring-slate-700">
            {t('fuel.tanks.after', { litres: f.number(after, 0) })}
            {kind === 'dip' && tank.measured && (
              <span className="block text-slate-500">{t('fuel.tanks.difference', { litres: f.number(after - tank.stockL, 0) })}</span>
            )}
          </p>
        )}
      </form>
    </Dialog>
  );
}

/** Tanks (or drums): what is in each, fuel arriving, dips, and the history. */
export default function FuelTanksPage() {
  const { t } = useTranslation();
  const f = useFormat();
  const mvr = useMvr();
  const { can } = useBiz();
  const q = useQuery({ queryKey: FUEL_KEYS.tanks, queryFn: () => api.get<{ tanks: FuelTankStock[]; moves: Move[] }>('/fuel/tanks') });
  const [open, setOpen] = useState<null | { kind: 'delivery' | 'dip'; tankId: string }>(null);
  if (!q.data) return <SkeletonRows rows={6} />;
  const names = new Map(q.data.tanks.map((x) => [x.id, x.name]));
  return (
    <div className="space-y-4">
      <PageHeader title={t('fuel.nav_tanks')} description={t('fuel.tanks.subtitle')} />
      <div className="grid gap-4 md:grid-cols-2">
        {q.data.tanks.map((tk) => (
          <Card key={tk.id}>
            <TankGauge tank={tk} />
            {can('fuel.stock') && (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" icon={<Truck className="size-4" />} onClick={() => setOpen({ kind: 'delivery', tankId: tk.id })}>
                  {t('fuel.tanks.delivery')}
                </Button>
                <Button variant="secondary" size="sm" icon={<Droplets className="size-4" />} onClick={() => setOpen({ kind: 'dip', tankId: tk.id })}>
                  {t('fuel.tanks.dip')}
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>
      <Card padded={false}>
        <div className="p-5 pb-2">
          <CardHeader title={t('fuel.tanks.history')} />
        </div>
        {q.data.moves.length ? (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {q.data.moves.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                {m.kind === 'delivery' ? <Truck className="size-4 shrink-0 text-slate-400" /> : <Droplets className="size-4 shrink-0 text-slate-400" />}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {m.kind === 'delivery' ? t('fuel.tanks.delivery_row', { litres: f.number(m.litres, 0) }) : t('fuel.tanks.dip_row', { litres: f.number(m.litres, 0) })}
                    <span className="font-normal text-slate-500"> · {names.get(m.tankId)}</span>
                  </p>
                  <p className="truncate text-xs text-slate-500" dir="auto">
                    {f.dateTime(m.createdAt)}
                    {m.supplier && ` · ${m.supplier}`}
                    {m.cost != null && ` · ${mvr(m.cost)}`}
                    {m.bookL != null && ` · ${t('fuel.tanks.difference', { litres: f.number(m.litres - m.bookL, 0) })}`}
                    {m.createdByName && ` · ${m.createdByName}`}
                    {m.note && ` · ${m.note}`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 pb-6 text-sm text-slate-500">{t('fuel.tanks.no_history')}</p>
        )}
      </Card>
      {open && <StockDialog kind={open.kind} tankId={open.tankId} tanks={q.data.tanks} onClose={() => setOpen(null)} />}
    </div>
  );
}
