import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Download, Lock, Printer, RotateCcw, Save, Trash2, UserPlus, X } from 'lucide-react';
import { api } from '../../lib/api';
import { useBiz } from '../../auth/business';
import { parseAmount, useMoney } from '../../lib/money';
import { useErrorMessage, useToastError } from '../../lib/useApiError';
import { Alert, Badge, Card, PageHeader, SkeletonRows } from '../../components/ui/Card';
import { Button, IconButton } from '../../components/ui/Button';
import { ConfirmDialog, Dialog } from '../../components/ui/Dialog';
import { Select, Switch, Textarea } from '../../components/ui/Form';
import { periodLabel } from './Payroll';

export interface PayrollLine {
  id: string;
  staffId: string | null;
  name: string;
  position: string;
  basic: number;
  allowances: number;
  overtime: number;
  deductions: number;
  advance: number;
  net: number;
  notes: string;
}
export interface PayrollRun {
  id: string;
  period: string;
  status: 'draft' | 'finalized';
  notes: string;
  totalNet: number;
  expenseId: string | null;
  finalizedAt: string | null;
  lines: PayrollLine[];
  totals: { basic: number; allowances: number; overtime: number; deductions: number; advance: number; net: number };
}

const AMOUNTS = ['basic', 'allowances', 'overtime', 'deductions', 'advance'] as const;
type Amount = (typeof AMOUNTS)[number];
type Draft = { id: string; name: string; position: string; notes: string } & Record<Amount, string>;

const toDraft = (l: PayrollLine): Draft => ({
  id: l.id,
  name: l.name,
  position: l.position,
  notes: l.notes,
  ...(Object.fromEntries(AMOUNTS.map((k) => [k, (l[k] / 100).toString()])) as Record<Amount, string>),
});
/** Same formula as the server (which is the one that counts): basic + allowances + overtime − deductions − advance. */
const netMinor = (d: Draft) => Math.round((parseAmount(d.basic) + parseAmount(d.allowances) + parseAmount(d.overtime) - parseAmount(d.deductions) - parseAmount(d.advance)) * 100);

