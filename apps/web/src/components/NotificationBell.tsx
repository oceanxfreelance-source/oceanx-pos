import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { api } from '../lib/api';
import { useFormat } from '../lib/format';
import { useMoney } from '../lib/money';
import { Dropdown } from './Dropdown';

interface Notification {
  id: number;
  key: string;
  params: Record<string, unknown>;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

/** In-app notifications for the signed-in user (low stock, invoices paid, online orders, credit payments…). */
export function NotificationBell() {
  const { t } = useTranslation();
  const f = useFormat();
  const money = useMoney();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['biz', 'notifications'], queryFn: () => api.get<{ items: Notification[]; unread: number }>('/notifications'), refetchInterval: 30_000 });
  const read = useMutation({ mutationFn: (ids?: number[]) => api.post('/notifications/read', ids ? { ids } : {}), onSuccess: () => qc.invalidateQueries({ queryKey: ['biz', 'notifications'] }) });
  const unread = q.data?.unread ?? 0;
  const render = (n: Notification) => {
    const params = Object.fromEntries(Object.entries(n.params).map(([k, v]) => [k, k === 'amount' && typeof v === 'number' ? money(v) : v]));
    return t(n.key, params);
  };
  return (
    <Dropdown
      trigger={() => (
        <button type="button" aria-label={t('notifications.title')} className="relative rounded-xl p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
          <Bell className="size-5" />
          {unread > 0 && (
            <span className="absolute -end-0.5 -top-0.5 flex min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white" dir="ltr">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
      )}
    >
      {(close) => (
        <div className="w-80 max-w-[calc(100vw-2rem)]">
          <div className="flex items-center justify-between px-3 py-2">
            <p className="text-sm font-semibold">{t('notifications.title')}</p>
            {unread > 0 && (
              <button type="button" className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300" onClick={() => read.mutate(undefined)}>
                {t('notifications.mark_all_read')}
              </button>
            )}
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {!q.data?.items.length && <li className="px-3 py-6 text-center text-sm text-slate-400">{t('notifications.empty')}</li>}
            {q.data?.items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  className={`w-full rounded-lg px-3 py-2 text-start text-sm hover:bg-slate-100 dark:hover:bg-slate-800 ${n.readAt ? 'text-slate-500' : 'font-medium'}`}
                  onClick={() => {
                    if (!n.readAt) read.mutate([n.id]);
                    close();
                    if (n.link) navigate(n.link);
                  }}
                >
                  <span className="flex items-start gap-2">
                    {!n.readAt && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-600" />}
                    <span>
                      <span className="block" dir="auto">
                        {render(n)}
                      </span>
                      <span className="block text-xs font-normal text-slate-400">{f.relative(n.createdAt)}</span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Dropdown>
  );
}
