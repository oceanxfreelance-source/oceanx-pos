import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Building2, Plus, RefreshCcw, Search } from 'lucide-react';
import { BUSINESS_TYPES, LANGUAGES } from '@oceanx/shared';
import { qs, saApi, ApiError, type Paginated } from '../../lib/api';
import { useFormat } from '../../lib/format';
import { useErrorMessage, useFieldErrors } from '../../lib/useApiError';
import { Alert, Badge, Card, EmptyState, Ltr, PageHeader, SkeletonRows, type BadgeTone } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select, Textarea } from '../../components/ui/Form';
import { Dialog } from '../../components/ui/Dialog';
import { DataTable, Pagination, type Column } from '../../components/ui/Table';
import { OwnerCredentials, generatePassword } from '../../components/OwnerCredentials';

interface Row {
  id: string;
  name: string;
  slug: string;
  businessType: string;
  status: string;
  email: string;
  createdAt: string;
  planName: string | null;
  effectiveSubscriptionStatus: string | null;
  viberCreditRequested?: boolean;
  addonRequests?: number;
  currentPeriodEnd: string | null;
  userCount: number;
}
export interface Plan {
  id: string;
  code: string;
  name: string;
  priceMonthly: string;
  currency: string;
  trialDays: number;
  isActive: boolean;
}

export const STATUS_TONE: Record<string, BadgeTone> = { active: 'green', pending: 'amber', suspended: 'red', deactivated: 'gray' };
export const SUB_TONE: Record<string, BadgeTone> = { active: 'green', trialing: 'blue', past_due: 'amber', expired: 'red', cancelled: 'gray' };

