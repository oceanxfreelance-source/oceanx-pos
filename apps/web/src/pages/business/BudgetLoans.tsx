import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import clsx from 'clsx';
import { ArrowLeft, BellRing, Check, HandCoins, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useBiz, useBizSession } from '../../auth/business';
import { useMoney } from '../../lib/money';
import { useFormat } from '../../lib/format';
import { useFieldErrors } from '../../lib/useApiError';
import { Card, EmptyState, SkeletonRows } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Form';
import { ConfirmDialog, Dialog } from '../../components/ui/Dialog';

type Side = 'gave' | 'took';
interface Person {
  id: string;
  name: string;
  phone: string;
  owesMe: number;
  iOwe: number;
  gaveCount: number;
  tookCount: number;
  gaveTotal: number;
  tookTotal: number;
  gaveDue: string | null;
  tookDue: string | null;
  lastGave: string | null;
  lastTook: string | null;
  lastBack: string | null;
}
interface LoanList {
  today: string;
  owesMe: number;
  iOwe: number;
  people: Person[];
}
interface Entry {
  id: string;
  kind: 'gave' | 'took' | 'received' | 'repaid';
  amount: number;
  occurredOn: string;
  dueOn: string | null;
  note: string;
}
interface ReminderPerson {
  id: string;
  name: string;
  phone: string;
  amount: number;
  due: string | null;
}

const KEY = ['biz', 'budget', 'loans'] as const;
const refresh = (qc: ReturnType<typeof useQueryClient>) => qc.invalidateQueries({ queryKey: KEY });

/** Is the Loans feature on for this account (early access from Super Admin, or for everyone)? */
export function useLoansOn() {
  const { session } = useBiz();
  return !!session?.features?.includes('loans');
}

const AVATAR = ['bg-orange-500', 'bg-sky-500', 'bg-violet-500', 'bg-teal-500', 'bg-rose-500', 'bg-amber-500', 'bg-indigo-500'];
function Avatar({ name, muted }: { name: string; muted?: boolean }) {
  const color = muted ? 'bg-slate-400' : AVATAR[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR.length];
  return <span className={clsx('flex size-10 shrink-0 items-center justify-center rounded-full font-bold text-white', color)}>{name.trim().slice(0, 1).toUpperCase()}</span>;
}

/** The polite reminder text for someone who owes money, ready to send (or edit) in Viber, SMS or any app. */
function useReminderText() {
  const { t } = useTranslation();
  const money = useMoney();
  return (name: string, amount: number) => t('loans.reminder_text', { name: name.split(' ')[0], amount: money(amount) });
}

/** Opens the phone's share sheet (Viber, SMS, WhatsApp…); without one, an SMS to the number or a copy. */
async function sendReminder(text: string, phone: string, copied: () => void) {
  const nav = navigator as Navigator & { share?: (d: { text: string }) => Promise<void> };
  if (nav.share) {
    try {
      await nav.share({ text });
      return;
    } catch {
      /* closed: fall through to SMS or copy */
    }
  }
  if (phone) {
    window.location.href = `sms:${phone.replace(/\s/g, '')}?&body=${encodeURIComponent(text)}`;
    return;
  }
  await navigator.clipboard?.writeText(text).catch(() => undefined);
  copied();
}

