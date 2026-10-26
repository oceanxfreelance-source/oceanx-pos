import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarX2, Clock, CloudOff, KeyRound, LogOut, ShieldOff } from 'lucide-react';
import { useBiz, useBizSession } from '../../auth/business';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Logo } from '../../components/Logo';
import { FarumaWarning } from '../../components/FarumaWarning';
import { ChangePasswordForm } from '../../components/ChangePasswordForm';
import { useFormat } from '../../lib/format';
import { PayPanel, useBilling } from './Billing';
import { BudgetMark, FlowMark, FuelMark, GravityMark } from '../auth/AuthLayout';
import { useFuelPalette } from '../auth/FuelAuth';
import { productPath, useProductTheme } from '../../lib/product';
import { useOnline } from '../../lib/budgetOffline';

function Frame({ icon, title, body, children, wide }: { icon: React.ReactNode; title: string; body: React.ReactNode; children?: React.ReactNode; wide?: boolean }) {
  const { t } = useTranslation();
  const { logout } = useBiz();
  const navigate = useNavigate();
  // A Gravity account sees Gravity's name, logo and colours here too.
  const product = useBizSession().business.product;
  const gravity = product !== 'pos';
  useProductTheme(product);
  return (
    <div className="min-h-dvh">
      <FarumaWarning />
      <div className={`mx-auto flex min-h-dvh flex-col justify-center px-5 py-10 ${wide ? 'max-w-2xl' : 'max-w-lg'}`}>
        <div className="mb-6 flex items-center gap-2">
          {product === 'gravity' ? <GravityMark className="size-9" /> : product === 'flow' ? <FlowMark className="size-9" /> : product === 'budget' ? <BudgetMark className="size-9" /> : product === 'fuel' ? <FuelMark className="size-9" /> : <Logo />}
          <span className="font-semibold">{gravity ? t(`${product}.name`) : t('app.name')}</span>
        </div>
        <Card className="animate-pop-in">
          <div className="mb-4 inline-flex rounded-2xl bg-brand-50 p-3 text-brand-700 dark:bg-brand-950 dark:text-brand-300">{icon}</div>
          <h1 className="text-xl font-semibold">{title}</h1>
          <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">{body}</div>
          {children && <div className="mt-6">{children}</div>}
          <div className="mt-6 border-t border-slate-100 pt-4 dark:border-slate-800">
            <Button
              variant="ghost"
              icon={<LogOut className="rtl-flip size-4" />}
              onClick={async () => {
                await logout();
                navigate(productPath(product, 'login'));
              }}
            >
              {t('auth.logout')}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

/** Shown when the business is pending/suspended or the subscription is no longer valid. */
export function StatusScreen() {
  const { t } = useTranslation();
  const s = useBizSession();
  const f = useFormat();
  switch (s.state) {
    case 'business_pending':
      // Theyo Fihaara: the shed asked for an account; the team calls them before approving it.
      if (s.business.product === 'fuel') return <FuelPending name={s.business.name} />;
      return <Frame icon={<Clock className="size-6" />} title={t('status.pending_title')} body={t('status.pending_body', { name: s.business.name })} />;
    case 'business_suspended':
    case 'business_deactivated':
      return (
        <Frame
          icon={<ShieldOff className="size-6" />}
          title={t('status.suspended_title')}
          body={
            <>
              <p>{t('status.suspended_body')}</p>
              {s.business.suspensionReason && <p className="mt-2 font-medium" dir="auto">{s.business.suspensionReason}</p>}
            </>
          }
        />
      );
    default:
      // Trial or paid period over: pay right here (choose plan, bank transfer, upload the slip).
      return (
        <Frame
          wide
          icon={<CalendarX2 className="size-6" />}
          title={s.subscription?.planCode === 'trial' || s.subscription?.status === 'trialing' ? t('billing.trial_over_title') : t('status.expired_title')}
          body={t(s.subscription?.deleteAt ? 'gravity.blocked_body_delete' : 'billing.blocked_body', { plan: s.subscription?.planName ?? '—', date: f.date(s.subscription?.currentPeriodEnd), app: s.business.product === 'gravity' ? 'Gravity' : s.business.product === 'flow' ? 'Gravity Flow' : s.business.product === 'budget' ? 'Gravity Budget' : 'OceanX' })}
        >
          {/* Gravity: an unpaid trial is deleted soon after it ends. */}
          {s.subscription?.deleteAt && (
            <p className="mb-4 rounded-xl bg-rose-50 p-3 text-sm font-medium text-rose-700 ring-1 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-900" role="alert">
              {t('gravity.delete_warning', { date: f.dateTime(s.subscription.deleteAt) })}
            </p>
          )}
          <ExpiredPay />
        </Frame>
      );
  }
}

export function ForcePasswordChange() {
  const { t } = useTranslation();
  const { refresh } = useBiz();
  return (
    <Frame icon={<KeyRound className="size-6" />} title={t('auth.must_change_title')} body={t('auth.must_change_body')}>
      <ChangePasswordForm minLength={8} submit={(b) => api.post('/auth/change-password', b)} onDone={() => refresh()} />
    </Frame>
  );
}

function ExpiredPay() {
  const { t } = useTranslation();
  const q = useBilling();
  const online = useOnline();
  if (q.data) return <PayPanel info={q.data} />;
  // Offline (Gravity Budget works offline): the bank details and slip upload need the internet.
  if (!online || q.isError)
    return (
      <div className="flex items-start gap-2 rounded-xl bg-slate-100 p-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">
        <CloudOff className="mt-0.5 size-4 shrink-0" />
        <span className="flex-1">{t('billing.pay_needs_internet')}</span>
        {online && (
          <button type="button" onClick={() => void q.refetch()} className="shrink-0 font-semibold text-brand-700 dark:text-brand-300">
            {t('billing.try_again')}
          </button>
        )}
      </div>
    );
  return null;
}

/** Theyo Fihaara: a shed's request is waiting for the team's call, in the same black-and-amber look as its sign-up. */
function FuelPending({ name }: { name: string }) {
  const { t } = useTranslation();
  useFuelPalette();
  return <Frame icon={<Clock className="size-6" />} title={t('fuel.pending_title')} body={t('fuel.pending_body', { name })} />;
}
