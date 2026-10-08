import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CreditCard, History, Monitor, Plus, ShieldCheck, ShieldOff } from 'lucide-react';
import QRCode from 'qrcode';
import { qs, saApi, type Paginated } from '../../lib/api';
import { useSuperAdmin } from '../../auth/superadmin';
import { useFormat } from '../../lib/format';
import { actionLabel } from '../../lib/labels';
import { useFieldErrors, useToastError } from '../../lib/useApiError';
import { Alert, Badge, Card, CardHeader, EmptyState, Ltr, PageHeader, SkeletonRows } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select, Switch, Textarea } from '../../components/ui/Form';
import { Dialog } from '../../components/ui/Dialog';
import { Tabs } from '../../components/ui/Tabs';
import { DataTable, Pagination, type Column } from '../../components/ui/Table';
import { ChangePasswordForm } from '../../components/ChangePasswordForm';
import { STATUS_TONE, SUB_TONE } from './Businesses';

// ------------------------------------------------------------------ subscriptions
interface SubRow {
  id: string;
  businessId: string;
  businessName: string;
  businessStatus: string;
  planName: string;
  priceMonthly: string;
  currency: string;
  status: string;
  currentPeriodEnd: string;
}

export function SubscriptionsPage() {
  const { t } = useTranslation();
  const f = useFormat();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const q = useQuery({
    queryKey: ['sa', 'subscriptions', page, status],
    queryFn: () => saApi.get<Paginated<SubRow>>(`/subscriptions${qs({ page, pageSize: 25, status })}`),
    placeholderData: keepPreviousData,
  });
  const effective = (s: SubRow) => (new Date(s.currentPeriodEnd) < new Date() || s.status === 'cancelled' ? 'expired' : s.status);
  const columns: Column<SubRow>[] = [
    { key: 'b', header: t('superadmin.businesses.business'), cell: (s) => <span className="font-medium" dir="auto">{s.businessName}</span> },
    { key: 'plan', header: t('superadmin.businesses.plan'), cell: (s) => s.planName },
    { key: 'status', header: t('common.status'), cell: (s) => <Badge tone={SUB_TONE[effective(s)]}>{t(`superadmin.sub_status.${effective(s)}`)}</Badge> },
    { key: 'bs', header: t('superadmin.subscriptions.business_status'), hideOnMobile: true, cell: (s) => <Badge tone={STATUS_TONE[s.businessStatus]} dot>{t(`superadmin.status.${s.businessStatus}`)}</Badge> },
    { key: 'price', header: t('superadmin.plans.price'), hideOnMobile: true, cell: (s) => <Ltr>{`${s.currency} ${f.number(Number(s.priceMonthly), 2)}`}</Ltr> },
    { key: 'end', header: t('superadmin.businesses.period_end'), cell: (s) => f.date(s.currentPeriodEnd) },
  ];
  return (
    <div>
      <PageHeader title={t('superadmin.subscriptions.title')} description={t('superadmin.subscriptions.subtitle')} />
      <Card padded={false}>
        <div className="border-b border-slate-100 p-4 sm:max-w-xs dark:border-slate-800">
          <Select label={t('common.status')} value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))}>
            <option value="">{t('common.all')}</option>
            {['trialing', 'active', 'expired'].map((s) => (
              <option key={s} value={s}>
                {t(`superadmin.sub_status.${s}`)}
              </option>
            ))}
          </Select>
        </div>
        {q.isLoading ? (
          <SkeletonRows />
        ) : !q.data?.items.length ? (
          <EmptyState icon={<CreditCard className="size-6" />} title={t('superadmin.subscriptions.empty')} />
        ) : (
          <>
            <DataTable columns={columns} rows={q.data.items} rowKey={(s) => s.id} onRowClick={(s) => navigate(`/superadmin/businesses/${s.businessId}`)} />
            <Pagination page={page} pageSize={25} total={q.data.total} onPage={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------ users
interface AdminRow {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  totpEnabled: boolean;
  lastLoginAt: string | null;
  hasPassword: boolean;
}
interface BizUserRow {
  id: string;
  name: string;
  email: string;
  isOwner: boolean;
  isActive: boolean;
  lastLoginAt: string | null;
  businessId: string;
  businessName: string;
}

export function PlatformUsersPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'admins' | 'business'>('admins');
  return (
    <div className="space-y-6">
      <PageHeader title={t('superadmin.users.title')} description={t('superadmin.users.subtitle')} />
      <Tabs
        tabs={[
          { value: 'admins', label: t('superadmin.users.admins') },
          { value: 'business', label: t('superadmin.users.business_users') },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'admins' ? <AdminsTab /> : <BusinessUsersTab />}
    </div>
  );
}

function AdminsTab() {
  const { t } = useTranslation();
  const f = useFormat();
  const qc = useQueryClient();
  const { session } = useSuperAdmin();
  const toastErr = useToastError();
  const q = useQuery({ queryKey: ['sa', 'admins'], queryFn: () => saApi.get<{ items: AdminRow[] }>('/users/admins') });
  const [inviting, setInviting] = useState(false);
  const toggle = useMutation({
    mutationFn: (a: AdminRow) => saApi.patch(`/users/admins/${a.id}`, { isActive: !a.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sa', 'admins'] }),
    onError: toastErr,
  });
  const columns: Column<AdminRow>[] = [
    {
      key: 'n',
      header: t('common.name'),
      cell: (a) => (
        <div>
          <p className="font-medium">{a.name}</p>
          <Ltr className="text-xs text-slate-500">{a.email}</Ltr>
        </div>
      ),
    },
    { key: '2fa', header: t('superadmin.security.two_factor'), cell: (a) => (a.totpEnabled ? <Badge tone="green">{t('common.enabled')}</Badge> : <Badge tone="amber">{t('common.disabled')}</Badge>) },
    { key: 'last', header: t('users.last_login'), hideOnMobile: true, cell: (a) => (a.hasPassword ? (a.lastLoginAt ? f.relative(a.lastLoginAt) : t('users.never')) : t('superadmin.business.invite_pending')) },
    {
      key: 'status',
      header: t('common.status'),
      cell: (a) =>
        a.id === session?.admin.id ? (
          <Badge tone="blue">{t('users.you')}</Badge>
        ) : (
          <Button size="sm" variant={a.isActive ? 'secondary' : 'subtle'} loading={toggle.isPending && toggle.variables?.id === a.id} onClick={() => toggle.mutate(a)}>
            {a.isActive ? t('superadmin.users.deactivate') : t('superadmin.users.activate')}
          </Button>
        ),
    },
  ];
  return (
    <Card padded={false}>
      <div className="flex justify-end border-b border-slate-100 p-4 dark:border-slate-800">
        <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setInviting(true)}>
          {t('superadmin.users.invite')}
        </Button>
      </div>
      {q.isLoading ? <SkeletonRows /> : <DataTable columns={columns} rows={q.data?.items ?? []} rowKey={(a) => a.id} />}
      {inviting && <InviteAdminDialog onClose={() => setInviting(false)} />}
    </Card>
  );
}

function InviteAdminDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const m = useMutation({
    mutationFn: () => saApi.post('/users/admins', { name, email }),
    onSuccess: () => {
      toast.success(t('superadmin.users.invited'));
      void qc.invalidateQueries({ queryKey: ['sa', 'admins'] });
      onClose();
    },
  });
  const fieldErr = useFieldErrors(m.error);
  const toastErr = useToastError();
  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      title={t('superadmin.users.invite')}
      description={t('superadmin.users.invite_hint')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => m.mutate(undefined, { onError: (e) => (e as { code?: string }).code !== 'validation_failed' && toastErr(e) })} loading={m.isPending} disabled={!name || !email}>
            {t('superadmin.users.send_invite')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label={t('common.name')} value={name} onChange={(e) => setName(e.target.value)} error={fieldErr('name')} />
        <Input type="email" label={t('auth.email')} value={email} onChange={(e) => setEmail(e.target.value)} error={fieldErr('email')} />
      </div>
    </Dialog>
  );
}

function BusinessUsersTab() {
  const { t } = useTranslation();
  const f = useFormat();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const id = setTimeout(() => (setQ(search), setPage(1)), 250);
    return () => clearTimeout(id);
  }, [search]);
  const list = useQuery({
    queryKey: ['sa', 'business-users', page, q],
    queryFn: () => saApi.get<Paginated<BizUserRow>>(`/users/business${qs({ page, pageSize: 25, q })}`),
    placeholderData: keepPreviousData,
  });
  const columns: Column<BizUserRow>[] = [
    {
      key: 'n',
      header: t('common.name'),
      cell: (u) => (
        <div>
          <p className="font-medium" dir="auto">
            {u.name} {u.isOwner && <Badge tone="violet">{t('users.owner')}</Badge>}
          </p>
          <Ltr className="text-xs text-slate-500">{u.email}</Ltr>
        </div>
      ),
    },
    { key: 'b', header: t('superadmin.businesses.business'), cell: (u) => <span dir="auto">{u.businessName}</span> },
    { key: 's', header: t('common.status'), cell: (u) => <Badge tone={u.isActive ? 'green' : 'gray'} dot>{u.isActive ? t('common.active') : t('common.inactive')}</Badge> },
    { key: 'l', header: t('users.last_login'), hideOnMobile: true, cell: (u) => (u.lastLoginAt ? f.relative(u.lastLoginAt) : t('users.never')) },
  ];
  return (
    <Card padded={false}>
      <div className="border-b border-slate-100 p-4 dark:border-slate-800">
        <Input className="max-w-sm" type="search" placeholder={t('users.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
        <p className="mt-2 text-xs text-slate-500">{t('superadmin.users.read_only_note')}</p>
      </div>
      {list.isLoading ? (
        <SkeletonRows />
      ) : (
        <>
          <DataTable columns={columns} rows={list.data?.items ?? []} rowKey={(u) => u.id} />
          {list.data && <Pagination page={page} pageSize={25} total={list.data.total} onPage={setPage} />}
        </>
      )}
    </Card>
  );
}

// ------------------------------------------------------------------ languages
interface LangRow {
  code: string;
  name: string;
  nativeName: string;
  direction: string;
  isEnabled: boolean;
  isDefault: boolean;
}

export function LanguagesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toastErr = useToastError();
  const q = useQuery({ queryKey: ['sa', 'languages'], queryFn: () => saApi.get<{ items: LangRow[] }>('/languages') });
  const m = useMutation({
    mutationFn: ({ code, body }: { code: string; body: Partial<LangRow> }) => saApi.patch(`/languages/${code}`, body),
    onSuccess: () => {
      toast.success(t('common.saved'));
      void qc.invalidateQueries({ queryKey: ['sa', 'languages'] });
    },
    onError: toastErr,
  });
  return (
    <div>
      <PageHeader title={t('superadmin.languages.title')} description={t('superadmin.languages.subtitle')} />
      <Card padded={false}>
        {q.isLoading ? (
          <SkeletonRows />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {q.data?.items.map((l) => (
              <li key={l.code} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                <div>
                  <p className="font-medium">
                    <span lang={l.code}>{l.nativeName}</span> <span className="text-sm font-normal text-slate-500">· {l.name}</span>
                  </p>
                  <p className="mt-0.5 flex gap-1.5 text-xs text-slate-500">
                    <Ltr className="font-mono">{l.code}</Ltr>
                    {l.direction === 'rtl' && <Badge tone="violet">RTL</Badge>}
                    {l.isDefault && <Badge tone="blue">{t('superadmin.languages.default')}</Badge>}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  {!l.isDefault && l.isEnabled && (
                    <Button size="sm" variant="ghost" onClick={() => m.mutate({ code: l.code, body: { isDefault: true } })}>
                      {t('superadmin.languages.make_default')}
                    </Button>
                  )}
                  <Switch checked={l.isEnabled} disabled={l.isDefault} onChange={(v) => m.mutate({ code: l.code, body: { isEnabled: v } })} label={<span className="sr-only">{l.name}</span>} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------ platform settings
interface PlatformSettings {
  platformName: string;
  supportEmail: string;
  registrationMode: 'open' | 'approval' | 'closed';
  defaultPlanCode: string;
  defaultCurrency: string;
  billingBankDetails: string;
  billingNote: string;
  billingReminderDays: number;
}

export function PlatformSettingsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['sa', 'settings'], queryFn: () => saApi.get<PlatformSettings>('/settings') });
  const plans = useQuery({ queryKey: ['sa', 'plans'], queryFn: () => saApi.get<{ items: { code: string; name: string; isActive: boolean }[] }>('/plans') });
  const [form, setForm] = useState<PlatformSettings | null>(null);
  useEffect(() => {
    if (q.data) setForm(q.data);
  }, [q.data]);
  const save = useMutation({
    mutationFn: () => saApi.patch('/settings', form),
    onSuccess: () => {
      toast.success(t('common.saved'));
      void qc.invalidateQueries({ queryKey: ['sa', 'settings'] });
    },
  });
  const fieldErr = useFieldErrors(save.error);
  if (!form)
    return (
      <Card padded={false}>
        <SkeletonRows />
      </Card>
    );
  return (
    <div>
      <PageHeader title={t('superadmin.settings.title')} description={t('superadmin.settings.subtitle')} />
      <Card>
        <div className="grid max-w-3xl gap-5 sm:grid-cols-2">
          <Input label={t('superadmin.settings.platform_name')} value={form.platformName} onChange={(e) => setForm({ ...form, platformName: e.target.value })} error={fieldErr('platformName')} />
          <Input type="email" label={t('superadmin.settings.support_email')} value={form.supportEmail} onChange={(e) => setForm({ ...form, supportEmail: e.target.value })} error={fieldErr('supportEmail')} />
          <Select label={t('superadmin.settings.registration_mode')} value={form.registrationMode} onChange={(e) => setForm({ ...form, registrationMode: e.target.value as PlatformSettings['registrationMode'] })} hint={t(`superadmin.settings.registration_${form.registrationMode}_hint`)}>
            {(['open', 'approval', 'closed'] as const).map((m) => (
              <option key={m} value={m}>
                {t(`superadmin.settings.registration_${m}`)}
              </option>
            ))}
          </Select>
          <Select label={t('superadmin.settings.default_plan')} value={form.defaultPlanCode} onChange={(e) => setForm({ ...form, defaultPlanCode: e.target.value })} error={fieldErr('defaultPlanCode')} hint={t('superadmin.settings.default_plan_hint')}>
            {plans.data?.items.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </Select>
          <Input label={t('superadmin.settings.default_currency')} value={form.defaultCurrency} maxLength={3} dir="ltr" onChange={(e) => setForm({ ...form, defaultCurrency: e.target.value.toUpperCase() })} error={fieldErr('defaultCurrency')} />
        </div>
        <h3 className="mt-8 mb-3 text-sm font-semibold">{t('superadmin.settings.billing_section')}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Textarea
            className="sm:col-span-2"
            rows={4}
            label={t('superadmin.settings.bank_details')}
            hint={t('superadmin.settings.bank_details_hint')}
            value={form.billingBankDetails}
            maxLength={1000}
            onChange={(e) => setForm({ ...form, billingBankDetails: e.target.value })}
            error={fieldErr('billingBankDetails')}
          />
          <Textarea
            className="sm:col-span-2"
            rows={2}
            label={t('superadmin.settings.billing_note')}
            hint={t('superadmin.settings.billing_note_hint')}
            value={form.billingNote}
            maxLength={500}
            onChange={(e) => setForm({ ...form, billingNote: e.target.value })}
            error={fieldErr('billingNote')}
          />
          <Input
            type="number"
            min={0}
            max={60}
            label={t('superadmin.settings.reminder_days')}
            hint={t('superadmin.settings.reminder_days_hint')}
            value={String(form.billingReminderDays)}
            onChange={(e) => setForm({ ...form, billingReminderDays: Number(e.target.value) })}
            error={fieldErr('billingReminderDays')}
          />
        </div>
        <div className="mt-6 flex justify-end">
          <Button onClick={() => save.mutate()} loading={save.isPending}>
            {t('common.save_changes')}
          </Button>
        </div>
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------ activity logs
interface SaLog {
  id: number;
  actorType: string;
  actorName: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  businessName: string | null;
  ip: string | null;
  createdAt: string;
}

export function SuperAdminActivityPage() {
  const { t } = useTranslation();
  const f = useFormat();
  const [page, setPage] = useState(1);
  const [actorType, setActorType] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const q = useQuery({
    queryKey: ['sa', 'activity', page, actorType, action, from, to],
    queryFn: () => saApi.get<Paginated<SaLog>>(`/activity-logs${qs({ page, pageSize: 30, actorType, action, from, to })}`),
    placeholderData: keepPreviousData,
  });
  const columns: Column<SaLog>[] = [
    { key: 'a', header: t('activity.event'), cell: (l) => <span className="font-medium">{actionLabel(t, l.action)}</span> },
    { key: 'actor', header: t('activity.actor'), cell: (l) => <span dir="auto">{l.actorName ?? t(`superadmin.activity.actor_${l.actorType}`)}</span> },
    { key: 'b', header: t('superadmin.businesses.business'), hideOnMobile: true, cell: (l) => <span dir="auto">{l.businessName ?? '—'}</span> },
    { key: 'ip', header: t('activity.ip'), hideOnMobile: true, cell: (l) => (l.ip ? <Ltr className="font-mono text-xs">{l.ip}</Ltr> : '—') },
    { key: 't', header: t('activity.time'), cell: (l) => <span className="text-slate-500">{f.dateTime(l.createdAt)}</span> },
  ];
  return (
    <div>
      <PageHeader title={t('superadmin.activity.title')} description={t('superadmin.activity.subtitle')} />
      <Card padded={false}>
        <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-800">
          <Select label={t('activity.actor')} value={actorType} onChange={(e) => (setActorType(e.target.value), setPage(1))}>
            <option value="">{t('common.all')}</option>
            <option value="super_admin">{t('superadmin.activity.actor_super_admin')}</option>
            <option value="user">{t('superadmin.activity.actor_user')}</option>
          </Select>
          <Input label={t('superadmin.activity.action_prefix')} placeholder="superadmin." dir="ltr" value={action} onChange={(e) => (setAction(e.target.value.replace(/[^a-z_.]/g, '')), setPage(1))} />
          <Input type="date" label={t('common.from')} value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" label={t('common.to')} value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        {q.isLoading ? (
          <SkeletonRows />
        ) : !q.data?.items.length ? (
          <EmptyState icon={<History className="size-6" />} title={t('activity.empty')} />
        ) : (
          <>
            <DataTable columns={columns} rows={q.data.items} rowKey={(l) => String(l.id)} />
            <Pagination page={page} pageSize={30} total={q.data.total} onPage={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------ security
interface SessionRow {
  id: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
}

export function SecurityPage() {
  const { t } = useTranslation();
  const f = useFormat();
  const qc = useQueryClient();
  const { session } = useSuperAdmin();
  const toastErr = useToastError();
  const sessions = useQuery({ queryKey: ['sa', 'sessions'], queryFn: () => saApi.get<{ items: SessionRow[] }>('/security/sessions') });
  const revoke = useMutation({
    mutationFn: (id: string) => saApi.delete(`/security/sessions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sa', 'sessions'] }),
    onError: toastErr,
  });
  const [setup, setSetup] = useState(false);
  const [disabling, setDisabling] = useState(false);
  return (
    <div className="space-y-6">
      <PageHeader title={t('superadmin.security.title')} description={t('superadmin.security.subtitle')} />
      <Card>
        <CardHeader
          title={t('superadmin.security.two_factor')}
          description={t('superadmin.security.two_factor_hint')}
          actions={
            session?.admin.totpEnabled ? (
              <Button variant="secondary" icon={<ShieldOff className="size-4" />} onClick={() => setDisabling(true)}>
                {t('superadmin.security.disable_2fa')}
              </Button>
            ) : (
              <Button icon={<ShieldCheck className="size-4" />} onClick={() => setSetup(true)}>
                {t('superadmin.security.enable_2fa')}
              </Button>
            )
          }
        />
        {session?.admin.totpEnabled ? (
          <Alert tone="green" icon={<ShieldCheck className="size-5" />}>
            {t('superadmin.security.2fa_on')}
          </Alert>
        ) : (
          <Alert tone="amber" icon={<ShieldOff className="size-5" />}>
            {t('superadmin.security.2fa_off')}
          </Alert>
        )}
      </Card>
      <Card>
        <CardHeader title={t('superadmin.security.sessions')} description={t('superadmin.security.sessions_hint')} />
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {sessions.data?.items.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <Monitor className="size-5 shrink-0 text-slate-400" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium" dir="ltr">
                    {s.userAgent ?? '—'}
                  </p>
                  <p className="text-xs text-slate-500">
                    <Ltr>{s.ip ?? '—'}</Ltr> · {t('superadmin.security.last_active', { when: f.relative(s.lastSeenAt) })}
                  </p>
                </div>
              </div>
              {s.current ? (
                <Badge tone="green">{t('superadmin.security.this_device')}</Badge>
              ) : (
                <Button size="sm" variant="secondary" loading={revoke.isPending && revoke.variables === s.id} onClick={() => revoke.mutate(s.id)}>
                  {t('superadmin.security.revoke')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardHeader title={t('auth.change_password')} description={t('superadmin.security.password_hint')} />
        <ChangePasswordForm minLength={12} submit={(b) => saApi.post('/auth/change-password', b)} onDone={() => qc.invalidateQueries({ queryKey: ['sa', 'sessions'] })} />
      </Card>
      {setup && <TwoFactorSetupDialog onClose={() => setSetup(false)} />}
      {disabling && <TwoFactorDisableDialog onClose={() => setDisabling(false)} />}
    </div>
  );
}

function TwoFactorSetupDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toastErr = useToastError();
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const init = useQuery({ queryKey: ['sa', '2fa-setup'], queryFn: () => saApi.post<{ secret: string; otpauthUri: string }>('/security/2fa/setup'), gcTime: 0, staleTime: Infinity, retry: false });
  useEffect(() => {
    if (init.data) void QRCode.toDataURL(init.data.otpauthUri, { margin: 1, width: 220 }).then(setQr);
  }, [init.data]);
  const enable = useMutation({
    mutationFn: () => saApi.post('/security/2fa/enable', { code }),
    onSuccess: () => {
      toast.success(t('superadmin.security.2fa_enabled'));
      void qc.invalidateQueries({ queryKey: ['sa', 'session'] });
      onClose();
    },
  });
  const fieldErr = useFieldErrors(enable.error);
  useEffect(() => {
    if (init.error) toastErr(init.error);
  }, [init.error, toastErr]);
  return (
    <Dialog
      open
      onClose={onClose}
      title={t('superadmin.security.enable_2fa')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => enable.mutate()} loading={enable.isPending} disabled={code.length !== 6}>
            {t('superadmin.verify')}
          </Button>
        </>
      }
    >
      <ol className="list-decimal space-y-4 ps-5 text-sm">
        <li>
          {t('superadmin.security.step_scan')}
          <div className="mt-3 flex flex-col items-center gap-2 rounded-xl bg-white p-4 ring-1 ring-slate-200">
            {qr ? <img src={qr} alt="QR" className="size-48" /> : <div className="size-48 animate-pulse rounded bg-slate-100" />}
            {init.data && <code className="text-xs break-all text-slate-600" dir="ltr">{init.data.secret}</code>}
          </div>
        </li>
        <li>
          {t('superadmin.security.step_code')}
          <Input className="mt-2" value={code} inputMode="numeric" autoComplete="one-time-code" onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} error={fieldErr('code')} />
        </li>
      </ol>
    </Dialog>
  );
}

function TwoFactorDisableDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const m = useMutation({
    mutationFn: () => saApi.post('/security/2fa/disable', { password, code }),
    onSuccess: () => {
      toast.success(t('superadmin.security.2fa_disabled'));
      void qc.invalidateQueries({ queryKey: ['sa', 'session'] });
      onClose();
    },
  });
  const fieldErr = useFieldErrors(m.error);
  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      title={t('superadmin.security.disable_2fa')}
      description={t('superadmin.security.disable_hint')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" onClick={() => m.mutate()} loading={m.isPending} disabled={!password || code.length !== 6}>
            {t('superadmin.security.disable_2fa')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input type="password" label={t('auth.password')} value={password} onChange={(e) => setPassword(e.target.value)} error={fieldErr('password')} />
        <Input label={t('superadmin.mfa_code')} value={code} inputMode="numeric" onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} error={fieldErr('code')} />
      </div>
    </Dialog>
  );
}
