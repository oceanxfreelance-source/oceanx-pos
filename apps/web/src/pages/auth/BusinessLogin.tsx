import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useBiz, type BusinessSession } from '../../auth/business';
import { useErrorMessage } from '../../lib/useApiError';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Form';
import { Alert } from '../../components/ui/Card';
import { Smartphone } from 'lucide-react';
import { productPath, type Product } from '../../lib/product';
import { android } from '../../lib/desktop';
import { AuthLayout } from './AuthLayout';
import { LanguagePicker } from './LanguagePicker';

/** Business sign-in. `/gravity/login` shows the same sign-in with Gravity's look. */
export default function BusinessLogin({ product = 'pos' }: { product?: Product }) {
  const { t } = useTranslation();
  const { session, setSession } = useBiz();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // Back to the screen that asked for sign-in (same site only).
  const nextParam = params.get('next') ?? '';
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') && !nextParam.startsWith('/\\') ? nextParam : '/';
  const errMsg = useErrorMessage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const m = useMutation({
    mutationFn: () => api.post<BusinessSession>('/auth/login', { email, password }),
    onSuccess: (s) => {
      setSession(s);
      navigate(next, { replace: true });
    },
  });
  if (session) return <Navigate to={next} replace />;
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    m.mutate();
  };
  return (
    <AuthLayout
      variant={product === 'pos' ? 'business' : product}
      title={t('auth.login_title')}
      subtitle={t('auth.login_subtitle')}
      footer={
        <div className="space-y-4">
          {product === 'fuel' ? (
            <p>{t('fuel.no_account')}</p>
          ) : (
            <p>
              {product === 'pos' ? t('auth.no_account') : t(`${product}.no_account`)}{' '}
              <Link to={productPath(product, 'register')} className="font-medium text-brand-700 hover:underline dark:text-brand-300">
                {product === 'pos' ? t('auth.register_cta') : t('gravity.create_account')}
              </Link>
            </p>
          )}
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
      {/* Gravity and Gravity Flow have a phone app (sign in once). Not shown inside the app itself. */}
      {product !== 'pos' && product !== 'fuel' && !android && (
        <a
          href={`/download/${product}.apk`}
          className="mt-4 flex items-center gap-3 rounded-xl p-3 ring-1 ring-slate-200 transition hover:bg-slate-50 dark:ring-slate-700 dark:hover:bg-slate-800/60"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
            <Smartphone className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold">{t('gravity.get_app')}</span>
            <span className="block text-xs text-slate-500">{t('gravity.get_app_hint')}</span>
          </span>
        </a>
      )}
    </AuthLayout>
  );
}
