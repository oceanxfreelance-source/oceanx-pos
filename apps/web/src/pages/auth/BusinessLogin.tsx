import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useBiz, type BusinessSession } from '../../auth/business';
import { useErrorMessage } from '../../lib/useApiError';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Form';
import { Alert } from '../../components/ui/Card';
import { AuthLayout } from './AuthLayout';
import { LanguagePicker } from './LanguagePicker';

export default function BusinessLogin() {
  const { t } = useTranslation();
  const { session, setSession } = useBiz();
  const navigate = useNavigate();
  const errMsg = useErrorMessage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const m = useMutation({
    mutationFn: () => api.post<BusinessSession>('/auth/login', { email, password }),
    onSuccess: (s) => {
      setSession(s);
      navigate('/', { replace: true });
    },
  });
  if (session) return <Navigate to="/" replace />;
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    m.mutate();
  };
  return (
    <AuthLayout
      title={t('auth.login_title')}
      subtitle={t('auth.login_subtitle')}
      footer={
        <div className="space-y-4">
          <p>
            {t('auth.no_account')}{' '}
            <Link to="/register" className="font-medium text-brand-700 hover:underline dark:text-brand-300">
              {t('auth.register_cta')}
            </Link>
          </p>
          <LanguagePicker />
        </div>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {m.error && <Alert tone="red">{errMsg(m.error)}</Alert>}
        <Input type="email" autoComplete="username" label={t('auth.email')} value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        <Input type="password" autoComplete="current-password" label={t('auth.password')} value={password} onChange={(e) => setPassword(e.target.value)} required />
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
            {t('auth.forgot_password')}
          </Link>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={m.isPending} disabled={!email || !password}>
          {t('auth.sign_in')}
        </Button>
      </form>
    </AuthLayout>
  );
}
