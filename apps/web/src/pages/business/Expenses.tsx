import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Paperclip, Plus, Wallet } from 'lucide-react';
import { EXPENSE_CATEGORIES } from '@oceanx/shared';
import { api } from '../../lib/api';
import { useBiz } from '../../auth/business';
import { useFormat } from '../../lib/format';
import { parseAmount, useMoney } from '../../lib/money';
import { useList } from '../../lib/useList';
import { useErrorMessage, useFieldErrors, useToastError } from '../../lib/useApiError';
import { Alert, Badge, Card, EmptyState, PageHeader, SkeletonRows, StatCard } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select, Textarea } from '../../components/ui/Form';
import { ConfirmDialog, Dialog } from '../../components/ui/Dialog';
import { DataTable, Pagination, type Column } from '../../components/ui/Table';
import { ListToolbar } from '../../components/ListToolbar';

interface Expense {
  id: string;
  category: string;
  amount: number;
  expenseDate: string;
  paymentMethod: string;
  payee: string;
  reference: string;
  notes: string;
  hasAttachment: boolean;
  createdByName: string | null;
}

export default function ExpensesPage() {
  const { t } = useTranslation();
  const { can } = useBiz();
  const money = useMoney();
  const f = useFormat();
  const [category, setCategory] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [editing, setEditing] = useState<Expense | 'new' | null>(null);
  const { query, page, setPage, search, setSearch, pageSize } = useList<Expense>('expenses', '/expenses', { category, from, to });
  const columns: Column<Expense>[] = [
    { key: 'd', header: t('common.date'), cell: (e) => f.date(e.expenseDate) },
    { key: 'c', header: t('expenses.category'), cell: (e) => <Badge>{t(`expenses.categories.${e.category}`)}</Badge> },
    {
      key: 'p',
      header: t('expenses.payee'),
      hideOnMobile: true,
      cell: (e) => (
        <span className="inline-flex items-center gap-1" dir="auto">
          {e.payee || '—'} {e.hasAttachment && <Paperclip className="size-3.5 text-slate-400" />}
        </span>
      ),
    },
    { key: 'm', header: t('payments.method'), hideOnMobile: true, cell: (e) => t(`payment_methods.${e.paymentMethod}`) },
    { key: 'a', header: t('payments.amount'), className: 'text-end', cell: (e) => <span className="font-semibold tabular-nums">{money(e.amount)}</span> },
  ];
  return (
    <div className="space-y-6">
      <PageHeader
        title={t('expenses.title')}
        description={t('expenses.subtitle')}
        actions={
          can('expenses.create') && (
            <Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
              {t('expenses.create')}
            </Button>
          )
        }
      />
      {query.data && <StatCard label={t('expenses.total_filtered')} value={money(query.data.sum as number)} />}
      <Card padded={false}>
        <ListToolbar search={search} onSearch={setSearch} placeholder={t('expenses.search')}>
          <Select label={t('expenses.category')} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">{t('common.all')}</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`expenses.categories.${c}`)}
              </option>
            ))}
          </Select>
          <Input type="date" label={t('common.from')} value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" label={t('common.to')} value={to} onChange={(e) => setTo(e.target.value)} />
        </ListToolbar>
        {query.isLoading ? (
          <SkeletonRows />
        ) : !query.data?.items.length ? (
          <EmptyState icon={<Wallet className="size-6" />} title={t('expenses.empty_title')} description={t('expenses.empty_body')} />
        ) : (
          <>
            <DataTable columns={columns} rows={query.data.items} rowKey={(e) => e.id} onRowClick={setEditing} />
            <Pagination page={page} pageSize={pageSize} total={query.data.total} onPage={setPage} />
          </>
        )}
      </Card>
      {editing && <ExpenseDialog expense={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ExpenseDialog({ expense, onClose }: { expense: Expense | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { can } = useBiz();
  const qc = useQueryClient();
  const toastErr = useToastError();
  const errMsg = useErrorMessage();
  const editable = expense ? can('expenses.edit') : can('expenses.create');
  const [form, setForm] = useState({
    category: expense?.category ?? 'other',
    amount: expense ? String(expense.amount / 100) : '',
    expenseDate: expense?.expenseDate ?? new Date().toISOString().slice(0, 10),
    paymentMethod: expense?.paymentMethod ?? 'cash',
    payee: expense?.payee ?? '',
    reference: expense?.reference ?? '',
    notes: expense?.notes ?? '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [deleting, setDeleting] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ['biz', 'expenses'] });
  const save = useMutation({
    mutationFn: async () => {
      const body = { ...form, amount: parseAmount(form.amount) };
      const saved = expense ? await api.put<{ id: string }>(`/expenses/${expense.id}`, body) : await api.post<{ id: string }>('/expenses', body);
      if (file) await api.upload(`/expenses/${saved.id}/attachment`, file);
      return saved;
    },
    onSuccess: () => {
      toast.success(t('common.saved'));
      void refresh();
      onClose();
    },
  });
  const del = useMutation({
    mutationFn: () => api.delete(`/expenses/${expense!.id}`),
    onSuccess: () => {
      toast.success(t('common.deleted'));
      void refresh();
      onClose();
    },
    onError: toastErr,
  });
  const fe = useFieldErrors(save.error);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Dialog
      open
      onClose={onClose}
      title={expense ? t('expenses.edit') : t('expenses.create')}
      footer={
        <>
          {expense && can('expenses.delete') && (
            <Button variant="ghost" className="me-auto text-rose-600" onClick={() => setDeleting(true)}>
              {t('common.delete')}
            </Button>
          )}
          {editable && (
            <Button onClick={() => save.mutate()} loading={save.isPending} disabled={parseAmount(form.amount) <= 0}>
              {t('common.save')}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {save.error && !fe('amount') && <Alert tone="red">{errMsg(save.error)}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label={t('expenses.category')} value={form.category} disabled={!editable} onChange={set('category')}>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`expenses.categories.${c}`)}
              </option>
            ))}
          </Select>
          <Input type="number" min={0} step="0.01" label={t('payments.amount')} value={form.amount} disabled={!editable} onChange={set('amount')} error={fe('amount')} />
          <Input type="date" label={t('common.date')} value={form.expenseDate} disabled={!editable} onChange={set('expenseDate')} error={fe('expenseDate')} />
          <Select label={t('payments.method')} value={form.paymentMethod} disabled={!editable} onChange={set('paymentMethod')}>
            {['cash', 'card', 'bank_transfer', 'other'].map((m) => (
              <option key={m} value={m}>
                {t(`payment_methods.${m}`)}
              </option>
            ))}
          </Select>
          <Input label={t('expenses.payee')} value={form.payee} disabled={!editable} onChange={set('payee')} />
          <Input label={t('payments.reference')} value={form.reference} disabled={!editable} onChange={set('reference')} />
        </div>
        <Textarea label={t('common.notes')} value={form.notes} disabled={!editable} onChange={set('notes')} />
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {expense?.hasAttachment && (
            <a className="inline-flex items-center gap-1 font-medium text-brand-700 underline dark:text-brand-300" href={`/api/expenses/${expense.id}/attachment`} target="_blank" rel="noopener noreferrer">
              <Paperclip className="size-4" /> {t('expenses.view_attachment')}
            </a>
          )}
          {editable && (
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 font-medium ring-1 ring-slate-200 hover:bg-slate-50 dark:ring-slate-700 dark:hover:bg-slate-800">
              <Paperclip className="size-4" />
              {file ? file.name : t('expenses.attach')}
              <input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
          )}
        </div>
      </div>
      <ConfirmDialog open={deleting} onClose={() => setDeleting(false)} onConfirm={() => del.mutate()} loading={del.isPending} danger title={t('expenses.delete_title')} message={t('expenses.delete_body')} confirmLabel={t('common.delete')} />
    </Dialog>
  );
}
