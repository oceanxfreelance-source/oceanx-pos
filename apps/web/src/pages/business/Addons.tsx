import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, Clock, Puzzle, Send } from 'lucide-react';
import { api } from '../../lib/api';
import { useFormat } from '../../lib/format';
import { addonLabel } from '../../lib/labels';
import { Badge, Card, EmptyState, PageHeader, Skeleton } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useToastError } from '../../lib/useApiError';

interface AddonItem {
  code: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  grantedAt: string | null;
  expiresAt: string | null;
  requestedAt: string | null;
}

/** Add-ons are granted by the platform (Super Admin); the business configures and operates them. */
export default function AddonsPage() {
  const { t } = useTranslation();
  const f = useFormat();
  const qc = useQueryClient();
  const toastErr = useToastError();
  const q = useQuery({ queryKey: ['biz', 'addons'], queryFn: () => api.get<{ items: AddonItem[] }>('/addons') });
  const request = useMutation({
    mutationFn: ({ code, cancel }: { code: string; cancel?: boolean }) => (cancel ? api.delete(`/addons/${code}/request`) : api.post(`/addons/${code}/request`)),
    onSuccess: (_r, v) => {
      toast.success(v.cancel ? t('addons.request_cancelled') : t('addons.request_sent'));
      void qc.invalidateQueries({ queryKey: ['biz', 'addons'] });
    },
    onError: toastErr,
  });
  const items = q.data?.items ?? [];
  const enabled = items.filter((a) => a.enabled);
  const available = items.filter((a) => !a.enabled);
  return (
    <div className="space-y-8">
      <PageHeader title={t('addons.title')} description={t('addons.subtitle')} />
      {q.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          <section>
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase">{t('addons.enabled')}</h2>
            {enabled.length === 0 ? (
              <Card>
                <EmptyState icon={<Puzzle className="size-6" />} title={t('addons.none_enabled')} description={t('addons.none_enabled_body')} />
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {enabled.map((a) => (
                  <Card key={a.code}>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold">{addonLabel(t, a.code, a.name)}</h3>
                      <Badge tone="green">
                        <CheckCircle2 className="size-3" />
                        {t('addons.active')}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{t(`addons.descriptions.${a.code}`, { defaultValue: a.description })}</p>
                    <p className="mt-3 text-xs text-slate-400">{a.expiresAt ? t('addons.expires', { date: f.date(a.expiresAt) }) : t('addons.since', { date: f.date(a.grantedAt) })}</p>
                  </Card>
                ))}
              </div>
            )}
          </section>
          <section>
            <h2 className="mb-1 text-sm font-semibold tracking-wide text-slate-500 uppercase">{t('addons.available')}</h2>
            <p className="mb-3 text-sm text-slate-500">{t('addons.request_hint')}</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {available.map((a) => (
                <Card key={a.code} className="opacity-90">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold">{addonLabel(t, a.code, a.name)}</h3>
                    <Badge>{t(`addons.categories.${a.category}`, { defaultValue: a.category })}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{t(`addons.descriptions.${a.code}`, { defaultValue: a.description })}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {a.requestedAt ? (
                      <>
                        <Badge tone="violet">
                          <Clock className="size-3" />
                          {t('addons.requested_on', { date: f.date(a.requestedAt) })}
                        </Badge>
                        <Button size="sm" variant="ghost" onClick={() => request.mutate({ code: a.code, cancel: true })} disabled={request.isPending}>
                          {t('addons.cancel_request')}
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="secondary" icon={<Send className="size-4" />} onClick={() => request.mutate({ code: a.code })} loading={request.isPending && request.variables?.code === a.code}>
                        {t('addons.request')}
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
