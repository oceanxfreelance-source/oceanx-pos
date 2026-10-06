import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Layers, Pencil, Plus, Puzzle } from 'lucide-react';
import { PLAN_LIMIT_KEYS, PLAN_MODULES } from '@oceanx/shared';
import { saApi, ApiError } from '../../lib/api';
import { useFormat } from '../../lib/format';
import { addonLabel, moduleLabel } from '../../lib/labels';
import { useErrorMessage, useFieldErrors } from '../../lib/useApiError';
import { Alert, Badge, Card, EmptyState, Ltr, PageHeader, SkeletonRows } from '../../components/ui/Card';
import { Button, IconButton } from '../../components/ui/Button';
import { Checkbox, Input, Switch, Textarea } from '../../components/ui/Form';
import { Dialog } from '../../components/ui/Dialog';
import { DataTable, type Column } from '../../components/ui/Table';

interface PlanFull {
  id: string;
  code: string;
  name: string;
  description: string;
  priceMonthly: string;
  currency: string;
  trialDays: number;
  limits: Record<string, number | null>;
  modules: string[];
  isActive: boolean;
  isPublic: boolean;
  sortOrder: number;
  subscriptionCount: number;
}

export function PlansPage() {
  const { t } = useTranslation();
  const f = useFormat();
  const q = useQuery({ queryKey: ['sa', 'plans'], queryFn: () => saApi.get<{ items: PlanFull[] }>('/plans') });
  const [editing, setEditing] = useState<PlanFull | 'new' | null>(null);
  return (
    <div>
      <PageHeader
        title={t('superadmin.plans.title')}
        description={t('superadmin.plans.subtitle')}
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
            {t('superadmin.plans.create')}
          </Button>
        }
      />
      {q.isLoading ? (
        <Card padded={false}>
          <SkeletonRows />
        </Card>
      ) : !q.data?.items.length ? (
        <Card>
          <EmptyState icon={<Layers className="size-6" />} title={t('superadmin.plans.empty')} />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {q.data.items.map((p) => (
            <Card key={p.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-lg font-semibold">{p.name}</h3>
                  <Ltr className="text-xs text-slate-500">{p.code}</Ltr>
                </div>
                <div className="flex gap-1.5">
                  {!p.isActive && <Badge tone="gray">{t('common.inactive')}</Badge>}
                  {!p.isPublic && <Badge tone="violet">{t('superadmin.plans.private')}</Badge>}
                </div>
              </div>
              <p className="mt-3 text-2xl font-semibold tabular-nums">
                <Ltr>
                  {p.currency} {f.number(Number(p.priceMonthly), 2)}
                </Ltr>
                <span className="text-sm font-normal text-slate-500"> / {t('superadmin.plans.month')}</span>
              </p>
              {p.trialDays > 0 && <p className="text-sm text-slate-500">{t('superadmin.plans.trial_days_n', { count: p.trialDays })}</p>}
              <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                {PLAN_LIMIT_KEYS.map((k) => (
                  <div key={k}>
                    <dt className="text-xs text-slate-500">{t(`superadmin.plans.limits.${k}`)}</dt>
                    <dd className="font-medium tabular-nums">{p.limits[k] == null ? t('common.unlimited') : f.number(p.limits[k]!)}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 flex flex-wrap gap-1">
                {p.modules.map((m) => (
                  <Badge key={m} tone="blue">
                    {moduleLabel(t, m)}
                  </Badge>
                ))}
              </div>
              <div className="mt-auto flex items-center justify-between pt-4 text-sm text-slate-500">
                <span>{t('superadmin.plans.subscriptions_n', { count: p.subscriptionCount })}</span>
                <IconButton label={t('common.edit')} onClick={() => setEditing(p)}>
                  <Pencil className="size-4" />
                </IconButton>
              </div>
            </Card>
          ))}
        </div>
      )}
      {editing && <PlanDialog plan={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function PlanDialog({ plan, onClose }: { plan: PlanFull | null; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const errMsg = useErrorMessage();
  const [form, setForm] = useState({
    code: plan?.code ?? '',
    name: plan?.name ?? '',
    description: plan?.description ?? '',
    priceMonthly: plan ? Number(plan.priceMonthly) : 0,
    currency: plan?.currency ?? 'USD',
    trialDays: plan?.trialDays ?? 0,
    isActive: plan?.isActive ?? true,
    isPublic: plan?.isPublic ?? true,
    sortOrder: plan?.sortOrder ?? 0,
    modules: plan?.modules ?? [...PLAN_MODULES],
  });
  // '' = unlimited
  const [limits, setLimits] = useState<Record<string, string>>(Object.fromEntries(PLAN_LIMIT_KEYS.map((k) => [k, plan?.limits[k] == null ? '' : String(plan.limits[k])])));
  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, limits: Object.fromEntries(Object.entries(limits).map(([k, v]) => [k, v === '' ? null : Number(v)])) };
      return plan ? saApi.put(`/plans/${plan.id}`, body) : saApi.post('/plans', body);
    },
    onSuccess: () => {
      toast.success(t('common.saved'));
      void qc.invalidateQueries({ queryKey: ['sa', 'plans'] });
      onClose();
    },
  });
  const fieldErr = useFieldErrors(save.error);
  return (
    <Dialog
      open
      onClose={onClose}
      size="xl"
      title={plan ? t('superadmin.plans.edit') : t('superadmin.plans.create')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => save.mutate()} loading={save.isPending}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {save.error && !(save.error instanceof ApiError && save.error.code === 'validation_failed') && <Alert tone="red">{errMsg(save.error)}</Alert>}
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label={t('superadmin.plans.code')} value={form.code} dir="ltr" onChange={(e) => setForm({ ...form, code: e.target.value.toLowerCase() })} error={fieldErr('code')} disabled={!!plan} required />
          <Input label={t('common.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={fieldErr('name')} required />
          <Input type="number" label={t('superadmin.plans.sort')} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} />
          <Input type="number" step="0.01" min={0} label={t('superadmin.plans.price')} value={form.priceMonthly} onChange={(e) => setForm({ ...form, priceMonthly: Number(e.target.value) })} error={fieldErr('priceMonthly')} />
          <Input label={t('settings.currency')} value={form.currency} maxLength={3} dir="ltr" onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} error={fieldErr('currency')} />
          <Input type="number" min={0} label={t('superadmin.plans.trial_days')} value={form.trialDays} onChange={(e) => setForm({ ...form, trialDays: Number(e.target.value) })} error={fieldErr('trialDays')} />
          <Textarea className="sm:col-span-3" label={t('common.description')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div>
          <p className="mb-1 text-sm font-semibold">{t('superadmin.plans.limits_title')}</p>
          <p className="mb-3 text-xs text-slate-500">{t('superadmin.plans.limits_hint')}</p>
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {PLAN_LIMIT_KEYS.map((k) => (
              <Input
                key={k}
                type="number"
                min={0}
                label={t(`superadmin.plans.limits.${k}`)}
                placeholder={t('common.unlimited')}
                value={limits[k]}
                onChange={(e) => setLimits({ ...limits, [k]: e.target.value })}
                error={fieldErr(`limits.${k}`)}
              />
            ))}
          </div>
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold">{t('superadmin.plans.modules_title')}</p>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {PLAN_MODULES.map((m) => (
              <Checkbox
                key={m}
                checked={form.modules.includes(m)}
                onChange={(v) => setForm({ ...form, modules: v ? [...form.modules, m] : form.modules.filter((x) => x !== m) })}
                label={moduleLabel(t, m)}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">{t('superadmin.plans.core_note')}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Switch checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} label={t('superadmin.plans.active')} description={t('superadmin.plans.active_hint')} />
          <Switch checked={form.isPublic} onChange={(v) => setForm({ ...form, isPublic: v })} label={t('superadmin.plans.public')} description={t('superadmin.plans.public_hint')} />
        </div>
      </div>
    </Dialog>
  );
}

interface AddonFull {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  priceMonthly: string | null;
  currency: string;
  isActive: boolean;
  activeBusinesses: number;
}

export function AddonCatalogPage() {
  const { t } = useTranslation();
  const f = useFormat();
  const q = useQuery({ queryKey: ['sa', 'addons'], queryFn: () => saApi.get<{ items: AddonFull[] }>('/addons') });
  const [editing, setEditing] = useState<AddonFull | 'new' | null>(null);
  const columns: Column<AddonFull>[] = [
    {
      key: 'name',
      header: t('common.name'),
      cell: (a) => (
        <div>
          <p className="font-medium text-slate-900 dark:text-white">{addonLabel(t, a.code, a.name)}</p>
          <Ltr className="text-xs text-slate-500">{a.code}</Ltr>
        </div>
      ),
    },
    { key: 'category', header: t('superadmin.addons.category'), hideOnMobile: true, cell: (a) => t(`addons.categories.${a.category}`, { defaultValue: a.category }) },
    { key: 'price', header: t('superadmin.plans.price'), cell: (a) => (a.priceMonthly ? <Ltr>{`${a.currency} ${f.number(Number(a.priceMonthly), 2)}`}</Ltr> : '—') },
    { key: 'usage', header: t('superadmin.addons.businesses'), cell: (a) => <span className="tabular-nums">{f.number(a.activeBusinesses)}</span> },
    {
      key: 'status',
      header: t('common.status'),
      cell: (a) => (
        <Badge tone={a.isActive ? 'green' : 'gray'} dot>
          {a.isActive ? t('common.active') : t('common.inactive')}
        </Badge>
      ),
    },
    {
      key: 'edit',
      header: <span className="sr-only">{t('common.actions')}</span>,
      className: 'text-end',
      cell: (a) => (
        <IconButton label={t('common.edit')} onClick={() => setEditing(a)}>
          <Pencil className="size-4" />
        </IconButton>
      ),
    },
  ];
  return (
    <div>
      <PageHeader
        title={t('superadmin.addons.title')}
        description={t('superadmin.addons.subtitle')}
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
            {t('superadmin.addons.create')}
          </Button>
        }
      />
      <Card padded={false}>
        {q.isLoading ? <SkeletonRows /> : !q.data?.items.length ? <EmptyState icon={<Puzzle className="size-6" />} title={t('superadmin.addons.empty')} /> : <DataTable columns={columns} rows={q.data.items} rowKey={(a) => a.id} />}
      </Card>
      {editing && <AddonDialog addon={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function AddonDialog({ addon, onClose }: { addon: AddonFull | null; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const errMsg = useErrorMessage();
  const [form, setForm] = useState({
    code: addon?.code ?? '',
    name: addon?.name ?? '',
    description: addon?.description ?? '',
    category: addon?.category ?? 'general',
    price: addon?.priceMonthly ?? '',
    currency: addon?.currency ?? 'USD',
    isActive: addon?.isActive ?? true,
  });
  const save = useMutation({
    mutationFn: () => {
      const body = { code: form.code, name: form.name, description: form.description, category: form.category, priceMonthly: form.price === '' ? null : Number(form.price), currency: form.currency, isActive: form.isActive };
      return addon ? saApi.put(`/addons/${addon.id}`, body) : saApi.post('/addons', body);
    },
    onSuccess: () => {
      toast.success(t('common.saved'));
      void qc.invalidateQueries({ queryKey: ['sa', 'addons'] });
      onClose();
    },
  });
  const fieldErr = useFieldErrors(save.error);
  return (
    <Dialog
      open
      onClose={onClose}
      title={addon ? t('superadmin.addons.edit') : t('superadmin.addons.create')}
      description={t('superadmin.addons.dialog_hint')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => save.mutate()} loading={save.isPending}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {save.error && !(save.error instanceof ApiError && save.error.code === 'validation_failed') && <Alert tone="red">{errMsg(save.error)}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label={t('superadmin.plans.code')} value={form.code} dir="ltr" disabled={!!addon} onChange={(e) => setForm({ ...form, code: e.target.value.toLowerCase() })} error={fieldErr('code')} hint={addon ? t('superadmin.addons.code_locked') : undefined} />
          <Input label={t('common.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={fieldErr('name')} />
          <Input label={t('superadmin.addons.category')} value={form.category} dir="ltr" onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <Input type="number" step="0.01" min={0} label={t('superadmin.plans.price')} placeholder="—" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} error={fieldErr('priceMonthly')} />
            <Input label={t('settings.currency')} value={form.currency} maxLength={3} dir="ltr" onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} />
          </div>
        </div>
        <Textarea label={t('common.description')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <Switch checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} label={t('superadmin.addons.available')} description={t('superadmin.addons.available_hint')} />
      </div>
    </Dialog>
  );
}
