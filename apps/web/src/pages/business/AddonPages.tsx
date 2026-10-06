import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarClock, Check, Globe, Mic2, Plus, X } from 'lucide-react';
import { BOOKING_STATUSES, RESERVATION_STATUSES } from '@oceanx/shared';
import { api } from '../../lib/api';
import { useBiz } from '../../auth/business';
import { useFormat } from '../../lib/format';
import { parseAmount, useMoney } from '../../lib/money';
import { useErrorMessage, useFieldErrors, useToastError } from '../../lib/useApiError';
import { Alert, Badge, Card, CardHeader, EmptyState, Ltr, PageHeader, SkeletonRows } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select, Switch, Textarea } from '../../components/ui/Form';
import { Dialog } from '../../components/ui/Dialog';
import { StatusBadge } from '../../components/StatusBadge';
import { CustomerPicker } from '../../components/Pickers';
import { useTables } from './Tables';

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
const time = (iso: string) => new Date(iso).toTimeString().slice(0, 5);
const sameDay = (iso: string, day: string) => toLocalInput(new Date(iso)).slice(0, 10) === day;

// ================================================================== KARAOKE
interface Room {
  id: string;
  name: string;
  capacity: number;
  hourlyRate: number;
  isActive: boolean;
  notes: string;
}
interface Booking {
  id: string;
  roomId: string;
  roomName: string;
  customerName: string;
  customerPhone: string;
  startAt: string;
  endAt: string;
  status: string;
  total: number;
  paidAmount: number;
  notes: string;
}

