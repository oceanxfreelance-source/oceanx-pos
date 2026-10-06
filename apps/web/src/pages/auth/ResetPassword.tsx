import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { CircleCheck } from 'lucide-react';
import { api, ApiError, saApi } from '../../lib/api';
import { useErrorMessage, useFieldErrors } from '../../lib/useApiError';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Form';
import { Alert } from '../../components/ui/Card';
import { AuthLayout } from './AuthLayout';

/** Password reset and invitation acceptance (same single-use token mechanism). */
export default function ResetPassword({ domain }: { domain: 'business' | 'superadmin' }) {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const invite = params.get('invite') === '1';
  const errMsg = useErrorMessage();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const min = domain === 'business' ? 8 : 12;
  const client = domain === 'business' ? api : saApi;
  const loginPath = domain === 'business' ? '/login' : '/superadmin/login';
  const m = useMutation({ mutationFn: () => client.post('/auth/reset-password', { token, password }) });
  const fieldErr = useFieldErrors(m.error);
  const mismatch = confirm.length > 0 && confirm !== password;
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!mismatch) m.mutate();
  };
  return (
    <AuthLayout variant={domain} title={invite ? t('auth.invite_title') : t('auth.reset_title')} subtitle={invite ? t('auth.invite_subtitle') : t('auth.reset_subtitle')}>
      {!token ? (
        <Alert tone="red">{t('errors.invalid_token')}</Alert>
      ) : m.isSuccess ? (
        <div className="space-y-5">
          <Alert tone="green" icon={<CircleCheck className="size-5" />} title={t('auth.reset_done_title')}>
            {t('auth.reset_done_body')}
          </Alert>
          <Link to={loginPath}>
            <Button size="lg" className="w-full">
              {t('auth.sign_in')}
            </Button>
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          {m.error && !(m.error instanceof ApiError && m.error.code === 'validation_failed') && <Alert tone="red">{errMsg(m.error)}</Alert>}
          <Input
            type="password"
            autoComplete="new-password"
            label={t('auth.new_password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={min}
            hint={t('auth.password_hint', { min })}
            error={fieldErr('password')}
            required
            autoFocus
          />
          <Input
            type="password"
            autoComplete="new-password"
            label={t('auth.confirm_password')}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            error={mismatch ? t('validation.passwords_mismatch') : undefined}
            required
          />
          <Button type="submit" size="lg" className="w-full" loading={m.isPending} disabled={password.length < min || mismatch}>
            {invite ? t('auth.set_password') : t('auth.reset_password')}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
