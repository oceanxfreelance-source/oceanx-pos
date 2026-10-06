import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Pencil, Plus, Store } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { useBiz } from '../../auth/business';
import { useErrorMessage, useFieldErrors } from '../../lib/useApiError';
import { Alert, Badge, Card, EmptyState, Ltr, PageHeader, SkeletonRows } from '../../components/ui/Card';
import { Button, IconButton } from '../../components/ui/Button';
import { Input, Switch, Textarea } from '../../components/ui/Form';
import { Dialog } from '../../components/ui/Dialog';
import { DataTable, type Column } from '../../components/ui/Table';

interface Outlet {
  id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  isDefault: boolean;
  isActive: boolean;
}

export default function OutletsPage() {
  const { t } = useTranslation();
  const { can } = useBiz();
  const q = useQuery({ queryKey: ['biz', 'outlets'], queryFn: () => api.get<{ items: Outlet[]; limit: number | null }>('/outlets') });
  const [editing, setEditing] = useState<Outlet | 'new' | null>(null);
  const columns: Column<Outlet>[] = [
    {
      key: 'name',
      header: t('common.name'),
      cell: (o) => (
        <div>
          <p className="font-medium text-slate-900 dark:text-white" dir="auto">
            {o.name} {o.isDefault && <Badge tone="blue">{t('outlets.default')}</Badge>}
          </p>
          {o.code && <Ltr className="text-xs text-slate-500">{o.code}</Ltr>}
        </div>
      ),
    },
    { key: 'address', header: t('common.address'), hideOnMobile: true, cell: (o) => <span dir="auto">{o.address || '—'}</span> },
    { key: 'phone', header: t('common.phone'), hideOnMobile: true, cell: (o) => (o.phone ? <Ltr>{o.phone}</Ltr> : '—') },
    {
      key: 'status',
      header: t('common.status'),
      cell: (o) => (
        <Badge tone={o.isActive ? 'green' : 'gray'} dot>
          {o.isActive ? t('common.active') : t('common.inactive')}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">{t('common.actions')}</span>,
      className: 'text-end',
      cell: (o) =>
        can('outlets.manage') && (
          <IconButton label={t('common.edit')} onClick={() => setEditing(o)}>
            <Pencil className="size-4" />
          </IconButton>
        ),
    },
  ];
  return (
    <div>
      <PageHeader
        title={t('outlets.title')}
        description={q.data?.limit != null ? t('outlets.subtitle_limit', { count: q.data.items.filter((o) => o.isActive).length, limit: q.data.limit }) : t('outlets.subtitle')}
        actions={
          can('outlets.manage') && (
            <Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
              {t('outlets.create')}
            </Button>
          )
        }
      />
      <Card padded={false}>
        {q.isLoading ? <SkeletonRows /> : !q.data?.items.length ? <EmptyState icon={<Store className="size-6" />} title={t('outlets.empty')} /> : <DataTable columns={columns} rows={q.data.items} rowKey={(o) => o.id} />}
      </Card>
      {editing && <OutletDialog outlet={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function OutletDialog({ outlet, onClose }: { outlet: Outlet | null; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { refresh } = useBiz();
  const errMsg = useErrorMessage();
  const [form, setForm] = useState({ name: outlet?.name ?? '', code: outlet?.code ?? '', address: outlet?.address ?? '', phone: outlet?.phone ?? '', isActive: outlet?.isActive ?? true });
  const save = useMutation({
    mutationFn: () => (outlet ? api.patch(`/outlets/${outlet.id}`, form) : api.post('/outlets', form)),
    onSuccess: () => {
      toast.success(t('common.saved'));
      void qc.invalidateQueries({ queryKey: ['biz', 'outlets'] });
      void refresh();
      onClose();
    },
  });
  const fieldErr = useFieldErrors(save.error);
  return (
    <Dialog
      open
      onClose={onClose}
      title={outlet ? t('outlets.edit') : t('outlets.create')}
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
          <Input label={t('common.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={fieldErr('name')} required />
          <Input label={t('outlets.code')} value={form.code} dir="ltr" onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} error={fieldErr('code')} />
          <Input type="tel" label={t('common.phone')} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} error={fieldErr('phone')} />
        </div>
        <Textarea label={t('common.address')} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        {!outlet?.isDefault && <Switch checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} label={t('common.active')} />}
      </div>
    </Dialog>
  );
}