export function KaraokePage() {
  const { t } = useTranslation();
  const { can } = useBiz();
  const money = useMoney();
  const qc = useQueryClient();
  const toastErr = useToastError();
  const [day, setDay] = useState(localToday());
  const rooms = useQuery({ queryKey: ['biz', 'karaoke', 'rooms'], queryFn: () => api.get<{ items: Room[] }>('/karaoke/rooms') });
  const bookings = useQuery({ queryKey: ['biz', 'karaoke', 'bookings', day], queryFn: () => api.get<{ items: Booking[] }>(`/karaoke/bookings?date=${day}`), refetchInterval: 30_000 });
  const [room, setRoom] = useState<Room | 'new' | null>(null);
  const [booking, setBooking] = useState<{ roomId: string } | null>(null);
  const [paying, setPaying] = useState<Booking | null>(null);
  const status = useMutation({
    mutationFn: ({ id, s }: { id: string; s: string }) => api.patch(`/karaoke/bookings/${id}/status`, { status: s }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['biz', 'karaoke', 'bookings'] }),
    onError: toastErr,
  });
  const dayBookings = bookings.data?.items.filter((b) => sameDay(b.startAt, day)) ?? [];
  return (
    <div className="space-y-6">
      <PageHeader
        title={t('karaoke.title')}
        description={t('karaoke.subtitle')}
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <Input type="date" aria-label={t('common.date')} value={day} onChange={(e) => setDay(e.target.value)} />
            {can('karaoke.manage') && (
              <Button variant="secondary" icon={<Plus className="size-4" />} onClick={() => setRoom('new')}>
                {t('karaoke.add_room')}
              </Button>
            )}
          </div>
        }
      />
      {!rooms.data ? (
        <SkeletonRows />
      ) : rooms.data.items.length === 0 ? (
        <Card>
          <EmptyState icon={<Mic2 className="size-6" />} title={t('karaoke.no_rooms')} description={t('karaoke.no_rooms_body')} />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rooms.data.items.map((r) => {
            const list = dayBookings.filter((b) => b.roomId === r.id);
            return (
              <Card key={r.id} padded={false}>
                <CardHeader
                  title={
                    <span className="flex items-center gap-2" dir="auto">
                      {r.name} {!r.isActive && <Badge>{t('common.inactive')}</Badge>}
                    </span>
                  }
                  description={`${t('tables.seats', { count: r.capacity })} · ${money(r.hourlyRate)} / ${t('karaoke.hour')}`}
                  actions={
                    can('karaoke.manage') && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setRoom(r)}>
                          {t('common.edit')}
                        </Button>
                        {r.isActive && (
                          <Button size="sm" onClick={() => setBooking({ roomId: r.id })}>
                            {t('karaoke.book')}
                          </Button>
                        )}
                      </div>
                    )
                  }
                />
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {list.length === 0 && <li className="px-5 py-4 text-sm text-slate-400">{t('karaoke.no_bookings')}</li>}
                  {list.map((b) => (
                    <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                      <div>
                        <p className="font-medium">
                          <Ltr>{`${time(b.startAt)}–${time(b.endAt)}`}</Ltr> · <span dir="auto">{b.customerName}</span>
                        </p>
                        <p className="text-xs text-slate-500">
                          {money(b.total)} · {t('invoices.paid')} {money(b.paidAmount)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {can('karaoke.manage') && b.paidAmount < b.total && b.status !== 'cancelled' && (
                          <Button size="sm" variant="ghost" onClick={() => setPaying(b)}>
                            {t('karaoke.take_payment')}
                          </Button>
                        )}
                        {can('karaoke.manage') ? (
                          <Select aria-label={t('common.status')} value={b.status} onChange={(e) => status.mutate({ id: b.id, s: e.target.value })}>
                            {BOOKING_STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {t(`status_labels.${s}`)}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          <StatusBadge status={b.status} />
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
      {room && <RoomDialog room={room === 'new' ? null : room} onClose={() => setRoom(null)} />}
      {booking && <BookingDialog roomId={booking.roomId} rooms={rooms.data?.items ?? []} day={day} onClose={() => setBooking(null)} />}
      {paying && <BookingPaymentDialog booking={paying} onClose={() => setPaying(null)} />}
    </div>
  );
}

function RoomDialog({ room, onClose }: { room: Room | null; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: room?.name ?? '', capacity: String(room?.capacity ?? 8), hourlyRate: room ? String(room.hourlyRate / 100) : '', isActive: room?.isActive ?? true, notes: room?.notes ?? '' });
  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, capacity: Math.max(1, Math.floor(parseAmount(form.capacity))), hourlyRate: parseAmount(form.hourlyRate) };
      return room ? api.put(`/karaoke/rooms/${room.id}`, body) : api.post('/karaoke/rooms', body);
    },
    onSuccess: () => {
      toast.success(t('common.saved'));
      void qc.invalidateQueries({ queryKey: ['biz', 'karaoke', 'rooms'] });
      onClose();
    },
  });
  const fe = useFieldErrors(save.error);
  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      title={room ? t('karaoke.edit_room') : t('karaoke.add_room')}
      footer={
        <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!form.name.trim()}>
          {t('common.save')}
        </Button>
      }
    >
      <div className="space-y-4">
        <Input label={t('common.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={fe('name')} />
        <Input type="number" min={1} label={t('tables.capacity')} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
        <Input type="number" min={0} step="0.01" label={t('karaoke.hourly_rate')} value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })} error={fe('hourlyRate')} />
        <Textarea label={t('common.notes')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <Switch checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} label={t('common.active')} />
      </div>
    </Dialog>
  );
}

