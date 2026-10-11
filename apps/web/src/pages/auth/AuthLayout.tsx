import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Logo } from '../../components/Logo';
import { FarumaWarning } from '../../components/FarumaWarning';
import { DeviceThemeToggle } from '../../components/DeviceThemeToggle';
import { FullscreenButton } from '../../components/FullscreenButton';
import { InstallApp } from '../../components/InstallApp';
import { useProductTheme } from '../../lib/product';

export function AuthLayout({ title, subtitle, children, footer, aside, variant = 'business' }: { title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; aside?: ReactNode; variant?: 'business' | 'superadmin' | 'gravity' }) {
  const { t } = useTranslation();
  useProductTheme(variant === 'gravity');
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
              {variant === 'gravity' ? <GravityMark className="size-10" /> : <Logo className="size-10" />}
              <div>
                <p className="text-lg font-semibold tracking-tight">{variant === 'gravity' ? t('gravity.name') : t('app.name')}</p>
                <p className="text-xs text-slate-500">{variant === 'superadmin' ? t('superadmin.console') : variant === 'gravity' ? t('gravity.tagline') : t('app.tagline')}</p>
              </div>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
            <div className="mt-8">{children}</div>
            {footer && <div className="mt-8 text-sm text-slate-500">{footer}</div>}
            {variant !== 'superadmin' && (
              <div className="mt-6">
                <InstallApp />
              </div>
            )}
          </div>
        </div>
        <div
          className={
            variant === 'superadmin'
              ? 'relative hidden overflow-hidden bg-slate-900 lg:block'
              : variant === 'gravity'
                ? 'gravity-surface relative hidden overflow-hidden lg:block'
                : 'relative hidden overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-brand-950 lg:block'
          }
        >
          {aside ?? (variant === 'gravity' ? <GravityAside /> : <AuthAside />)}
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

/** Gravity's hexagon "G" (white) on its deep-sea tile. */
const GRAVITY_G = 'M186,50 L526,50 L688,320 L682,327 L224,327 L217,320 L289,197 L366,197 L336,252 L531,252 L472,149 L241,149 L126,350 L241,550 L472,550 L531,448 L336,448 L366,503 L289,503 L217,380 L224,373 L682,373 L688,380 L526,650 L186,650 L14,357 L14,343 Z';

export function GravityMark({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden>
      <defs>
        <radialGradient id={`${id}a`} cx="45%" cy="42%" r="70%">
          <stop offset="0" stopColor="#0f3b58" />
          <stop offset=".55" stopColor="#03213a" />
          <stop offset="1" stopColor="#010c16" />
        </radialGradient>
        <radialGradient id={`${id}b`} cx="0%" cy="100%" r="65%">
          <stop offset="0" stopColor="#2a7d5e" stopOpacity=".95" />
          <stop offset="1" stopColor="#2a7d5e" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill={`url(#${id}a)`} />
      <rect width="512" height="512" rx="112" fill={`url(#${id}b)`} />
      <path d={GRAVITY_G} transform="translate(256 256) scale(.47) translate(-350 -350)" fill="#fff" stroke="#fff" strokeWidth="6" strokeLinejoin="round" />
    </svg>
  );
}

function GravityAside() {
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-col justify-end p-12 text-white">
      <svg className="absolute -end-24 -top-24 size-[28rem] opacity-15" viewBox="0 0 700 700" aria-hidden>
        <path d={GRAVITY_G} fill="none" stroke="white" strokeWidth="3" strokeLinejoin="round" />
      </svg>
      <p className="max-w-md text-3xl leading-tight font-semibold">{t('gravity.aside_title')}</p>
      <ul className="mt-4 max-w-md space-y-1.5 text-brand-100">
        <li>✓ {t('gravity.aside_1')}</li>
        <li>✓ {t('gravity.aside_2')}</li>
        <li>✓ {t('gravity.aside_3')}</li>
        <li>✓ {t('gravity.aside_4')}</li>
      </ul>
    </div>
  );
}
