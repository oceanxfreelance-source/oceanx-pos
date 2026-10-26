import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { HandCoins, Plus, Users } from 'lucide-react';
import { api } from '../../../lib/api';
import { useBiz } from '../../../auth/business';
import { useFormat } from '../../../lib/format';
import { useErrorMessage, useFieldErrors } from '../../../lib/useApiError';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Form';
import { Alert, Card, EmptyState, PageHeader, SkeletonRows } from '../../../components/ui/Card';
import { Dialog } from '../../../components/ui/Dialog';
import { Segmented } from '../FuelSetup';
import { FUEL_INVALIDATE, FUEL_KEYS, useFuelCustomers, useMvr, type FuelCustomer, type FuelSale } from './data';
import { SaleRow } from './FuelTill';

function CustomerDialog({ customer, onClose }: { customer?: FuelCustomer; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const errMsg = useErrorMessage();
  const [form, setForm] = useState({ name: customer?.name ?? '', phone: customer?.phone ?? '', creditLimit: customer ? String(customer.creditLimit || '') : '', note: customer?.note ?? '' });
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((x) => ({ ...x, [k]: e.target.value }));
  const m = useMutation({
    mutationFn: () => {
      const body = { ...form, creditLimit: Number(form.creditLimit) || 0 };
      return customer ? api.patch(`/fuel/customers/${customer.id}`, body) : api.post('/fuel/customers', body);
    },
    onSuccess: () => {
      toast.success(t('fuel.credit.saved'));
      void qc.invalidateQueries(FUEL_INVALIDATE);
      onClose();
    },
  });
  const fieldErr = useFieldErrors(m.error);
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    m.mutate();
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title={customer ? t('fuel.credit.edit') : t('fuel.credit.add')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="fuel-customer-form" loading={m.isPending}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form id="fuel-customer-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        {m.error && !fieldErr('name') && <Alert tone="red">{errMsg(m.error)}</Alert>}
        <Input id="fuel-c-name" label={t('fuel.credit.name')} hint={t('fuel.credit.name_hint')} value={form.name} onChange={set('name')} error={fieldErr('name')} required />
        <Input id="fuel-c-phone" type="tel" dir="ltr" label={t('fuel.reg.phone')} value={form.phone} onChange={set('phone')} />
        <Input id="fuel-c-limit" inputMode="decimal" dir="ltr" label={t('fuel.credit.limit')} hint={t('fuel.credit.limit_hint')} value={form.creditLimit} onChange={set('creditLimit')} error={fieldErr('creditLimit')} />
        <Input id="fuel-c-note" label={t('fuel.tanks.note')} value={form.note} onChange={set('note')} />
      </form>
    </Dialog>
  );
}

function PaymentDialog({ customer, onClose }: { customer: FuelCustomer; onClose: () => void }) {
  const { t } = useTranslation();
  const mvr = useMvr();
  const qc = useQueryClient();
  const errMsg = useErrorMessage();
  const [amount, setAmount] = useState(String(customer.owed));
  const [method, setMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
  const m = useMutation({
    mutationFn: () => api.post(`/fuel/customers/${customer.id}/payments`, { amount: Number(amount), method }),
    onSuccess: () => {
      toast.success(t('fuel.credit.payment_saved'));
      void qc.invalidateQueries(FUEL_INVALIDATE);
      onClose();
    },
  });
  return (
    <Dialog
      open
      onClose={onClose}
      title={t('fuel.credit.take_payment')}
      description={t('fuel.credit.owes_now', { name: customer.name, amount: mvr(customer.owed) })}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => m.mutate()} loading={m.isPending} disabled={!(Number(amount) > 0)}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {m.error && <Alert tone="red">{errMsg(m.error)}</Alert>}
        <Input id="fuel-pay-amount" inputMode="decimal" dir="ltr" label={t('fuel.credit.amount')} value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} />
        <Segmented
          value={method}
          onChange={(v) => setMethod(v as typeof method)}
          options={[
            ['cash', t('fuel.pay.cash')],
            ['card', t('fuel.pay.card')],
            ['transfer', t('fuel.pay.transfer')],
          ]}
        />
      </div>
    </Dialog>
  );
}

