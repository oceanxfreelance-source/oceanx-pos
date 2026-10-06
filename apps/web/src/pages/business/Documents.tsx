import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowRightLeft, FileText, Plus, Printer, Send, Trash2 } from 'lucide-react';
import { calculateTotals, toMinor } from '@oceanx/shared';
import { api, ApiError } from '../../lib/api';
import { useBiz, useBizSession } from '../../auth/business';
import { useFormat } from '../../lib/format';
import { parseAmount, useMoney } from '../../lib/money';
import { useList } from '../../lib/useList';
import { useErrorMessage, useFieldErrors, useToastError } from '../../lib/useApiError';
import { Alert, Card, CardHeader, EmptyState, Ltr, PageHeader, SkeletonRows, StatCard } from '../../components/ui/Card';
import { Button, IconButton } from '../../components/ui/Button';
import { Input, Select, Textarea } from '../../components/ui/Form';
import { ConfirmDialog, Dialog } from '../../components/ui/Dialog';
import { DataTable, Pagination, type Column } from '../../components/ui/Table';
import { ListToolbar } from '../../components/ListToolbar';
import { StatusBadge } from '../../components/StatusBadge';
import { CustomerPicker, ProductPicker } from '../../components/Pickers';

export type DocKind = 'quotation' | 'invoice';
const plural = (k: DocKind) => (k === 'quotation' ? 'quotations' : 'invoices');
const STATUSES: Record<DocKind, string[]> = {
  quotation: ['draft', 'sent', 'accepted', 'rejected', 'expired', 'converted', 'cancelled'],
  invoice: ['draft', 'issued', 'partially_paid', 'paid', 'overdue', 'unpaid', 'void', 'cancelled'],
};

interface DocRow {
  id: string;
  number: string;
  status: string;
  customerName: string;
  salespersonName: string | null;
  total: number;
  balanceDue?: number;
  quotationDate?: string;
  validUntil?: string;
  invoiceDate?: string;
  dueDate?: string;
}

