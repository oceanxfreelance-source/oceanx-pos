import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from '@tanstack/react-query';
import { FileSpreadsheet, Plus } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { useBiz } from '../../auth/business';
import { localeFor } from '../../lib/format';
import { useMoney } from '../../lib/money';
import { useErrorMessage } from '../../lib/useApiError';
import { Alert, Badge, Card, EmptyState, PageHeader, SkeletonRows } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Input } from '../../components/ui/Form';
import { Tabs } from '../../components/ui/Tabs';
import { StaffPanel } from './Staff';

export interface PayrollRunSummary {
  id: string;
  period: string;
  status: 'draft' | 'finalized';
  totalNet: number;
  staffCount: number;
  finalizedAt: string | null;
}

/** "2026-09" → "September 2026" in the given language. */
export function periodLabel(period: string, lang: string) {
  const [y, m] = period.split('-').map(Number) as [number, number];
  return new Intl.DateTimeFormat(localeFor(lang), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1)));
}

/** Payroll add-on: monthly salary sheets and the staff list. */
export default function PayrollPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'staff' ? 'staff' : 'sheets';
  return (
    <div className="space-y-6">
      <PageHeader title={t('staff.payroll_title')} description={t('staff.payroll_subtitle')} />
      <Tabs
        tabs={[
          { value: 'sheets', label: t('staff.tab_sheets') },
          { value: 'staff', label: t('staff.tab_staff') },
        ]}
        value={tab}
        onChange={(v) => setParams(v === 'sheets' ? {} : { tab: v }, { replace: true })}
      />
      {tab === 'sheets' ? <Sheets /> : <StaffPanel />}
    </div>
  );
}

function Sheets() {
  const { t, i18n } = useTranslation();
  const { can } = useBiz();
  const money = useMoney();
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ['biz', 'payroll'], queryFn: () => api.get<{ items: PayrollRunSummary[] }>('/payroll') });
  const [creating, setCreating] = useState(false);
  const items = q.data?.items ?? [];
  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
        <p className="text-sm text-slate-500">{t('staff.sheets_hint')}</p>
        {can('payroll.manage') && (
          <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
            {t('staff.new_sheet')}
          </Button>
        )}
      </div>
      {!q.data ? (
        <div className="p-5">
          <SkeletonRows rows={4} />
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={<FileSpreadsheet className="size-6" />} title={t('staff.no_sheets')} description={t('staff.no_sheets_hint')} />
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {items.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => navigate(`/payroll/${r.id}`)} className="flex w-full items-center gap-3 px-5 py-4 text-start hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{periodLabel(r.period, i18n.language)}</p>
                  <p className="text-sm text-slate-500">{t('staff.staff_count', { count: r.staffCount })}</p>
                </div>
                <Badge tone={r.status === 'finalized' ? 'green' : 'amber'}>{t(`staff.status_${r.status}`)}</Badge>
                <span className="w-32 text-end font-semibold tabular-nums">{money(r.totalNet)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {creating && <NewSheetDialog onClose={() => setCreating(false)} />}
    </Card>
  );
}

function NewSheetDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const errMsg = useErrorMessage();
  const now = new Date();
  const [period, setPeriod] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const create = useMutation({
    mutationFn: () => api.post<{ id: string }>('/payroll', { period }),
    onSuccess: (r) => navigate(`/payroll/${r.id}`),
    onError: (e) => {
      // The month already has a sheet: open it instead.
      if (e instanceof ApiError && e.code === 'payroll_period_exists' && typeof e.details.id === 'string') navigate(`/payroll/${e.details.id}`);
    },
  });
  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      title={t('staff.new_sheet')}
      footer={
        <Button onClick={() => create.mutate()} loading={create.isPending} disabled={!/^\d{4}-\d{2}$/.test(period)}>
          {t('staff.create_sheet')}
        </Button>
      }
    >
      <div className="space-y-4">
        {create.error && !(create.error instanceof ApiError && create.error.code === 'payroll_period_exists') && <Alert tone="red">{errMsg(create.error)}</Alert>}
        <Input label={t('staff.month')} type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
        <p className="text-sm text-slate-500">{t('staff.new_sheet_hint')}</p>
      </div>
    </Dialog>
  );
}