export default function BusinessesPage({ presetType }: { presetType?: string }) {
  const { t } = useTranslation();
  const f = useFormat();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [type, setType] = useState(presetType ?? '');
  const [status, setStatus] = useState('');
  const [subscription, setSubscription] = useState('');
  const [creating, setCreating] = useState(false);
  useEffect(() => setType(presetType ?? ''), [presetType]);
  useEffect(() => {
    const id = setTimeout(() => {
      setQ(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(id);
  }, [search]);

  const list = useQuery({
    queryKey: ['sa', 'businesses', page, q, type, status, subscription],
    queryFn: () => saApi.get<Paginated<Row>>(`/businesses${qs({ page, pageSize: 20, q, type, status, subscription })}`),
    placeholderData: keepPreviousData,
  });

  const columns: Column<Row>[] = [
    {
      key: 'name',
      header: t('superadmin.businesses.business'),
      cell: (b) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900 dark:text-white" dir="auto">
            {b.name}
          </p>
          <p className="truncate text-xs text-slate-500">{t(`business_types.${b.businessType}`)}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: t('common.status'),
      cell: (b) => (
        <span className="flex flex-wrap items-center justify-end gap-1.5 md:justify-start">
          <Badge tone={STATUS_TONE[b.status]} dot>
            {t(`superadmin.status.${b.status}`)}
          </Badge>
          {b.viberCreditRequested && <Badge tone="violet">{t('superadmin.business.viber_requested')}</Badge>}
          {(b.addonRequests ?? 0) > 0 && <Badge tone="violet">{t('superadmin.business.addon_requests', { count: b.addonRequests })}</Badge>}
        </span>
      ),
    },
    {
      key: 'plan',
      header: t('superadmin.businesses.plan'),
      cell: (b) => (
        <div className="flex items-center justify-end gap-2 md:justify-start">
          <span>{b.planName ?? '—'}</span>
          {b.effectiveSubscriptionStatus && <Badge tone={SUB_TONE[b.effectiveSubscriptionStatus]}>{t(`superadmin.sub_status.${b.effectiveSubscriptionStatus}`)}</Badge>}
        </div>
      ),
    },
    { key: 'period', header: t('superadmin.businesses.period_end'), hideOnMobile: true, cell: (b) => <span className="text-slate-500">{f.date(b.currentPeriodEnd)}</span> },
    { key: 'users', header: t('superadmin.businesses.users'), hideOnMobile: true, cell: (b) => <span className="tabular-nums">{f.number(b.userCount)}</span> },
    { key: 'created', header: t('common.created'), hideOnMobile: true, cell: (b) => <span className="text-slate-500">{f.date(b.createdAt)}</span> },
  ];

  const title =
    presetType === 'restaurant' ? t('superadmin.nav.restaurants') : presetType === 'cafe' ? t('superadmin.nav.cafes') : presetType === 'retail' ? t('superadmin.nav.retail') : t('superadmin.businesses.title');
  return (
    <div>
      <PageHeader
        title={title}
        description={t('superadmin.businesses.subtitle')}
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
            {t('superadmin.businesses.create')}
          </Button>
        }
      />
      <Card padded={false}>
        <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-800">
          <div className="relative self-end">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('superadmin.businesses.search')}
              className="w-full rounded-xl border-0 bg-slate-50 py-2.5 ps-9 pe-3 text-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-brand-600 focus:outline-none dark:bg-slate-800 dark:ring-slate-700"
            />
          </div>
          <Select label={t('auth.business_type')} value={type} onChange={(e) => (setType(e.target.value), setPage(1))} disabled={!!presetType}>
            <option value="">{t('common.all')}</option>
            {presetType === 'retail' && <option value="retail">{t('superadmin.nav.retail')}</option>}
            {BUSINESS_TYPES.map((b) => (
              <option key={b} value={b}>
                {t(`business_types.${b}`)}
              </option>
            ))}
          </Select>
          <Select label={t('common.status')} value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))}>
            <option value="">{t('common.all')}</option>
            {['pending', 'active', 'suspended', 'deactivated'].map((s) => (
              <option key={s} value={s}>
                {t(`superadmin.status.${s}`)}
              </option>
            ))}
          </Select>
          <Select label={t('superadmin.businesses.subscription')} value={subscription} onChange={(e) => (setSubscription(e.target.value), setPage(1))}>
            <option value="">{t('common.all')}</option>
            {['trialing', 'active', 'expired'].map((s) => (
              <option key={s} value={s}>
                {t(`superadmin.sub_status.${s}`)}
              </option>
            ))}
          </Select>
        </div>
        {list.isLoading ? (
          <SkeletonRows />
        ) : !list.data?.items.length ? (
          <EmptyState icon={<Building2 className="size-6" />} title={t('superadmin.businesses.empty_title')} description={t('superadmin.businesses.empty_body')} />
        ) : (
          <>
            <DataTable columns={columns} rows={list.data.items} rowKey={(b) => b.id} onRowClick={(b) => navigate(`/superadmin/businesses/${b.id}`)} />
            <Pagination page={page} pageSize={20} total={list.data.total} onPage={setPage} />
          </>
        )}
      </Card>
      {creating && <CreateBusinessDialog onClose={() => setCreating(false)} defaultType={presetType === 'retail' ? 'retail_shop' : presetType} />}
    </div>
  );
}

