import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import clsx from 'clsx';

const control =
  'block w-full rounded-xl border-0 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-brand-600 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700 dark:disabled:bg-slate-800';
const invalidCls = 'ring-rose-400 focus:ring-rose-500 dark:ring-rose-500';

export function Field({
  label,
  error,
  hint,
  children,
  htmlFor,
  required,
  className,
}: {
  label?: ReactNode;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={clsx('space-y-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
          {required && <span className="ms-0.5 text-rose-500">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-sm text-rose-600 dark:text-rose-400" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode; error?: string; hint?: ReactNode };

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ label, error, hint, className, id, required, ...rest }, ref) {
  const auto = useId();
  const inputId = id ?? auto;
  // Emails, phones, numbers and codes are always LTR, even inside RTL layouts.
  const ltr = rest.type === 'email' || rest.type === 'tel' || rest.type === 'number' || rest.type === 'password' || rest.inputMode === 'numeric';
  return (
    <Field label={label} error={error} hint={hint} htmlFor={inputId} required={required} className={className}>
      <input
        ref={ref}
        id={inputId}
        required={required}
        dir={ltr ? 'ltr' : rest.dir ?? 'auto'}
        aria-invalid={!!error}
        className={clsx(control, error && invalidCls, ltr && 'ltr-text text-start')}
        {...rest}
      />
    </Field>
  );
});

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { label?: ReactNode; error?: string; hint?: ReactNode };

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ label, error, hint, className, id, children, required, ...rest }, ref) {
  const auto = useId();
  const selectId = id ?? auto;
  return (
    <Field label={label} error={error} hint={hint} htmlFor={selectId} required={required} className={className}>
      <select ref={ref} id={selectId} required={required} aria-invalid={!!error} className={clsx(control, 'pe-9', error && invalidCls)} {...rest}>
        {children}
      </select>
    </Field>
  );
});

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: ReactNode; error?: string; hint?: ReactNode };

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ label, error, hint, className, id, required, ...rest }, ref) {
  const auto = useId();
  const tId = id ?? auto;
  return (
    <Field label={label} error={error} hint={hint} htmlFor={tId} required={required} className={className}>
      <textarea ref={ref} id={tId} dir="auto" rows={3} required={required} aria-invalid={!!error} className={clsx(control, error && invalidCls)} {...rest} />
    </Field>
  );
});

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium text-slate-800 dark:text-slate-200">
          {label}
        </label>
        {description && <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
          checked ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-700',
        )}
      >
        <span
          className={clsx(
            'inline-block size-5 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-5.5 rtl:-translate-x-5.5' : 'translate-x-0.5 rtl:-translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
  disabled,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  disabled?: boolean;
  description?: ReactNode;
}) {
  const id = useId();
  return (
    <div className={clsx('flex items-start gap-2.5', disabled && 'opacity-60')}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 rounded border-slate-300 text-brand-600 accent-brand-700 focus:ring-brand-600"
      />
      <label htmlFor={id} className="min-w-0 text-sm text-slate-700 dark:text-slate-300">
        {label}
        {description && <span className="block text-xs text-slate-500">{description}</span>}
      </label>
    </div>
  );
}
