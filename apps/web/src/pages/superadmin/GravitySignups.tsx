import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search, UserPlus } from 'lucide-react';
import { qs, saApi } from '../../lib/api';
import { useFormat } from '../../lib/format';
import { Badge, Card, EmptyState, Ltr, PageHeader, SkeletonRows, type BadgeTone } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Form';
import { DataTable, Pagination, type Column } from '../../components/ui/Table';

interface Row {
  id: string;
  businessId: string | null;
  businessName: string;
  ownerName: string;
  email: string;
  phone: string | null;
  createdAt: string;
  trialEnd: string | null;
  state: 'trial' | 'trial_ended' | 'payment_review' | 'paid' | 'active' | 'deleted';
  deleteAt: string | null;
  deletedAt: string | null;
}

const TONE: Record<Row['state'], BadgeTone> = { trial: 'blue', trial_ended: 'red', payment_review: 'amber', paid: 'green', active: 'green', deleted: 'gray' };
const PAGE = 50;

/**
 * Every Gravity sign-up with the owner's details. Accounts start at once (no approval); an unpaid trial is deleted
 * the set number of hours after it ends, but its sign-up details stay here.
 */
export default function GravitySignupsPage() {
  const { t } = useTranslation();
  const f = useFormat();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [hours, setHours] = useState('');
  useEffect(() => {
    const id = setTimeout(() => (setQ(search), setPage(1)), 250);
    return () => clearTimeout(id);
  }, [search]);
  const list = useQuery({
    queryKey: ['sa', 'signups', q, page],
    queryFn: () => saApi.get<{ items: Row[]; total: number; trialDeleteHours: number }>(`/signups${qs({ product: 'gravity', q, page, pageSize: PAGE })}`),
    placeholderData: keepPreviousData,
  });
  useEffect(() => {
    if (list.data && hours === '') setHours(String(list.data.trialDeleteHours));
  }, [list.data, hours]);
  const save = useMutation({
    mutationFn: () => saApi.patch('/settings', { trialDeleteHours: Number(hours || 0) }),
    onSuccess: () => {
      toast.success(t('common.saved'));
      void qc.invalidateQueries({ queryKey: ['sa', 'signups'] });
    },
  });

  const status = (r: Row) => (
    <span className="flex flex-col items-end gap-1 md:items-start">
      <Badge tone={TONE[r.state]} dot>
        {t(`gravity.signup_state_${r.state}`)}
      </Badge>
      {r.state === 'trial' && r.trialEnd && <span className="text-xs text-slate-500">{t('gravity.trial_ends_at', { date: f.dateTime(r.trialEnd) })}</span>}
      {r.deleteAt && <span className="text-xs font-medium text-rose-600 dark:text-rose-400">{t('gravity.deletes_at', { date: f.dateTime(r.deleteAt) })}</span>}
      {r.deletedAt && <span className="text-xs text-slate-500">{f.dateTime(r.deletedAt)}</span>}
    </span>
  );
  const columns: Column<Row>[] = [
    {
      key: 'name',
      header: t('superadmin.businesses.business'),
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900 dark:text-white" dir="auto">
            {r.businessName}
          </p>
          <p className="truncate text-xs text-slate-500" dir="auto">
            {r.ownerName}
          </p>
        </div>
      ),
    },
    {
      key: 'contact',
      header: t('gravity.signup_contact'),
      cell: (r) => (
        <div className="min-w-0 text-sm">
          <Ltr className="block truncate">{r.email}</Ltr>
          {r.phone && <Ltr className="block truncate text-xs text-slate-500">{r.phone}</Ltr>}
        </div>
      ),
    },
    { key: 'created', header: t('gravity.signed_up'), hideOnMobile: true, cell: (r) => <span className="text-slate-500">{f.dateTime(r.createdAt)}</span> },
    { key: 'status', header: t('common.status'), cell: status },
  ];

  return (
    <div>
      <PageHeader title={t('gravity.signups_title')} description={t('gravity.signups_subtitle')} />
      <Card className="mb-4">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="w-44">
            <Input label={t('gravity.delete_after')} type="number" inputMode="numeric" min={0} max={8760} value={hours} onChange={(e) => setHours(e.target.value)} />
          </div>
          <Button type="submit" variant="secondary" loading={save.isPending}>
            {t('common.save')}
          </Button>
          <p className="basis-full text-xs text-slate-500">{t('gravity.delete_after_hint')}</p>
        </form>
      </Card>
      <Card padded={false}>
        <div className="border-b border-slate-100 p-4 dark:border-slate-800">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('gravity.signups_search')}
              aria-label={t('gravity.signups_search')}
              className="w-full rounded-xl border-0 bg-slate-50 py-2.5 ps-9 pe-3 text-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-brand-600 focus:outline-none dark:bg-slate-800 dark:ring-slate-700"
            />
          </div>
        </div>
        {!list.data ? (
          <SkeletonRows rows={5} />
        ) : list.data.items.length === 0 ? (
          <EmptyState icon={<UserPlus className="size-6" />} title={t('gravity.signups_empty')} />
        ) : (
          <>
            <DataTable columns={columns} rows={list.data.items} rowKey={(r) => r.id} />
            <div className="p-4">
              <Pagination page={page} pageSize={PAGE} total={list.data.total} onPage={setPage} />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
