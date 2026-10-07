import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Copy, Download, ExternalLink, Printer, QrCode } from 'lucide-react';
import { LANGUAGES, languageDir, type BusinessSettings } from '@oceanx/shared';
import { api, qs } from '../../lib/api';
import { useBiz, useBizSession } from '../../auth/business';
import { menuUrl, qrPng } from '../../lib/qrMenu';
import { useToastError } from '../../lib/useApiError';
import { Alert, Card, CardHeader, Ltr, PageHeader, SkeletonRows } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Checkbox, Switch, Textarea } from '../../components/ui/Form';

type Online = BusinessSettings['online'];

/**
 * QR menu: one printed code per table. The code holds only the menu address, so every change to items,
 * prices, photos or availability shows up immediately — nothing needs re-printing.
 */
export default function QrMenuPage() {
  const { t } = useTranslation();
  const { can, hasAddon } = useBiz();
  const session = useBizSession();
  const qc = useQueryClient();
  const toastErr = useToastError();
  const url = menuUrl(session.business.slug);
  const [png, setPng] = useState<string | null>(null);
  useEffect(() => {
    void qrPng(url).then(setPng);
  }, [url]);
  const settings = useQuery({
    queryKey: ['biz', 'settings'],
    queryFn: () => api.get<{ sections: { online?: Online }; editable: string[] }>('/settings'),
  });
  const online = settings.data?.sections.online;
  const editable = !!settings.data?.editable.includes('online');
  const [message, setMessage] = useState('');
  const [messageTr, setMessageTr] = useState<Online['messageTranslations']>({});
  useEffect(() => {
    if (online) {
      setMessage(online.message);
      setMessageTr(online.messageTranslations ?? {});
    }
  }, [online]);
  const [showAllMsg, setShowAllMsg] = useState(false);
  const messageChanged = !!online && (message !== online.message || JSON.stringify(messageTr) !== JSON.stringify(online.messageTranslations ?? {}));
  const save = useMutation({
    mutationFn: (patch: Partial<Online>) => api.patch('/settings/online', { ...online, ...patch }),
    onSuccess: () => {
      toast.success(t('common.saved'));
      void qc.invalidateQueries({ queryKey: ['biz', 'settings'] });
    },
    onError: toastErr,
  });
  const tables = useQuery({
    queryKey: ['biz', 'tables'],
    queryFn: () =>
      api.get<{
        items: { id: string; name: string; area: string; isActive: boolean }[];
      }>('/tables'),
    enabled: can('tables.view') || can('pos.access'),
  });
  const activeTables = tables.data?.items.filter((x) => x.isActive) ?? [];
  const [picked, setPicked] = useState<string[] | null>(null);
  const chosen = picked ?? activeTables.map((x) => x.id);
  const printCards = (download: boolean) =>
    window.open(`/print/qr-cards${qs({ tables: chosen.length === activeTables.length ? 'all' : chosen.join(','), download: download ? '1' : undefined })}`, '_blank', 'noopener');
  const printGeneric = (download: boolean) => window.open(`/print/qr-cards${qs({ tables: 'none', download: download ? '1' : undefined })}`, '_blank', 'noopener');

  return (
    <div className="space-y-6">
      <PageHeader title={t('qr.title')} description={t('qr.subtitle')} />
      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <Card>
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
              {png ? <img src={png} alt={t('settings.online.qr_alt')} className="size-56" /> : <div className="size-56" />}
            </div>
            <p className="text-sm text-slate-500">{t('qr.auto_update')}</p>
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm break-all text-brand-700 underline dark:text-brand-300" dir="ltr">
              {url}
            </a>
            <div className="flex flex-wrap justify-center gap-2">
              {png && (
                <a href={png} download={`menu-qr-${session.business.slug}.png`}>
                  <Button size="sm" icon={<Download className="size-4" />}>
                    {t('settings.online.download_qr')}
                  </Button>
                </a>
              )}
              <Button
                size="sm"
                variant="secondary"
                icon={<Copy className="size-4" />}
                onClick={() => void navigator.clipboard?.writeText(url).then(() => toast.success(t('qr.copied')))}
              >
                {t('qr.copy_link')}
              </Button>
              <a href={url} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="ghost" icon={<ExternalLink className="size-4" />}>
                  {t('qr.open_menu')}
                </Button>
              </a>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title={t('qr.settings')} />
            {!online ? (
              <SkeletonRows rows={3} />
            ) : (
              <fieldset disabled={!editable || save.isPending} className="space-y-5">
                <Switch
                  checked={online.menuEnabled}
                  onChange={(v) => save.mutate({ menuEnabled: v })}
                  label={t('settings.online.menu_enabled')}
                  description={t('settings.online.menu_enabled_hint')}
                />
                <Switch checked={online.showPrices} onChange={(v) => save.mutate({ showPrices: v })} label={t('settings.online.show_prices')} />
                {hasAddon('online_ordering') ? (
                  <Switch
                    checked={online.ordersEnabled}
                    onChange={(v) => save.mutate({ ordersEnabled: v })}
                    label={t('qr.customers_can_order')}
                    description={online.ordersEnabled ? t('qr.mode_order') : t('qr.mode_view_only')}
                  />
                ) : (
                  <Alert tone="blue">{t('qr.mode_view_only')}</Alert>
                )}
                <div className="space-y-2">
                  <Textarea label={t('settings.online.message')} placeholder={t('qr.message_placeholder')} value={message} onChange={(e) => setMessage(e.target.value)} />
                  {LANGUAGES.filter((l) => l.code !== 'en').map((l) => (
                    <Textarea
                      key={l.code}
                      rows={2}
                      label={t('menu_i18n.message_in', { language: l.nativeName })}
                      lang={l.code}
                      dir={languageDir(l.code)}
                      className={l.code === 'dv' || messageTr[l.code] || showAllMsg ? '' : 'hidden'}
                      value={messageTr[l.code] ?? ''}
                      onChange={(e) => setMessageTr({ ...messageTr, [l.code]: e.target.value })}
                    />
                  ))}
                  {!showAllMsg && (
                    <button type="button" className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300" onClick={() => setShowAllMsg(true)}>
                      {t('menu_i18n.more_languages')}
                    </button>
                  )}
                  {messageChanged && (
                    <Button size="sm" onClick={() => save.mutate({ message, messageTranslations: Object.fromEntries(Object.entries(messageTr).filter(([, v]) => v?.trim())) })}>
                      {t('common.save')}
                    </Button>
                  )}
                </div>
                {!online.menuEnabled && <Alert tone="amber">{t('qr.menu_off')}</Alert>}
              </fieldset>
            )}
          </Card>

          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <QrCode className="size-5 text-brand-600" /> {t('qr.table_cards')}
                </span>
              }
              description={t('qr.table_cards_hint')}
            />
            {activeTables.length === 0 ? (
              <p className="text-sm text-slate-500">{t('qr.no_tables')}</p>
            ) : (
              <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {activeTables.map((x) => (
                  <Checkbox
                    key={x.id}
                    checked={chosen.includes(x.id)}
                    onChange={(v) => setPicked(v ? [...chosen, x.id] : chosen.filter((id) => id !== x.id))}
                    label={<span dir="auto">{x.name}</span>}
                  />
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {activeTables.length > 0 && (
                <>
                  <Button icon={<Download className="size-4" />} onClick={() => printCards(true)} disabled={!chosen.length}>
                    {t('qr.download_cards', { count: chosen.length })}
                  </Button>
                  <Button variant="secondary" icon={<Printer className="size-4" />} onClick={() => printCards(false)} disabled={!chosen.length}>
                    {t('print.print')}
                  </Button>
                </>
              )}
              <Button variant="ghost" icon={<Download className="size-4" />} onClick={() => printGeneric(true)}>
                {t('qr.generic_card')}
              </Button>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              {t('qr.example_link')}: <Ltr>{menuUrl(session.business.slug, activeTables[0]?.name ?? 'T1')}</Ltr>
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
