import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Copy, KeyRound } from 'lucide-react';
import { Button } from './ui/Button';
import { Ltr } from './ui/Card';

/** Easy-to-read password (no 0/O, 1/l/I) for the team to hand over; the owner replaces it at first sign-in. */
export function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  const body = [...bytes].map((b) => chars[b % chars.length]).join('');
  return `Ox-${body.slice(0, 5)}-${body.slice(5)}`;
}

/** Sign-in details to give a business owner, with one-click copy. */
export function OwnerCredentials({ email, password }: { email: string; password: string }) {
  const { t } = useTranslation();
  const url = `${window.location.origin}/login`;
  const text = `${t('superadmin.credentials.login_link')}: ${url}\n${t('auth.email')}: ${email}\n${t('auth.password')}: ${password}\n${t('superadmin.credentials.change_note')}`;
  return (
    <div className="space-y-3 rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:ring-emerald-900">
      <p className="flex items-center gap-2 text-sm font-semibold text-emerald-900 dark:text-emerald-100">
        <KeyRound className="size-4" /> {t('superadmin.credentials.title')}
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-slate-500">{t('superadmin.credentials.login_link')}</dt>
        <dd className="font-medium break-all">
          <Ltr>{url}</Ltr>
        </dd>
        <dt className="text-slate-500">{t('auth.email')}</dt>
        <dd className="font-medium break-all select-all">
          <Ltr>{email}</Ltr>
        </dd>
        <dt className="text-slate-500">{t('auth.password')}</dt>
        <dd className="font-mono text-base font-semibold select-all">
          <Ltr>{password}</Ltr>
        </dd>
      </dl>
      <p className="text-xs text-slate-600 dark:text-slate-300">{t('superadmin.credentials.change_note')}</p>
      <Button
        size="sm"
        variant="secondary"
        icon={<Copy className="size-4" />}
        onClick={() => {
          void navigator.clipboard?.writeText(text).then(
            () => toast.success(t('superadmin.credentials.copied')),
            () => toast.error(t('superadmin.credentials.copy_failed')),
          );
        }}
      >
        {t('superadmin.credentials.copy')}
      </Button>
    </div>
  );
}
