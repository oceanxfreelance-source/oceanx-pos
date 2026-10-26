import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bell, BellOff, FileText, Fuel, LogOut, PiggyBank, Store, TrendingUp } from 'lucide-react';
import { saApi } from '../../lib/api';
import { android } from '../../lib/desktop';
import { useSuperAdmin } from '../../auth/superadmin';
import { useNavyPalette } from '../../lib/product';
import { useToastError } from '../../lib/useApiError';
import { Card, SkeletonRows } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { fmtAmount } from '../business/Billing';
import { PaymentsTable, PRODUCT_NAME, usePayments } from './Payments';

interface PhoneSummary {
  pending: number;
  receivedThisMonth: { currency: string; total: number; count: number }[];
  activeAccounts: { product: string; active: number }[];
}
const ICON = { pos: Store, gravity: FileText, flow: TrendingUp, budget: PiggyBank, fuel: Fuel } as const;
const ALERT_KEY_ID = 'ox_sa_alert_key_id';

/** Notifications on this phone (OceanX Admin app only): a read-only key the app uses to check in the background. */
function AlertsSwitch() {
  const { t } = useTranslation();
  const toastErr = useToastError();
  const [on, setOn] = useState(() => !!android?.alertsOn?.());
  const turnOn = useMutation({
    mutationFn: () => saApi.post<{ id: string; key: string }>('/alerts/keys', { device: navigator.userAgent.match(/Android [\d.]+; ([^;)]+)/)?.[1]?.trim() ?? 'Android' }),
    onSuccess: (r) => {
      try {
        localStorage.setItem(ALERT_KEY_ID, r.id);
      } catch {
        /* ignore */
      }
      android?.enableAlerts?.(r.key);
      setOn(true);
      toast.success(t('superadmin.phone.alerts_on'));
    },
    onError: toastErr,
  });
  const turnOff = useMutation({
    mutationFn: async () => {
      let id: string | null = null;
      try {
        id = localStorage.getItem(ALERT_KEY_ID);
      } catch {
        /* ignore */
      }
      if (id) await saApi.delete(`/alerts/keys/${id}`).catch(() => undefined);
    },
    onSettled: () => {
      android?.disableAlerts?.();
      try {
        localStorage.removeItem(ALERT_KEY_ID);
      } catch {
        /* ignore */
      }
      setOn(false);
    },
  });
  if (!android?.enableAlerts) return null;
  return (
    <Card>
      <div className="flex items-center gap-3">
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${on ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
          {on ? <Bell className="size-5" /> : <BellOff className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">{on ? t('superadmin.phone.alerts_on') : t('superadmin.phone.alerts_title')}</p>
          <p className="text-xs text-slate-500">{t('superadmin.phone.alerts_hint')}</p>
        </div>
        {on ? (
          <Button size="sm" variant="secondary" onClick={() => turnOff.mutate()} loading={turnOff.isPending}>
            {t('superadmin.phone.alerts_turn_off')}
          </Button>
        ) : (
          <Button size="sm" onClick={() => turnOn.mutate()} loading={turnOn.isPending}>
            {t('superadmin.phone.alerts_turn_on')}
          </Button>
        )}
      </div>
    </Card>
  );
}

/** OceanX Admin phone app: payments waiting for approval, and how many accounts are active. Nothing else. */
export default function SuperAdminPhonePage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { session, logout } = useSuperAdmin();
  useNavyPalette(true);
  const summary = useQuery({ queryKey: ['sa', 'payments', 'phone-summary'], queryFn: () => saApi.get<PhoneSummary>('/phone/summary'), refetchInterval: 30_000 });
  const waiting = usePayments({ status: 'pending' });
  // Opening the app again (e.g. from a notification) shows the latest at once.
  useEffect(() => {
    const again = () => document.visibilityState === 'visible' && void qc.invalidateQueries({ queryKey: ['sa', 'payments'] });
    document.addEventListener('visibilitychange', again);
    return () => document.removeEventListener('visibilitychange', again);
  }, [qc]);
  const s = summary.data;
  const totalActive = s?.activeAccounts.reduce((a, x) => a + x.active, 0) ?? 0;
  return (
    <div className="mx-auto min-h-screen max-w-xl space-y-4 bg-slate-50 px-4 pt-4 pb-10 dark:bg-slate-950">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">OceanX Admin</h1>
          <p className="text-xs text-slate-500">{session?.admin.name}</p>
        </div>
        <Button size="sm" variant="ghost" icon={<LogOut className="size-4" />} onClick={() => void logout()}>
          {t('auth.logout')}
        </Button>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <p className="text-xs text-slate-500">{t('superadmin.payments.waiting')}</p>
          <p className={`mt-1 text-3xl font-semibold tabular-nums ${s?.pending ? 'text-amber-600 dark:text-amber-400' : ''}`}>{s ? s.pending : '—'}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">{t('superadmin.payments.received_month')}</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{s?.receivedThisMonth.length ? s.receivedThisMonth.map((r) => fmtAmount(r.total, r.currency)).join(' + ') : '—'}</p>
        </Card>
      </div>

      <AlertsSwitch />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300">{t('superadmin.payments.inbox_title')}</h2>
        <Card padded={false}>
          {waiting.data ? (
            waiting.data.items.length ? (
              <PaymentsTable items={waiting.data.items} showProduct phone />
            ) : (
              <p className="px-4 py-8 text-center text-sm text-slate-500">{t('superadmin.phone.all_done')}</p>
            )
          ) : (
            <SkeletonRows rows={3} />
          )}
        </Card>
      </section>

      <section className="space-y-2">
        <h2 className="flex items-baseline justify-between text-sm font-semibold text-slate-600 dark:text-slate-300">
          <span>{t('superadmin.phone.active_accounts')}</span>
          <span className="tabular-nums">{s ? totalActive : ''}</span>
        </h2>
        <Card padded={false}>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {(s?.activeAccounts ?? []).map((a) => {
              const Icon = ICON[a.product as keyof typeof ICON] ?? Store;
              return (
                <li key={a.product} className="flex items-center gap-3 px-4 py-3">
                  <Icon className="size-5 text-slate-400" />
                  <span className="flex-1 font-medium">{PRODUCT_NAME[a.product] ?? a.product}</span>
                  <span className="text-lg font-semibold tabular-nums">{a.active}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      </section>
      <p className="text-center text-xs text-slate-500">{t('superadmin.phone.full_admin_note')}</p>
    </div>
  );
}
