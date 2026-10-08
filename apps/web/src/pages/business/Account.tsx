import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useBiz, useBizSession } from '../../auth/business';
import { api } from '../../lib/api';
import { useToastError } from '../../lib/useApiError';
import { Card, CardHeader, Ltr, PageHeader } from '../../components/ui/Card';
import { Select, Switch } from '../../components/ui/Form';
import { ChangePasswordForm } from '../../components/ChangePasswordForm';
import { roleLabel } from '../../lib/labels';
import { InkSetup } from '../../components/SignatureSetup';

export default function AccountPage() {
  const { t } = useTranslation();
  const s = useBizSession();
  const { refresh } = useBiz();
  const toastErr = useToastError();
  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patch('/me/preferences', body),
    onSuccess: () => {
      toast.success(t('common.saved'));
      void refresh();
    },
    onError: toastErr,
  });
  return (
    <div className="space-y-6">
      <PageHeader title={t('account.title')} description={t('account.subtitle')} />
      <Card>
        <CardHeader title={t('account.profile')} />
        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-slate-500">{t('common.name')}</dt>
            <dd className="mt-0.5 font-medium" dir="auto">
              {s.user.name}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">{t('auth.email')}</dt>
            <dd className="mt-0.5 font-medium">
              <Ltr>{s.user.email}</Ltr>
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">{t('account.business')}</dt>
            <dd className="mt-0.5 font-medium" dir="auto">
              {s.business.name}
              {s.user.isOwner && <span className="ms-1 text-xs text-slate-400">({roleLabel(t, { name: '', systemKey: 'business_admin' })})</span>}
            </dd>
          </div>
        </dl>
      </Card>
      <Card>
        <CardHeader title={t('account.preferences')} description={t('account.preferences_hint')} />
        <div className="max-w-md space-y-5">
          <Select label={t('users.app_language')} value={s.user.language} onChange={(e) => save.mutate({ language: e.target.value })}>
            {s.languages.map((l) => (
              <option key={l.code} value={l.code}>
                {l.nativeName}
              </option>
            ))}
          </Select>
          <Select label={t('account.theme')} value={s.user.preferences.theme ?? 'system'} onChange={(e) => save.mutate({ theme: e.target.value })}>
            <option value="system">{t('account.theme_system')}</option>
            <option value="light">{t('account.theme_light')}</option>
            <option value="dark">{t('account.theme_dark')}</option>
          </Select>
          <Switch
            checked={!!s.user.preferences.reduceAnimations}
            onChange={(v) => save.mutate({ reduceAnimations: v })}
            label={t('account.reduce_animations')}
            description={t('account.reduce_animations_hint')}
          />
        </div>
      </Card>
      <Card>
        <CardHeader title={t('branding.my_signature')} description={t('branding.my_signature_hint')} />
        <InkSetup current={s.user.hasSignature ? `/api/users/${s.user.id}/signature` : null} uploadPath="/me/signature" allowDraw onChanged={() => void refresh()} previewClass="max-h-20 max-w-64 object-contain" />
      </Card>
      <Card>
        <CardHeader title={t('auth.change_password')} description={t('account.password_hint')} />
        <ChangePasswordForm minLength={8} submit={(b) => api.post('/auth/change-password', b)} />
      </Card>
    </div>
  );
}
