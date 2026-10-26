import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { saApi } from '../../lib/api';
import { useFormat } from '../../lib/format';
import { useFieldErrors } from '../../lib/useApiError';
import { Card, CardHeader, Ltr, PageHeader, SkeletonRows } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Form';
import { BudgetLoansForAllCard, BudgetPaydayCard } from './BudgetPayday';

interface GravityPlan {
  id: string;
  name: string;
  priceMonthly: string;
  currency: string;
  trialMinutes: number;
  accounts: number;
}

const UNITS = { days: 1440, hours: 60, minutes: 1 } as const;
type Unit = keyof typeof UNITS;

/** The largest unit that shows the trial as a whole number (14 days, 2 hours, 90 minutes). */
function splitTrial(minutes: number): { amount: number; unit: Unit } {
  if (minutes > 0 && minutes % 1440 === 0) return { amount: minutes / 1440, unit: 'days' };
  if (minutes > 0 && minutes % 60 === 0) return { amount: minutes / 60, unit: 'hours' };
  return { amount: minutes, unit: 'minutes' };
}

/**
 * Gravity has one plan for everyone: one monthly price in MVR, and a free trial that can be days,
 * hours or minutes long. A new trial length applies to accounts created from then on.
 */
export default function GravityPlanPage({ product = 'gravity' }: { product?: 'gravity' | 'flow' | 'budget' | 'fuel' }) {
  const { t } = useTranslation();
  const f = useFormat();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['sa', 'product-plan', product], queryFn: () => saApi.get<GravityPlan>(`/${product}/plan`) });
  const [price, setPrice] = useState('');
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState<Unit>('days');

  useEffect(() => {
    if (!q.data) return;
    setPrice(String(Number(q.data.priceMonthly)));
    const s = splitTrial(q.data.trialMinutes);
    setAmount(String(s.amount));
    setUnit(s.unit);
  }, [q.data]);

  const trialMinutes = Math.round(Number(amount || 0) * UNITS[unit]);
  const save = useMutation({
    mutationFn: () => saApi.put(`/${product}/plan`, { priceMonthly: Number(price || 0), trialMinutes }),
    onSuccess: () => {
      toast.success(t('common.saved'));
      void qc.invalidateQueries({ queryKey: ['sa', 'product-plan', product] });
      void qc.invalidateQueries({ queryKey: ['sa', 'plans'] });
    },
  });
  const fieldErr = useFieldErrors(save.error);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t(`${product}.plan_title`)} description={t('gravity.plan_subtitle')} />
      {!q.data ? (
        <Card padded={false}>
          <SkeletonRows rows={4} />
        </Card>
      ) : (
        <Card>
          <CardHeader
            title={q.data.name}
            description={t('gravity.plan_accounts', { count: q.data.accounts })}
          />
          <p className="mb-6 text-3xl font-semibold tabular-nums">
            <Ltr>MVR {f.number(Number(q.data.priceMonthly), 2)}</Ltr>
            <span className="text-sm font-normal text-slate-500"> / {t('superadmin.plans.month')}</span>
          </p>
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
            noValidate
          >
            <Input
              label={t('gravity.monthly_price')}
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              error={fieldErr('priceMonthly')}
              required
            />
            <div>
              <div className="grid grid-cols-[1fr_auto] gap-3">
                <Input
                  label={t('gravity.trial_length')}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  error={fieldErr('trialMinutes')}
                />
                <Select label={t('gravity.trial_unit')} value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
                  {(Object.keys(UNITS) as Unit[]).map((u) => (
                    <option key={u} value={u}>
                      {t(`gravity.unit_${u}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <p className="mt-1.5 text-xs text-slate-500">{t('gravity.trial_hint')}</p>
            </div>
            <div className="flex justify-end">
              <Button type="submit" loading={save.isPending}>
                {t('common.save')}
              </Button>
            </div>
          </form>
        </Card>
      )}
      {product === 'budget' && <BudgetPaydayCard />}
      {product === 'budget' && <BudgetLoansForAllCard />}
    </div>
  );
}