function CustomerHistory({ customer }: { customer: FuelCustomer }) {
  const { t } = useTranslation();
  const f = useFormat();
  const mvr = useMvr();
  const q = useQuery({
    queryKey: FUEL_KEYS.customer(customer.id),
    queryFn: () => api.get<{ sales: FuelSale[]; payments: { id: string; amount: number; method: string; createdAt: string; createdByName: string }[] }>(`/fuel/customers/${customer.id}`),
  });
  if (!q.data) return <SkeletonRows rows={3} />;
  if (!q.data.sales.length && !q.data.payments.length) return <p className="text-sm text-slate-500">{t('fuel.credit.no_history')}</p>;
  return (
    <div className="space-y-4">
      {q.data.payments.length > 0 && (
        <ul className="space-y-1.5 text-sm">
          {q.data.payments.map((p) => (
            <li key={p.id} className="flex justify-between gap-3">
              <span>
                {t('fuel.credit.paid_row', { method: t(`fuel.pay.${p.method}`) })} · <span className="text-slate-500">{f.dateTime(p.createdAt)}</span>
              </span>
              <span className="font-medium text-emerald-700 tabular-nums dark:text-emerald-400">−{mvr(p.amount)}</span>
            </li>
          ))}
        </ul>
      )}
      <ul className="-mx-5 divide-y divide-slate-100 dark:divide-slate-800">
        {q.data.sales.map((s) => (
          <SaleRow key={s.id} sale={s} />
        ))}
      </ul>
    </div>
  );
}

/** Credit customers: who owes what, add one, take a payment, see each one's fuel and payments. */
export default function FuelCustomersPage() {
  const { t } = useTranslation();
  const mvr = useMvr();
  const { can } = useBiz();
  const q = useFuelCustomers();
  const [edit, setEdit] = useState<FuelCustomer | 'new' | null>(null);
  const [pay, setPay] = useState<FuelCustomer | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  if (!q.data) return <SkeletonRows rows={6} />;
  const list = q.data.customers;
  const total = list.reduce((a, c) => a + Math.max(0, c.owed), 0);
  return (
    <div className="space-y-4">
      <PageHeader
        title={t('fuel.nav_credit')}
        description={t('fuel.credit.subtitle', { total: mvr(total) })}
        actions={
          can('fuel.credit') && (
            <Button icon={<Plus className="size-4" />} onClick={() => setEdit('new')}>
              {t('fuel.credit.add')}
            </Button>
          )
        }
      />
      {!list.length ? (
        <Card>
          <EmptyState icon={<Users className="size-6" />} title={t('fuel.credit.empty')} description={t('fuel.credit.empty_body')} />
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map((c) => (
            <Card key={c.id}>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className="min-w-0 flex-1 text-start" onClick={() => setOpenId(openId === c.id ? null : c.id)} aria-expanded={openId === c.id}>
                  <p className="truncate font-semibold" dir="auto">
                    {c.name}
                  </p>
                  <p className="text-xs text-slate-500" dir="ltr">
                    {[c.phone, c.creditLimit ? `${t('fuel.credit.limit')}: ${mvr(c.creditLimit)}` : ''].filter(Boolean).join(' · ')}
                  </p>
                </button>
                <div className="text-end">
                  <p className={c.owed > 0 ? 'font-semibold text-red-600 tabular-nums dark:text-red-400' : 'font-semibold text-slate-500 tabular-nums'}>{mvr(c.owed)}</p>
                  <p className="text-xs text-slate-500">{t('fuel.credit.owed')}</p>
                </div>
                {can('fuel.credit') && (
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setEdit(c)}>
                      {t('common.edit')}
                    </Button>
                    <Button size="sm" icon={<HandCoins className="size-4" />} disabled={!(c.owed > 0)} onClick={() => setPay(c)}>
                      {t('fuel.credit.take_payment')}
                    </Button>
                  </div>
                )}
              </div>
              {openId === c.id && (
                <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <CustomerHistory customer={c} />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
      {edit && <CustomerDialog customer={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
      {pay && <PaymentDialog customer={pay} onClose={() => setPay(null)} />}
    </div>
  );
}
