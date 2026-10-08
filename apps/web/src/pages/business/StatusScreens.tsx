import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarX2, Clock, KeyRound, LogOut, ShieldOff } from 'lucide-react';
import { useBiz, useBizSession } from '../../auth/business';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Logo } from '../../components/Logo';
import { FarumaWarning } from '../../components/FarumaWarning';
import { ChangePasswordForm } from '../../components/ChangePasswordForm';
import { useFormat } from '../../lib/format';
import { PayPanel, useBilling } from './Billing';

function Frame({ icon, title, body, children, wide }: { icon: React.ReactNode; title: string; body: React.ReactNode; children?: React.ReactNode; wide?: boolean }) {
  const { t } = useTranslation();
  const { logout } = useBiz();
  const navigate = useNavigate();
  return (
    <div className="min-h-dvh">
      <FarumaWarning />
      <div className={`mx-auto flex min-h-dvh flex-col justify-center px-5 py-10 ${wide ? 'max-w-2xl' : 'max-w-lg'}`}>
        <div className="mb-6 flex items-center gap-2">
          <Logo />
          <span className="font-semibold">{t('app.name')}</span>
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
                navigate('/login');
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
          title={s.subscription?.planCode === 'trial' ? t('billing.trial_over_title') : t('status.expired_title')}
          body={t('billing.blocked_body', { plan: s.subscription?.planName ?? '—', date: f.date(s.subscription?.currentPeriodEnd) })}
        >
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
  const q = useBilling();
  return q.data ? <PayPanel info={q.data} /> : null;
}
