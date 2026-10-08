import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2, UserRound } from 'lucide-react';
import { api } from '../../lib/api';
import { useBiz } from '../../auth/business';
import { parseAmount, useMoney } from '../../lib/money';
import { useFieldErrors, useToastError } from '../../lib/useApiError';
import { Badge, Card, EmptyState, SkeletonRows } from '../../components/ui/Card';
import { Button, IconButton } from '../../components/ui/Button';
import { ConfirmDialog, Dialog } from '../../components/ui/Dialog';
import { Input, Switch, Textarea } from '../../components/ui/Form';

export interface StaffMember {
  id: string;
  name: string;
  position: string;
  phone: string;
  /** null when the viewer may not see payroll. */
  basicSalary: number | null;
  isActive: boolean;
  notes: string;
}

export const useStaff = () => useQuery({ queryKey: ['biz', 'staff'], queryFn: () => api.get<{ items: StaffMember[] }>('/staff') });

/** Staff list shared by the Payroll and Duty Rota add-ons. People here do not need a login. */
export function StaffPanel() {
  const { t } = useTranslation();
  const { can, canAny } = useBiz();
  const money = useMoney();
  const qc = useQueryClient();
  const toastErr = useToastError();
  const q = useStaff();
  const canManage = canAny('payroll.manage', 'rota.manage');
  const showPay = can('payroll.view');
  const [editing, setEditing] = useState<StaffMember | 'new' | null>(null);
  const [removing, setRemoving] = useState<StaffMember | null>(null);
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/staff/${id}`),
    onSuccess: () => {
      setRemoving(null);
      void qc.invalidateQueries({ queryKey: ['biz', 'staff'] });
      void qc.invalidateQueries({ queryKey: ['biz', 'rota'] });
    },
    onError: toastErr,
  });
  const items = q.data?.items ?? [];
  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
        <p className="text-sm text-slate-500">{t('staff.staff_hint')}</p>
        {canManage && (
          <Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
            {t('staff.add_staff')}
          </Button>
        )}
      </div>
      {!q.data ? (
        <div className="p-5">
          <SkeletonRows rows={4} />
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={<UserRound className="size-6" />} title={t('staff.no_staff')} description={t('staff.no_staff_hint')} />
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {items.map((s) => (
            <li key={s.id} className={`flex items-center gap-3 px-5 py-3 ${s.isActive ? '' : 'opacity-60'}`}>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-800 dark:bg-brand-900 dark:text-brand-100">
                {s.name.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  <span dir="auto">{s.name}</span>
                  {!s.isActive && <Badge>{t('common.inactive')}</Badge>}
                </p>
                <p className="truncate text-sm text-slate-500" dir="auto">
                  {[s.position, s.phone].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
              {showPay && s.basicSalary !== null && (
                <span className="hidden text-sm font-medium tabular-nums sm:block" title={t('staff.basic_salary')}>
                  {money(s.basicSalary)}
                </span>
              )}
              {canManage && (
                <div className="flex shrink-0">
                  <IconButton label={t('common.edit')} onClick={() => setEditing(s)}>
                    <Pencil className="size-4" />
                  </IconButton>
                  <IconButton label={t('common.delete')} onClick={() => setRemoving(s)} className="hover:text-rose-600">
                    <Trash2 className="size-4" />
                  </IconButton>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {editing && <StaffDialog member={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && remove.mutate(removing.id)}
        title={t('staff.remove_title')}
        message={t('staff.remove_body', { name: removing?.name ?? '' })}
        confirmLabel={t('common.delete')}
        danger
        loading={remove.isPending}
      />
    </Card>
  );
}

function StaffDialog({ member, onClose }: { member: StaffMember | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { can } = useBiz();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: member?.name ?? '',
    position: member?.position ?? '',
    phone: member?.phone ?? '',
    basicSalary: member?.basicSalary != null ? (member.basicSalary / 100).toString() : '',
    isActive: member?.isActive ?? true,
    notes: member?.notes ?? '',
  });
  const canPay = can('payroll.manage');
  const save = useMutation({
    mutationFn: () => {
      const { basicSalary, ...rest } = form;
      const body = canPay ? { ...rest, basicSalary: parseAmount(basicSalary) } : rest;
      return member ? api.put(`/staff/${member.id}`, body) : api.post('/staff', body);
    },
    onSuccess: () => {
      toast.success(t('common.saved'));
      void qc.invalidateQueries({ queryKey: ['biz', 'staff'] });
      void qc.invalidateQueries({ queryKey: ['biz', 'rota'] });
      onClose();
    },
  });
  const err = useFieldErrors(save.error);
  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      title={member ? t('staff.edit_staff') : t('staff.add_staff')}
      footer={
        <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!form.name.trim()}>
          {t('common.save')}
        </Button>
      }
    >
      <div className="space-y-4">
        <Input label={t('common.name')} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={err('name')} dir="auto" />
        <Input label={t('staff.position')} placeholder={t('staff.position_placeholder')} value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} dir="auto" />
        <Input label={t('common.phone')} type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} error={err('phone')} />
        {canPay && (
          <Input
            label={t('staff.basic_salary')}
            hint={t('staff.basic_salary_hint')}
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={form.basicSalary}
            onChange={(e) => setForm({ ...form, basicSalary: e.target.value })}
            error={err('basicSalary')}
          />
        )}
        <Textarea label={t('common.notes')} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <Switch checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} label={t('common.active')} description={t('staff.active_hint')} />
      </div>
    </Dialog>
  );
}
