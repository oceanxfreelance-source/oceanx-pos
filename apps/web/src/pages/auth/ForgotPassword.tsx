import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { MailCheck } from 'lucide-react';
import { api, saApi } from '../../lib/api';
import { useErrorMessage } from '../../lib/useApiError';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Form';
import { Alert } from '../../components/ui/Card';
import { AuthLayout } from './AuthLayout';

export default function ForgotPassword({ domain }: { domain: 'business' | 'superadmin' }) {
  const { t } = useTranslation();
  const errMsg = useErrorMessage();
  const [email, setEmail] = useState('');
  const client = domain === 'business' ? api : saApi;
  const loginPath = domain === 'business' ? '/login' : '/superadmin/login';
  const m = useMutation({ mutationFn: () => client.post('/auth/forgot-password', { email }) });
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    m.mutate();
  };
  return (
    <AuthLayout
      variant={domain}
      title={t('auth.forgot_title')}
      subtitle={t('auth.forgot_subtitle')}
      footer={
        <Link to={loginPath} className="font-medium text-brand-700 hover:underline dark:text-brand-300">
          {t('auth.back_to_login')}
        </Link>
      }
    >
      {m.isSuccess ? (
        <Alert tone="green" icon={<MailCheck className="size-5" />} title={t('auth.forgot_sent_title')}>
          {t('auth.forgot_sent_body')}
        </Alert>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          {m.error && <Alert tone="red">{errMsg(m.error)}</Alert>}
          <Input type="email" autoComplete="username" label={t('auth.email')} value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          <Button type="submit" size="lg" className="w-full" loading={m.isPending} disabled={!email}>
            {t('auth.send_reset_link')}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
