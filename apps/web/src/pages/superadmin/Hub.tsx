import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import clsx from 'clsx';
import {
  Banknote,
  Briefcase,
  Building2,
  CreditCard,
  FolderKanban,
  Gauge,
  Layers,
  Pencil,
  Puzzle,
  CheckCircle2,
  FileText,
  Headset,
  ListTodo,
  Plus,
  Printer,
  Receipt,
  Store,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  HUB_CLIENT_KINDS,
  HUB_LEAD_SOURCES,
  HUB_LEAD_STATUSES,
  HUB_PAYMENT_METHODS,
  HUB_PRIORITIES,
  HUB_PROJECT_STATUSES,
  HUB_SERVICE_CATEGORIES,
  HUB_TICKET_CHANNELS,
  HUB_TICKET_STATUSES,
  HUB_VENTURE_COLORS,
} from '@oceanx/shared';
import { saApi, ApiError } from '../../lib/api';
import { useFormat } from '../../lib/format';
import { parseAmount } from '../../lib/money';
import { useErrorMessage, useFieldErrors, useToastError } from '../../lib/useApiError';
import { useSuperAdmin } from '../../auth/superadmin';
import { Alert, Badge, Card, EmptyState, Ltr, PageHeader, SkeletonRows, StatCard, type BadgeTone } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select, Textarea } from '../../components/ui/Form';
import { ConfirmDialog, Dialog } from '../../components/ui/Dialog';
import { DataTable, type Column } from '../../components/ui/Table';
import { Tabs } from '../../components/ui/Tabs';
import { ListToolbar } from '../../components/ListToolbar';
import { fmtAmount } from '../business/Billing';
import { VENTURE_TONE, useVentures, type Venture } from './hubVentures';