// ================================================================== list
export function DocumentListPage({ kind }: { kind: DocKind }) {
  const { t } = useTranslation();
  const { can } = useBiz();
  const money = useMoney();
  const f = useFormat();
  const navigate = useNavigate();
  const p = plural(kind);
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const { query, page, setPage, search, setSearch, pageSize } = useList<DocRow>(p, `/${p}`, { status, from, to });
  const summary = query.data?.summary as { outstanding: number; overdue: number } | undefined;
  const columns: Column<DocRow>[] = [
    { key: 'n', header: t('documents.number'), cell: (d) => <Ltr className="font-medium">{d.number}</Ltr> },
    { key: 'c', header: t('customers.customer'), cell: (d) => <span dir="auto">{d.customerName}</span> },
    { key: 's', header: t('common.status'), cell: (d) => <StatusBadge status={d.status} /> },
    { key: 'd', header: t('common.date'), hideOnMobile: true, cell: (d) => f.date(d.quotationDate ?? d.invoiceDate) },
    { key: 'v', header: t(kind === 'quotation' ? 'quotations.valid_until' : 'invoices.due_date'), hideOnMobile: true, cell: (d) => f.date(d.validUntil ?? d.dueDate) },
    {
      key: 't',
      header: t(kind === 'invoice' ? 'credit.balance_due' : 'documents.total'),
      className: 'text-end',
      cell: (d) => (
        <span className="font-semibold tabular-nums">
          {money(kind === 'invoice' && d.status !== 'draft' ? (d.balanceDue ?? 0) : d.total)}
        </span>
      ),
    },
  ];
  return (
    <div className="space-y-6">
      <PageHeader
        title={t(`${p}.title`)}
        description={t(`${p}.subtitle`)}
        actions={
          can(`${p}.create`) && (
            <Link to={`/${p}/new`}>
              <Button icon={<Plus className="size-4" />}>{t(`${p}.create`)}</Button>
            </Link>
          )
        }
      />
      {summary && (
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard label={t('credit.outstanding')} value={money(summary.outstanding)} />
          <StatCard label={t('status_labels.overdue')} value={money(summary.overdue)} tone={summary.overdue > 0 ? 'red' : 'green'} />
        </div>
      )}
      <Card padded={false}>
        <ListToolbar search={search} onSearch={setSearch} placeholder={t('documents.search')}>
          <Select label={t('common.status')} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{t('common.all')}</option>
            {STATUSES[kind].map((s) => (
              <option key={s} value={s}>
                {t(`status_labels.${s}`)}
              </option>
            ))}
          </Select>
          <Input type="date" label={t('common.from')} value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" label={t('common.to')} value={to} onChange={(e) => setTo(e.target.value)} />
        </ListToolbar>
        {query.isLoading ? (
          <SkeletonRows />
        ) : !query.data?.items.length ? (
          <EmptyState icon={<FileText className="size-6" />} title={t(`${p}.empty_title`)} description={t(`${p}.empty_body`)} />
        ) : (
          <>
            <DataTable columns={columns} rows={query.data.items} rowKey={(d) => d.id} onRowClick={(d) => navigate(`/${p}/${d.id}`)} />
            <Pagination page={page} pageSize={pageSize} total={query.data.total} onPage={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}

// ================================================================== editor
interface ItemDraft {
  key: number;
  productId: string | null;
  name: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  discount: string;
  taxRate: number | null;
}
interface DocDetail {
  customer: { id: string; name: string; email: string; phone: string };
  items: { id: string; productId: string | null; itemNameSnapshot: string; description: string; quantity: number; unit: string; unitPrice: number; discount: number; taxRate: number | null; tax: number; total: number }[];
  quotation?: Record<string, never> & DocFields;
  invoice?: Record<string, never> & DocFields;
  payments?: { id: string; method: string; amount: number; reference: string; paidAt: string; receivedByName: string | null }[];
  invoice_link?: never;
  documentLanguage: string;
}
interface DocFields {
  id: string;
  number: string;
  status: string;
  quotationDate: string;
  validUntil: string;
  invoiceDate: string;
  dueDate: string;
  language: string | null;
  notes: string;
  terms: string;
  orderDiscount: number;
  subtotal: number;
  discount: number;
  serviceCharge: number;
  tax: number;
  total: number;
  paidAmount: number;
  balanceDue: number;
  salespersonName: string | null;
  voidReason: string | null;
  sourceQuotationId: string | null;
}

let keySeq = 1;
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const plusDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export function DocumentEditorPage({ kind }: { kind: DocKind }) {
  const { id } = useParams<{ id: string }>();
  const p = plural(kind);
  const existing = useQuery({ queryKey: ['biz', kind, id], queryFn: () => api.get<DocDetail>(`/${p}/${id}`), enabled: !!id });
  if (id && !existing.data) return <SkeletonRows rows={8} />;
  return <DocumentEditor kind={kind} detail={existing.data ?? null} />;
}

function DocumentEditor({ kind, detail }: { kind: DocKind; detail: DocDetail | null }) {
  const { t } = useTranslation();
  const session = useBizSession();
  const money = useMoney();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const errMsg = useErrorMessage();
  const p = plural(kind);
  const doc = detail ? (kind === 'quotation' ? detail.quotation! : detail.invoice!) : null;
  const today = todayIso();
  const [customer, setCustomer] = useState<{ id: string; name: string } | null>(detail ? { id: detail.customer.id, name: detail.customer.name } : null);
  const [head, setHead] = useState({
    date: doc ? (kind === 'quotation' ? doc.quotationDate : doc.invoiceDate) : today,
    until: doc ? (kind === 'quotation' ? doc.validUntil : doc.dueDate) : plusDays(today, kind === 'quotation' ? 30 : 14),
    language: doc?.language ?? '',
    discount: doc ? String(doc.orderDiscount / 100) : '0',
    notes: doc?.notes ?? '',
    terms: doc?.terms ?? '',
  });
  const [items, setItems] = useState<ItemDraft[]>(
    detail?.items.map((i) => ({
      key: keySeq++,
      productId: i.productId,
      name: i.itemNameSnapshot,
      description: i.description,
      quantity: String(i.quantity),
      unit: i.unit,
      unitPrice: String(i.unitPrice / 100),
      discount: String(i.discount / 100),
      taxRate: i.taxRate,
    })) ?? [],
  );
  const upd = (k: number, patch: Partial<ItemDraft>) => setItems((xs) => xs.map((x) => (x.key === k ? { ...x, ...patch } : x)));
  const addBlank = () => setItems((xs) => [...xs, { key: keySeq++, productId: null, name: '', description: '', quantity: '1', unit: 'pcs', unitPrice: '0', discount: '0', taxRate: null }]);

  // Live preview only — the server recalculates every total on save.
  const preview = useMemo(() => {
    try {
      return calculateTotals(
        items.map((i) => ({ quantity: parseAmount(i.quantity), unitPrice: toMinor(parseAmount(i.unitPrice)), discount: toMinor(parseAmount(i.discount)), taxRate: i.taxRate })),
        session.tax,
        toMinor(parseAmount(head.discount)),
      );
    } catch {
      return null;
    }
  }, [items, head.discount, session.tax]);

  const save = useMutation({
    mutationFn: () => {
      const body = {
        customerId: customer?.id,
        [kind === 'quotation' ? 'quotationDate' : 'invoiceDate']: head.date,
        [kind === 'quotation' ? 'validUntil' : 'dueDate']: head.until,
        language: head.language || null,
        discount: parseAmount(head.discount),
        notes: head.notes,
        terms: head.terms,
        items: items.map((i) => ({ productId: i.productId, name: i.name, description: i.description, quantity: parseAmount(i.quantity), unit: i.unit || 'pcs', unitPrice: parseAmount(i.unitPrice), discount: parseAmount(i.discount), taxRate: i.taxRate })),
      };
      return doc ? api.put<{ id: string }>(`/${p}/${doc.id}`, body) : api.post<{ id: string }>(`/${p}`, body);
    },
    onSuccess: (r) => {
      toast.success(t('common.saved'));
      void qc.invalidateQueries({ queryKey: ['biz', p] });
      void qc.invalidateQueries({ queryKey: ['biz', kind] });
      navigate(`/${p}/${doc?.id ?? r.id}`);
    },
  });
  const fe = useFieldErrors(save.error);
  return (
    <div className="space-y-6">
      <PageHeader title={doc ? <Ltr>{doc.number}</Ltr> : t(`${p}.create`)} back={<Link to={doc ? `/${p}/${doc.id}` : `/${p}`}>{t('common.back')}</Link>} />
      {save.error && !(save.error instanceof ApiError && save.error.code === 'validation_failed') && <Alert tone="red">{errMsg(save.error)}</Alert>}
      <Card>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <CustomerPicker label={t('customers.customer')} value={customer?.id ?? null} valueLabel={customer?.name} onChange={(id, c) => setCustomer(id && c ? { id, name: c.name } : null)} error={fe('customerId')} />
          </div>
          <Input type="date" label={t('common.date')} value={head.date} onChange={(e) => setHead({ ...head, date: e.target.value })} error={fe(kind === 'quotation' ? 'quotationDate' : 'invoiceDate')} />
          <Input type="date" label={t(kind === 'quotation' ? 'quotations.valid_until' : 'invoices.due_date')} value={head.until} onChange={(e) => setHead({ ...head, until: e.target.value })} error={fe(kind === 'quotation' ? 'validUntil' : 'dueDate')} />
          <Select label={t('documents.language')} hint={t('documents.language_hint')} value={head.language} onChange={(e) => setHead({ ...head, language: e.target.value })}>
            <option value="">{t('settings.use_default_document_language')}</option>
            {session.languages.map((l) => (
              <option key={l.code} value={l.code}>
                {l.nativeName}
              </option>
            ))}
          </Select>
        </div>
      </Card>
      <Card padded={false}>
        <CardHeader title={t('documents.items')} />
        <div className="space-y-3 p-4">
          {items.length === 0 && <p className="text-sm text-slate-500">{t('documents.no_items')}</p>}
          {fe('items') && <p className="text-sm text-rose-600">{fe('items')}</p>}
          {items.map((i, idx) => (
            <div key={i.key} className="grid gap-2 rounded-xl p-3 ring-1 ring-slate-200 sm:grid-cols-12 dark:ring-slate-700">
              <Input className="sm:col-span-4" label={idx === 0 ? t('documents.item') : undefined} aria-label={t('documents.item')} value={i.name} onChange={(e) => upd(i.key, { name: e.target.value })} />
              <Input className="sm:col-span-2" type="number" min={0} step="0.001" label={idx === 0 ? t('documents.quantity') : undefined} aria-label={t('documents.quantity')} value={i.quantity} onChange={(e) => upd(i.key, { quantity: e.target.value })} />
              <Input className="sm:col-span-2" type="number" min={0} step="0.01" label={idx === 0 ? t('documents.unit_price') : undefined} aria-label={t('documents.unit_price')} value={i.unitPrice} onChange={(e) => upd(i.key, { unitPrice: e.target.value })} />
              <Input className="sm:col-span-2" type="number" min={0} step="0.01" label={idx === 0 ? t('documents.discount') : undefined} aria-label={t('documents.discount')} value={i.discount} onChange={(e) => upd(i.key, { discount: e.target.value })} />
              <div className="flex items-end justify-between gap-2 sm:col-span-2">
                <span className="py-2.5 text-sm font-semibold tabular-nums">{preview?.lines[idx] ? money(preview.lines[idx].total) : '—'}</span>
                <IconButton label={t('common.delete')} onClick={() => setItems((xs) => xs.filter((x) => x.key !== i.key))}>
                  <Trash2 className="size-4" />
                </IconButton>
              </div>
              <Input className="sm:col-span-12" placeholder={t('documents.item_description')} aria-label={t('documents.item_description')} value={i.description} onChange={(e) => upd(i.key, { description: e.target.value })} />
            </div>
          ))}
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <ProductPicker
              value={null}
              placeholder={t('documents.add_product')}
              onChange={(_id, pr) =>
                pr &&
                setItems((xs) => [...xs, { key: keySeq++, productId: pr.id, name: pr.name, description: '', quantity: '1', unit: pr.unit, unitPrice: String(pr.sellingPrice / 100), discount: '0', taxRate: pr.taxRate }])
              }
            />
            <Button variant="secondary" icon={<Plus className="size-4" />} onClick={addBlank}>
              {t('documents.add_custom_item')}
            </Button>
          </div>
        </div>
      </Card>
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card>
          <div className="space-y-4">
            <Textarea label={t('documents.notes')} value={head.notes} onChange={(e) => setHead({ ...head, notes: e.target.value })} />
            <Textarea label={t('documents.terms')} value={head.terms} onChange={(e) => setHead({ ...head, terms: e.target.value })} />
          </div>
        </Card>
        <Card>
          <div className="space-y-3 text-sm">
            <Input type="number" min={0} step="0.01" label={t('documents.order_discount')} value={head.discount} onChange={(e) => setHead({ ...head, discount: e.target.value })} error={fe('discount')} />
            {preview && (
              <dl className="space-y-1">
                <Line l={t('documents.subtotal')} v={money(preview.subtotal)} />
                {preview.discount > 0 && <Line l={t('documents.discount')} v={`− ${money(preview.discount)}`} />}
                {preview.serviceCharge > 0 && <Line l={t('documents.service_charge')} v={money(preview.serviceCharge)} />}
                {preview.tax > 0 && <Line l={t('documents.tax')} v={money(preview.tax)} />}
                <Line l={t('documents.total')} v={money(preview.total)} bold />
              </dl>
            )}
            <p className="text-xs text-slate-500">{t('documents.server_totals_hint')}</p>
            <Button className="w-full" onClick={() => save.mutate()} loading={save.isPending} disabled={!customer || items.length === 0 || items.some((i) => !i.name.trim())}>
              {t('common.save')}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Line({ l, v, bold }: { l: React.ReactNode; v: React.ReactNode; bold?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${bold ? 'border-t border-slate-200 pt-2 text-base font-semibold dark:border-slate-700' : ''}`}>
      <dt className="text-slate-600 dark:text-slate-300">{l}</dt>
      <dd className="tabular-nums">{v}</dd>
    </div>
  );
}

// ================================================================== detail
export function DocumentDetailPage({ kind }: { kind: DocKind }) {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { can } = useBiz();
  const money = useMoney();
  const f = useFormat();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toastErr = useToastError();
  const p = plural(kind);
  const q = useQuery({ queryKey: ['biz', kind, id], queryFn: () => api.get<DocDetail & { invoice?: DocFields; quotation?: DocFields | { id: string; number: string } | null }>(`/${p}/${id}`) });
  const [confirm, setConfirm] = useState<null | { action: string; danger?: boolean }>(null);
  const [voiding, setVoiding] = useState(false);
  const [reason, setReason] = useState('');
  const [paying, setPaying] = useState(false);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['biz', kind, id] });
    void qc.invalidateQueries({ queryKey: ['biz', p] });
  };
  const act = useMutation({
    mutationFn: async (action: string) => {
      if (action === 'delete') return api.delete(`/${p}/${id}`);
      if (action === 'void') return api.post(`/${p}/${id}/void`, { reason });
      return api.post<{ id?: string; emailed?: boolean }>(`/${p}/${id}/${action}`, {});
    },
    onSuccess: (r, action) => {
      setConfirm(null);
      setVoiding(false);
      if (action === 'delete') {
        toast.success(t('common.deleted'));
        void qc.invalidateQueries({ queryKey: ['biz', p] });
        navigate(`/${p}`);
        return;
      }
      if (action === 'convert') {
        toast.success(t('quotations.converted'));
        void qc.invalidateQueries({ queryKey: ['biz', 'invoices'] });
        navigate(`/invoices/${(r as { id: string }).id}`);
        return;
      }
      if (action === 'send') toast.success(kind === 'invoice' || (r as { emailed?: boolean })?.emailed ? t('documents.emailed') : t('documents.marked_sent'));
      else toast.success(t(`documents.actions_done.${action}`));
      refresh();
    },
    onError: toastErr,
  });
  if (!q.data) return <SkeletonRows rows={8} />;
  const d = q.data;
  const doc = (kind === 'quotation' ? d.quotation : d.invoice) as DocFields;
  const linkedInvoice = kind === 'quotation' ? (d as unknown as { invoice: { id: string; number: string } | null }).invoice : null;
  const linkedQuote = kind === 'invoice' ? (d as unknown as { quotation: { id: string; number: string } | null }).quotation : null;
  const st = doc.status;
  const actions: { key: string; label: string; perm: string; show: boolean; primary?: boolean; danger?: boolean; icon?: React.ReactNode }[] =
    kind === 'quotation'
      ? [
          { key: 'edit', label: t('common.edit'), perm: 'quotations.edit', show: st === 'draft' || st === 'sent' },
          { key: 'send', label: t('documents.send'), perm: 'quotations.send', show: st === 'draft' || st === 'sent', icon: <Send className="size-4" /> },
          { key: 'accept', label: t('quotations.accept'), perm: 'quotations.edit', show: st === 'draft' || st === 'sent' },
          { key: 'reject', label: t('quotations.reject'), perm: 'quotations.edit', show: st === 'draft' || st === 'sent' },
          { key: 'convert', label: t('quotations.convert'), perm: 'quotations.convert_to_invoice', show: st === 'accepted', primary: true, icon: <ArrowRightLeft className="size-4" /> },
          { key: 'cancel', label: t('common.cancel_document'), perm: 'quotations.edit', show: ['draft', 'sent', 'accepted'].includes(st), danger: true },
          { key: 'delete', label: t('common.delete'), perm: 'quotations.delete', show: st === 'draft', danger: true },
        ]
      : [
          { key: 'edit', label: t('common.edit'), perm: 'invoices.edit', show: st === 'draft' },
          { key: 'issue', label: t('invoices.issue'), perm: 'invoices.edit', show: st === 'draft', primary: true },
          { key: 'pay', label: t('invoices.record_payment'), perm: 'invoices.payment', show: ['issued', 'partially_paid', 'overdue'].includes(st), primary: true },
          { key: 'send', label: t('documents.send'), perm: 'invoices.send', show: ['issued', 'partially_paid', 'overdue', 'paid'].includes(st), icon: <Send className="size-4" /> },
          { key: 'cancel', label: t('common.cancel_document'), perm: 'invoices.edit', show: st === 'draft', danger: true },
          { key: 'void', label: t('sales.void'), perm: 'invoices.void', show: ['issued', 'partially_paid', 'overdue', 'paid'].includes(st) && doc.paidAmount === 0, danger: true },
          { key: 'delete', label: t('common.delete'), perm: 'invoices.delete', show: st === 'draft' || st === 'cancelled', danger: true },
        ];
  const onAction = (key: string, danger?: boolean) => {
    if (key === 'edit') return navigate(`/${p}/${id}/edit`);
    if (key === 'pay') return setPaying(true);
    if (key === 'void') return setVoiding(true);
    setConfirm({ action: key, danger });
  };
  return (
    <div className="space-y-6">
      <PageHeader
        back={<Link to={`/${p}`}>{t(`${p}.title`)}</Link>}
        title={
          <span className="flex items-center gap-3">
            <Ltr>{doc.number}</Ltr> <StatusBadge status={st} />
          </span>
        }
        description={
          <span dir="auto">
            {d.customer.name} · {f.date(kind === 'quotation' ? doc.quotationDate : doc.invoiceDate)}
          </span>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={<Printer className="size-4" />} onClick={() => window.open(`/print/${kind}/${id}`, '_blank', 'noopener')}>
              {t('print.print')}
            </Button>
            {actions
              .filter((a) => a.show && can(a.perm))
              .map((a) => (
                <Button key={a.key} variant={a.primary ? 'primary' : a.danger ? 'ghost' : 'secondary'} className={a.danger ? 'text-rose-600' : undefined} icon={a.icon} onClick={() => onAction(a.key, a.danger)}>
                  {a.label}
                </Button>
              ))}
          </div>
        }
      />
      {linkedInvoice && (
        <Alert tone="violet">
          {t('quotations.converted_to')} <Link className="font-semibold underline" to={`/invoices/${linkedInvoice.id}`}><Ltr>{linkedInvoice.number}</Ltr></Link>
        </Alert>
      )}
      {linkedQuote && (
        <Alert tone="blue">
          {t('invoices.from_quotation')} <Link className="font-semibold underline" to={`/quotations/${linkedQuote.id}`}><Ltr>{linkedQuote.number}</Ltr></Link>
        </Alert>
      )}
      {doc.voidReason && <Alert tone="red">{doc.voidReason}</Alert>}
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card padded={false}>
          <DataTable
            columns={[
              { key: 'n', header: t('documents.item'), cell: (i) => <div><p dir="auto" className="font-medium">{i.itemNameSnapshot}</p>{i.description && <p className="text-xs text-slate-500" dir="auto">{i.description}</p>}</div> },
              { key: 'q', header: t('documents.quantity'), cell: (i) => <Ltr>{`${Number(i.quantity)} ${i.unit}`}</Ltr> },
              { key: 'u', header: t('documents.unit_price'), hideOnMobile: true, cell: (i) => money(i.unitPrice) },
              { key: 'd', header: t('documents.discount'), hideOnMobile: true, cell: (i) => (i.discount ? money(i.discount) : '—') },
              { key: 't', header: t('documents.total'), className: 'text-end', cell: (i) => <span className="font-semibold tabular-nums">{money(i.total)}</span> },
            ]}
            rows={d.items}
            rowKey={(i) => i.id}
          />
          {(doc.notes || doc.terms) && (
            <div className="grid gap-4 border-t border-slate-100 p-5 text-sm sm:grid-cols-2 dark:border-slate-800">
              {doc.notes && <div><p className="font-medium">{t('documents.notes')}</p><p className="whitespace-pre-line text-slate-600 dark:text-slate-300" dir="auto">{doc.notes}</p></div>}
              {doc.terms && <div><p className="font-medium">{t('documents.terms')}</p><p className="whitespace-pre-line text-slate-600 dark:text-slate-300" dir="auto">{doc.terms}</p></div>}
            </div>
          )}
        </Card>
        <div className="space-y-6">
          <Card>
            <dl className="space-y-1 text-sm">
              <Line l={t('documents.subtotal')} v={money(doc.subtotal)} />
              {doc.discount > 0 && <Line l={t('documents.discount')} v={`− ${money(doc.discount)}`} />}
              {doc.serviceCharge > 0 && <Line l={t('documents.service_charge')} v={money(doc.serviceCharge)} />}
              {doc.tax > 0 && <Line l={t('documents.tax')} v={money(doc.tax)} />}
              <Line l={t('documents.total')} v={money(doc.total)} bold />
              {kind === 'invoice' && (
                <>
                  <Line l={t('invoices.paid')} v={money(doc.paidAmount)} />
                  <Line l={t('credit.balance_due')} v={money(doc.balanceDue)} bold />
                </>
              )}
            </dl>
            <dl className="mt-4 space-y-1 border-t border-slate-100 pt-3 text-sm dark:border-slate-800">
              <Line l={t(kind === 'quotation' ? 'quotations.valid_until' : 'invoices.due_date')} v={f.date(kind === 'quotation' ? doc.validUntil : doc.dueDate)} />
              {doc.salespersonName && <Line l={t('documents.salesperson')} v={<span dir="auto">{doc.salespersonName}</span>} />}
              <Line l={t('documents.language')} v={d.documentLanguage.toUpperCase()} />
            </dl>
          </Card>
          {kind === 'invoice' && d.payments && (
            <Card>
              <p className="mb-2 text-sm font-semibold">{t('payments.title')}</p>
              {d.payments.length === 0 ? (
                <p className="text-sm text-slate-400">{t('invoices.no_payments')}</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {d.payments.map((x) => (
                    <li key={x.id} className="flex justify-between gap-2">
                      <span>
                        {t(`payment_methods.${x.method}`)}
                        <span className="block text-xs text-slate-500">
                          {f.dateTime(x.paidAt)} {x.reference && <Ltr>· {x.reference}</Ltr>}
                        </span>
                      </span>
                      <span className="font-semibold tabular-nums">{money(x.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && act.mutate(confirm.action)}
        loading={act.isPending}
        danger={confirm?.danger}
        title={confirm ? t(`documents.confirm.${confirm.action}_title`) : ''}
        message={confirm ? t(`documents.confirm.${confirm.action}_body`, { number: doc.number, email: d.customer.email || '—' }) : ''}
        confirmLabel={t('common.confirm')}
      />
      <Dialog
        open={voiding}
        onClose={() => setVoiding(false)}
        size="sm"
        title={t('invoices.void_title')}
        footer={
          <Button variant="danger" onClick={() => act.mutate('void')} loading={act.isPending} disabled={reason.trim().length < 3}>
            {t('sales.void')}
          </Button>
        }
      >
        <Textarea label={t('sales.void_reason')} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Dialog>
      {paying && <InvoicePaymentDialog id={id!} balance={doc.balanceDue} onClose={() => setPaying(false)} onDone={refresh} />}
    </div>
  );
}

function InvoicePaymentDialog({ id, balance, onClose, onDone }: { id: string; balance: number; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation();
  const money = useMoney();
  const errMsg = useErrorMessage();
  const [form, setForm] = useState({ method: 'bank_transfer', amount: (balance / 100).toFixed(2), reference: '', notes: '' });
  const pay = useMutation({
    mutationFn: () => api.post(`/invoices/${id}/payments`, { ...form, amount: parseAmount(form.amount) }),
    onSuccess: () => {
      toast.success(t('invoices.payment_recorded'));
      onDone();
      onClose();
    },
  });
  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      title={t('invoices.record_payment')}
      description={`${t('credit.balance_due')}: ${money(balance)}`}
      footer={
        <Button onClick={() => pay.mutate()} loading={pay.isPending} disabled={parseAmount(form.amount) <= 0}>
          {t('common.save')}
        </Button>
      }
    >
      <div className="space-y-4">
        {pay.error && <Alert tone="red">{errMsg(pay.error)}</Alert>}
        <Select label={t('payments.method')} value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
          {['cash', 'card', 'bank_transfer', 'other'].map((m) => (
            <option key={m} value={m}>
              {t(`payment_methods.${m}`)}
            </option>
          ))}
        </Select>
        <Input label={t('payments.amount')} type="number" min={0} step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        <Input label={t('payments.reference')} value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
        <Textarea label={t('common.notes')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </div>
    </Dialog>
  );
}
