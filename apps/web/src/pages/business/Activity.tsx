import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import { api, qs, type Paginated } from '../../lib/api';
import { useFormat } from '../../lib/format';
import { actionLabel } from '../../lib/labels';
import { Card, EmptyState, Ltr, PageHeader, SkeletonRows } from '../../components/ui/Card';
import { Input, Select } from '../../components/ui/Form';
import { DataTable, Pagination, type Column } from '../../components/ui/Table';

interface Log {
  id: number;
  action: string;
  actorType: string;
  actorName: string | null;
  entityType: string | null;
  ip: string | null;
  createdAt: string;
}

const FILTERS = ['', 'user.', 'role.', 'permission.', 'settings.', 'outlet.'];

export default function ActivityPage() {
  const { t } = useTranslation();
  const f = useFormat();
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const q = useQuery({
    queryKey: ['biz', 'activity', page, action, from, to],
    queryFn: () => api.get<Paginated<Log>>(`/activity-logs${qs({ page, pageSize: 25, action, from, to })}`),
    placeholderData: keepPreviousData,
  });
  const columns: Column<Log>[] = [
    { key: 'action', header: t('activity.event'), cell: (l) => <span className="font-medium text-slate-900 dark:text-white">{actionLabel(t, l.action)}</span> },
    {
      key: 'actor',
      header: t('activity.actor'),
      cell: (l) => <span dir="auto">{l.actorType === 'super_admin' ? t('activity.platform_admin') : (l.actorName ?? t('activity.system'))}</span>,
    },
    { key: 'ip', header: t('activity.ip'), hideOnMobile: true, cell: (l) => (l.ip ? <Ltr className="font-mono text-xs">{l.ip}</Ltr> : '—') },
    { key: 'time', header: t('activity.time'), cell: (l) => <span className="text-slate-500">{f.dateTime(l.createdAt)}</span> },
  ];
  return (
    <div>
      <PageHeader title={t('activity.title')} description={t('activity.subtitle')} />
      <Card padded={false}>
        <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-3 dark:border-slate-800">
          <Select
            label={t('activity.filter_event')}
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
          >
            {FILTERS.map((x) => (
              <option key={x} value={x}>
                {x ? t(`activity.filters.${x.replace('.', '')}`) : t('common.all')}
              </option>
            ))}
          </Select>
          <Input type="date" label={t('common.from')} value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" label={t('common.to')} value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        {q.isLoading ? (
          <SkeletonRows />
        ) : !q.data?.items.length ? (
          <EmptyState icon={<History className="size-6" />} title={t('activity.empty')} />
        ) : (
          <>
            <DataTable columns={columns} rows={q.data.items} rowKey={(l) => String(l.id)} />
            <Pagination page={page} pageSize={25} total={q.data.total} onPage={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}