/** One month's salary sheet: edit while draft; finalize to lock, print or save as PDF. */
export default function PayrollSheetPage() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const { can, hasModule } = useBiz();
  const money = useMoney();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const errMsg = useErrorMessage();
  const toastErr = useToastError();
  const q = useQuery({ queryKey: ['biz', 'payroll', id], queryFn: () => api.get<PayrollRun>(`/payroll/${id}`) });
  const run = q.data;
  const editable = !!run && run.status === 'draft' && can('payroll.manage');
  const [lines, setLines] = useState<Draft[]>([]);
  const [notes, setNotes] = useState('');
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!run) return;
    setLines(run.lines.map(toDraft));
    setNotes(run.notes);
    setDirty(false);
  }, [run]);
  const set = (lineId: string, k: Amount | 'notes', v: string) => {
    setLines((ls) => ls.map((l) => (l.id === lineId ? { ...l, [k]: v } : l)));
    setDirty(true);
  };
  const totals = useMemo(
    () =>
      lines.reduce(
        (a, l) => {
          for (const k of AMOUNTS) a[k] += Math.round(parseAmount(l[k]) * 100);
          a.net += netMinor(l);
          return a;
        },
        { basic: 0, allowances: 0, overtime: 0, deductions: 0, advance: 0, net: 0 } as Record<Amount | 'net', number>,
      ),
    [lines],
  );
  const after = (r: PayrollRun) => {
    qc.setQueryData(['biz', 'payroll', id], r);
    void qc.invalidateQueries({ queryKey: ['biz', 'payroll'], exact: true });
  };
  const body = () => ({ notes, lines: lines.map((l) => ({ id: l.id, notes: l.notes, ...Object.fromEntries(AMOUNTS.map((k) => [k, parseAmount(l[k])])) })) });
  const save = useMutation({
    mutationFn: () => api.put<PayrollRun>(`/payroll/${id}`, body()),
    onSuccess: (r) => {
      toast.success(t('common.saved'));
      after(r);
    },
    onError: toastErr,
  });
  const addStaff = useMutation({ mutationFn: () => api.post<PayrollRun>(`/payroll/${id}/add-staff`), onSuccess: after, onError: toastErr });
  const removeLine = useMutation({ mutationFn: (lineId: string) => api.delete<PayrollRun>(`/payroll/${id}/lines/${lineId}`), onSuccess: after, onError: toastErr });
  const [finalizing, setFinalizing] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const reopen = useMutation({
    mutationFn: () => api.post<PayrollRun>(`/payroll/${id}/reopen`),
    onSuccess: (r) => {
      setReopening(false);
      after(r);
    },
    onError: toastErr,
  });
  const del = useMutation({
    mutationFn: () => api.delete(`/payroll/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['biz', 'payroll'] });
      navigate('/payroll');
    },
    onError: toastErr,
  });
  const print = (download: boolean) => window.open(`/print/payroll/${id}${download ? '?download=1' : ''}`, '_blank', 'noopener');

  if (q.error)
    return (
      <div className="space-y-4">
        <Alert tone="red">{errMsg(q.error)}</Alert>
        <Link to="/payroll" className="text-sm text-brand-700 underline">
          {t('common.back')}
        </Link>
      </div>
    );
  if (!run) return <SkeletonRows rows={8} />;
  const cell = 'px-2 py-2';
  const num = 'w-24 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-end text-sm tabular-nums focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900';
  return (
    <div className="space-y-6">
      <PageHeader
        back={
          <Link to="/payroll" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-200">
            <ArrowLeft className="rtl-flip size-4" /> {t('staff.payroll_title')}
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-3">
            {t('staff.sheet_title', { month: periodLabel(run.period, i18n.language) })}
            <Badge tone={run.status === 'finalized' ? 'green' : 'amber'}>{t(`staff.status_${run.status}`)}</Badge>
          </span>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={<Printer className="size-4" />} onClick={() => print(false)} disabled={dirty}>
              {t('print.print')}
            </Button>
            <Button variant="secondary" icon={<Download className="size-4" />} onClick={() => print(true)} disabled={dirty}>
              {t('print.download_pdf')}
            </Button>
            {run.status === 'finalized' && can('payroll.manage') && (
              <Button variant="secondary" icon={<RotateCcw className="size-4" />} onClick={() => setReopening(true)}>
                {t('staff.reopen')}
              </Button>
            )}
          </div>
        }
      />
      {run.status === 'finalized' && (
        <Alert tone="green" icon={<Lock className="size-4" />}>
          {run.expenseId ? t('staff.finalized_with_expense') : t('staff.finalized_hint')}
        </Alert>
      )}
      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-800/50">
              <tr>
                <th className={`${cell} ps-5 text-start font-medium`}>{t('staff.staff_member')}</th>
                {AMOUNTS.map((k) => (
                  <th key={k} className={`${cell} text-end font-medium whitespace-nowrap`}>
                    {t(`staff.col_${k}`)}
                  </th>
                ))}
                <th className={`${cell} text-end font-medium whitespace-nowrap`}>{t('staff.col_net')}</th>
                <th className={`${cell} text-start font-medium`}>{t('common.notes')}</th>
                {editable && <th className={cell} />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {lines.map((l) => {
                const net = netMinor(l);
                return (
                  <tr key={l.id}>
                    <td className={`${cell} ps-5`}>
                      <p className="font-medium" dir="auto">
                        {l.name}
                      </p>
                      {l.position && (
                        <p className="text-xs text-slate-500" dir="auto">
                          {l.position}
                        </p>
                      )}
                    </td>
                    {AMOUNTS.map((k) => (
                      <td key={k} className={`${cell} text-end`}>
                        {editable ? (
                          <input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step="0.01"
                            aria-label={`${l.name} ${t(`staff.col_${k}`)}`}
                            className={num}
                            value={l[k]}
                            onChange={(e) => set(l.id, k, e.target.value)}
                          />
                        ) : (
                          <span className="tabular-nums">{money(Math.round(parseAmount(l[k]) * 100))}</span>
                        )}
                      </td>
                    ))}
                    <td className={`${cell} text-end font-semibold tabular-nums ${net < 0 ? 'text-rose-600' : ''}`}>{money(net)}</td>
                    <td className={cell}>
                      {editable ? (
                        <input
                          aria-label={`${l.name} ${t('common.notes')}`}
                          className="w-36 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                          value={l.notes}
                          maxLength={200}
                          onChange={(e) => set(l.id, 'notes', e.target.value)}
                          dir="auto"
                        />
                      ) : (
                        <span className="text-slate-600 dark:text-slate-300" dir="auto">
                          {l.notes}
                        </span>
                      )}
                    </td>
                    {editable && (
                      <td className={cell}>
                        <IconButton label={t('staff.remove_from_sheet')} onClick={() => removeLine.mutate(l.id)} className="hover:text-rose-600" disabled={dirty}>
                          <X className="size-4" />
                        </IconButton>
                      </td>
                    )}
                  </tr>
                );
              })}
              {lines.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-5 py-8 text-center text-slate-500">
                    {t('staff.sheet_empty')}
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="border-t-2 border-slate-200 font-semibold dark:border-slate-700">
              <tr>
                <td className={`${cell} ps-5`}>{t('reports.total_row')}</td>
                {AMOUNTS.map((k) => (
                  <td key={k} className={`${cell} text-end tabular-nums`}>
                    {money(totals[k])}
                  </td>
                ))}
                <td className={`${cell} text-end text-base tabular-nums`}>{money(totals.net)}</td>
                <td colSpan={editable ? 2 : 1} />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
      <p className="text-xs text-slate-500">{t('staff.net_formula')}</p>
      {editable ? (
        <>
          <Textarea label={t('staff.sheet_notes')} rows={2} value={notes} onChange={(e) => (setNotes(e.target.value), setDirty(true))} />
          <div className="flex flex-wrap items-center gap-2">
            <Button icon={<Save className="size-4" />} onClick={() => save.mutate()} loading={save.isPending} disabled={!dirty}>
              {t('common.save')}
            </Button>
            <Button variant="secondary" icon={<UserPlus className="size-4" />} onClick={() => addStaff.mutate()} loading={addStaff.isPending} disabled={dirty}>
              {t('staff.add_missing_staff')}
            </Button>
            <Button variant="secondary" icon={<Lock className="size-4" />} onClick={() => setFinalizing(true)} disabled={dirty || lines.length === 0}>
              {t('staff.finalize')}
            </Button>
            <Button variant="ghost" icon={<Trash2 className="size-4" />} onClick={() => setDeleting(true)} className="ms-auto text-rose-600">
              {t('staff.delete_sheet')}
            </Button>
          </div>
          {dirty && <p className="text-sm text-amber-700 dark:text-amber-400">{t('staff.unsaved')}</p>}
        </>
      ) : (
        run.notes && (
          <p className="text-sm text-slate-600 dark:text-slate-300" dir="auto">
            {run.notes}
          </p>
        )
      )}
      {finalizing && <FinalizeDialog run={run} canExpense={hasModule('expenses') && can('expenses.create')} onClose={() => setFinalizing(false)} onDone={after} />}
      <ConfirmDialog
        open={reopening}
        onClose={() => setReopening(false)}
        onConfirm={() => reopen.mutate()}
        title={t('staff.reopen')}
        message={run.expenseId ? t('staff.reopen_with_expense') : t('staff.reopen_body')}
        loading={reopen.isPending}
      />
      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={() => del.mutate()}
        title={t('staff.delete_sheet')}
        message={t('staff.delete_sheet_body')}
        confirmLabel={t('common.delete')}
        danger
        loading={del.isPending}
      />
    </div>
  );
}

function FinalizeDialog({ run, canExpense, onClose, onDone }: { run: PayrollRun; canExpense: boolean; onClose: () => void; onDone: (r: PayrollRun) => void }) {
  const { t } = useTranslation();
  const money = useMoney();
  const errMsg = useErrorMessage();
  const [addToExpenses, setAdd] = useState(canExpense);
  const [paymentMethod, setMethod] = useState('bank_transfer');
  const fin = useMutation({
    mutationFn: () => api.post<PayrollRun>(`/payroll/${run.id}/finalize`, { addToExpenses: canExpense && addToExpenses, paymentMethod }),
    onSuccess: (r) => {
      toast.success(t('staff.finalized_toast'));
      onDone(r);
      onClose();
    },
  });
  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      title={t('staff.finalize')}
      footer={
        <Button icon={<Lock className="size-4" />} onClick={() => fin.mutate()} loading={fin.isPending}>
          {t('staff.finalize')}
        </Button>
      }
    >
      <div className="space-y-4">
        {fin.error && <Alert tone="red">{errMsg(fin.error)}</Alert>}
        <div className="rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-800/50">
          <p className="text-sm text-slate-500">{t('staff.total_net_pay')}</p>
          <p className="text-2xl font-bold tabular-nums">{money(run.totalNet)}</p>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300">{t('staff.finalize_body')}</p>
        {canExpense && run.totalNet > 0 && (
          <>
            <Switch checked={addToExpenses} onChange={setAdd} label={t('staff.add_to_expenses')} description={t('staff.add_to_expenses_hint')} />
            {addToExpenses && (
              <Select label={t('payments.method')} value={paymentMethod} onChange={(e) => setMethod(e.target.value)}>
                {['bank_transfer', 'cash', 'card', 'other'].map((m) => (
                  <option key={m} value={m}>
                    {t(`payment_methods.${m}`)}
                  </option>
                ))}
              </Select>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}
