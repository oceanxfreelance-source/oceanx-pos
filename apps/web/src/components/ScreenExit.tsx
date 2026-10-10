import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, LogOut } from 'lucide-react';
import { useBiz } from '../auth/business';
import { android } from '../lib/desktop';
import { ConfirmDialog } from './ui/Dialog';

/**
 * Top-left button of the full-screen POS and kitchen screens. Normally "back to the dashboard"; on the
 * tablet app (POS only) it signs out instead, after a confirmation so a busy tap does not end the shift.
 */
export function ScreenExit() {
  const { t } = useTranslation();
  const { logout } = useBiz();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const cls = 'rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800';
  if (!android) {
    return (
      <Link to="/" className={cls} aria-label={t('nav.dashboard')}>
        <ArrowLeft className="rtl-flip size-5" />
      </Link>
    );
  }
  return (
    <>
      <button type="button" className={cls} aria-label={t('auth.logout')} title={t('auth.logout')} onClick={() => setConfirm(true)}>
        <LogOut className="rtl-flip size-5" />
      </button>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t('auth.logout')}
        message={t('tablet.sign_out_confirm')}
        confirmLabel={t('auth.logout')}
        loading={busy}
        onConfirm={async () => {
          setBusy(true);
          await logout();
          navigate('/login?next=%2Fstart', { replace: true });
        }}
      />
    </>
  );
}

/** Tablet app, account without POS or kitchen access: explain instead of opening the back office. */
export function TabletPosOnly() {
  const { t } = useTranslation();
  const { logout } = useBiz();
  const navigate = useNavigate();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-slate-50 p-8 text-center dark:bg-slate-950">
      <h1 className="text-xl font-semibold">{t('tablet.pos_only_title')}</h1>
      <p className="max-w-md text-sm text-slate-500">{t('tablet.pos_only_body')}</p>
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-5 py-3 text-sm font-semibold text-white"
        onClick={async () => {
          await logout();
          navigate('/login?next=%2Fstart', { replace: true });
        }}
      >
        <LogOut className="rtl-flip size-4" /> {t('auth.logout')}
      </button>
    </div>
  );
}