function BookingDialog({ roomId, rooms, day, onClose }: { roomId: string; rooms: Room[]; day: string; onClose: () => void }) {
  const { t } = useTranslation();
  const money = useMoney();
  const qc = useQueryClient();
  const errMsg = useErrorMessage();
  const start = new Date(`${day}T19:00`);
  const [form, setForm] = useState({ roomId, customerId: null as string | null, customerLabel: '', customerName: '', customerPhone: '', startAt: toLocalInput(start), endAt: toLocalInput(new Date(start.getTime() + 2 * 3_600_000)), deposit: '0', notes: '' });
  const room = rooms.find((r) => r.id === form.roomId);
  const minutes = Math.max(0, (new Date(form.endAt).getTime() - new Date(form.startAt).getTime()) / 60_000);
  const save = useMutation({
    mutationFn: () =>
      api.post('/karaoke/bookings', {
        roomId: form.roomId,
        customerId: form.customerId,
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        startAt: new Date(form.startAt).toISOString(),
        endAt: new Date(form.endAt).toISOString(),
        deposit: parseAmount(form.deposit),
        notes: form.notes,
      }),
    onSuccess: () => {
      toast.success(t('karaoke.booked'));
      void qc.invalidateQueries({ queryKey: ['biz', 'karaoke', 'bookings'] });
      onClose();
    },
  });
  const fe = useFieldErrors(save.error);
  return (
    <Dialog
      open
      onClose={onClose}
      title={t('karaoke.book')}
      description={room && minutes > 0 ? `${t('karaoke.estimated')}: ${money(Math.round((room.hourlyRate * minutes) / 60))}` : undefined}
      footer={
        <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!form.customerName.trim() || minutes <= 0}>
          {t('karaoke.book')}
        </Button>
      }
    >
      <div className="space-y-4">
        {save.error && <Alert tone="red">{errMsg(save.error)}</Alert>}
        <Select label={t('karaoke.room')} value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })}>
          {rooms
            .filter((r) => r.isActive)
            .map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
        </Select>
        <CustomerPicker
          label={t('customers.customer')}
          value={form.customerId}
          valueLabel={form.customerLabel}
          onChange={(id, c) => setForm({ ...form, customerId: id, customerLabel: c?.name ?? '', customerName: c?.name ?? form.customerName, customerPhone: c?.phone ?? form.customerPhone })}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label={t('common.name')} value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} error={fe('customerName')} />
          <Input label={t('common.phone')} dir="ltr" value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} error={fe('customerPhone')} />
          <Input type="datetime-local" label={t('karaoke.start')} value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} />
          <Input type="datetime-local" label={t('karaoke.end')} value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} error={fe('endAt')} />
          <Input type="number" min={0} step="0.01" label={t('karaoke.deposit')} value={form.deposit} onChange={(e) => setForm({ ...form, deposit: e.target.value })} />
        </div>
        <Textarea label={t('common.notes')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </div>
    </Dialog>
  );
}

function BookingPaymentDialog({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const { t } = useTranslation();
  const money = useMoney();
  const qc = useQueryClient();
  const errMsg = useErrorMessage();
  const [form, setForm] = useState({ method: 'cash', amount: ((booking.total - booking.paidAmount) / 100).toFixed(2), reference: '' });
  const pay = useMutation({
    mutationFn: () => api.post(`/karaoke/bookings/${booking.id}/payments`, { ...form, amount: parseAmount(form.amount) }),
    onSuccess: () => {
      toast.success(t('invoices.payment_recorded'));
      void qc.invalidateQueries({ queryKey: ['biz', 'karaoke', 'bookings'] });
      onClose();
    },
  });
  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      title={t('karaoke.take_payment')}
      description={`${t('credit.balance_due')}: ${money(booking.total - booking.paidAmount)}`}
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
        <Input type="number" min={0} step="0.01" label={t('payments.amount')} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        <Input label={t('payments.reference')} value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
      </div>
    </Dialog>
  );
}

// ================================================================== RESERVATIONS
interface Reservation {
  id: string;
  tableId: string | null;
  tableName: string | null;
  customerName: string;
  phone: string;
  partySize: number;
  reservedAt: string;
  durationMinutes: number;
  status: string;
  notes: string;
}

