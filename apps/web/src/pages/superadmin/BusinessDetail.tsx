import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Ban, CalendarPlus, CheckCircle2, Mail, Power, RefreshCcw } from 'lucide-react';
import { saApi } from '../../lib/api';
import { useFormat } from '../../lib/format';
import { actionLabel, addonLabel } from '../../lib/labels';
import { useToastError } from '../../lib/useApiError';
import { Badge, Card, CardHeader, Ltr, PageHeader, SkeletonRows } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select, Textarea } from '../../components/ui/Form';
import { ConfirmDialog, Dialog } from '../../components/ui/Dialog';
import { STATUS_TONE, SUB_TONE, type Plan } from './Businesses';

interface Detail {
  business: { id: string; name: string; slug: string; businessType: string; status: string; email: string; phone: string; address: string; currency: string; timezone: string; createdAt: string; approvedAt: string | null; suspensionReason: string | null; superadminViberCreditEnabled: boolean; managerViberCreditEnabled: boolean; viberCreditRequestedAt: string | null };
  subscription: { status: string; effectiveStatus: string; currentPeriodEnd: string; startsAt: string; plan: Plan } | null;
  addons: { code: string; name: string; isActive: boolean; status: string | null; grantedAt: string | null; revokedAt: string | null; expiresAt: string | null }[];
  userCount: number;
  outletCount: number;
  owner: { id: string; name: string; email: string; lastLoginAt: string | null; hasPassword: boolean } | null;
  activity: { id: number; action: string; actorName: string | null; createdAt: string; metadata: Record<string, unknown> }[];
}

