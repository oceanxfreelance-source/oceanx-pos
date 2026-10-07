import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MessageCircle, Send } from 'lucide-react';
import { api } from '../../lib/api';
import { useBiz } from '../../auth/business';
import { useFormat } from '../../lib/format';
import { useToastError } from '../../lib/useApiError';
import { Alert, Badge, Card, CardHeader, Ltr } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Form';

interface ViberStatus {
  available: boolean; // superadmin_viber_credit_enabled
  enabled: boolean; // manager_viber_credit_enabled
  active: boolean;
  requestedAt: string | null;
  countryCode: string;
  providerConfigured: boolean;
  recent: { id: string; recipient: string; body: string; status: string; error: string | null; createdAt: string }[];
}

/**
 * Viber Credit Notifications (optional). Super Admin makes it available per business; the manager
 * then turns it ON/OFF here. When active, Credit (Pay Later) sales send "Total: …/-" to the customer's
 * registered Viber number — nothing else.
 */
export function ViberCreditSettings() {
  const { t } = useTranslation();
  const { can, refresh } = useBiz();
  const f = useFormat();
  const qc = useQueryClient();
  const toastErr = useToastError();
  const q = useQuery({ queryKey: ['biz', 'viber-credit'], queryFn: () => api.get<ViberStatus>('/viber-credit') });
  const [cc, setCc] = useState('');
  useEffect(() => {
    if (q.data) setCc(q.data.countryCode);
  }, [q.data]);
  const done = (s: ViberStatus) => {
    qc.setQueryData(['biz', 'viber-credit'], s);
    void refresh();
  };
  const save = useMutation({ mutationFn: (enabled: boolean) => api.put<ViberStatus>('/viber-credit', { enabled, countryCode: cc }), onSuccess: (s) => (done(s), toast.success(t('common.saved'))), onError: toastErr });
  const request = useMutation({ mutationFn: () => api.post<ViberStatus>('/viber-credit/request', {}), onSuccess: (s) => (done(s), toast.success(t('viber.requested'))), onError: toastErr });
  const s = q.data;
  const manage = can('settings.manage');
  if (!s) return null;
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <MessageCircle className="size-5 text-violet-600" /> {t('viber.title')}
          </span>
        }
        description={t('viber.subtitle')}
        actions={<Badge tone={s.active ? 'green' : 'gray'} dot>{s.active ? t('viber.on') : t('viber.off')}</Badge>}
      />
      <div className="space-y-5">
        <div className="rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-800/40">
          <p className="font-medium">{t('viber.message_preview')}</p>
          <p className="mt-2 inline-block rounded-2xl rounded-ss-sm bg-violet-600 px-3 py-2 text-white" dir="ltr">
            Total: 40/-
          </p>
          <p className="mt-2 text-xs text-slate-500">{t('viber.message_rule')}</p>
        </div>

        {!s.available ? (
          <Alert tone="amber" title={t('viber.not_available_title')}>
            <p>{t('viber.not_available_body')}</p>
            {manage &&
              (s.requestedAt ? (
                <p className="mt-2 font-medium">{t('viber.request_sent', { date: f.date(s.requestedAt) })}</p>
              ) : (
                <Button className="mt-3" size="sm" icon={<Send className="size-4" />} onClick={() => request.mutate()} loading={request.isPending}>
                  {t('viber.request')}
                </Button>
              ))}
          </Alert>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium">{t('viber.title')}</span>
              <div className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800" role="radiogroup" aria-label={t('viber.title')}>
                {[true, false].map((on) => (
                  <button
                    key={String(on)}
                    type="button"
                    role="radio"
                    aria-checked={s.enabled === on}
                    disabled={!manage || save.isPending}
                    onClick={() => s.enabled !== on && save.mutate(on)}
                    className={`rounded-lg px-5 py-1.5 text-sm font-semibold transition ${
                      s.enabled === on ? (on ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white') : 'text-slate-500'
                    }`}
                  >
                    {on ? t('viber.on') : t('viber.off')}
                  </button>
                ))}
              </div>
            </div>
            <Alert tone={s.enabled ? 'green' : 'gray'}>{s.enabled ? t('viber.status_on') : t('viber.status_off')}</Alert>
            {!s.providerConfigured && <Alert tone="amber">{t('viber.no_provider')}</Alert>}
            <div className="flex flex-wrap items-end gap-3">
              <Input className="w-40" label={t('viber.country_code')} hint={t('viber.country_code_hint')} dir="ltr" value={cc} disabled={!manage} onChange={(e) => setCc(e.target.value.replace(/\D/g, '').slice(0, 4))} />
              {manage && cc !== s.countryCode && (
                <Button variant="secondary" onClick={() => save.mutate(s.enabled)} loading={save.isPending}>
                  {t('common.save')}
                </Button>
              )}
            </div>
          </>
        )}

        {s.recent.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium">{t('viber.recent')}</p>
            <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {s.recent.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    <Ltr className="font-medium">+{m.recipient}</Ltr> · <Ltr>{m.body}</Ltr>
                    <span className="block text-xs text-slate-500">{f.dateTime(m.createdAt)}</span>
                  </span>
                  <Badge tone={m.status === 'sent' ? 'green' : m.status === 'failed' ? 'red' : 'amber'}>{t(`viber.status.${m.status}`)}</Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}