export function ReservationsPage() {
  const { t } = useTranslation();
  const { can } = useBiz();
  const qc = useQueryClient();
  const toastErr = useToastError();
  const [day, setDay] = useState(localToday());
  const q = useQuery({ queryKey: ['biz', 'reservations', day], queryFn: () => api.get<{ items: Reservation[] }>(`/reservations?date=${day}`), refetchInterval: 30_000 });
  const [editing, setEditing] = useState<Reservation | 'new' | null>(null);
  const status = useMutation({
    mutationFn: ({ id, s }: { id: string; s: string }) => api.patch(`/reservations/${id}/status`, { status: s }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['biz', 'reservations'] }),
    onError: toastErr,
  });
  const list = q.data?.items.filter((r) => sameDay(r.reservedAt, day)) ?? [];
  return (
    <div className="space-y-6">
      <PageHeader
        title={t('reservations.title')}
        description={t('reservations.subtitle')}
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <Input type="date" aria-label={t('common.date')} value={day} onChange={(e) => setDay(e.target.value)} />
            {can('reservations.manage') && (
              <Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
                {t('reservations.create')}
              </Button>
            )}
          </div>
        }
      />
      <Card padded={false}>
        {!q.data ? (
          <SkeletonRows />
        ) : list.length === 0 ? (
          <EmptyState icon={<CalendarClock className="size-6" />} title={t('reservations.empty')} />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {list.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                <button type="button" className="min-w-0 text-start" disabled={!can('reservations.manage')} onClick={() => setEditing(r)}>
                  <p className="font-medium">
                    <Ltr>{time(r.reservedAt)}</Ltr> · <span dir="auto">{r.customerName}</span> · {t('reservations.party', { count: r.partySize })}
                  </p>
                  <p className="text-xs text-slate-500">
                    {r.tableName ? `${t('pos.table')} ${r.tableName}` : t('reservations.no_table')} {r.phone && <Ltr>· {r.phone}</Ltr>}
                  </p>
                </button>
                {can('reservations.manage') ? (
                  <Select aria-label={t('common.status')} value={r.status} onChange={(e) => status.mutate({ id: r.id, s: e.target.value })}>
                    {RESERVATION_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {t(`status_labels.${s}`)}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <StatusBadge status={r.status} />
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
      {editing && <ReservationDialog reservation={editing === 'new' ? null : editing} day={day} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ReservationDialog({ reservation, day, onClose }: { reservation: Reservation | null; day: string; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const errMsg = useErrorMessage();
  const tables = useTables();
  const [form, setForm] = useState({
    tableId: reservation?.tableId ?? '',
    customerName: reservation?.customerName ?? '',
    phone: reservation?.phone ?? '',
    partySize: String(reservation?.partySize ?? 2),
    reservedAt: reservation ? toLocalInput(new Date(reservation.reservedAt)) : `${day}T19:00`,
    durationMinutes: String(reservation?.durationMinutes ?? 90),
    notes: reservation?.notes ?? '',
  });
  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, tableId: form.tableId || null, partySize: Math.max(1, Math.floor(parseAmount(form.partySize))), durationMinutes: Math.floor(parseAmount(form.durationMinutes)), reservedAt: new Date(form.reservedAt).toISOString() };
      return reservation ? api.put(`/reservations/${reservation.id}`, body) : api.post('/reservations', body);
    },
    onSuccess: () => {
      toast.success(t('common.saved'));
      void qc.invalidateQueries({ queryKey: ['biz', 'reservations'] });
      onClose();
    },
  });
  const fe = useFieldErrors(save.error);
  return (
    <Dialog
      open
      onClose={onClose}
      title={reservation ? t('reservations.edit') : t('reservations.create')}
      footer={
        <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!form.customerName.trim()}>
          {t('common.save')}
        </Button>
      }
    >
      <div className="space-y-4">
        {save.error && <Alert tone="red">{errMsg(save.error)}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label={t('common.name')} value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} error={fe('customerName')} />
          <Input label={t('common.phone')} dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} error={fe('phone')} />
          <Input type="datetime-local" label={t('reservations.time')} value={form.reservedAt} onChange={(e) => setForm({ ...form, reservedAt: e.target.value })} />
          <Input type="number" min={1} label={t('reservations.party_size')} value={form.partySize} onChange={(e) => setForm({ ...form, partySize: e.target.value })} />
          <Input type="number" min={15} step={15} label={t('reservations.duration')} value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} error={fe('durationMinutes')} />
          <Select label={t('pos.table')} value={form.tableId} onChange={(e) => setForm({ ...form, tableId: e.target.value })}>
            <option value="">{t('reservations.no_table')}</option>
            {tables.data?.items
              .filter((x) => x.isActive)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name} ({x.capacity})
                </option>
              ))}
          </Select>
        </div>
        <Textarea label={t('common.notes')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </div>
    </Dialog>
  );
}

// ================================================================== ONLINE ORDERS
interface OnlineOrder {
  id: string;
  orderType: string;
  total: number;
  note: string;
  createdAt: string;
  cashierId: string | null;
  onlineCustomer: { name: string; phone: string; tableName?: string | null; address?: string } | null;
  lines: { id: string; nameSnapshot: string; quantity: number; total: number; options: { choice: string }[]; note: string }[];
}