// ---------------------------------------------------------------- new loan
function NewLoanDialog({ side: initialSide, person, today, onClose }: { side: Side; person?: Person; today: string; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const money = useMoney();
  const navigate = useNavigate();
  const [side, setSide] = useState<Side>(initialSide);
  const [name, setName] = useState(person?.name ?? '');
  const [phone, setPhone] = useState(person?.phone ?? '');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today);
  const [due, setDue] = useState('');
  const [note, setNote] = useState('');
  const save = useMutation({
    mutationFn: () =>
      api.post<{ id: string; personId: string }>('/budget/loans', {
        side,
        ...(person ? { personId: person.id } : { name, phone }),
        amount: amount.trim(),
        occurredOn: date,
        dueOn: due || null,
        note,
      }),
    onSuccess: (r) => {
      toast.success(t('loans.saved'));
      void refresh(qc);
      onClose();
      if (!person) navigate(`/loans/${r.personId}`);
    },
  });
  const fieldErr = useFieldErrors(save.error);
  return (
    <Dialog
      open
      onClose={onClose}
      title={person ? t('loans.new_with', { name: person.name }) : t('loans.new')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!amount.trim() || (!person && !name.trim())}>
            {t('loans.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div role="radiogroup" aria-label={t('loans.type')} className="grid grid-cols-2 gap-2">
          {(['gave', 'took'] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={side === s}
              onClick={() => setSide(s)}
              className={clsx(
                'rounded-xl px-3 py-2.5 text-sm font-semibold ring-2',
                side === s ? (s === 'gave' ? 'bg-emerald-50 text-emerald-800 ring-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-rose-50 text-rose-800 ring-rose-600 dark:bg-rose-950/40 dark:text-rose-300') : 'ring-slate-200 dark:ring-slate-700',
              )}
            >
              {s === 'gave' ? t('loans.i_gave_money') : t('loans.i_took_money')}
            </button>
          ))}
        </div>
        {!person && (
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('loans.person')} value={name} onChange={(e) => setName(e.target.value)} error={fieldErr('name')} maxLength={60} autoFocus dir="auto" />
            <Input label={t('loans.phone_optional')} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" maxLength={30} dir="ltr" />
          </div>
        )}
        <Input label={`${t('flow.amount')} (${money.symbol})`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} error={fieldErr('amount')} placeholder="0.00" dir="ltr" autoFocus={!!person} />
        <div className="grid grid-cols-2 gap-3">
          <Input label={t('flow.date')} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input label={t('loans.return_by')} type="date" value={due} onChange={(e) => setDue(e.target.value)} hint={t('loans.optional')} />
        </div>
        <Input label={t('flow.note')} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} dir="auto" />
        <p className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          <BellRing className="mt-0.5 size-4 shrink-0" /> {t('loans.reminder_hint')}
        </p>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- money back
function PaymentDialog({ person, side, today, onClose }: { person: Person; side: Side; today: string; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const money = useMoney();
  const owed = side === 'gave' ? person.owesMe : person.iOwe;
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const save = useMutation({
    mutationFn: (all: boolean) => api.post(`/budget/loans/people/${person.id}/payments`, { side, all, ...(all ? {} : { amount: amount.trim() }), occurredOn: date, note }),
    onSuccess: () => {
      toast.success(t('common.saved'));
      void refresh(qc);
      onClose();
    },
  });
  const fieldErr = useFieldErrors(save.error);
  return (
    <Dialog
      open
      onClose={onClose}
      title={side === 'gave' ? t('loans.got_back_from', { name: person.name }) : t('loans.paid_back_to', { name: person.name })}
      description={side === 'gave' ? t('loans.still_owes', { name: person.name, amount: money(owed) }) : t('loans.you_still_owe', { name: person.name, amount: money(owed) })}
      footer={
        <>
          <Button variant="secondary" onClick={() => save.mutate(true)} loading={save.isPending && save.variables === true} icon={<Check className="size-4" />}>
            {t('loans.all_of_it', { amount: money(owed) })}
          </Button>
          <Button onClick={() => save.mutate(false)} loading={save.isPending && save.variables === false} disabled={!amount.trim()}>
            {t('loans.save_part')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label={`${t('loans.amount_back')} (${money.symbol})`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} error={fieldErr('amount')} placeholder="0.00" dir="ltr" autoFocus />
        <div className="grid grid-cols-2 gap-3">
          <Input label={t('flow.date')} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input label={t('flow.note')} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} dir="auto" />
        </div>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- the Loans tab
function PersonRow({ p, side, today }: { p: Person; side: Side; today: string }) {
  const { t } = useTranslation();
  const money = useMoney();
  const f = useFormat();
  const amount = side === 'gave' ? p.owesMe : p.iOwe;
  const due = side === 'gave' ? p.gaveDue : p.tookDue;
  const count = side === 'gave' ? p.gaveCount : p.tookCount;
  const last = side === 'gave' ? p.lastGave : p.lastTook;
  const paidBack = amount <= 0;
  return (
    <li>
      <Link to={`/loans/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50">
        <Avatar name={p.name} muted={paidBack} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold" dir="auto">
            {p.name}
          </span>
          <span className="block truncate text-xs text-slate-500">{paidBack ? t('loans.paid_back_on', { date: p.lastBack ? f.date(p.lastBack) : '' }) : t('loans.count_since', { count, date: last ? f.date(last) : '' })}</span>
        </span>
        <span className="text-end">
          <span className={clsx('block font-bold tabular-nums', paidBack && 'text-emerald-600')}>
            {paidBack ? `${money(side === 'gave' ? p.gaveTotal : p.tookTotal)} ✓` : money(amount)}
          </span>
          {!paidBack && (
            <span className={clsx('block text-xs font-semibold', due && due < today ? 'text-rose-600' : due ? 'text-amber-600' : 'text-slate-400')}>
              {due ? (due < today ? t('loans.overdue') : t('loans.due_on', { date: f.date(due) })) : t('loans.salary_day')}
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}

export function BudgetLoansPage() {
  const { t } = useTranslation();
  const money = useMoney();
  const { can } = useBiz();
  const [side, setSide] = useState<Side>('gave');
  const [adding, setAdding] = useState(false);
  const q = useQuery({ queryKey: KEY, queryFn: () => api.get<LoanList>('/budget/loans') });
  if (!q.data) return <SkeletonRows rows={6} />;
  const d = q.data;
  const mine = d.people.filter((p) => (side === 'gave' ? p.gaveCount : p.tookCount) > 0);
  const open = mine.filter((p) => (side === 'gave' ? p.owesMe : p.iOwe) > 0);
  const done = mine.filter((p) => (side === 'gave' ? p.owesMe : p.iOwe) <= 0);
  return (
    <div className="mx-auto max-w-xl space-y-4 pb-24">
      <h1 className="flex items-center gap-2 text-xl font-bold">
        <HandCoins className="size-6 text-brand-700" /> {t('loans.title')}
      </h1>
      <section className="gravity-surface grid grid-cols-2 gap-3 rounded-3xl p-4 text-white">
        <div className="rounded-2xl bg-white/10 p-3">
          <p className="text-xs text-white/80">{t('loans.people_owe_me')}</p>
          <p className="mt-1 text-xl font-bold whitespace-nowrap text-emerald-300 tabular-nums">{money(d.owesMe)}</p>
        </div>
        <div className="rounded-2xl bg-white/10 p-3">
          <p className="text-xs text-white/80">{t('loans.i_owe')}</p>
          <p className="mt-1 text-xl font-bold whitespace-nowrap text-rose-300 tabular-nums">{money(d.iOwe)}</p>
        </div>
      </section>
      <div role="tablist" className="grid grid-cols-2 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
        {(['gave', 'took'] as const).map((s) => (
          <button key={s} type="button" role="tab" aria-selected={side === s} onClick={() => setSide(s)} className={clsx('rounded-xl py-2 text-sm font-semibold', side === s ? 'bg-white shadow-sm dark:bg-slate-900' : 'text-slate-500')}>
            {s === 'gave' ? t('loans.tab_gave') : t('loans.tab_took')}
          </button>
        ))}
      </div>
      {mine.length === 0 ? (
        <EmptyState icon={<HandCoins className="size-6" />} title={side === 'gave' ? t('loans.empty_gave') : t('loans.empty_took')} description={t('loans.empty_hint')} />
      ) : (
        <>
          {open.length > 0 && (
            <Card padded={false}>
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {open.map((p) => (
                  <PersonRow key={p.id} p={p} side={side} today={d.today} />
                ))}
              </ul>
            </Card>
          )}
          {side === 'took' && open.length > 0 && (
            <p className="flex items-start gap-2 rounded-2xl bg-rose-50 p-3 text-sm text-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
              <BellRing className="mt-0.5 size-4 shrink-0" /> {t('loans.took_reminder_note')}
            </p>
          )}
          {done.length > 0 && (
            <div>
              <h2 className="mb-2 px-1 text-sm font-semibold text-slate-500">{t('loans.paid_back')}</h2>
              <Card padded={false}>
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {done.map((p) => (
                    <PersonRow key={p.id} p={p} side={side} today={d.today} />
                  ))}
                </ul>
              </Card>
            </div>
          )}
        </>
      )}
      {can('budget.manage') && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="fixed end-4 bottom-[calc(5rem+var(--safe-bottom,0px))] z-30 inline-flex items-center gap-2 rounded-full bg-brand-700 px-5 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-900/25 hover:bg-brand-800 lg:bottom-8"
        >
          <Plus className="size-5" /> {t('loans.new')}
        </button>
      )}
      {adding && <NewLoanDialog side={side} today={d.today} onClose={() => setAdding(false)} />}
    </div>
  );
}

// ---------------------------------------------------------------- one person
export function LoanPersonPage() {
  const { t } = useTranslation();
  const money = useMoney();
  const f = useFormat();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { can } = useBiz();
  const { id } = useParams();
  const reminderText = useReminderText();
  const [dialog, setDialog] = useState<null | { kind: 'loan' | 'pay'; side: Side }>(null);
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState<null | 'person' | Entry>(null);
  const q = useQuery({ queryKey: [...KEY, 'person', id], queryFn: () => api.get<{ person: Person; entries: Entry[] }>(`/budget/loans/people/${id}`) });
  const list = useQuery({ queryKey: KEY, queryFn: () => api.get<LoanList>('/budget/loans') });
  const remove = useMutation({
    mutationFn: (what: 'person' | Entry) => (what === 'person' ? api.delete(`/budget/loans/people/${id}`) : api.delete(`/budget/loans/entries/${what.id}`)),
    onSuccess: (_r, what) => {
      void refresh(qc);
      setRemoving(null);
      if (what === 'person') navigate('/loans', { replace: true });
    },
  });
  if (!q.data || !list.data) return <SkeletonRows rows={6} />;
  const { person: p, entries } = q.data;
  const today = list.data.today;
  const manage = can('budget.manage');
  const sides = (['gave', 'took'] as const).filter((s) => (s === 'gave' ? p.gaveCount : p.tookCount) > 0);
  return (
    <div className="mx-auto max-w-xl space-y-4 pb-16">
      <div className="flex items-center gap-2">
        <Link to="/loans" className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={t('loans.title')}>
          <ArrowLeft className="rtl-flip size-5" />
        </Link>
        <Avatar name={p.name} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold" dir="auto">
            {p.name}
          </h1>
          {p.phone && (
            <p className="text-xs text-slate-500" dir="ltr">
              {p.phone}
            </p>
          )}
        </div>
        {manage && (
          <button type="button" onClick={() => setEditing(true)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={t('common.edit')}>
            <Pencil className="size-4" />
          </button>
        )}
      </div>

      {sides.map((side) => {
        const owed = side === 'gave' ? p.owesMe : p.iOwe;
        const due = side === 'gave' ? p.gaveDue : p.tookDue;
        return (
          <Card key={side}>
            <p className="text-center text-sm text-slate-500">{side === 'gave' ? t('loans.still_owes_you', { name: p.name }) : t('loans.you_owe_name', { name: p.name })}</p>
            <p className={clsx('text-center text-3xl font-bold tabular-nums', owed <= 0 ? 'text-slate-400' : side === 'gave' ? 'text-emerald-600' : 'text-rose-600')}>{money(Math.max(owed, 0))}</p>
            {owed > 0 ? (
              <p className={clsx('mt-1 text-center text-xs font-semibold', due && due < today ? 'text-rose-600' : 'text-slate-500')}>{due ? (due < today ? t('loans.overdue') : t('loans.due_reminder', { date: f.date(due) })) : t('loans.salary_day_reminder')}</p>
            ) : (
              <p className="mt-1 text-center text-xs font-semibold text-emerald-600">{t('loans.fully_paid')} ✓</p>
            )}
            {manage && (
              <div className="mt-4 grid grid-cols-2 gap-2">
                {owed > 0 && (
                  <Button onClick={() => setDialog({ kind: 'pay', side })} icon={<Check className="size-4" />}>
                    {side === 'gave' ? t('loans.got_money_back') : t('loans.i_paid_back')}
                  </Button>
                )}
                <Button variant="secondary" onClick={() => setDialog({ kind: 'loan', side })} icon={<Plus className="size-4" />} className={owed > 0 ? '' : 'col-span-2'}>
                  {side === 'gave' ? t('loans.gave_more') : t('loans.took_more')}
                </Button>
                {side === 'gave' && owed > 0 && (
                  <Button variant="subtle" className="col-span-2" icon={<Send className="size-4" />} onClick={() => void sendReminder(reminderText(p.name, owed), p.phone, () => toast.success(t('loans.copied')))}>
                    {t('loans.send_reminder')}
                  </Button>
                )}
              </div>
            )}
          </Card>
        );
      })}

      <div>
        <h2 className="mb-2 px-1 text-sm font-semibold text-slate-500">{t('loans.history')}</h2>
        <Card padded={false}>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{t(`loans.kind_${e.kind}`, { amount: money(e.amount) })}</span>
                  <span className="block truncate text-xs text-slate-500" dir="auto">
                    {f.date(e.occurredOn)}
                    {e.note ? ` · ${e.note}` : ''}
                    {e.dueOn ? ` · ${t('loans.due_on', { date: f.date(e.dueOn) })}` : ''}
                  </span>
                </span>
                <span className={clsx('font-bold tabular-nums', e.kind === 'received' || e.kind === 'repaid' ? 'text-emerald-600' : '')}>
                  {e.kind === 'received' || e.kind === 'repaid' ? '−' : '+'}
                  {money(e.amount)}
                </span>
                {manage && (
                  <button type="button" onClick={() => setRemoving(e)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-slate-800" aria-label={t('common.delete')}>
                    <Trash2 className="size-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>
      {manage && (
        <button type="button" onClick={() => setRemoving('person')} className="mx-auto block text-sm font-medium text-rose-600">
          {t('loans.remove_person', { name: p.name })}
        </button>
      )}

      {dialog?.kind === 'loan' && <NewLoanDialog side={dialog.side} person={p} today={today} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'pay' && <PaymentDialog person={p} side={dialog.side} today={today} onClose={() => setDialog(null)} />}
      {editing && <EditPersonDialog person={p} onClose={() => setEditing(false)} />}
      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        danger
        title={removing === 'person' ? t('loans.remove_person', { name: p.name }) : t('loans.remove_entry')}
        message={removing === 'person' ? t('loans.remove_person_body') : t('loans.remove_entry_body')}
        confirmLabel={t('common.delete')}
        loading={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing)}
      />
    </div>
  );
}

function EditPersonDialog({ person, onClose }: { person: Person; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [name, setName] = useState(person.name);
  const [phone, setPhone] = useState(person.phone);
  const save = useMutation({
    mutationFn: () => api.patch(`/budget/loans/people/${person.id}`, { name, phone }),
    onSuccess: () => {
      void refresh(qc);
      onClose();
    },
  });
  const fieldErr = useFieldErrors(save.error);
  return (
    <Dialog
      open
      onClose={onClose}
      title={t('common.edit')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!name.trim()}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label={t('loans.person')} value={name} onChange={(e) => setName(e.target.value)} error={fieldErr('name')} maxLength={60} dir="auto" />
        <Input label={t('loans.phone_optional')} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" maxLength={30} dir="ltr" />
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- salary-day reminder on the home screen
const laterKey = (today: string) => `ox.loanReminder.later.${today}`;

/**
 * On salary day (the 30th) and after it, or on a return date: money to collect and money to give back.
 * "Later" hides it until tomorrow.
 */
export function LoanReminderCard() {
  const { t } = useTranslation();
  const money = useMoney();
  const reminderText = useReminderText();
  const session = useBizSession();
  const [, force] = useState(0);
  const on = !!session.features?.includes('loans');
  const q = useQuery({ queryKey: [...KEY, 'reminder'], queryFn: () => api.get<{ today: string; salaryDay: boolean; collect: ReminderPerson[]; giveBack: ReminderPerson[] }>('/budget/loans/reminder'), enabled: on });
  if (!on || !q.data) return null;
  const { today, collect, giveBack, salaryDay } = q.data;
  let later = false;
  try {
    later = localStorage.getItem(laterKey(today)) === '1';
  } catch {
    /* storage blocked: always show */
  }
  if (later || (!collect.length && !giveBack.length)) return null;
  const hide = () => {
    try {
      localStorage.setItem(laterKey(today), '1');
    } catch {
      /* storage blocked */
    }
    force((x) => x + 1);
  };
  const list = (people: ReminderPerson[]) => people.map((p) => `${p.name} ${money(p.amount)}`).join(' · ');
  return (
    <div className="space-y-3">
      {collect.length > 0 && (
        <section className="rounded-2xl bg-emerald-50 p-4 text-emerald-950 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-100 dark:ring-emerald-800">
          <p className="font-semibold">💰 {salaryDay ? t('loans.card_collect_title') : t('loans.card_due_title')}</p>
          <p className="mt-1 text-sm" dir="auto">
            {t('loans.card_collect_body', { list: list(collect) })}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {collect.map((p) => (
              <Button key={p.id} size="sm" icon={<Send className="size-4" />} onClick={() => void sendReminder(reminderText(p.name, p.amount), p.phone, () => toast.success(t('loans.copied')))}>
                {t('loans.remind_name', { name: p.name.split(' ')[0] })}
              </Button>
            ))}
            <Link to="/loans" className="rounded-xl px-3 py-1.5 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-300 dark:text-emerald-200">
              {t('loans.open_loans')}
            </Link>
            <button type="button" onClick={hide} className="ms-auto rounded-xl px-3 py-1.5 text-sm font-medium text-emerald-800/80 dark:text-emerald-200/80">
              {t('loans.later')}
            </button>
          </div>
        </section>
      )}
      {giveBack.length > 0 && (
        <section className="rounded-2xl bg-rose-50 p-4 text-rose-950 ring-1 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-100 dark:ring-rose-800">
          <p className="font-semibold">🔴 {salaryDay ? t('loans.card_return_title') : t('loans.card_return_due_title')}</p>
          <p className="mt-1 text-sm" dir="auto">
            {t('loans.card_return_body', { list: list(giveBack) })}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to="/loans" className="rounded-xl bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white">
              {t('loans.open_loans')}
            </Link>
            {!collect.length && (
              <button type="button" onClick={hide} className="ms-auto rounded-xl px-3 py-1.5 text-sm font-medium text-rose-800/80 dark:text-rose-200/80">
                {t('loans.later')}
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
