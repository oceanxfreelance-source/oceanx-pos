import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import clsx from 'clsx';
import { api, ApiError } from '../../lib/api';
import { useBiz, type BusinessSession } from '../../auth/business';
import { useErrorMessage, useFieldErrors } from '../../lib/useApiError';
import { forceDark } from '../../lib/theme';
import { productPath } from '../../lib/product';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Form';
import { Alert } from '../../components/ui/Card';
import { FullscreenButton } from '../../components/FullscreenButton';
import { LanguagePicker } from './LanguagePicker';

const PRICE = 17.21;

/** Theyo Fihaara's dark, amber look while one of its screens is open. */
export function useFuelPalette(active = true) {
  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    root.dataset.palette = 'fuel';
    forceDark(true);
    return () => {
      delete root.dataset.palette;
      forceDark(false);
    };
  }, [active]);
}

/** A pump's display: litres and rufiyaa counting up as fuel goes in, like the dispenser at the shed. */
function PumpDisplay({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const [litres, setLitres] = useState(25);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('reduce-motion')) return;
    let raf = 0;
    const t0 = performance.now();
    // 5 s filling to 25 L, then 2.5 s holding the sale, again.
    const tick = (now: number) => {
      const s = ((now - t0) / 1000) % 7.5;
      const p = Math.min(1, s / 5);
      setLitres(Math.round(25 * (1 - Math.pow(1 - p, 2)) * 100) / 100);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  const rows: [string, string][] = [
    [t('fuel.display.amount'), (litres * PRICE).toFixed(2)],
    [t('fuel.display.litres'), litres.toFixed(2)],
    ...(compact ? [] : ([[t('fuel.display.price'), PRICE.toFixed(2)]] as [string, string][])),
  ];
  return (
    <div className="fuel-display rounded-2xl p-1.5" aria-hidden>
      <div className={clsx('rounded-xl border border-zinc-800 bg-black', compact ? 'grid grid-cols-2 gap-px' : 'space-y-px')}>
        {rows.map(([label, value]) => (
          <div key={label} className={clsx('flex items-baseline justify-between gap-4', compact ? 'px-3 py-2' : 'px-5 py-3')}>
            <span className="text-[10px] font-semibold tracking-[0.18em] text-zinc-500 uppercase">{label}</span>
            <span className={clsx('fuel-digits tabular-nums', compact ? 'text-xl' : 'text-4xl')} dir="ltr">
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Brand() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3">
      <img src="/fuel/icon-192.png" alt="" className="size-11 rounded-[22%] ring-1 ring-zinc-700" />
      <div>
        <p className="text-lg font-semibold tracking-tight text-white">{t('fuel.name')}</p>
        <p className="text-xs text-zinc-400">
          {t('fuel.tagline')} · <span lang="dv">ތެޔޮ ފިހާރަ</span>
        </p>
      </div>
    </div>
  );
}

/**
 * Theyo Fihaara's own sign-in and sign-up frame: black and amber, with a working pump display on the left.
 * Different from OceanX POS and the Gravity apps on purpose.
 */
export function FuelAuthShell({ title, subtitle, children, footer }: { title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  const { t } = useTranslation();
  useFuelPalette();
  return (
    <div className="fuel-auth relative min-h-dvh text-zinc-100">
      <div className="absolute end-4 top-4 z-10">
        <FullscreenButton />
      </div>
      <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <aside className="fuel-aside relative hidden flex-col justify-between overflow-hidden border-e border-zinc-800 p-12 lg:flex">
          <Brand />
          <div className="mx-auto w-full max-w-md">
            <div className="mb-3 flex items-center gap-2 text-xs font-medium text-zinc-400">
              <span className="size-2 rounded-full bg-emerald-500 shadow-[0_0_8px] shadow-emerald-500/70" />
              {t('fuel.display.pump')}
            </div>
            <PumpDisplay />
          </div>
          <div className="max-w-md">
            <p className="text-3xl leading-tight font-semibold text-balance text-white">{t('fuel.aside_title')}</p>
            <ul className="mt-4 space-y-2 text-zinc-300">
              {['fuel.aside_1', 'fuel.aside_2', 'fuel.aside_3'].map((k) => (
                <li key={k} className="flex gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-400" />
                  {t(k)}
                </li>
              ))}
            </ul>
          </div>
        </aside>
        <main className="flex flex-col justify-center px-5 py-10 sm:px-10">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-6 space-y-5 lg:hidden">
              <Brand />
              <PumpDisplay compact />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-balance text-white">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm text-zinc-400">{subtitle}</p>}
            <div className="mt-7">{children}</div>
            {footer && <div className="mt-8 text-sm text-zinc-400">{footer}</div>}
          </div>
        </main>
      </div>
    </div>
  );
}

/** "Request a shed account": the shed, then the owner. The team calls, then approves it in Super Admin. */
export default function FuelRegister() {
  const { t, i18n } = useTranslation();
  const { session, setSession } = useBiz();
  const navigate = useNavigate();
  const errMsg = useErrorMessage();
  const [form, setForm] = useState({ businessName: '', island: '', ownerName: '', phone: '', email: '', password: '' });
  const [nozzles, setNozzles] = useState<'1' | '2-4' | '5+'>('1');
  const [stock, setStock] = useState<'tanks' | 'drums'>('tanks');
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const m = useMutation({
    mutationFn: () =>
      api.post<BusinessSession>('/auth/register', { ...form, product: 'fuel', businessType: 'other', currency: 'MVR', language: i18n.language, fuelNozzles: nozzles, fuelStock: stock }),
    onSuccess: (s) => {
      setSession(s);
      navigate('/', { replace: true });
    },
  });
  const fieldErr = useFieldErrors(m.error);
  if (session) return <Navigate to="/" replace />;
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    m.mutate();
  };
  const choice = <T extends string>(value: T, current: T, onPick: (v: T) => void, label: string) => (
    <button
      key={value}
      type="button"
      role="radio"
      aria-checked={current === value}
      onClick={() => onPick(value)}
      className={clsx(
        'rounded-xl px-3 py-2.5 text-sm font-medium ring-1 transition focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none',
        current === value ? 'bg-brand-500/15 text-brand-200 ring-brand-500' : 'text-zinc-300 ring-zinc-700 hover:bg-zinc-800/60',
      )}
    >
      {label}
    </button>
  );
  return (
    <FuelAuthShell
      title={t('fuel.register_title')}
      subtitle={t('fuel.register_subtitle')}
      footer={
        <div className="space-y-4">
          <p>
            {t('auth.have_account')}{' '}
            <Link to={productPath('fuel', 'login')} className="font-medium text-brand-300 hover:underline">
              {t('auth.sign_in')}
            </Link>
          </p>
          <LanguagePicker />
        </div>
      }
    >
      <form onSubmit={onSubmit} className="space-y-6" noValidate>
        {m.error && !(m.error instanceof ApiError && m.error.code === 'validation_failed') && <Alert tone="red">{errMsg(m.error)}</Alert>}
        <fieldset className="space-y-4">
          <legend className="mb-3 text-[11px] font-semibold tracking-[0.16em] text-zinc-500 uppercase">{t('fuel.reg.section_shed')}</legend>
          <Input id="fuel-shed" label={t('fuel.sa.shed_name')} value={form.businessName} onChange={set('businessName')} error={fieldErr('businessName')} required autoFocus />
          <Input id="fuel-island" label={t('fuel.reg.island')} placeholder={t('fuel.reg.island_placeholder')} value={form.island} onChange={set('island')} error={fieldErr('island')} required />
          <div role="radiogroup" aria-label={t('fuel.reg.nozzles')}>
            <p className="mb-1.5 text-sm font-medium text-zinc-300">{t('fuel.reg.nozzles')}</p>
            <div className="grid grid-cols-3 gap-2">{(['1', '2-4', '5+'] as const).map((v) => choice(v, nozzles, setNozzles, v === '2-4' ? '2–4' : v))}</div>
          </div>
          <div role="radiogroup" aria-label={t('fuel.reg.stock')}>
            <p className="mb-1.5 text-sm font-medium text-zinc-300">{t('fuel.reg.stock')}</p>
            <div className="grid grid-cols-2 gap-2">
              {choice('tanks', stock, setStock, t('fuel.reg.tanks'))}
              {choice('drums', stock, setStock, t('fuel.reg.drums'))}
            </div>
          </div>
        </fieldset>
        <fieldset className="space-y-4 border-t border-zinc-800 pt-6">
          <legend className="sr-only">{t('fuel.reg.section_you')}</legend>
          <p className="text-[11px] font-semibold tracking-[0.16em] text-zinc-500 uppercase" aria-hidden>
            {t('fuel.reg.section_you')}
          </p>
          <Input id="fuel-owner" label={t('auth.your_name')} value={form.ownerName} onChange={set('ownerName')} error={fieldErr('ownerName')} required />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input id="fuel-phone" type="tel" label={t('fuel.reg.phone')} value={form.phone} onChange={set('phone')} error={fieldErr('phone')} dir="ltr" required />
            <Input id="fuel-email" type="email" autoComplete="username" label={t('auth.email')} value={form.email} onChange={set('email')} error={fieldErr('email')} required />
          </div>
          <Input
            id="fuel-password"
            type="password"
            autoComplete="new-password"
            label={t('auth.password')}
            value={form.password}
            onChange={set('password')}
            hint={t('auth.password_hint', { min: 8 })}
            error={fieldErr('password')}
            minLength={8}
            required
          />
        </fieldset>
        <Button type="submit" size="lg" className="w-full" loading={m.isPending}>
          {t('fuel.reg.submit')}
        </Button>
        <p className="text-xs text-zinc-500">{t('fuel.reg.after')}</p>
      </form>
    </FuelAuthShell>
  );
}
