import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { saApi } from '../../lib/api';
import { useSuperAdmin, type SuperAdminSession } from '../../auth/superadmin';
import { useErrorMessage } from '../../lib/useApiError';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Form';
import { Alert } from '../../components/ui/Card';
import { AuthLayout } from '../auth/AuthLayout';

export default function SuperAdminLogin() {
  const { t } = useTranslation();
  const { session, setSession } = useSuperAdmin();
  const navigate = useNavigate();
  const errMsg = useErrorMessage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const login = useMutation({
    mutationFn: () => saApi.post<SuperAdminSession>('/auth/login', { email, password }),
    onSuccess: (s) => {
      setSession(s);
      if (!s.mfaPending) navigate('/superadmin/dashboard', { replace: true });
    },
  });
  const mfa = useMutation({
    mutationFn: () => saApi.post<SuperAdminSession>('/auth/mfa', { code }),
    onSuccess: (s) => {
      setSession(s);
      navigate('/superadmin/dashboard', { replace: true });
    },
  });
  if (session && !session.mfaPending) return <Navigate to="/superadmin/dashboard" replace />;
  const needsCode = session?.mfaPending;

  return (
    <AuthLayout variant="superadmin" title={needsCode ? t('superadmin.mfa_title') : t('superadmin.login_title')} subtitle={needsCode ? t('superadmin.mfa_subtitle') : t('superadmin.login_subtitle')} aside={<SaAside />}>
      {needsCode ? (
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            mfa.mutate();
          }}
          className="space-y-4"
        >
          {mfa.error && <Alert tone="red">{errMsg(mfa.error)}</Alert>}
          <Input
            label={t('superadmin.mfa_code')}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            className="[&_input]:text-center [&_input]:text-lg [&_input]:tracking-[0.5em]"
            autoFocus
          />
          <Button type="submit" size="lg" className="w-full" loading={mfa.isPending} disabled={code.length !== 6}>
            {t('superadmin.verify')}
          </Button>
        </form>
      ) : (
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            login.mutate();
          }}
          className="space-y-4"
        >
          {login.error && <Alert tone="red">{errMsg(login.error)}</Alert>}
          <Input type="email" autoComplete="username" label={t('auth.email')} value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          <Input type="password" autoComplete="current-password" label={t('auth.password')} value={password} onChange={(e) => setPassword(e.target.value)} required />
          <div className="flex justify-end">
            <Link to="/superadmin/forgot-password" className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
              {t('auth.forgot_password')}
            </Link>
          </div>
          <Button type="submit" size="lg" className="w-full" loading={login.isPending} disabled={!email || !password}>
            {t('auth.sign_in')}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}

function SaAside() {
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-col justify-end p-12 text-white">
      <ShieldCheck className="mb-6 size-12 text-brand-300" />
      <p className="max-w-md text-3xl leading-tight font-semibold">{t('superadmin.aside_title')}</p>
      <p className="mt-3 max-w-md text-slate-300">{t('superadmin.aside_body')}</p>
    </div>
  );
}
