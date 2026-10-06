import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from './ui/Button';
import { Input } from './ui/Form';
import { useErrorMessage, useFieldErrors } from '../lib/useApiError';

export function ChangePasswordForm({ submit, minLength, onDone }: { submit: (body: { currentPassword: string; newPassword: string }) => Promise<unknown>; minLength: number; onDone?: () => void }) {
  const { t } = useTranslation();
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [confirm, setConfirm] = useState('');
  const errMsg = useErrorMessage();
  const m = useMutation({
    mutationFn: () => submit({ currentPassword, newPassword }),
    onSuccess: () => {
      toast.success(t('auth.password_changed'));
      setCurrent('');
      setNew('');
      setConfirm('');
      onDone?.();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const fieldErr = useFieldErrors(m.error);
  const mismatch = confirm.length > 0 && confirm !== newPassword;
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!mismatch) m.mutate();
  };
  return (
    <form onSubmit={onSubmit} className="max-w-md space-y-4">
      <Input type="password" autoComplete="current-password" label={t('auth.current_password')} value={currentPassword} onChange={(e) => setCurrent(e.target.value)} error={fieldErr('currentPassword')} required />
      <Input
        type="password"
        autoComplete="new-password"
        label={t('auth.new_password')}
        value={newPassword}
        minLength={minLength}
        onChange={(e) => setNew(e.target.value)}
        hint={t('auth.password_hint', { min: minLength })}
        error={fieldErr('newPassword')}
        required
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
      <Button type="submit" loading={m.isPending}>
        {t('auth.change_password')}
      </Button>
    </form>
  );
}