// ---------------------------------------------------------------- shared
/** Where a Hub page is: the main office (everything) or inside one project (only its work). */
export function useHubCtx() {
  const { ventureId } = useParams<{ ventureId?: string }>();
  const ventures = useVentures();
  const venture = ventures.find((v) => v.id === ventureId) ?? null;
  const base = ventureId ? `/superadmin/p/${ventureId}` : '/superadmin/hub';
  const qs = (params: Record<string, string | undefined> = {}) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) u.set(k, v);
    if (ventureId) u.set('ventureId', ventureId);
    const str = u.toString();
    return str ? `?${str}` : '';
  };
  return { ventureId: ventureId ?? null, venture, base, qs, ventures };
}
function VentureSelect({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const { t } = useTranslation();
  const ventures = useVentures().filter((v) => v.isActive || v.id === value);
  return (
    <Select label={t('hub.ventures.project')} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">{t('hub.ventures.general')}</option>
      {ventures.map((v) => (
        <option key={v.id} value={v.id}>
          {v.name}
        </option>
      ))}
    </Select>
  );
}
function VentureBadge({ id }: { id: string | null }) {
  const v = useVentures().find((x) => x.id === id);
  if (!v) return <>—</>;
  return <Badge tone={(VENTURE_TONE[v.color] ?? VENTURE_TONE.blue!).tone}>{v.name}</Badge>;
}

interface TeamMember {
  id: string;
  name: string;
}
interface Overview {
  currency: string;
  leadsOpen: number;
  followUpsDue: number;
  clients: number;
  projectsActive: number;
  myOpenTasks: number;
  openTasks: number;
  ticketsOpen: number;
  ticketsUrgent: number;
  invoicesUnpaid: number;
  amountDue: number;
  receivedThisMonth: number;
  posBusinessesActive: number | null;
  posPaymentsPending: number | null;
  gravityAccountsActive: number | null;
}
interface Service {
  id: string;
  ventureId: string | null;
  name: string;
  category: string;
  description: string;
  unit: string;
  price: number;
  isActive: boolean;
}
interface Client {
  id: string;
  ventureId: string | null;
  name: string;
  company: string;
  kind: string;
  phone: string;
  email: string;
  address: string;
  taxNumber: string;
  notes: string;
  businessId: string | null;
  businessName?: string | null;
  amountDue?: number;
  openProjects?: number;
}
interface Lead {
  id: string;
  ventureId: string | null;
  name: string;
  company: string;
  phone: string;
  email: string;
  source: string;
  serviceId: string | null;
  serviceName: string | null;
  interest: string;
  status: string;
  nextFollowUp: string | null;
  assignedTo: string | null;
  assignedName: string | null;
  notes: string;
  clientId: string | null;
}
interface Project {
  id: string;
  ventureId: string | null;
  title: string;
  clientId: string | null;
  clientName: string | null;
  serviceId: string | null;
  description: string;
  status: string;
  startDate: string | null;
  dueDate: string | null;
  value: number;
  assignedTo: string | null;
  assignedName: string | null;
  tasksOpen: number;
  tasksDone: number;
}
interface Task {
  id: string;
  ventureId: string | null;
  title: string;
  projectId: string | null;
  projectTitle: string | null;
  notes: string;
  status: string;
  priority: string;
  dueDate: string | null;
  assignedTo: string | null;
  assignedName: string | null;
}
interface Ticket {
  id: string;
  ventureId: string | null;
  number: string;
  subject: string;
  description: string;
  clientId: string | null;
  clientName: string | null;
  businessId: string | null;
  businessName: string | null;
  channel: string;
  priority: string;
  status: string;
  assignedTo: string | null;
  assignedName: string | null;
  createdAt: string;
}
interface DocRow {
  id: string;
  ventureId: string | null;
  kind: 'quote' | 'invoice';
  number: string;
  clientId: string;
  clientName: string;
  issueDate: string;
  dueDate: string | null;
  status: string;
  currency: string;
  total: number;
  paidAmount: number;
}

const today = () => new Date().toISOString().slice(0, 10);
const LEAD_TONE: Record<string, BadgeTone> = { new: 'blue', contacted: 'violet', demo: 'amber', proposal: 'amber', won: 'green', lost: 'gray' };
const PROJECT_TONE: Record<string, BadgeTone> = { planned: 'gray', in_progress: 'blue', review: 'amber', done: 'green', cancelled: 'gray' };
const PRIORITY_TONE: Record<string, BadgeTone> = { low: 'gray', normal: 'blue', high: 'amber', urgent: 'red' };
const TICKET_TONE: Record<string, BadgeTone> = { open: 'red', in_progress: 'blue', waiting: 'amber', resolved: 'green', closed: 'gray' };
const DOC_TONE: Record<string, BadgeTone> = { draft: 'gray', sent: 'blue', accepted: 'green', rejected: 'red', converted: 'violet', issued: 'blue', partially_paid: 'amber', paid: 'green', void: 'gray' };

function useCurrency() {
  const q = useQuery({ queryKey: ['sa', 'hub', 'overview', 'all'], queryFn: () => saApi.get<Overview>('/hub/overview'), staleTime: 60_000 });
  return q.data?.currency ?? 'MVR';
}
function useTeam() {
  return useQuery({ queryKey: ['sa', 'hub', 'team'], queryFn: () => saApi.get<{ items: TeamMember[] }>('/hub/team'), staleTime: 300_000 }).data?.items ?? [];
}
function useClients() {
  return useQuery({ queryKey: ['sa', 'hub', 'clients', ''], queryFn: () => saApi.get<{ items: Client[] }>('/hub/clients') }).data?.items ?? [];
}
function useServices() {
  return useQuery({ queryKey: ['sa', 'hub', 'services'], queryFn: () => saApi.get<{ items: Service[] }>('/hub/services') }).data?.items ?? [];
}
const invalidateHub = (qc: ReturnType<typeof useQueryClient>) => void qc.invalidateQueries({ queryKey: ['sa', 'hub'] });
const overdue = (d: string | null) => !!d && d < today();

function TeamSelect({ value, onChange, label }: { value: string | null; onChange: (v: string | null) => void; label?: string }) {
  const { t } = useTranslation();
  const team = useTeam();
  return (
    <Select label={label ?? t('hub.assigned_to')} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">{t('hub.unassigned')}</option>
      {team.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </Select>
  );
}
function ClientSelect({ value, onChange, required }: { value: string | null; onChange: (v: string | null) => void; required?: boolean }) {
  const { t } = useTranslation();
  const clients = useClients();
  return (
    <Select label={t('hub.client')} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} required={required}>
      <option value="">{required ? t('hub.choose_client') : t('hub.no_client')}</option>
      {clients.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
          {c.company ? ` · ${c.company}` : ''}
        </option>
      ))}
    </Select>
  );
}
function ServiceSelect({ value, onChange, label }: { value: string | null; onChange: (v: string | null, s: Service | null) => void; label?: string }) {
  const { t } = useTranslation();
  const services = useServices().filter((s) => s.isActive || s.id === value);
  return (
    <Select label={label ?? t('hub.service')} value={value ?? ''} onChange={(e) => onChange(e.target.value || null, services.find((s) => s.id === e.target.value) ?? null)}>
      <option value="">{t('hub.no_service')}</option>
      {services.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </Select>
  );
}
function SaveFooter({ onCancel, onSave, saving, disabled, extra }: { onCancel: () => void; onSave: () => void; saving: boolean; disabled?: boolean; extra?: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <>
      {extra}
      <Button variant="secondary" onClick={onCancel}>
        {t('common.cancel')}
      </Button>
      <Button onClick={onSave} loading={saving} disabled={disabled}>
        {t('common.save')}
      </Button>
    </>
  );
}
function FormError({ error }: { error: unknown }) {
  const errMsg = useErrorMessage();
  if (!error || (error instanceof ApiError && error.code === 'validation_failed')) return null;
  return <Alert tone="red">{errMsg(error)}</Alert>;
}

// ---------------------------------------------------------------- overview
export function HubOverviewPage() {
  const { t } = useTranslation();
  const { session } = useSuperAdmin();
  const { ventureId, venture, base, qs } = useHubCtx();
  const q = useQuery({ queryKey: ['sa', 'hub', 'overview', ventureId ?? 'all'], queryFn: () => saApi.get<Overview>(`/hub/overview${qs()}`) });
  const leads = useQuery({ queryKey: ['sa', 'hub', 'leads', ventureId, 'open', ''], queryFn: () => saApi.get<{ items: Lead[] }>(`/hub/leads${qs({ status: 'open' })}`) });
  const tasks = useQuery({ queryKey: ['sa', 'hub', 'tasks', ventureId, '', 'mine'], queryFn: () => saApi.get<{ items: Task[] }>(`/hub/tasks${qs({ status: 'open', mine: 'true' })}`) });
  const tickets = useQuery({ queryKey: ['sa', 'hub', 'tickets', ventureId, 'open_all', ''], queryFn: () => saApi.get<{ items: Ticket[] }>(`/hub/tickets${qs({ status: 'open_all' })}`) });
  const o = q.data;
  const cur = o?.currency ?? 'MVR';
  const due = (leads.data?.items ?? []).filter((l) => l.nextFollowUp && l.nextFollowUp <= today());
  return (
    <div className="space-y-6">
      <PageHeader
        title={venture ? venture.name : t('hub.overview_title', { name: session?.admin.name ?? '' })}
        description={venture ? venture.description || t('hub.ventures.project_subtitle') : t('hub.overview_subtitle')}
      />
      {!ventureId && <VentureGrid />}
      {venture?.kind === 'pos' && <PosConsoleLinks pending={o?.posPaymentsPending ?? 0} />}
      {venture?.kind === 'gravity' && <GravityConsoleLinks pending={venture.paymentsPending ?? 0} />}
      {!o ? (
        <SkeletonRows rows={4} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Link to={`${base}/leads`}>
            <StatCard label={t('hub.stat_leads')} value={o.leadsOpen} hint={o.followUpsDue ? t('hub.stat_follow_ups', { count: o.followUpsDue }) : undefined} icon={<UserPlus className="size-5" />} tone={o.followUpsDue ? 'amber' : 'blue'} />
          </Link>
          <Link to={`${base}/invoices`}>
            <StatCard label={t('hub.stat_due')} value={fmtAmount(o.amountDue, cur)} hint={t('hub.stat_unpaid_invoices', { count: o.invoicesUnpaid })} icon={<Receipt className="size-5" />} tone={o.amountDue ? 'amber' : 'green'} />
          </Link>
          <StatCard label={t('hub.stat_received')} value={fmtAmount(o.receivedThisMonth, cur)} icon={<Banknote className="size-5" />} tone="green" />
          <Link to={`${base}/tickets`}>
            <StatCard label={t('hub.stat_tickets')} value={o.ticketsOpen} hint={o.ticketsUrgent ? t('hub.stat_urgent', { count: o.ticketsUrgent }) : undefined} icon={<Headset className="size-5" />} tone={o.ticketsUrgent ? 'red' : 'blue'} />
          </Link>
          <Link to={`${base}/jobs`}>
            <StatCard label={t('hub.stat_projects')} value={o.projectsActive} icon={<Briefcase className="size-5" />} tone="violet" />
          </Link>
          <Link to={`${base}/tasks`}>
            <StatCard label={t('hub.stat_my_tasks')} value={o.myOpenTasks} hint={t('hub.stat_team_tasks', { count: o.openTasks })} icon={<ListTodo className="size-5" />} tone="blue" />
          </Link>
          <Link to={`${base}/clients`}>
            <StatCard label={t('hub.stat_clients')} value={o.clients} icon={<Users className="size-5" />} tone="gray" />
          </Link>
          {o.gravityAccountsActive !== null && (
            <Link to="/superadmin/gravity/accounts">
              <StatCard label={t('gravity.active_accounts')} value={o.gravityAccountsActive} icon={<FileText className="size-5" />} tone="violet" />
            </Link>
          )}
          {o.posBusinessesActive !== null && (
            <Link to="/superadmin/dashboard">
              <StatCard label={t('hub.stat_pos')} value={o.posBusinessesActive} hint={o.posPaymentsPending ? t('hub.stat_pos_pending', { count: o.posPaymentsPending }) : undefined} icon={<Store className="size-5" />} tone={o.posPaymentsPending ? 'amber' : 'green'} />
            </Link>
          )}
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <p className="mb-3 font-semibold">{t('hub.follow_ups_today')}</p>
          {due.length === 0 ? (
            <p className="text-sm text-slate-500">{t('hub.nothing_due')}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {due.slice(0, 8).map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-2">
                  <Link to={`${base}/leads`} className="min-w-0 truncate font-medium hover:underline" dir="auto">
                    {l.name}
                    {l.company ? ` · ${l.company}` : ''}
                  </Link>
                  <Badge tone={overdue(l.nextFollowUp) ? 'red' : 'amber'}>{l.nextFollowUp}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <p className="mb-3 font-semibold">{t('hub.my_tasks')}</p>
          {(tasks.data?.items ?? []).length === 0 ? (
            <p className="text-sm text-slate-500">{t('hub.no_tasks')}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {tasks.data!.items.slice(0, 8).map((x) => (
                <li key={x.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate" dir="auto">
                    {x.title}
                  </span>
                  {x.dueDate && <Badge tone={overdue(x.dueDate) ? 'red' : 'gray'}>{x.dueDate}</Badge>}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <p className="mb-3 font-semibold">{t('hub.open_tickets')}</p>
          {(tickets.data?.items ?? []).length === 0 ? (
            <p className="text-sm text-slate-500">{t('hub.no_tickets')}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {tickets.data!.items.slice(0, 8).map((x) => (
                <li key={x.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate" dir="auto">
                    <Ltr>{x.number}</Ltr> · {x.subject}
                  </span>
                  <Badge tone={PRIORITY_TONE[x.priority]}>{t(`hub.priorities.${x.priority}`)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

/** Main office: every OceanX project as a card; open one to see everything related to it. */
function VentureGrid() {
  const { t } = useTranslation();
  const cur = useCurrency();
  const ventures = useVentures();
  const [editing, setEditing] = useState<Venture | 'new' | null>(null);
  return (
    <section aria-label={t('hub.ventures.title')}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{t('hub.ventures.title')}</h2>
        <Button size="sm" variant="secondary" icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
          {t('hub.ventures.new')}
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {ventures.map((v) => {
          const tone = VENTURE_TONE[v.color] ?? VENTURE_TONE.blue!;
          return (
            <div key={v.id} className={clsx('relative rounded-2xl bg-white p-4 shadow-sm ring-1 dark:bg-slate-900', tone.ring, !v.isActive && 'opacity-60')}>
              <Link to={`/superadmin/p/${v.id}`} className="block" aria-label={t('hub.ventures.open', { name: v.name })}>
                <div className="flex items-center gap-3">
                  <span className={clsx('grid size-10 shrink-0 place-items-center rounded-xl text-white', tone.dot)}>{v.kind === 'pos' ? <Store className="size-5" /> : v.kind === 'gravity' ? <FileText className="size-5" /> : <FolderKanban className="size-5" />}</span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold" dir="auto">
                      {v.name}
                    </p>
                    <p className="truncate text-xs text-slate-500" dir="auto">
                      {v.description || (v.kind === 'pos' ? t('hub.ventures.pos_hint') : t('hub.ventures.project_subtitle'))}
                    </p>
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  {v.kind !== 'custom' && (
                    <>
                      <dt className="text-slate-500">{v.kind === 'pos' ? t('hub.stat_pos') : t('gravity.active_accounts')}</dt>
                      <dd className="text-end font-medium">{v.accountsActive ?? 0}</dd>
                    </>
                  )}
                  <dt className="text-slate-500">{t('hub.stat_leads')}</dt>
                  <dd className="text-end font-medium">{v.leadsOpen}</dd>
                  <dt className="text-slate-500">{t('hub.stat_projects')}</dt>
                  <dd className="text-end font-medium">{v.jobsActive}</dd>
                  <dt className="text-slate-500">{t('hub.stat_tickets')}</dt>
                  <dd className="text-end font-medium">{v.ticketsOpen}</dd>
                  <dt className="text-slate-500">{t('hub.stat_due')}</dt>
                  <dd className="text-end font-medium">{fmtAmount(v.amountDue, cur)}</dd>
                </dl>
              </Link>
              <button type="button" onClick={() => setEditing(v)} aria-label={t('hub.ventures.edit', { name: v.name })} className="absolute end-3 top-3 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800">
                <Pencil className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
      {editing && <VentureDialog venture={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

function VentureDialog({ venture, onClose }: { venture: Venture | null; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [f, setF] = useState({ name: venture?.name ?? '', description: venture?.description ?? '', color: venture?.color ?? 'violet', isActive: venture?.isActive ?? true, sortOrder: venture?.sortOrder ?? 10 });
  const save = useMutation({
    mutationFn: () => (venture ? saApi.put(`/hub/ventures/${venture.id}`, f) : saApi.post('/hub/ventures', f)),
    onSuccess: () => {
      toast.success(t('common.saved'));
      invalidateHub(qc);
      onClose();
    },
  });
  const fe = useFieldErrors(save.error);
  return (
    <Dialog open onClose={onClose} title={venture ? venture.name : t('hub.ventures.new')} footer={<SaveFooter onCancel={onClose} onSave={() => save.mutate()} saving={save.isPending} disabled={!f.name.trim()} />}>
      <div className="space-y-4">
        <FormError error={save.error} />
        <Input label={t('common.name')} hint={t('hub.ventures.name_hint')} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} error={fe('name')} required autoFocus />
        <Textarea label={t('hub.description')} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <fieldset>
          <legend className="mb-2 text-sm font-medium">{t('hub.ventures.color')}</legend>
          <div className="flex flex-wrap gap-2">
            {HUB_VENTURE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                aria-pressed={f.color === c}
                onClick={() => setF({ ...f, color: c })}
                className={clsx('size-8 rounded-full ring-offset-2 dark:ring-offset-slate-900', VENTURE_TONE[c]!.dot, f.color === c && 'ring-2 ring-slate-900 dark:ring-white')}
              />
            ))}
          </div>
        </fieldset>
        <Input type="number" min={0} max={1000} label={t('hub.ventures.order')} value={String(f.sortOrder)} onChange={(e) => setF({ ...f, sortOrder: Number(e.target.value) || 0 })} />
        {venture?.kind !== 'pos' && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} /> {t('hub.active')}
          </label>
        )}
      </div>
    </Dialog>
  );
}

/** Inside the Gravity project: its accounts, payments and plans. */
function GravityConsoleLinks({ pending }: { pending: number }) {
  const { t } = useTranslation();
  const links: [string, string, React.ComponentType<{ className?: string }>][] = [
    ['/superadmin/gravity/accounts', 'gravity.accounts', Building2],
    ['/superadmin/gravity/payments', 'superadmin.nav.payments', Banknote],
    ['/superadmin/gravity/plans', 'superadmin.nav.plans', Layers],
  ];
  return (
    <section aria-label={t('gravity.console')}>
      <h2 className="mb-3 text-lg font-semibold">{t('gravity.console')}</h2>
      <p className="-mt-2 mb-3 text-sm text-slate-500">
        {t('gravity.signup_link')}{' '}
        <a href="/gravity/register" target="_blank" rel="noreferrer" className="font-medium text-brand-700 hover:underline dark:text-brand-300" dir="ltr">
          {window.location.host}/gravity
        </a>
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {links.map(([to, label, Icon]) => (
          <Link key={to} to={to} className="flex items-center gap-2 rounded-xl bg-white p-3 text-sm font-medium shadow-sm ring-1 ring-slate-200 hover:ring-brand-500 dark:bg-slate-900 dark:ring-slate-800">
            <Icon className="size-4 shrink-0 text-slate-500" />
            <span className="min-w-0 truncate">{t(label)}</span>
            {to === '/superadmin/gravity/payments' && pending > 0 && <Badge tone="amber">{pending}</Badge>}
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Inside the OceanX POS project: shortcuts to the POS console. */
function PosConsoleLinks({ pending }: { pending: number }) {
  const { t } = useTranslation();
  const links: [string, string, React.ComponentType<{ className?: string }>][] = [
    ['/superadmin/dashboard', 'superadmin.nav.dashboard', Gauge],
    ['/superadmin/businesses', 'superadmin.nav.businesses', Building2],
    ['/superadmin/subscriptions', 'superadmin.nav.subscriptions', CreditCard],
    ['/superadmin/payments', 'superadmin.nav.payments', Banknote],
    ['/superadmin/plans', 'superadmin.nav.plans', Layers],
    ['/superadmin/addons', 'superadmin.nav.addons', Puzzle],
  ];
  return (
    <section aria-label={t('hub.nav.group_pos_console')}>
      <h2 className="mb-3 text-lg font-semibold">{t('hub.nav.group_pos_console')}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {links.map(([to, label, Icon]) => (
          <Link key={to} to={to} className="flex items-center gap-2 rounded-xl bg-white p-3 text-sm font-medium shadow-sm ring-1 ring-slate-200 hover:ring-brand-500 dark:bg-slate-900 dark:ring-slate-800">
            <Icon className="size-4 shrink-0 text-slate-500" />
            <span className="min-w-0 truncate">{t(label)}</span>
            {to === '/superadmin/payments' && pending > 0 && <Badge tone="amber">{pending}</Badge>}
          </Link>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- leads
export function LeadsPage() {
  const { t } = useTranslation();
  const { ventureId, qs } = useHubCtx();
  const [status, setStatus] = useState<'open' | 'won' | 'lost' | 'all'>('open');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Lead | 'new' | null>(null);
  const q = useQuery({
    queryKey: ['sa', 'hub', 'leads', ventureId, status, search],
    queryFn: () => saApi.get<{ items: Lead[] }>(`/hub/leads${qs({ status: status !== 'all' ? status : undefined, q: search })}`),
  });
  const columns: Column<Lead>[] = [
    {
      key: 'n',
      header: t('common.name'),
      cell: (l) => (
        <div className="min-w-0">
          <p className="truncate font-medium" dir="auto">
            {l.name}
          </p>
          <p className="truncate text-xs text-slate-500">
            {l.company && <span dir="auto">{l.company} · </span>}
            <Ltr>{l.phone || l.email}</Ltr>
          </p>
        </div>
      ),
    },
    { key: 's', header: t('hub.source'), hideOnMobile: true, cell: (l) => <Badge>{t(`hub.sources.${l.source}`)}</Badge> },
    { key: 'i', header: t('hub.interest'), hideOnMobile: true, cell: (l) => <span dir="auto">{l.serviceName ?? l.interest ?? '—'}</span> },
    { key: 'f', header: t('hub.follow_up'), cell: (l) => (l.nextFollowUp ? <Badge tone={overdue(l.nextFollowUp) && !['won', 'lost'].includes(l.status) ? 'red' : 'gray'}>{l.nextFollowUp}</Badge> : '—') },
    { key: 'a', header: t('hub.assigned_to'), hideOnMobile: true, cell: (l) => l.assignedName ?? '—' },
    ...(ventureId ? [] : [{ key: 'venture', header: t('hub.ventures.project'), hideOnMobile: true, cell: (r: Lead) => <VentureBadge id={r.ventureId} /> }]),
    { key: 'st', header: t('common.status'), className: 'text-end', cell: (l) => <Badge tone={LEAD_TONE[l.status]}>{t(`hub.lead_statuses.${l.status}`)}</Badge> },
  ];
  return (
    <div className="space-y-6">
      <PageHeader
        title={t('hub.leads')}
        description={t('hub.leads_subtitle')}
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
            {t('hub.new_lead')}
          </Button>
        }
      />
      <Tabs
        value={status}
        onChange={setStatus}
        tabs={(['open', 'won', 'lost', 'all'] as const).map((v) => ({ value: v, label: t(`hub.lead_tabs.${v}`) }))}
      />
      <Card padded={false}>
        <ListToolbar search={search} onSearch={setSearch} placeholder={t('hub.search_leads')} />
        {q.isLoading ? (
          <SkeletonRows />
        ) : !q.data?.items.length ? (
          <EmptyState icon={<UserPlus className="size-6" />} title={t('hub.no_leads')} description={t('hub.no_leads_body')} />
        ) : (
          <DataTable columns={columns} rows={q.data.items} rowKey={(l) => l.id} onRowClick={setEditing} />
        )}
      </Card>
      {editing && <LeadDialog lead={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function LeadDialog({ lead, onClose }: { lead: Lead | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { base, ventureId } = useHubCtx();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const toastErr = useToastError();
  const [f, setF] = useState({
    ventureId: lead ? lead.ventureId : ventureId,
    name: lead?.name ?? '',
    company: lead?.company ?? '',
    phone: lead?.phone ?? '',
    email: lead?.email ?? '',
    source: lead?.source ?? 'instagram',
    serviceId: lead?.serviceId ?? null,
    interest: lead?.interest ?? '',
    status: lead?.status ?? 'new',
    nextFollowUp: lead?.nextFollowUp ?? '',
    assignedTo: lead?.assignedTo ?? null,
    notes: lead?.notes ?? '',
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const save = useMutation({
    mutationFn: () => {
      const body = { ...f, nextFollowUp: f.nextFollowUp || null };
      return lead ? saApi.put(`/hub/leads/${lead.id}`, body) : saApi.post('/hub/leads', body);
    },
    onSuccess: () => {
      toast.success(t('common.saved'));
      invalidateHub(qc);
      onClose();
    },
  });
  const convert = useMutation({
    mutationFn: () => saApi.post<Lead>(`/hub/leads/${lead!.id}/convert`, {}),
    onSuccess: () => {
      toast.success(t('hub.lead_converted'));
      invalidateHub(qc);
      onClose();
      navigate(`${base}/clients`);
    },
    onError: toastErr,
  });
  const fe = useFieldErrors(save.error);
  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={lead ? lead.name : t('hub.new_lead')}
      footer={
        <SaveFooter
          onCancel={onClose}
          onSave={() => save.mutate()}
          saving={save.isPending}
          disabled={!f.name.trim()}
          extra={
            lead && !lead.clientId ? (
              <Button variant="secondary" className="me-auto" icon={<CheckCircle2 className="size-4" />} loading={convert.isPending} onClick={() => convert.mutate()}>
                {t('hub.convert_to_client')}
              </Button>
            ) : undefined
          }
        />
      }
    >
      <div className="space-y-4">
        <FormError error={save.error} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label={t('common.name')} value={f.name} onChange={set('name')} error={fe('name')} required autoFocus />
          <Input label={t('hub.company')} value={f.company} onChange={set('company')} />
          <Input label={t('common.phone')} type="tel" dir="ltr" value={f.phone} onChange={set('phone')} error={fe('phone')} />
          <Input label={t('common.email')} type="email" dir="ltr" value={f.email} onChange={set('email')} error={fe('email')} />
          <VentureSelect value={f.ventureId} onChange={(v) => setF((x) => ({ ...x, ventureId: v }))} />
          <Select label={t('hub.source')} value={f.source} onChange={set('source')}>
            {HUB_LEAD_SOURCES.map((s) => (
              <option key={s} value={s}>
                {t(`hub.sources.${s}`)}
              </option>
            ))}
          </Select>
          <Select label={t('common.status')} value={f.status} onChange={set('status')}>
            {HUB_LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`hub.lead_statuses.${s}`)}
              </option>
            ))}
          </Select>
          <ServiceSelect label={t('hub.interested_in')} value={f.serviceId} onChange={(v) => setF((x) => ({ ...x, serviceId: v }))} />
          <Input label={t('hub.interest_details')} value={f.interest} onChange={set('interest')} />
          <Input type="date" label={t('hub.next_follow_up')} value={f.nextFollowUp} onChange={set('nextFollowUp')} />
          <TeamSelect value={f.assignedTo} onChange={(v) => setF((x) => ({ ...x, assignedTo: v }))} />
        </div>
        <Textarea label={t('common.notes')} value={f.notes} onChange={set('notes')} />
        {lead?.clientId && <Alert tone="green">{t('hub.lead_is_client')}</Alert>}
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- clients
export function ClientsPage() {
  const { t } = useTranslation();
  const { ventureId, qs } = useHubCtx();
  const cur = useCurrency();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Client | 'new' | null>(null);
  const q = useQuery({ queryKey: ['sa', 'hub', 'clients', ventureId, search], queryFn: () => saApi.get<{ items: Client[] }>(`/hub/clients${qs({ q: search })}`) });
  const columns: Column<Client>[] = [
    {
      key: 'n',
      header: t('common.name'),
      cell: (c) => (
        <div className="min-w-0">
          <p className="flex items-center gap-2 truncate font-medium" dir="auto">
            {c.name}
            {c.kind !== 'person' && <Badge tone={c.kind === 'government' ? 'blue' : 'gray'}>{t(`hub.client_kinds.${c.kind}`)}</Badge>}
          </p>
          <p className="truncate text-xs text-slate-500">
            {c.company && <span dir="auto">{c.company} · </span>}
            <Ltr>{c.phone || c.email}</Ltr>
          </p>
        </div>
      ),
    },
    { key: 'p', header: t('hub.pos_business'), hideOnMobile: true, cell: (c) => (c.businessName ? <Badge tone="green">{c.businessName}</Badge> : '—') },
    { key: 'pr', header: t('hub.open_projects'), hideOnMobile: true, cell: (c) => c.openProjects || '—' },
    ...(ventureId ? [] : [{ key: 'venture', header: t('hub.ventures.project'), hideOnMobile: true, cell: (r: Client) => <VentureBadge id={r.ventureId} /> }]),
    { key: 'd', header: t('hub.amount_due'), className: 'text-end', cell: (c) => (c.amountDue ? <span className="font-semibold text-amber-700">{fmtAmount(c.amountDue, cur)}</span> : '—') },
  ];
  return (
    <div className="space-y-6">
      <PageHeader
        title={t('hub.clients')}
        description={t('hub.clients_subtitle')}
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
            {t('hub.new_client')}
          </Button>
        }
      />
      <Card padded={false}>
        <ListToolbar search={search} onSearch={setSearch} placeholder={t('hub.search_clients')} />
        {q.isLoading ? (
          <SkeletonRows />
        ) : !q.data?.items.length ? (
          <EmptyState icon={<Users className="size-6" />} title={t('hub.no_clients')} description={t('hub.no_clients_body')} />
        ) : (
          <DataTable columns={columns} rows={q.data.items} rowKey={(c) => c.id} onRowClick={setEditing} />
        )}
      </Card>
      {editing && <ClientDialog client={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ClientDialog({ client, onClose }: { client: Client | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { base, ventureId } = useHubCtx();
  const qc = useQueryClient();
  const f0 = useFormat();
  const toastErr = useToastError();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const businesses = useQuery({ queryKey: ['sa', 'businesses', 'all-lite'], queryFn: () => saApi.get<{ items: { id: string; name: string }[] }>('/businesses?pageSize=100') });
  const detail = useQuery({
    queryKey: ['sa', 'hub', 'client', client?.id],
    queryFn: () => saApi.get<{ documents: DocRow[]; projects: Project[]; tickets: Ticket[] }>(`/hub/clients/${client!.id}`),
    enabled: !!client,
  });
  const [f, setF] = useState({
    ventureId: client ? client.ventureId : ventureId,
    name: client?.name ?? '',
    company: client?.company ?? '',
    kind: client?.kind ?? 'company',
    phone: client?.phone ?? '',
    email: client?.email ?? '',
    address: client?.address ?? '',
    taxNumber: client?.taxNumber ?? '',
    notes: client?.notes ?? '',
    businessId: client?.businessId ?? null,
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const save = useMutation({
    mutationFn: () => (client ? saApi.put(`/hub/clients/${client.id}`, f) : saApi.post('/hub/clients', f)),
    onSuccess: () => {
      toast.success(t('common.saved'));
      invalidateHub(qc);
      onClose();
    },
  });
  const del = useMutation({
    mutationFn: () => saApi.delete(`/hub/clients/${client!.id}`),
    onSuccess: () => {
      toast.success(t('common.deleted'));
      invalidateHub(qc);
      onClose();
    },
    onError: toastErr,
  });
  const fe = useFieldErrors(save.error);
  const d = detail.data;
  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={client ? client.name : t('hub.new_client')}
      footer={
        <SaveFooter
          onCancel={onClose}
          onSave={() => save.mutate()}
          saving={save.isPending}
          disabled={!f.name.trim()}
          extra={
            client ? (
              <Button variant="ghost" className="me-auto text-rose-600" icon={<Trash2 className="size-4" />} onClick={() => setConfirmDelete(true)}>
                {t('common.delete')}
              </Button>
            ) : undefined
          }
        />
      }
    >
      <div className="space-y-4">
        <FormError error={save.error} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label={t('hub.client_kind')} value={f.kind} onChange={set('kind')}>
            {HUB_CLIENT_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`hub.client_kinds.${k}`)}
              </option>
            ))}
          </Select>
          <Input label={t('common.name')} value={f.name} onChange={set('name')} error={fe('name')} required autoFocus />
          <Input label={t('hub.company')} value={f.company} onChange={set('company')} />
          <Input label={t('common.phone')} type="tel" dir="ltr" value={f.phone} onChange={set('phone')} error={fe('phone')} />
          <Input label={t('common.email')} type="email" dir="ltr" value={f.email} onChange={set('email')} error={fe('email')} />
          <Input label={t('hub.tax_number')} dir="ltr" value={f.taxNumber} onChange={set('taxNumber')} />
          <VentureSelect value={f.ventureId} onChange={(v) => setF((x) => ({ ...x, ventureId: v }))} />
          <Select label={t('hub.pos_business')} hint={t('hub.pos_business_hint')} value={f.businessId ?? ''} onChange={(e) => setF((x) => ({ ...x, businessId: e.target.value || null }))}>
            <option value="">—</option>
            {(businesses.data?.items ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </div>
        <Textarea label={t('common.address')} value={f.address} onChange={set('address')} />
        <Textarea label={t('common.notes')} value={f.notes} onChange={set('notes')} />
        {d && (d.documents.length > 0 || d.projects.length > 0 || d.tickets.length > 0) && (
          <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/50">
            {d.projects.map((p) => (
              <p key={p.id} className="flex justify-between gap-2">
                <span dir="auto">
                  <Briefcase className="me-1 inline size-3.5" /> {p.title}
                </span>
                <Badge tone={PROJECT_TONE[p.status]}>{t(`hub.project_statuses.${p.status}`)}</Badge>
              </p>
            ))}
            {d.documents.map((x) => (
              <Link key={x.id} to={`${base}/documents/${x.id}`} className="flex justify-between gap-2 hover:underline">
                <span>
                  <FileText className="me-1 inline size-3.5" /> <Ltr>{x.number}</Ltr> · {f0.date(x.issueDate)}
                </span>
                <Badge tone={DOC_TONE[x.status]}>{t(`hub.doc_statuses.${x.status}`)}</Badge>
              </Link>
            ))}
            {d.tickets.map((x) => (
              <p key={x.id} className="flex justify-between gap-2">
                <span dir="auto">
                  <Headset className="me-1 inline size-3.5" /> <Ltr>{x.number}</Ltr> · {x.subject}
                </span>
                <Badge tone={TICKET_TONE[x.status]}>{t(`hub.ticket_statuses.${x.status}`)}</Badge>
              </p>
            ))}
          </div>
        )}
      </div>
      <ConfirmDialog open={confirmDelete} onClose={() => setConfirmDelete(false)} onConfirm={() => del.mutate()} loading={del.isPending} danger title={t('hub.delete_client')} message={t('hub.delete_client_body')} confirmLabel={t('common.delete')} />
    </Dialog>
  );
}

// ---------------------------------------------------------------- services
export function ServicesPage() {
  const { t } = useTranslation();
  const { ventureId, qs } = useHubCtx();
  const cur = useCurrency();
  const [editing, setEditing] = useState<Service | 'new' | null>(null);
  const q = useQuery({ queryKey: ['sa', 'hub', 'services', ventureId], queryFn: () => saApi.get<{ items: Service[] }>(`/hub/services${qs()}`) });
  const columns: Column<Service>[] = [
    {
      key: 'n',
      header: t('common.name'),
      cell: (s) => (
        <div className="min-w-0">
          <p className="truncate font-medium" dir="auto">
            {s.name} {!s.isActive && <Badge>{t('hub.inactive')}</Badge>}
          </p>
          {s.description && <p className="truncate text-xs text-slate-500">{s.description}</p>}
        </div>
      ),
    },
    { key: 'c', header: t('hub.category'), hideOnMobile: true, cell: (s) => <Badge tone="violet">{t(`hub.categories.${s.category}`)}</Badge> },
    ...(ventureId ? [] : [{ key: 'venture', header: t('hub.ventures.project'), hideOnMobile: true, cell: (r: Service) => <VentureBadge id={r.ventureId} /> }]),
    { key: 'p', header: t('hub.price'), className: 'text-end', cell: (s) => `${fmtAmount(s.price, cur)} / ${s.unit}` },
  ];
  return (
    <div className="space-y-6">
      <PageHeader
        title={t('hub.services')}
        description={t('hub.services_subtitle')}
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
            {t('hub.new_service')}
          </Button>
        }
      />
      <Card padded={false}>
        {q.isLoading ? (
          <SkeletonRows />
        ) : !q.data?.items.length ? (
          <EmptyState icon={<Briefcase className="size-6" />} title={t('hub.no_services')} description={t('hub.no_services_body')} />
        ) : (
          <DataTable columns={columns} rows={q.data.items} rowKey={(s) => s.id} onRowClick={setEditing} />
        )}
      </Card>
      {editing && <ServiceDialog service={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ServiceDialog({ service, onClose }: { service: Service | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { ventureId } = useHubCtx();
  const qc = useQueryClient();
  const [f, setF] = useState({
    ventureId: service ? service.ventureId : ventureId,
    name: service?.name ?? '',
    category: service?.category ?? 'websites',
    description: service?.description ?? '',
    unit: service?.unit ?? 'job',
    price: service ? String(service.price / 100) : '',
    isActive: service?.isActive ?? true,
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const save = useMutation({
    mutationFn: () => {
      const body = { ...f, price: parseAmount(f.price) };
      return service ? saApi.put(`/hub/services/${service.id}`, body) : saApi.post('/hub/services', body);
    },
    onSuccess: () => {
      toast.success(t('common.saved'));
      invalidateHub(qc);
      onClose();
    },
  });
  const fe = useFieldErrors(save.error);
  return (
    <Dialog open onClose={onClose} title={service ? service.name : t('hub.new_service')} footer={<SaveFooter onCancel={onClose} onSave={() => save.mutate()} saving={save.isPending} disabled={!f.name.trim()} />}>
      <div className="space-y-4">
        <FormError error={save.error} />
        <Input label={t('common.name')} value={f.name} onChange={set('name')} error={fe('name')} required autoFocus />
        <VentureSelect value={f.ventureId} onChange={(v) => setF((x) => ({ ...x, ventureId: v }))} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Select label={t('hub.category')} value={f.category} onChange={set('category')}>
            {HUB_SERVICE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`hub.categories.${c}`)}
              </option>
            ))}
          </Select>
          <Input label={t('hub.price')} type="number" min={0} step="0.01" value={f.price} onChange={set('price')} error={fe('price')} />
          <Input label={t('hub.unit')} hint={t('hub.unit_hint')} value={f.unit} onChange={set('unit')} />
        </div>
        <Textarea label={t('hub.description')} value={f.description} onChange={set('description')} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.isActive} onChange={(e) => setF((x) => ({ ...x, isActive: e.target.checked }))} /> {t('hub.active')}
        </label>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- projects
export function ProjectsPage() {
  const { t } = useTranslation();
  const { ventureId, qs } = useHubCtx();
  const cur = useCurrency();
  const f = useFormat();
  const [status, setStatus] = useState<'active' | 'done' | 'all'>('active');
  const [editing, setEditing] = useState<Project | 'new' | null>(null);
  const q = useQuery({ queryKey: ['sa', 'hub', 'projects', ventureId, status], queryFn: () => saApi.get<{ items: Project[] }>(`/hub/projects${qs({ status: status !== 'all' ? status : undefined })}`) });
  const columns: Column<Project>[] = [
    {
      key: 't',
      header: t('hub.project'),
      cell: (p) => (
        <div className="min-w-0">
          <p className="truncate font-medium" dir="auto">
            {p.title}
          </p>
          <p className="truncate text-xs text-slate-500" dir="auto">
            {p.clientName ?? t('hub.internal')}
          </p>
        </div>
      ),
    },
    { key: 'tk', header: t('hub.tasks'), hideOnMobile: true, cell: (p) => (p.tasksOpen + p.tasksDone ? `${p.tasksDone}/${p.tasksOpen + p.tasksDone}` : '—') },
    { key: 'a', header: t('hub.assigned_to'), hideOnMobile: true, cell: (p) => p.assignedName ?? '—' },
    { key: 'd', header: t('hub.due'), cell: (p) => (p.dueDate ? <Badge tone={overdue(p.dueDate) && !['done', 'cancelled'].includes(p.status) ? 'red' : 'gray'}>{f.date(p.dueDate)}</Badge> : '—') },
    { key: 'v', header: t('hub.value'), hideOnMobile: true, cell: (p) => (p.value ? fmtAmount(p.value, cur) : '—') },
    ...(ventureId ? [] : [{ key: 'venture', header: t('hub.ventures.project'), hideOnMobile: true, cell: (r: Project) => <VentureBadge id={r.ventureId} /> }]),
    { key: 's', header: t('common.status'), className: 'text-end', cell: (p) => <Badge tone={PROJECT_TONE[p.status]}>{t(`hub.project_statuses.${p.status}`)}</Badge> },
  ];
  return (
    <div className="space-y-6">
      <PageHeader
        title={t('hub.projects')}
        description={t('hub.projects_subtitle')}
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
            {t('hub.new_project')}
          </Button>
        }
      />
      <Tabs value={status} onChange={setStatus} tabs={(['active', 'done', 'all'] as const).map((v) => ({ value: v, label: t(`hub.project_tabs.${v}`) }))} />
      <Card padded={false}>
        {q.isLoading ? (
          <SkeletonRows />
        ) : !q.data?.items.length ? (
          <EmptyState icon={<Briefcase className="size-6" />} title={t('hub.no_projects')} description={t('hub.no_projects_body')} />
        ) : (
          <DataTable columns={columns} rows={q.data.items} rowKey={(p) => p.id} onRowClick={setEditing} />
        )}
      </Card>
      {editing && <ProjectDialog project={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ProjectDialog({ project, onClose }: { project: Project | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { ventureId } = useHubCtx();
  const qc = useQueryClient();
  const [f, setF] = useState({
    ventureId: project ? project.ventureId : ventureId,
    title: project?.title ?? '',
    clientId: project?.clientId ?? null,
    serviceId: project?.serviceId ?? null,
    description: project?.description ?? '',
    status: project?.status ?? 'planned',
    startDate: project?.startDate ?? '',
    dueDate: project?.dueDate ?? '',
    value: project ? String(project.value / 100) : '',
    assignedTo: project?.assignedTo ?? null,
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const save = useMutation({
    mutationFn: () => {
      const body = { ...f, startDate: f.startDate || null, dueDate: f.dueDate || null, value: parseAmount(f.value) };
      return project ? saApi.put(`/hub/projects/${project.id}`, body) : saApi.post('/hub/projects', body);
    },
    onSuccess: () => {
      toast.success(t('common.saved'));
      invalidateHub(qc);
      onClose();
    },
  });
  const fe = useFieldErrors(save.error);
  return (
    <Dialog open onClose={onClose} size="lg" title={project ? project.title : t('hub.new_project')} footer={<SaveFooter onCancel={onClose} onSave={() => save.mutate()} saving={save.isPending} disabled={!f.title.trim()} />}>
      <div className="space-y-4">
        <FormError error={save.error} />
        <Input label={t('hub.project_title')} value={f.title} onChange={set('title')} error={fe('title')} required autoFocus />
        <div className="grid gap-4 sm:grid-cols-2">
          <VentureSelect value={f.ventureId} onChange={(v) => setF((x) => ({ ...x, ventureId: v }))} />
          <ClientSelect value={f.clientId} onChange={(v) => setF((x) => ({ ...x, clientId: v }))} />
          <ServiceSelect value={f.serviceId} onChange={(v) => setF((x) => ({ ...x, serviceId: v }))} />
          <Select label={t('common.status')} value={f.status} onChange={set('status')}>
            {HUB_PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`hub.project_statuses.${s}`)}
              </option>
            ))}
          </Select>
          <TeamSelect value={f.assignedTo} onChange={(v) => setF((x) => ({ ...x, assignedTo: v }))} />
          <Input type="date" label={t('hub.start_date')} value={f.startDate} onChange={set('startDate')} />
          <Input type="date" label={t('hub.due_date')} value={f.dueDate} onChange={set('dueDate')} />
          <Input type="number" min={0} step="0.01" label={t('hub.value')} value={f.value} onChange={set('value')} />
        </div>
        <Textarea label={t('hub.description')} value={f.description} onChange={set('description')} />
        {project && <TaskList projectId={project.id} />}
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- tasks
function TaskList({ projectId, mine }: { projectId?: string; mine?: boolean }) {
  const { t } = useTranslation();
  const { ventureId, qs } = useHubCtx();
  const qc = useQueryClient();
  const toastErr = useToastError();
  const [title, setTitle] = useState('');
  // A job's task list shows every task of the job, whichever project page it is opened from.
  const url = projectId ? `/hub/tasks?projectId=${projectId}` : `/hub/tasks${qs(mine ? { mine: 'true', status: 'open' } : {})}`;
  const q = useQuery({ queryKey: ['sa', 'hub', 'tasks', projectId ? null : ventureId, projectId ?? '', mine ? 'mine' : ''], queryFn: () => saApi.get<{ items: Task[] }>(url) });
  const { session } = useSuperAdmin();
  const add = useMutation({
    mutationFn: () => saApi.post('/hub/tasks', { title: title.trim(), projectId: projectId ?? null, ventureId, assignedTo: mine ? (session?.admin.id ?? null) : null }),
    onSuccess: () => {
      setTitle('');
      invalidateHub(qc);
    },
    onError: toastErr,
  });
  const toggle = useMutation({
    mutationFn: (x: Task) => saApi.put(`/hub/tasks/${x.id}`, { title: x.title, projectId: x.projectId, ventureId: x.ventureId, notes: x.notes, priority: x.priority, dueDate: x.dueDate, assignedTo: x.assignedTo, status: x.status === 'done' ? 'todo' : 'done' }),
    onSuccess: () => invalidateHub(qc),
    onError: toastErr,
  });
  const del = useMutation({ mutationFn: (id: string) => saApi.delete(`/hub/tasks/${id}`), onSuccess: () => invalidateHub(qc), onError: toastErr });
  const items = q.data?.items ?? [];
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">{t('hub.tasks')}</p>
      <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200 dark:divide-slate-800 dark:ring-slate-800">
        {items.map((x) => (
          <li key={x.id} className="flex items-center gap-3 px-3 py-2 text-sm">
            <input type="checkbox" aria-label={x.title} checked={x.status === 'done'} onChange={() => toggle.mutate(x)} className="size-4" />
            <span className={clsx('min-w-0 flex-1 truncate', x.status === 'done' && 'text-slate-400 line-through')} dir="auto">
              {x.title}
              {!projectId && x.projectTitle && <span className="text-xs text-slate-500"> · {x.projectTitle}</span>}
            </span>
            {x.priority === 'high' && <Badge tone="amber">{t('hub.priorities.high')}</Badge>}
            {x.dueDate && <Badge tone={overdue(x.dueDate) && x.status !== 'done' ? 'red' : 'gray'}>{x.dueDate}</Badge>}
            {x.assignedName && <span className="hidden text-xs text-slate-500 sm:inline">{x.assignedName}</span>}
            <button type="button" aria-label={t('common.delete')} className="rounded p-1 text-slate-400 hover:text-rose-600" onClick={() => del.mutate(x.id)}>
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
        <li className="flex gap-2 p-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && title.trim()) {
                e.preventDefault();
                add.mutate();
              }
            }}
            placeholder={t('hub.add_task_placeholder')}
            aria-label={t('hub.add_task')}
            className="min-w-0 flex-1 rounded-lg bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-brand-600 focus:outline-none dark:bg-slate-800 dark:ring-slate-700"
          />
          <Button size="sm" icon={<Plus className="size-4" />} disabled={!title.trim()} loading={add.isPending} onClick={() => add.mutate()}>
            {t('hub.add_task')}
          </Button>
        </li>
      </ul>
    </div>
  );
}

export function TasksPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'mine' | 'all'>('mine');
  return (
    <div className="space-y-6">
      <PageHeader title={t('hub.tasks')} description={t('hub.tasks_subtitle')} />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'mine', label: t('hub.my_tasks') }, { value: 'all', label: t('hub.all_tasks') }]} />
      <Card>{tab === 'mine' ? <TaskList mine /> : <TaskList />}</Card>
    </div>
  );
}

// ---------------------------------------------------------------- tickets
export function TicketsPage() {
  const { t } = useTranslation();
  const { ventureId, qs } = useHubCtx();
  const f = useFormat();
  const [status, setStatus] = useState<'open_all' | 'resolved' | 'all'>('open_all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Ticket | 'new' | null>(null);
  const q = useQuery({
    queryKey: ['sa', 'hub', 'tickets', ventureId, status, search],
    queryFn: () => saApi.get<{ items: Ticket[] }>(`/hub/tickets${qs({ status: status !== 'all' ? status : undefined, q: search })}`),
  });
  const columns: Column<Ticket>[] = [
    {
      key: 's',
      header: t('hub.ticket'),
      cell: (x) => (
        <div className="min-w-0">
          <p className="truncate font-medium" dir="auto">
            {x.subject}
          </p>
          <p className="truncate text-xs text-slate-500">
            <Ltr>{x.number}</Ltr> · <span dir="auto">{x.businessName ?? x.clientName ?? '—'}</span>
          </p>
        </div>
      ),
    },
    { key: 'p', header: t('hub.priority'), cell: (x) => <Badge tone={PRIORITY_TONE[x.priority]}>{t(`hub.priorities.${x.priority}`)}</Badge> },
    { key: 'a', header: t('hub.assigned_to'), hideOnMobile: true, cell: (x) => x.assignedName ?? '—' },
    { key: 'c', header: t('hub.opened'), hideOnMobile: true, cell: (x) => f.dateTime(x.createdAt) },
    ...(ventureId ? [] : [{ key: 'venture', header: t('hub.ventures.project'), hideOnMobile: true, cell: (r: Ticket) => <VentureBadge id={r.ventureId} /> }]),
    { key: 'st', header: t('common.status'), className: 'text-end', cell: (x) => <Badge tone={TICKET_TONE[x.status]}>{t(`hub.ticket_statuses.${x.status}`)}</Badge> },
  ];
  return (
    <div className="space-y-6">
      <PageHeader
        title={t('hub.tickets')}
        description={t('hub.tickets_subtitle')}
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
            {t('hub.new_ticket')}
          </Button>
        }
      />
      <Tabs value={status} onChange={setStatus} tabs={(['open_all', 'resolved', 'all'] as const).map((v) => ({ value: v, label: t(`hub.ticket_tabs.${v}`) }))} />
      <Card padded={false}>
        <ListToolbar search={search} onSearch={setSearch} placeholder={t('hub.search_tickets')} />
        {q.isLoading ? (
          <SkeletonRows />
        ) : !q.data?.items.length ? (
          <EmptyState icon={<Headset className="size-6" />} title={t('hub.no_tickets')} description={t('hub.no_tickets_body')} />
        ) : (
          <DataTable columns={columns} rows={q.data.items} rowKey={(x) => x.id} onRowClick={setEditing} />
        )}
      </Card>
      {editing && <TicketDialog ticket={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function TicketDialog({ ticket, onClose }: { ticket: Ticket | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { ventureId } = useHubCtx();
  const qc = useQueryClient();
  const fmt = useFormat();
  const toastErr = useToastError();
  const businesses = useQuery({ queryKey: ['sa', 'businesses', 'all-lite'], queryFn: () => saApi.get<{ items: { id: string; name: string }[] }>('/businesses?pageSize=100') });
  const detail = useQuery({
    queryKey: ['sa', 'hub', 'ticket', ticket?.id],
    queryFn: () => saApi.get<{ notes: { id: string; body: string; createdAt: string; authorName: string | null }[] }>(`/hub/tickets/${ticket!.id}`),
    enabled: !!ticket,
  });
  const [note, setNote] = useState('');
  const [f, setF] = useState({
    ventureId: ticket ? ticket.ventureId : ventureId,
    subject: ticket?.subject ?? '',
    description: ticket?.description ?? '',
    clientId: ticket?.clientId ?? null,
    businessId: ticket?.businessId ?? null,
    channel: ticket?.channel ?? 'whatsapp',
    priority: ticket?.priority ?? 'normal',
    status: ticket?.status ?? 'open',
    assignedTo: ticket?.assignedTo ?? null,
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const save = useMutation({
    mutationFn: () => (ticket ? saApi.put(`/hub/tickets/${ticket.id}`, f) : saApi.post('/hub/tickets', f)),
    onSuccess: () => {
      toast.success(t('common.saved'));
      invalidateHub(qc);
      onClose();
    },
  });
  const addNote = useMutation({
    mutationFn: () => saApi.post(`/hub/tickets/${ticket!.id}/notes`, { body: note.trim() }),
    onSuccess: () => {
      setNote('');
      void qc.invalidateQueries({ queryKey: ['sa', 'hub', 'ticket', ticket?.id] });
    },
    onError: toastErr,
  });
  const fe = useFieldErrors(save.error);
  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={ticket ? `${ticket.number} · ${ticket.subject}` : t('hub.new_ticket')}
      footer={<SaveFooter onCancel={onClose} onSave={() => save.mutate()} saving={save.isPending} disabled={!f.subject.trim()} />}
    >
      <div className="space-y-4">
        <FormError error={save.error} />
        <Input label={t('hub.subject')} value={f.subject} onChange={set('subject')} error={fe('subject')} required autoFocus={!ticket} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label={t('hub.pos_business')} value={f.businessId ?? ''} onChange={(e) => setF((x) => ({ ...x, businessId: e.target.value || null }))}>
            <option value="">—</option>
            {(businesses.data?.items ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <ClientSelect value={f.clientId} onChange={(v) => setF((x) => ({ ...x, clientId: v }))} />
          <VentureSelect value={f.ventureId} onChange={(v) => setF((x) => ({ ...x, ventureId: v }))} />
          <Select label={t('hub.priority')} value={f.priority} onChange={set('priority')}>
            {HUB_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {t(`hub.priorities.${p}`)}
              </option>
            ))}
          </Select>
          <Select label={t('common.status')} value={f.status} onChange={set('status')}>
            {HUB_TICKET_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`hub.ticket_statuses.${s}`)}
              </option>
            ))}
          </Select>
          <Select label={t('hub.channel')} value={f.channel} onChange={set('channel')}>
            {HUB_TICKET_CHANNELS.map((c) => (
              <option key={c} value={c}>
                {t(`hub.channels.${c}`)}
              </option>
            ))}
          </Select>
          <TeamSelect value={f.assignedTo} onChange={(v) => setF((x) => ({ ...x, assignedTo: v }))} />
        </div>
        <Textarea label={t('hub.description')} value={f.description} onChange={set('description')} />
        {ticket && (
          <div className="space-y-2">
            <p className="text-sm font-semibold">{t('hub.updates')}</p>
            {(detail.data?.notes ?? []).map((n) => (
              <div key={n.id} className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/50">
                <p className="text-xs text-slate-500">
                  {n.authorName ?? '—'} · {fmt.dateTime(n.createdAt)}
                </p>
                <p className="mt-1 whitespace-pre-line" dir="auto">
                  {n.body}
                </p>
              </div>
            ))}
            <div className="flex gap-2">
              <Textarea aria-label={t('hub.add_update')} placeholder={t('hub.add_update')} value={note} onChange={(e) => setNote(e.target.value)} className="flex-1" />
              <Button variant="secondary" disabled={!note.trim()} loading={addNote.isPending} onClick={() => addNote.mutate()}>
                {t('hub.post_update')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- quotations & invoices
export function HubDocumentsPage({ kind }: { kind: 'quote' | 'invoice' }) {
  const { t } = useTranslation();
  const { base, ventureId, qs } = useHubCtx();
  const f = useFormat();
  const navigate = useNavigate();
  const [status, setStatus] = useState<string>(kind === 'invoice' ? 'unpaid' : 'all');
  const [creating, setCreating] = useState(false);
  const q = useQuery({
    queryKey: ['sa', 'hub', 'documents', ventureId, kind, status],
    queryFn: () => saApi.get<{ items: DocRow[] }>(`/hub/documents${qs({ kind, status: status !== 'all' ? status : undefined })}`),
  });
  const tabs = kind === 'invoice' ? ['unpaid', 'paid', 'draft', 'all'] : ['all', 'draft', 'sent', 'accepted'];
  const columns: Column<DocRow>[] = [
    {
      key: 'n',
      header: t('hub.number'),
      cell: (d) => (
        <div className="min-w-0">
          <p className="font-medium">
            <Ltr>{d.number}</Ltr>
          </p>
          <p className="truncate text-xs text-slate-500" dir="auto">
            {d.clientName}
          </p>
        </div>
      ),
    },
    { key: 'd', header: t('common.date'), hideOnMobile: true, cell: (d) => f.date(d.issueDate) },
    { key: 't', header: t('hub.total'), cell: (d) => fmtAmount(d.total, d.currency) },
    ...(kind === 'invoice' ? [{ key: 'b', header: t('hub.balance'), hideOnMobile: true, cell: (d: DocRow) => (d.total - d.paidAmount > 0 && d.status !== 'void' ? fmtAmount(d.total - d.paidAmount, d.currency) : '—') }] : []),
    ...(ventureId ? [] : [{ key: 'venture', header: t('hub.ventures.project'), hideOnMobile: true, cell: (r: DocRow) => <VentureBadge id={r.ventureId} /> }]),
    { key: 's', header: t('common.status'), className: 'text-end', cell: (d) => <Badge tone={DOC_TONE[d.status]}>{t(`hub.doc_statuses.${d.status}`)}</Badge> },
  ];
  return (
    <div className="space-y-6">
      <PageHeader
        title={t(kind === 'invoice' ? 'hub.invoices' : 'hub.quotes')}
        description={t(kind === 'invoice' ? 'hub.invoices_subtitle' : 'hub.quotes_subtitle')}
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
            {t(kind === 'invoice' ? 'hub.new_invoice' : 'hub.new_quote')}
          </Button>
        }
      />
      <Tabs value={status} onChange={setStatus} tabs={tabs.map((v) => ({ value: v, label: v === 'all' ? t('hub.all') : v === 'unpaid' ? t('hub.unpaid') : t(`hub.doc_statuses.${v}`) }))} />
      <Card padded={false}>
        {q.isLoading ? (
          <SkeletonRows />
        ) : !q.data?.items.length ? (
          <EmptyState icon={<FileText className="size-6" />} title={t('hub.no_documents')} description={t('hub.no_documents_body')} />
        ) : (
          <DataTable columns={columns} rows={q.data.items} rowKey={(d) => d.id} onRowClick={(d) => navigate(`${base}/documents/${d.id}`)} />
        )}
      </Card>
      {creating && <DocumentDialog kind={kind} onClose={() => setCreating(false)} onSaved={(id) => navigate(`${base}/documents/${id}`)} />}
    </div>
  );
}

interface DocDetail {
  document: DocRow & { items: { serviceId: string | null; description: string; quantity: number; unitPrice: number; total: number }[]; subtotal: number; discount: number; notes: string; terms: string; projectId: string | null; sourceQuoteId: string | null };
  client: Client;
  payments: { id: string; amount: number; method: string; reference: string; paidAt: string; voidedAt: string | null; receivedByName: string | null }[];
  company: { name: string; address: string; phone: string; email: string; taxNumber: string; bankDetails: string };
}

function DocumentDialog({ kind, doc, onClose, onSaved }: { kind: 'quote' | 'invoice'; doc?: DocDetail['document']; onClose: () => void; onSaved: (id: string) => void }) {
  const { t } = useTranslation();
  const { ventureId } = useHubCtx();
  const qc = useQueryClient();
  const services = useServices();
  const plus = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };
  const [clientId, setClientId] = useState<string | null>(doc?.clientId ?? null);
  const [docVenture, setDocVenture] = useState<string | null>(doc ? doc.ventureId : ventureId);
  const [issueDate, setIssueDate] = useState(doc?.issueDate ?? today());
  const [dueDate, setDueDate] = useState(doc?.dueDate ?? plus(kind === 'quote' ? 30 : 14));
  const [discount, setDiscount] = useState(doc ? String(doc.discount / 100) : '');
  const [notes, setNotes] = useState(doc?.notes ?? '');
  const [items, setItems] = useState(
    doc?.items.map((i) => ({ serviceId: i.serviceId, description: i.description, quantity: String(i.quantity), unitPrice: String(i.unitPrice / 100) })) ?? [{ serviceId: null as string | null, description: '', quantity: '1', unitPrice: '' }],
  );
  const upd = (i: number, patch: Partial<(typeof items)[number]>) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const preview = useMemo(() => {
    const sub = items.reduce((a, i) => a + Math.round(parseAmount(i.unitPrice) * 100) * parseAmount(i.quantity), 0);
    return Math.max(0, Math.round(sub) - Math.round(parseAmount(discount) * 100));
  }, [items, discount]);
  const save = useMutation({
    mutationFn: () => {
      const body = {
        ventureId: docVenture,
        clientId,
        issueDate,
        dueDate: dueDate || null,
        discount: parseAmount(discount),
        notes,
        items: items.filter((i) => i.description.trim()).map((i) => ({ serviceId: i.serviceId, description: i.description.trim(), quantity: parseAmount(i.quantity), unitPrice: parseAmount(i.unitPrice) })),
      };
      return doc ? saApi.put<{ id: string }>(`/hub/documents/${doc.id}`, body) : saApi.post<{ id: string }>(`/hub/documents?kind=${kind}`, body);
    },
    onSuccess: (r) => {
      toast.success(t('common.saved'));
      invalidateHub(qc);
      onClose();
      onSaved(r.id);
    },
  });
  const cur = useCurrency();
  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={doc ? doc.number : t(kind === 'invoice' ? 'hub.new_invoice' : 'hub.new_quote')}
      footer={<SaveFooter onCancel={onClose} onSave={() => save.mutate()} saving={save.isPending} disabled={!clientId || !items.some((i) => i.description.trim())} />}
    >
      <div className="space-y-4">
        <FormError error={save.error} />
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <ClientSelect value={clientId} onChange={setClientId} required />
          </div>
          <VentureSelect value={docVenture} onChange={setDocVenture} />
          <Input type="date" label={t('common.date')} value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          <Input type="date" label={t(kind === 'invoice' ? 'hub.due_date' : 'hub.valid_until')} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <Input type="number" min={0} step="0.01" label={t('hub.discount')} value={discount} onChange={(e) => setDiscount(e.target.value)} />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold">{t('hub.items')}</p>
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-12 items-end gap-2 rounded-xl bg-slate-50 p-2 dark:bg-slate-800/50">
              <div className="col-span-12 sm:col-span-4">
                <ServiceSelect
                  value={it.serviceId}
                  onChange={(v, s) => upd(i, { serviceId: v, ...(s ? { description: it.description || s.name, unitPrice: it.unitPrice || String(s.price / 100) } : {}) })}
                />
              </div>
              <div className="col-span-12 sm:col-span-4">
                <Input label={t('hub.description')} aria-label={t('hub.description')} value={it.description} onChange={(e) => upd(i, { description: e.target.value })} />
              </div>
              <div className="col-span-4 sm:col-span-1">
                <Input label={t('hub.qty')} type="number" min={0} step="0.01" value={it.quantity} onChange={(e) => upd(i, { quantity: e.target.value })} />
              </div>
              <div className="col-span-6 sm:col-span-2">
                <Input label={t('hub.price')} type="number" min={0} step="0.01" value={it.unitPrice} onChange={(e) => upd(i, { unitPrice: e.target.value })} />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <button type="button" aria-label={t('common.delete')} disabled={items.length === 1} onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))} className="mb-2 rounded p-2 text-slate-400 hover:text-rose-600 disabled:opacity-30">
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
          <Button size="sm" variant="secondary" icon={<Plus className="size-4" />} onClick={() => setItems((xs) => [...xs, { serviceId: null, description: '', quantity: '1', unitPrice: '' }])}>
            {t('hub.add_line')}
          </Button>
          {services.length === 0 && <p className="text-xs text-slate-500">{t('hub.tip_add_services')}</p>}
        </div>
        <p className="text-end text-lg font-semibold">
          {t('hub.total')}: {fmtAmount(preview, cur)}
        </p>
        <Textarea label={t('common.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
    </Dialog>
  );
}

export function HubDocumentPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { base } = useHubCtx();
  const f = useFormat();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const toastErr = useToastError();
  const [editing, setEditing] = useState(false);
  const [paying, setPaying] = useState(false);
  const q = useQuery({ queryKey: ['sa', 'hub', 'document', id], queryFn: () => saApi.get<DocDetail>(`/hub/documents/${id}`) });
  const act = useMutation({
    mutationFn: (status: string) => saApi.post(`/hub/documents/${id}/status`, { status }),
    onSuccess: () => {
      toast.success(t('common.saved'));
      invalidateHub(qc);
    },
    onError: toastErr,
  });
  const convert = useMutation({
    mutationFn: () => saApi.post<{ id: string }>(`/hub/documents/${id}/convert`),
    onSuccess: (r) => {
      toast.success(t('hub.converted_to_invoice'));
      invalidateHub(qc);
      navigate(`${base}/documents/${r.id}`);
    },
    onError: toastErr,
  });
  const del = useMutation({
    mutationFn: () => saApi.delete(`/hub/documents/${id}`),
    onSuccess: () => {
      toast.success(t('common.deleted'));
      invalidateHub(qc);
      navigate(q.data?.document.kind === 'invoice' ? `${base}/invoices` : `${base}/quotes`);
    },
    onError: toastErr,
  });
  if (!q.data) return <SkeletonRows rows={6} />;
  const { document: d, client, payments } = q.data;
  const isQuote = d.kind === 'quote';
  const balance = d.total - d.paidAmount;
  return (
    <div className="space-y-6">
      <PageHeader
        title={<Ltr>{d.number}</Ltr>}
        description={`${t(isQuote ? 'hub.quote' : 'hub.invoice')} · ${client.name}`}
        back={<Link to={isQuote ? `${base}/quotes` : `${base}/invoices`}>{t('common.back')}</Link>}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={<Printer className="size-4" />} onClick={() => window.open(`/superadmin/hub/print/${d.id}`, '_blank', 'noopener')}>
              {t('hub.print_pdf')}
            </Button>
            {((isQuote && ['draft', 'sent'].includes(d.status)) || (!isQuote && d.status === 'draft')) && (
              <Button variant="secondary" onClick={() => setEditing(true)}>
                {t('common.edit')}
              </Button>
            )}
            {isQuote && d.status === 'draft' && <Button onClick={() => act.mutate('sent')}>{t('hub.mark_sent')}</Button>}
            {isQuote && ['draft', 'sent'].includes(d.status) && (
              <>
                <Button variant="secondary" onClick={() => act.mutate('rejected')}>
                  {t('hub.mark_rejected')}
                </Button>
                <Button onClick={() => act.mutate('accepted')}>{t('hub.mark_accepted')}</Button>
              </>
            )}
            {isQuote && d.status === 'accepted' && (
              <Button loading={convert.isPending} onClick={() => convert.mutate()}>
                {t('hub.convert_to_invoice')}
              </Button>
            )}
            {!isQuote && d.status === 'draft' && <Button onClick={() => act.mutate('issued')}>{t('hub.issue')}</Button>}
            {!isQuote && ['issued', 'partially_paid'].includes(d.status) && (
              <Button icon={<Banknote className="size-4" />} onClick={() => setPaying(true)}>
                {t('hub.record_payment')}
              </Button>
            )}
            {d.status === 'draft' && (
              <Button variant="ghost" className="text-rose-600" icon={<Trash2 className="size-4" />} onClick={() => del.mutate()}>
                {t('common.delete')}
              </Button>
            )}
          </div>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-800">
                <th className="py-2 text-start">{t('hub.description')}</th>
                <th className="py-2 text-end">{t('hub.qty')}</th>
                <th className="py-2 text-end">{t('hub.price')}</th>
                <th className="py-2 text-end">{t('hub.amount')}</th>
              </tr>
            </thead>
            <tbody>
              {d.items.map((i, k) => (
                <tr key={k} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-2" dir="auto">
                    {i.description}
                  </td>
                  <td className="py-2 text-end tabular-nums">{i.quantity}</td>
                  <td className="py-2 text-end tabular-nums">{fmtAmount(i.unitPrice, d.currency)}</td>
                  <td className="py-2 text-end tabular-nums">{fmtAmount(i.total, d.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="mt-4 space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">{t('hub.subtotal')}</dt>
              <dd>{fmtAmount(d.subtotal, d.currency)}</dd>
            </div>
            {d.discount > 0 && (
              <div className="flex justify-between">
                <dt className="text-slate-500">{t('hub.discount')}</dt>
                <dd>− {fmtAmount(d.discount, d.currency)}</dd>
              </div>
            )}
            <div className="flex justify-between text-base font-semibold">
              <dt>{t('hub.total')}</dt>
              <dd>{fmtAmount(d.total, d.currency)}</dd>
            </div>
            {!isQuote && (
              <div className="flex justify-between font-semibold text-amber-700">
                <dt>{t('hub.balance')}</dt>
                <dd>{fmtAmount(balance, d.currency)}</dd>
              </div>
            )}
          </dl>
          {d.notes && (
            <p className="mt-4 text-sm whitespace-pre-line text-slate-600" dir="auto">
              {d.notes}
            </p>
          )}
        </Card>
        <Card>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">{t('common.status')}</dt>
              <dd>
                <Badge tone={DOC_TONE[d.status]}>{t(`hub.doc_statuses.${d.status}`)}</Badge>
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">{t('common.date')}</dt>
              <dd>{f.date(d.issueDate)}</dd>
            </div>
            {d.dueDate && (
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">{t(isQuote ? 'hub.valid_until' : 'hub.due_date')}</dt>
                <dd>{f.date(d.dueDate)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">{t('hub.ventures.project')}</dt>
              <dd>
                <VentureBadge id={d.ventureId} />
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">{t('hub.client')}</dt>
              <dd className="text-end" dir="auto">
                {client.name}
                {client.company && <span className="block text-xs text-slate-500">{client.company}</span>}
              </dd>
            </div>
          </dl>
          {payments.length > 0 && (
            <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-sm dark:border-slate-800">
              <p className="font-semibold">{t('hub.payments')}</p>
              {payments.map((p) => (
                <p key={p.id} className="flex justify-between gap-2">
                  <span>
                    {f.date(p.paidAt)} · {t(`hub.methods.${p.method}`)}
                    {p.reference && <Ltr> · {p.reference}</Ltr>}
                  </span>
                  <span className="font-medium">{fmtAmount(p.amount, d.currency)}</span>
                </p>
              ))}
            </div>
          )}
        </Card>
      </div>
      {editing && <DocumentDialog kind={d.kind} doc={d} onClose={() => setEditing(false)} onSaved={() => void qc.invalidateQueries({ queryKey: ['sa', 'hub', 'document', id] })} />}
      {paying && <PaymentDialog id={d.id} balance={balance} currency={d.currency} onClose={() => setPaying(false)} />}
    </div>
  );
}

function PaymentDialog({ id, balance, currency, onClose }: { id: string; balance: number; currency: string; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [f, setF] = useState({ amount: (balance / 100).toFixed(2), method: 'bank_transfer', reference: '', paidAt: today() });
  const save = useMutation({
    mutationFn: () => saApi.post(`/hub/documents/${id}/payments`, { ...f, amount: parseAmount(f.amount) }),
    onSuccess: () => {
      toast.success(t('hub.payment_recorded'));
      invalidateHub(qc);
      onClose();
    },
  });
  return (
    <Dialog open onClose={onClose} size="sm" title={t('hub.record_payment')} description={`${t('hub.balance')}: ${fmtAmount(balance, currency)}`} footer={<SaveFooter onCancel={onClose} onSave={() => save.mutate()} saving={save.isPending} disabled={parseAmount(f.amount) <= 0} />}>
      <div className="space-y-4">
        <FormError error={save.error} />
        <Input label={t('hub.amount')} type="number" min={0} step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} autoFocus />
        <Select label={t('hub.method')} value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>
          {HUB_PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {t(`hub.methods.${m}`)}
            </option>
          ))}
        </Select>
        <Input label={t('hub.reference')} value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} />
        <Input type="date" label={t('common.date')} value={f.paidAt} onChange={(e) => setF({ ...f, paidAt: e.target.value })} />
      </div>
    </Dialog>
  );
}

