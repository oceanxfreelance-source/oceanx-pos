import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { languageDir } from '@oceanx/shared';
import { api } from '../../lib/api';
import { useBizSession } from '../../auth/business';
import { pdfName } from '../../lib/pdf';
import { menuUrl, qrPng } from '../../lib/qrMenu';
import { SkeletonRows } from '../../components/ui/Card';
import { Logo } from '../../components/Logo';
import { PrintFrame } from './PrintFrame';

/** Table tent cards (4 per A4 page): logo, "Scan for menu", QR code and the table name. */
export default function QrCardsPrint() {
  const [params] = useSearchParams();
  const { t, i18n } = useTranslation();
  const session = useBizSession();
  const which = params.get('tables') ?? 'all';
  const tables = useQuery({
    queryKey: ['biz', 'tables'],
    queryFn: () => api.get<{ items: { id: string; name: string; isActive: boolean }[] }>('/tables'),
    enabled: which !== 'none',
  });
  const list = which === 'none' ? [{ id: 'generic', name: '' }] : (tables.data?.items ?? []).filter((x) => x.isActive && (which === 'all' || which.split(',').includes(x.id)));
  const [codes, setCodes] = useState<Record<string, string> | null>(null);
  const ready = which === 'none' || !!tables.data;
  const key = list.map((x) => x.id).join(',');
  useEffect(() => {
    if (!ready) return;
    void Promise.all(list.map(async (x) => [x.id, await qrPng(menuUrl(session.business.slug, x.name || undefined), 600)] as const)).then((pairs) =>
      setCodes(Object.fromEntries(pairs)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, key]);
  const rows: (typeof list)[] = [];
  for (let i = 0; i < list.length; i += 2) rows.push(list.slice(i, i + 2));
  return (
    <PrintFrame ready={!!codes} filename={pdfName(session.business.name, 'qr-menu-cards')}>
      {!codes ? (
        <SkeletonRows rows={6} />
      ) : (
        <div lang={i18n.language} dir={languageDir(i18n.language)} className="space-y-6 p-8">
          {rows.map((row, ri) => (
            <div key={ri} className="grid grid-cols-2 gap-6" data-pdf-block>
              {row.map((x) => (
                <div key={x.id} className="flex flex-col items-center rounded-3xl border-2 border-dashed border-slate-300 px-6 py-7 text-center text-slate-900">
                  <div className="flex items-center gap-2">
                    {session.business.hasLogo ? <img src="/api/settings/logo" alt="" className="h-10 max-w-32 object-contain" /> : <Logo className="size-9" />}
                    <p className="text-lg font-bold" dir="auto">
                      {session.business.name}
                    </p>
                  </div>
                  <p className="mt-4 text-2xl font-extrabold tracking-tight">{t('qr.card_title')}</p>
                  <p className="text-sm text-slate-500">{t('qr.card_subtitle')}</p>
                  <img src={codes[x.id]} alt="" className="my-4 size-52" />
                  {x.name ? (
                    <p className="rounded-full bg-slate-900 px-5 py-1.5 text-lg font-bold text-white" dir="auto">
                      {t('qr.card_table', { table: x.name })}
                    </p>
                  ) : (
                    <p className="text-sm text-slate-500">{t('qr.card_generic')}</p>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </PrintFrame>
  );
}
