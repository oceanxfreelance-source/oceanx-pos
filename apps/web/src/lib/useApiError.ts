import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ApiError } from './api';

/** Translate API errors (codes) into the user's language. */
export function useErrorMessage() {
  const { t } = useTranslation();
  return (err: unknown): string => {
    if (err instanceof ApiError) return t(`errors.${err.code}`, { defaultValue: t('errors.internal_error') });
    return t('errors.internal_error');
  };
}

export function useToastError() {
  const msg = useErrorMessage();
  return (err: unknown) => toast.error(msg(err));
}

/** Field-level validation messages from a 422 response. */
export function useFieldErrors(err: unknown) {
  const { t } = useTranslation();
  const fields = err instanceof ApiError ? err.fields : {};
  return (name: string): string | undefined => {
    const f = fields[name];
    return f ? t(`validation.${f.code}`, { ...(f.params ?? {}), defaultValue: t('validation.invalid') }) : undefined;
  };
}