export default function BusinessDetailPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const f = useFormat();
  const qc = useQueryClient();
  const toastErr = useToastError();
  const q = useQuery({ queryKey: ['sa', 'business', id], queryFn: () => saApi.get<Detail>(`/businesses/${id}`) });
  const [confirm, setConfirm] = useState<'approve' | 'activate' | 'deactivate' | null>(null);
  const [suspending, setSuspending] = useState(false);
  const [changingPlan, setChangingPlan] = useState(false);
  const [extending, setExtending] = useState(false);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['sa', 'business', id] });
    void qc.invalidateQueries({ queryKey: ['sa', 'businesses'] });
  };
  const action = useMutation({
    mutationFn: ({ verb, body }: { verb: string; body?: unknown }) => saApi.post(`/businesses/${id}/${verb}`, body ?? {}),
    onSuccess: () => {
      toast.success(t('common.saved'));
      setConfirm(null);
      setSuspending(false);
      refresh();
    },
    onError: toastErr,
  });
  const addon = useMutation({
    mutationFn: ({ code, grant }: { code: string; grant: boolean }) => saApi.post(`/businesses/${id}/addons/${code}/${grant ? 'grant' : 'revoke'}`),
    onSuccess: (_d, v) => {
      toast.success(v.grant ? t('superadmin.business.addon_granted') : t('superadmin.business.addon_revoked'));
      refresh();
    },
    onError: toastErr,
  });
  const viber = useMutation({
    mutationFn: (enabled: boolean) => saApi.post(`/businesses/${id}/features/viber-credit`, { enabled }),
    onSuccess: () => {
      toast.success(t('common.saved'));
      void qc.invalidateQueries({ queryKey: ['sa', 'business', id] });
    },
    onError: toastErr,
  });
  const invite = useMutation({ mutationFn: () => saApi.post(`/businesses/${id}/owner/resend-invite`), onSuccess: () => toast.success(t('superadmin.business.invite_sent')), onError: toastErr });

  if (q.isLoading || !q.data)
    return (
      <Card padded={false}>
        <SkeletonRows rows={8} />
      </Card>
    );
  const { business: b, subscription: sub } = q.data;
  return (
    <div className="space-y-6">
      <PageHeader
        back={
          <Link to="/superadmin/businesses" className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
            <ArrowLeft className="rtl-flip size-4" /> {t('superadmin.businesses.title')}
          </Link>
        }
        title={<span dir="auto">{b.name}</span>}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            {t(`business_types.${b.businessType}`)} · <Ltr>{b.slug}</Ltr>
            <Badge tone={STATUS_TONE[b.status]} dot>
              {t(`superadmin.status.${b.status}`)}
            </Badge>
          </span>
        }
        actions={
          <>
            {b.status === 'pending' && (
              <Button icon={<CheckCircle2 className="size-4" />} onClick={() => setConfirm('approve')}>
                {t('superadmin.business.approve')}
              </Button>
            )}
            {(b.status === 'suspended' || b.status === 'deactivated') && (
              <Button icon={<Power className="size-4" />} onClick={() => setConfirm('activate')}>
                {t('superadmin.business.activate')}
              </Button>
            )}
            {(b.status === 'active' || b.status === 'pending') && (
              <Button variant="secondary" icon={<Ban className="size-4" />} onClick={() => setSuspending(true)}>
                {t('superadmin.business.suspend')}
              </Button>
            )}
            {b.status !== 'deactivated' && (
              <Button variant="ghost" className="text-rose-600" onClick={() => setConfirm('deactivate')}>
                {t('superadmin.business.deactivate')}
              </Button>
            )}
          </>
        }
      />
      {b.status === 'suspended' && b.suspensionReason && (
        <Card className="bg-rose-50 ring-rose-200 dark:bg-rose-950/40 dark:ring-rose-900">
          <p className="text-sm text-rose-800 dark:text-rose-200">
            <span className="font-semibold">{t('superadmin.business.suspension_reason')}:</span> <span dir="auto">{b.suspensionReason}</span>
          </p>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title={t('superadmin.business.subscription')}
            actions={
              <>
                <Button size="sm" variant="secondary" icon={<RefreshCcw className="size-4" />} onClick={() => setChangingPlan(true)}>
                  {t('superadmin.business.change_plan')}
                </Button>
                <Button size="sm" variant="secondary" icon={<CalendarPlus className="size-4" />} onClick={() => setExtending(true)} disabled={!sub}>
                  {t('superadmin.business.extend')}
                </Button>
              </>
            }
          />
          {sub ? (
            <dl className="grid gap-4 text-sm sm:grid-cols-4">
              <Info label={t('superadmin.businesses.plan')} value={sub.plan.name} />
              <Info label={t('common.status')} value={<Badge tone={SUB_TONE[sub.effectiveStatus]}>{t(`superadmin.sub_status.${sub.effectiveStatus}`)}</Badge>} />
              <Info label={t('superadmin.businesses.period_end')} value={f.date(sub.currentPeriodEnd)} />
              <Info label={t('superadmin.business.price')} value={<Ltr>{`${sub.plan.currency} ${sub.plan.priceMonthly}`}</Ltr>} />
            </dl>
          ) : (
            <p className="text-sm text-slate-500">{t('superadmin.business.no_subscription')}</p>
          )}
        </Card>
        <Card>
          <CardHeader title={t('superadmin.business.owner')} />
          {q.data.owner ? (
            <div className="space-y-3 text-sm">
              <p className="font-medium" dir="auto">
                {q.data.owner.name}
              </p>
              <Ltr className="text-slate-500">{q.data.owner.email}</Ltr>
              <p className="text-slate-500">
                {q.data.owner.hasPassword
                  ? t('superadmin.business.last_login', { when: q.data.owner.lastLoginAt ? f.relative(q.data.owner.lastLoginAt) : t('users.never') })
                  : t('superadmin.business.invite_pending')}
              </p>
              <Button size="sm" variant="secondary" icon={<Mail className="size-4" />} loading={invite.isPending} onClick={() => invite.mutate()}>
                {q.data.owner.hasPassword ? t('superadmin.business.send_reset') : t('superadmin.business.resend_invite')}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-slate-500">—</p>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title={t('superadmin.business.profile')} />
          <dl className="space-y-3 text-sm">
            <Info label={t('auth.email')} value={b.email ? <Ltr>{b.email}</Ltr> : '—'} />
            <Info label={t('common.phone')} value={b.phone ? <Ltr>{b.phone}</Ltr> : '—'} />
            <Info label={t('common.address')} value={<span dir="auto">{b.address || '—'}</span>} />
            <Info label={t('settings.currency')} value={b.currency} />
            <Info label={t('superadmin.business.users_outlets')} value={`${f.number(q.data.userCount)} / ${f.number(q.data.outletCount)}`} />
            <Info label={t('common.created')} value={f.date(b.createdAt)} />
          </dl>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title={t('superadmin.business.addons')} description={t('superadmin.business.addons_hint')} />
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {q.data.addons.map((a) => {
              const active = a.status === 'active';
              return (
                <li key={a.code} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{addonLabel(t, a.code, a.name)}</p>
                    <p className="text-xs text-slate-500">
                      {active ? t('addons.since', { date: f.date(a.grantedAt) }) : a.revokedAt ? t('superadmin.business.revoked_on', { date: f.date(a.revokedAt) }) : t('superadmin.business.not_granted')}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={active ? 'secondary' : 'subtle'}
                    disabled={!a.isActive && !active}
                    loading={addon.isPending && addon.variables?.code === a.code}
                    onClick={() => addon.mutate({ code: a.code, grant: !active })}
                  >
                    {active ? t('superadmin.business.revoke') : t('superadmin.business.grant')}
                  </Button>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <Card>
        <CardHeader title={t('superadmin.business.features')} description={t('superadmin.business.features_hint')} />
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl p-4 ring-1 ring-slate-200 dark:ring-slate-800">
          <div className="min-w-0 space-y-1">
            <p className="font-medium">{t('viber.title')}</p>
            <p className="text-sm text-slate-500">{t('superadmin.business.viber_hint')}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge tone={b.superadminViberCreditEnabled ? 'green' : 'gray'} dot>
                {b.superadminViberCreditEnabled ? t('superadmin.business.feature_enabled') : t('superadmin.business.feature_disabled')}
              </Badge>
              {b.superadminViberCreditEnabled && <Badge tone={b.managerViberCreditEnabled ? 'green' : 'amber'}>{b.managerViberCreditEnabled ? t('superadmin.business.manager_on') : t('superadmin.business.manager_off')}</Badge>}
              {b.viberCreditRequestedAt && !b.superadminViberCreditEnabled && <Badge tone="violet">{t('superadmin.business.requested_on', { date: f.date(b.viberCreditRequestedAt) })}</Badge>}
            </div>
          </div>
          <Button variant={b.superadminViberCreditEnabled ? 'secondary' : 'primary'} onClick={() => viber.mutate(!b.superadminViberCreditEnabled)} loading={viber.isPending}>
            {b.superadminViberCreditEnabled ? t('superadmin.business.disable') : t('superadmin.business.enable')}
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader title={t('superadmin.business.history')} description={t('superadmin.business.history_hint')} />
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {q.data.activity.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span>
                <span className="font-medium">{actionLabel(t, a.action)}</span>
                {a.actorName && <span className="text-slate-500"> · {a.actorName}</span>}
              </span>
              <span className="shrink-0 text-xs text-slate-400">{f.dateTime(a.createdAt)}</span>
            </li>
          ))}
        </ul>
      </Card>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && action.mutate({ verb: confirm })}
        loading={action.isPending}
        danger={confirm === 'deactivate'}
        title={confirm ? t(`superadmin.business.${confirm}_title`) : ''}
        message={confirm ? t(`superadmin.business.${confirm}_body`, { name: b.name }) : ''}
      />
      {suspending && <SuspendDialog loading={action.isPending} onClose={() => setSuspending(false)} onConfirm={(reason) => action.mutate({ verb: 'suspend', body: { reason } })} />}
      {changingPlan && <ChangePlanDialog businessId={b.id} currentPlanId={sub?.plan.id} onClose={() => setChangingPlan(false)} onDone={refresh} />}
      {extending && <ExtendDialog businessId={b.id} onClose={() => setExtending(false)} onDone={refresh} />}
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">{value}</dd>
    </div>
  );
}

function SuspendDialog({ onClose, onConfirm, loading }: { onClose: () => void; onConfirm: (reason: string) => void; loading: boolean }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      title={t('superadmin.business.suspend_title')}
      description={t('superadmin.business.suspend_body')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" onClick={() => onConfirm(reason)} loading={loading} disabled={reason.trim().length < 3}>
            {t('superadmin.business.suspend')}
          </Button>
        </>
      }
    >
      <Textarea label={t('superadmin.business.suspension_reason')} value={reason} onChange={(e) => setReason(e.target.value)} hint={t('superadmin.business.reason_visible')} required />
    </Dialog>
  );
}

function ChangePlanDialog({ businessId, currentPlanId, onClose, onDone }: { businessId: string; currentPlanId?: string; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation();
  const toastErr = useToastError();
  const plans = useQuery({ queryKey: ['sa', 'plans'], queryFn: () => saApi.get<{ items: Plan[] }>('/plans') });
  const [planId, setPlanId] = useState(currentPlanId ?? '');
  const [status, setStatus] = useState<'active' | 'trialing'>('active');
  const m = useMutation({
    mutationFn: () => saApi.post(`/businesses/${businessId}/subscription/change-plan`, { planId, status }),
    onSuccess: () => {
      toast.success(t('superadmin.business.plan_changed'));
      onDone();
      onClose();
    },
    onError: toastErr,
  });
  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      title={t('superadmin.business.change_plan')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => m.mutate()} loading={m.isPending} disabled={!planId}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select label={t('superadmin.businesses.plan')} value={planId} onChange={(e) => setPlanId(e.target.value)}>
          <option value="" disabled>
            —
          </option>
          {plans.data?.items
            .filter((p) => p.isActive || p.id === currentPlanId)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.currency} {p.priceMonthly}
              </option>
            ))}
        </Select>
        <Select label={t('common.status')} value={status} onChange={(e) => setStatus(e.target.value as 'active' | 'trialing')} hint={t('superadmin.business.plan_status_hint')}>
          <option value="active">{t('superadmin.sub_status.active')}</option>
          <option value="trialing">{t('superadmin.sub_status.trialing')}</option>
        </Select>
      </div>
    </Dialog>
  );
}

function ExtendDialog({ businessId, onClose, onDone }: { businessId: string; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation();
  const toastErr = useToastError();
  const [days, setDays] = useState(30);
  const m = useMutation({
    mutationFn: () => saApi.post(`/businesses/${businessId}/subscription/extend`, { days }),
    onSuccess: () => {
      toast.success(t('superadmin.business.extended'));
      onDone();
      onClose();
    },
    onError: toastErr,
  });
  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      title={t('superadmin.business.extend')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => m.mutate()} loading={m.isPending} disabled={days < 1}>
            {t('superadmin.business.extend')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input type="number" min={1} max={3650} label={t('superadmin.business.extend_days')} value={days} onChange={(e) => setDays(Number(e.target.value))} />
        <div className="flex flex-wrap gap-2">
          {[7, 14, 30, 90, 365].map((d) => (
            <Button key={d} size="sm" variant={d === days ? 'subtle' : 'ghost'} onClick={() => setDays(d)}>
              {t('common.days', { count: d })}
            </Button>
          ))}
        </div>
      </div>
    </Dialog>
  );
}
