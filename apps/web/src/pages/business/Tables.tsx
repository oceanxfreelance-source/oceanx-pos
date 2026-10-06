import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { LayoutGrid, Plus } from 'lucide-react';
import { api } from '../../lib/api';
import { useBiz, useBizSession } from '../../auth/business';
import { parseAmount, useMoney } from '../../lib/money';
import { useFieldErrors, useToastError } from '../../lib/useApiError';
import { Card, EmptyState, PageHeader, SkeletonRows } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Switch } from '../../components/ui/Form';
import { Dialog } from '../../components/ui/Dialog';
import { StatusBadge } from '../../components/StatusBadge';

export interface DiningTable {
  id: string;
  name: string;
  capacity: number;
  area: string;
  isActive: boolean;
  status: 'available' | 'occupied' | 'inactive';
  openOrders: number;
  openTotal: number;
}

export function useTables() {
  return useQuery({ queryKey: ['biz', 'tables'], queryFn: () => api.get<{ items: DiningTable[] }>('/tables'), refetchInterval: 15_000 });
}

export default function TablesPage() {
  const { t } = useTranslation();
  const { can } = useBiz();
  const session = useBizSession();
  const money = useMoney();
  const qc = useQueryClient();
  const toastErr = useToastError();
  const q = useTables();
  const [editing, setEditing] = useState<DiningTable | 'new' | null>(null);
  const [form, setForm] = useState({ name: '', capacity: '4', area: '', isActive: true });
  const open = (x: DiningTable | 'new') => {
    setEditing(x);
    setForm(x === 'new' ? { name: '', capacity: '4', area: '', isActive: true } : { name: x.name, capacity: String(x.capacity), area: x.area, isActive: x.isActive });
  };
  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, capacity: Math.max(1, Math.floor(parseAmount(form.capacity))) };
      return editing === 'new' ? api.post('/tables', body) : api.patch(`/tables/${(editing as DiningTable).id}`, body);
    },
    onSuccess: () => {
      toast.success(t('common.saved'));
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ['biz', 'tables'] });
    },
  });
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/tables/${id}`),
    onSuccess: () => {
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ['biz', 'tables'] });
    },
    onError: toastErr,
  });
  const fe = useFieldErrors(save.error);
  const areas = [...new Set(q.data?.items.map((x) => x.area) ?? [])];
  return (
    <div className="space-y-6">
      <PageHeader
        title={t('tables.title')}
        description={t('tables.subtitle', { outlet: session.outlet?.name ?? '' })}
        actions={
          can('tables.manage') && (
            <Button icon={<Plus className="size-4" />} onClick={() => open('new')}>
              {t('tables.create')}
            </Button>
          )
        }
      />
      {!q.data ? (
        <SkeletonRows />
      ) : q.data.items.length === 0 ? (
        <Card>
          <EmptyState icon={<LayoutGrid className="size-6" />} title={t('tables.empty_title')} description={t('tables.empty_body')} />
        </Card>
      ) : (
        areas.map((area) => (
          <section key={area} className="space-y-3">
            {area && <h2 className="text-sm font-semibold text-slate-500" dir="auto">{area}</h2>}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {q.data.items
                .filter((x) => x.area === area)
                .map((x) => (
                  <button
                    key={x.id}
                    type="button"
                    disabled={!can('tables.manage')}
                    onClick={() => open(x)}
                    className={`rounded-2xl p-4 text-start ring-1 transition ${x.status === 'occupied' ? 'bg-amber-50 ring-amber-200 dark:bg-amber-950/40 dark:ring-amber-900' : 'bg-white ring-slate-200 dark:bg-slate-900 dark:ring-slate-800'} enabled:hover:ring-brand-400`}
                  >
                    <p className="text-lg font-semibold" dir="auto">
                      {x.name}
                    </p>
                    <p className="text-xs text-slate-500">{t('tables.seats', { count: x.capacity })}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <StatusBadge status={x.status} />
                      {x.openTotal > 0 && <span className="text-xs font-semibold tabular-nums">{money(x.openTotal)}</span>}
                    </div>
                  </button>
                ))}
            </div>
          </section>
        ))
      )}
      <Dialog
        open={!!editing}
        onClose={() => setEditing(null)}
        size="sm"
        title={editing === 'new' ? t('tables.create') : t('tables.edit')}
        footer={
          <>
            {editing && editing !== 'new' && (
              <Button variant="ghost" className="me-auto text-rose-600" onClick={() => del.mutate(editing.id)} loading={del.isPending}>
                {t('common.delete')}
              </Button>
            )}
            <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!form.name.trim()}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label={t('common.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={fe('name')} />
          <Input type="number" min={1} max={100} label={t('tables.capacity')} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} error={fe('capacity')} />
          <Input label={t('tables.area')} placeholder={t('tables.area_placeholder')} value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
          <Switch checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} label={t('common.active')} />
        </div>
      </Dialog>
    </div>
  );
}
