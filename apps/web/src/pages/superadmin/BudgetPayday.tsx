import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { saApi } from '../../lib/api';
import { useFormat } from '../../lib/format';
import { useToastError } from '../../lib/useApiError';
import { Badge, Card, CardHeader, Ltr } from '../../components/ui/Card';
import { Switch } from '../../components/ui/Form';

interface PaydayRow {
  businessId: string;
  businessName: string;
  ownerName: string | null;
  email: string | null;
  phone: string | null;
  paydayDate: string;
  chosenAt: string;
  paid: boolean;
  slipWaiting: boolean;
}

/**
 * Gravity Budget "pay on salary day" (the 30th): Super Admin turns the offer on (e.g. for one month) and off again;
 * customers choose it themselves, once. Lists who chose it, their salary date and whether they have paid.
 */
export function BudgetPaydayCard() {
  const { t } = useTranslation();
  const f = useFormat();
  const qc = useQueryClient();
  const toastErr = useToastError();
  const settings = useQuery({ queryKey: ['sa', 'settings'], queryFn: () => saApi.get<{ budgetPaydayOn: boolean }>('/settings') });
  const list = useQuery({ queryKey: ['sa', 'budget-payday'], queryFn: () => saApi.get<{ items: PaydayRow[] }>('/billing/payday') });
  const save = useMutation({
    mutationFn: (body: { budgetPaydayOn: boolean }) => saApi.patch('/settings', body),
    onSuccess: () => {
      toast.success(t('common.saved'));
      void qc.invalidateQueries({ queryKey: ['sa', 'settings'] });
    },
    onError: toastErr,
  });
  const on = !!settings.data?.budgetPaydayOn;
  const items = list.data?.items ?? [];

  return (
    <Card className="mt-6">
      <CardHeader title={t('budget.payday_admin_title')} description={t('budget.payday_admin_hint')} />
      <div className="space-y-4">
        <Switch checked={on} disabled={!settings.data || save.isPending} onChange={(v) => save.mutate({ budgetPaydayOn: v })} label={t('budget.payday_admin_switch')} description={on ? t('budget.payday_admin_on') : t('budget.payday_admin_off')} />
        <div>
          <p className="mb-2 text-sm font-medium">{t('budget.payday_admin_list', { count: items.length })}</p>
          {items.length === 0 ? (
            <p className="text-sm text-slate-500">{t('budget.payday_admin_none')}</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.map((r) => (
                <li key={r.businessId} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" dir="auto">
                      {r.businessName}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      <Ltr>{[r.email, r.phone].filter(Boolean).join(' · ')}</Ltr>
                    </p>
                  </div>
                  <span className="text-sm tabular-nums">{t('budget.payday_admin_date', { date: f.date(r.paydayDate) })}</span>
                  {r.paid ? <Badge tone="green">{t('budget.payday_admin_paid')}</Badge> : r.slipWaiting ? <Badge tone="amber">{t('budget.payday_admin_slip')}</Badge> : <Badge tone="gray">{t('budget.payday_admin_unpaid')}</Badge>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}
