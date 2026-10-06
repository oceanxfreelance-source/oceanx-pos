import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { BUSINESS_TYPES, type BusinessType } from '@oceanx/shared';
import { api, ApiError } from '../../lib/api';
import { useBiz, type BusinessSession } from '../../auth/business';
import { useErrorMessage, useFieldErrors } from '../../lib/useApiError';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Form';
import { Alert } from '../../components/ui/Card';
import { AuthLayout } from './AuthLayout';
import { LanguagePicker } from './LanguagePicker';

export default function Register() {
  const { t, i18n } = useTranslation();
  const { session, setSession } = useBiz();
  const navigate = useNavigate();
  const errMsg = useErrorMessage();
  const [form, setForm] = useState({ businessName: '', businessType: 'restaurant' as BusinessType, ownerName: '', email: '', phone: '', password: '', currency: 'MVR' });
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const m = useMutation({
    mutationFn: () => api.post<BusinessSession>('/auth/register', { ...form, language: i18n.language }),
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
  return (
    <AuthLayout
      title={t('auth.register_title')}
      subtitle={t('auth.register_subtitle')}
      footer={
        <div className="space-y-4">
          <p>
            {t('auth.have_account')}{' '}
            <Link to="/login" className="font-medium text-brand-700 hover:underline dark:text-brand-300">
              {t('auth.sign_in')}
            </Link>
          </p>
          <LanguagePicker />
        </div>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {m.error && !(m.error instanceof ApiError && m.error.code === 'validation_failed') && <Alert tone="red">{errMsg(m.error)}</Alert>}
        <Select label={t('auth.business_type')} value={form.businessType} onChange={set('businessType')} required>
          {BUSINESS_TYPES.map((bt) => (
            <option key={bt} value={bt}>
              {t(`business_types.${bt}`)}
            </option>
          ))}
        </Select>
        <Input label={t('auth.business_name')} value={form.businessName} onChange={set('businessName')} error={fieldErr('businessName')} required />
        <Input label={t('auth.your_name')} value={form.ownerName} onChange={set('ownerName')} error={fieldErr('ownerName')} required />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input type="email" autoComplete="username" label={t('auth.email')} value={form.email} onChange={set('email')} error={fieldErr('email')} required />
          <Input type="tel" label={t('common.phone')} value={form.phone} onChange={set('phone')} error={fieldErr('phone')} />
        </div>
        <Input
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
        <Input label={t('settings.currency')} value={form.currency} maxLength={3} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value.toUpperCase() }))} error={fieldErr('currency')} dir="ltr" required />
        <Button type="submit" size="lg" className="w-full" loading={m.isPending}>
          {t('auth.create_business')}
        </Button>
      </form>
    </AuthLayout>
  );
}
