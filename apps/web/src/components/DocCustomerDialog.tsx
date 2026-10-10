import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CUSTOMER_KINDS } from '@oceanx/shared';
import { api, ApiError } from '../lib/api';
import { useErrorMessage, useFieldErrors } from '../lib/useApiError';
import { Alert } from './ui/Card';
import { Button } from './ui/Button';
import { Dialog } from './ui/Dialog';
import { Input, Select, Textarea } from './ui/Form';
import type { CustomerLite } from './Pickers';

/** Add who a quotation or invoice is for, without leaving the document (name, company, contact, address, TIN). */
export function DocCustomerDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (c: CustomerLite) => void }) {
  const { t } = useTranslation();
  const errMsg = useErrorMessage();
  const qc = useQueryClient();
  const [form, setForm] = useState({ kind: 'company', name: '', company: '', phone: '', email: '', address: '', taxNumber: '' });
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const save = useMutation({
    mutationFn: () => api.post<CustomerLite>('/customers', { ...form, name: form.name.trim() }),
    onSuccess: (c) => {
      toast.success(t('common.saved'));
      void qc.invalidateQueries({ queryKey: ['biz', 'customers'] });
      onCreated(c);
    },
  });
  const fe = useFieldErrors(save.error);
  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={t('customers.create')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!form.name.trim()}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {save.error && !(save.error instanceof ApiError && save.error.code === 'validation_failed') && <Alert tone="red">{errMsg(save.error)}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label={t('customers.kind')} value={form.kind} onChange={set('kind')}>
            {CUSTOMER_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`customers.kinds.${k}`)}
              </option>
            ))}
          </Select>
          <Input label={t('common.name')} value={form.name} onChange={set('name')} error={fe('name')} required autoFocus />
          <Input label={t('customers.company')} value={form.company} onChange={set('company')} error={fe('company')} />
          <Input label={t('customers.tax_number')} dir="ltr" value={form.taxNumber} onChange={set('taxNumber')} error={fe('taxNumber')} />
          <Input label={t('common.phone')} type="tel" dir="ltr" value={form.phone} onChange={set('phone')} error={fe('phone')} />
          <Input label={t('common.email')} type="email" dir="ltr" value={form.email} onChange={set('email')} error={fe('email')} />
        </div>
        <Textarea label={t('common.address')} value={form.address} onChange={set('address')} error={fe('address')} />
      </div>
    </Dialog>
  );
}
