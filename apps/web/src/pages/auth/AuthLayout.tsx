import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Logo } from '../../components/Logo';
import { FarumaWarning } from '../../components/FarumaWarning';
import { DeviceThemeToggle } from '../../components/DeviceThemeToggle';
import { FullscreenButton } from '../../components/FullscreenButton';

export function AuthLayout({ title, subtitle, children, footer, aside, variant = 'business' }: { title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; aside?: ReactNode; variant?: 'business' | 'superadmin' }) {
  const { t } = useTranslation();
  return (
    <div className="relative min-h-dvh">
      <FarumaWarning />
      <div className="absolute end-4 top-4 z-10 flex items-center gap-1">
        <FullscreenButton />
        <DeviceThemeToggle />
      </div>
      <div className="grid min-h-dvh lg:grid-cols-2">
        <div className="flex flex-col justify-center px-5 py-10 sm:px-10">
          <div className="mx-auto w-full max-w-sm">
            <div className="mb-8 flex items-center gap-3">
              <Logo className="size-10" />
              <div>
                <p className="text-lg font-semibold tracking-tight">{t('app.name')}</p>
                <p className="text-xs text-slate-500">{variant === 'superadmin' ? t('superadmin.console') : t('app.tagline')}</p>
              </div>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
            <div className="mt-8">{children}</div>
            {footer && <div className="mt-8 text-sm text-slate-500">{footer}</div>}
          </div>
        </div>
        <div
          className={
            variant === 'superadmin'
              ? 'relative hidden overflow-hidden bg-slate-900 lg:block'
              : 'relative hidden overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-brand-950 lg:block'
          }
        >
          {aside ?? <AuthAside />}
        </div>
      </div>
    </div>
  );
}

function AuthAside() {
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-col justify-end p-12 text-white">
      <svg className="absolute -end-24 -top-24 size-[28rem] opacity-15" viewBox="0 0 200 200" aria-hidden>
        <circle cx="100" cy="100" r="90" fill="none" stroke="white" strokeWidth="1" />
        <circle cx="100" cy="100" r="60" fill="none" stroke="white" strokeWidth="1" />
        <circle cx="100" cy="100" r="30" fill="none" stroke="white" strokeWidth="1" />
      </svg>
      <p className="max-w-md text-3xl leading-tight font-semibold">{t('auth.aside_title')}</p>
      <p className="mt-3 max-w-md text-brand-100">{t('auth.aside_body')}</p>
    </div>
  );
}