export function OnlineOrdersPage() {
  const { t } = useTranslation();
  const money = useMoney();
  const f = useFormat();
  const qc = useQueryClient();
  const toastErr = useToastError();
  const q = useQuery({ queryKey: ['biz', 'online-orders'], queryFn: () => api.get<{ items: OnlineOrder[] }>('/online-orders'), refetchInterval: 10_000 });
  const [rejecting, setRejecting] = useState<OnlineOrder | null>(null);
  const [reason, setReason] = useState('');
  const refresh = () => qc.invalidateQueries({ queryKey: ['biz', 'online-orders'] });
  const accept = useMutation({
    mutationFn: (id: string) => api.post(`/online-orders/${id}/accept`, {}),
    onSuccess: () => {
      toast.success(t('online.accepted'));
      void refresh();
    },
    onError: toastErr,
  });
  const reject = useMutation({
    mutationFn: () => api.post(`/online-orders/${rejecting!.id}/reject`, { reason }),
    onSuccess: () => {
      toast.success(t('online.rejected'));
      setRejecting(null);
      setReason('');
      void refresh();
    },
    onError: toastErr,
  });
  return (
    <div className="space-y-6">
      <PageHeader title={t('online.title')} description={t('online.subtitle')} />
      {!q.data ? (
        <SkeletonRows />
      ) : q.data.items.length === 0 ? (
        <Card>
          <EmptyState icon={<Globe className="size-6" />} title={t('online.empty')} description={t('online.empty_body')} />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {q.data.items.map((o) => (
            <Card key={o.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold" dir="auto">
                    {o.onlineCustomer?.name ?? '—'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {o.onlineCustomer?.phone && <Ltr>{o.onlineCustomer.phone}</Ltr>} · {f.relative(o.createdAt)}
                  </p>
                </div>
                <Badge tone={o.cashierId ? 'green' : 'amber'}>{o.cashierId ? t('online.in_progress') : t('online.new')}</Badge>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {t(`pos.order_types.${o.orderType}`)}
                {o.onlineCustomer?.tableName && ` · ${t('pos.table')} ${o.onlineCustomer.tableName}`}
                {o.onlineCustomer?.address && <span dir="auto"> · {o.onlineCustomer.address}</span>}
              </p>
              <ul className="my-3 space-y-1 text-sm">
                {o.lines.map((l) => (
                  <li key={l.id} className="flex justify-between gap-2">
                    <span dir="auto">
                      {Number(l.quantity)} × {l.nameSnapshot}
                      {l.options.length > 0 && <span className="block text-xs text-slate-500">{l.options.map((x) => x.choice).join(', ')}</span>}
                    </span>
                    <span className="tabular-nums">{money(l.total)}</span>
                  </li>
                ))}
              </ul>
              {o.note && <p className="mb-3 rounded-lg bg-amber-50 p-2 text-xs dark:bg-amber-950/40" dir="auto">{o.note}</p>}
              <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                <span className="font-semibold tabular-nums">{money(o.total)}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" className="text-rose-600" icon={<X className="size-4" />} onClick={() => setRejecting(o)}>
                    {t('online.reject')}
                  </Button>
                  {!o.cashierId && (
                    <Button size="sm" icon={<Check className="size-4" />} onClick={() => accept.mutate(o.id)} loading={accept.isPending && accept.variables === o.id}>
                      {t('online.accept')}
                    </Button>
                  )}
                </div>
              </div>
              {o.cashierId && <p className="mt-2 text-xs text-slate-500">{t('online.complete_in_pos')}</p>}
            </Card>
          ))}
        </div>
      )}
      <Dialog
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        size="sm"
        title={t('online.reject_title')}
        footer={
          <Button variant="danger" onClick={() => reject.mutate()} loading={reject.isPending} disabled={reason.trim().length < 3}>
            {t('online.reject')}
          </Button>
        }
      >
        <Textarea label={t('sales.void_reason')} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Dialog>
    </div>
  );
}