function CreateBusinessDialog({ onClose, defaultType }: { onClose: () => void; defaultType?: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const errMsg = useErrorMessage();
  const plans = useQuery({ queryKey: ['sa', 'plans'], queryFn: () => saApi.get<{ items: Plan[] }>('/plans') });
  const [form, setForm] = useState({
    name: '',
    businessType: defaultType ?? 'restaurant',
    email: '',
    phone: '',
    address: '',
    currency: 'MVR',
    timezone: 'Indian/Maldives',
    planId: '',
    ownerName: '',
    ownerEmail: '',
    ownerLanguage: 'en',
    ownerPassword: generatePassword(),
  });
  const [created, setCreated] = useState<{ id: string; email: string; password: string } | null>(null);
  useEffect(() => {
    if (!form.planId && plans.data?.items.length) {
      const trial = plans.data.items.find((p) => p.code === 'trial' && p.isActive) ?? plans.data.items.find((p) => p.isActive);
      if (trial) setForm((f) => ({ ...f, planId: trial.id }));
    }
  }, [plans.data, form.planId]);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const m = useMutation({
    mutationFn: () =>
      saApi.post<{ id: string }>('/businesses', {
        name: form.name,
        businessType: form.businessType,
        email: form.email,
        phone: form.phone,
        address: form.address,
        currency: form.currency,
        timezone: form.timezone,
        planId: form.planId,
        owner: { name: form.ownerName, email: form.ownerEmail, language: form.ownerLanguage, password: form.ownerPassword },
      }),
    onSuccess: (r) => {
      toast.success(t('superadmin.businesses.created'));
      void qc.invalidateQueries({ queryKey: ['sa', 'businesses'] });
      // Show the sign-in details to hand over before leaving the dialog.
      setCreated({ id: r.id, email: form.ownerEmail.trim().toLowerCase(), password: form.ownerPassword });
    },
  });
  const fieldErr = useFieldErrors(m.error);
  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={t('superadmin.businesses.create')}
      description={t('superadmin.businesses.create_hint')}
      footer={
        created ? (
          <Button onClick={() => navigate(`/superadmin/businesses/${created.id}`)}>{t('superadmin.credentials.open_business')}</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => m.mutate()} loading={m.isPending} disabled={!form.name || !form.ownerEmail || !form.planId || form.ownerPassword.length < 8}>
              {t('superadmin.businesses.create')}
            </Button>
          </>
        )
      }
    >
      {created ? (
        <OwnerCredentials email={created.email} password={created.password} />
      ) : (
      <div className="space-y-5">
        {m.error && !(m.error instanceof ApiError && m.error.code === 'validation_failed') && <Alert tone="red">{errMsg(m.error)}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label={t('auth.business_name')} value={form.name} onChange={set('name')} error={fieldErr('name')} required />
          <Select label={t('auth.business_type')} value={form.businessType} onChange={set('businessType')}>
            {BUSINESS_TYPES.map((b) => (
              <option key={b} value={b}>
                {t(`business_types.${b}`)}
              </option>
            ))}
          </Select>
          <Input type="email" label={t('superadmin.businesses.business_email')} value={form.email} onChange={set('email')} error={fieldErr('email')} />
          <Input type="tel" label={t('common.phone')} value={form.phone} onChange={set('phone')} error={fieldErr('phone')} />
          <Input label={t('settings.currency')} value={form.currency} maxLength={3} dir="ltr" onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value.toUpperCase() }))} error={fieldErr('currency')} />
          <Input label={t('settings.timezone')} value={form.timezone} dir="ltr" onChange={set('timezone')} error={fieldErr('timezone')} />
          <Textarea className="sm:col-span-2" label={t('common.address')} value={form.address} onChange={set('address')} />
          <Select className="sm:col-span-2" label={t('superadmin.businesses.plan')} value={form.planId} onChange={set('planId')} error={fieldErr('planId')}>
            {plans.data?.items
              .filter((p) => p.isActive)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.currency} {p.priceMonthly}
                  {p.trialDays ? ` (${t('superadmin.plans.trial_days_n', { count: p.trialDays })})` : ''}
                </option>
              ))}
          </Select>
        </div>
        <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200 dark:bg-slate-800/40 dark:ring-slate-700">
          <p className="mb-3 text-sm font-semibold">{t('superadmin.businesses.owner')}</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label={t('common.name')} value={form.ownerName} onChange={set('ownerName')} error={fieldErr('owner.name')} required />
            <Input type="email" label={t('auth.email')} value={form.ownerEmail} onChange={set('ownerEmail')} error={fieldErr('owner.email')} required />
            <Select label={t('users.app_language')} value={form.ownerLanguage} onChange={set('ownerLanguage')}>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.nativeName}
                </option>
              ))}
            </Select>
          </div>
          <div className="mt-4 flex items-end gap-2">
            <Input
              className="flex-1"
              label={t('superadmin.credentials.first_password')}
              hint={t('superadmin.credentials.first_password_hint')}
              value={form.ownerPassword}
              dir="ltr"
              onChange={set('ownerPassword')}
              error={fieldErr('owner.password')}
            />
            <Button variant="secondary" icon={<RefreshCcw className="size-4" />} onClick={() => setForm((f) => ({ ...f, ownerPassword: generatePassword() }))}>
              {t('superadmin.credentials.generate')}
            </Button>
          </div>
        </div>
      </div>
      )}
    </Dialog>
  );
}
