import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Copy, Download, Pencil, Plus, Printer, Trash2 } from 'lucide-react';
import { SHIFT_COLORS } from '@oceanx/shared';
import { api } from '../../lib/api';
import { useBiz } from '../../auth/business';
import { localeFor } from '../../lib/format';
import { useFieldErrors, useToastError } from '../../lib/useApiError';
import { Card, EmptyState, PageHeader, SkeletonRows } from '../../components/ui/Card';
import { Button, IconButton } from '../../components/ui/Button';
import { ConfirmDialog, Dialog } from '../../components/ui/Dialog';
import { Input, Select } from '../../components/ui/Form';
import { Tabs } from '../../components/ui/Tabs';
import { StaffPanel } from './Staff';

export interface RotaShift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  color: (typeof SHIFT_COLORS)[number];
  sortOrder: number;
}
export interface RotaEntry {
  staffId: string;
  date: string;
  kind: 'shift' | 'off' | 'leave';
  shiftId: string | null;
  note: string;
}
export interface RotaWeek {
  start: string;
  days: string[];
  shifts: RotaShift[];
  staff: { id: string; name: string; position: string; isActive: boolean }[];
  entries: RotaEntry[];
}

export const SHIFT_TONES: Record<string, string> = {
  sky: 'bg-sky-100 text-sky-900 ring-sky-200 dark:bg-sky-950 dark:text-sky-100 dark:ring-sky-900',
  amber: 'bg-amber-100 text-amber-900 ring-amber-200 dark:bg-amber-950 dark:text-amber-100 dark:ring-amber-900',
  violet: 'bg-violet-100 text-violet-900 ring-violet-200 dark:bg-violet-950 dark:text-violet-100 dark:ring-violet-900',
  emerald: 'bg-emerald-100 text-emerald-900 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-100 dark:ring-emerald-900',
  rose: 'bg-rose-100 text-rose-900 ring-rose-200 dark:bg-rose-950 dark:text-rose-100 dark:ring-rose-900',
  slate: 'bg-slate-200 text-slate-900 ring-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700',
};
export const OFF_TONE = 'bg-slate-50 text-slate-500 ring-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-800';
export const LEAVE_TONE = 'bg-orange-50 text-orange-800 ring-orange-200 dark:bg-orange-950/50 dark:text-orange-200 dark:ring-orange-900';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** Monday of the week containing the date. */
export const weekStart = (d: Date) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return iso(x);
};
export const shiftDays = (isoDate: string, n: number) => {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number];
  return iso(new Date(y, m - 1, d + n));
};
export function dayLabel(isoDate: string, lang: string) {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number];
  const dt = new Date(y, m - 1, d);
  const loc = localeFor(lang);
  return { weekday: new Intl.DateTimeFormat(loc, { weekday: 'short' }).format(dt), date: new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short' }).format(dt) };
}

/** Duty Rota add-on: weekly shifts, days off and leave; shift templates; staff list. */
export default function RotaPage() {
  const { t } = useTranslation();
  const { can } = useBiz();
  const [params, setParams] = useSearchParams();
  const tab = (['shifts', 'staff'] as const).find((x) => x === params.get('tab')) ?? 'rota';
  const tabs: { value: 'rota' | 'shifts' | 'staff'; label: string }[] = [
    { value: 'rota', label: t('staff.tab_rota') },
    { value: 'shifts', label: t('staff.tab_shifts') },
    { value: 'staff', label: t('staff.tab_staff') },
  ];
  return (
    <div className="space-y-6">
      <PageHeader title={t('staff.rota_title')} description={t('staff.rota_subtitle')} />
      <Tabs tabs={can('rota.manage') ? tabs : tabs.filter((x) => x.value !== 'shifts')} value={tab} onChange={(v) => setParams(v === 'rota' ? {} : { tab: v }, { replace: true })} />
      {tab === 'rota' ? <WeekGrid /> : tab === 'shifts' ? <ShiftsPanel /> : <StaffPanel />}
    </div>
  );
}

function WeekGrid() {
  const { t, i18n } = useTranslation();
  const { can } = useBiz();
  const qc = useQueryClient();
  const toastErr = useToastError();
  const [start, setStart] = useState(() => weekStart(new Date()));
  const key = ['biz', 'rota', start];
  const q = useQuery({ queryKey: key, queryFn: () => api.get<RotaWeek>(`/rota?start=${start}`) });
  const manage = can('rota.manage');
  const cells = useMemo(() => new Map((q.data?.entries ?? []).map((e) => [`${e.staffId}|${e.date}`, e])), [q.data]);
  const shiftsById = useMemo(() => new Map((q.data?.shifts ?? []).map((s) => [s.id, s])), [q.data]);
  const setCell = useMutation({
    mutationFn: (v: { staffId: string; date: string; value: string }) => {
      const kind = v.value === '' ? 'none' : v.value === 'off' || v.value === 'leave' ? v.value : 'shift';
      return api.put('/rota/entries', { staffId: v.staffId, date: v.date, kind, shiftId: kind === 'shift' ? v.value : null });
    },
    onMutate: (v) => {
      // Show the change at once; the server confirms it.
      qc.setQueryData<RotaWeek>(key, (d) => {
        if (!d) return d;
        const rest = d.entries.filter((e) => !(e.staffId === v.staffId && e.date === v.date));
        if (v.value === '') return { ...d, entries: rest };
        const kind = v.value === 'off' || v.value === 'leave' ? v.value : 'shift';
        return { ...d, entries: [...rest, { staffId: v.staffId, date: v.date, kind, shiftId: kind === 'shift' ? v.value : null, note: '' }] };
      });
    },
    onError: (e) => {
      toastErr(e);
      void q.refetch();
    },
  });
  const [copying, setCopying] = useState(false);
  const copy = useMutation({
    mutationFn: () => api.post<{ copied: number }>('/rota/copy', { from: shiftDays(start, -7), to: start }),
    onSuccess: (r) => {
      setCopying(false);
      toast.success(t('staff.copied', { count: r.copied }));
      void q.refetch();
    },
    onError: toastErr,
  });
  const print = (download: boolean) => window.open(`/print/rota?start=${start}${download ? '&download=1' : ''}`, '_blank', 'noopener');
  const w = q.data;
  const first = dayLabel(start, i18n.language);
  const last = dayLabel(shiftDays(start, 6), i18n.language);
  const today = iso(new Date());
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-xl ring-1 ring-slate-200 dark:ring-slate-700">
          <IconButton label={t('staff.prev_week')} onClick={() => setStart(shiftDays(start, -7))}>
            <ChevronLeft className="rtl-flip size-5" />
          </IconButton>
          <span className="min-w-40 px-1 text-center text-sm font-semibold">
            <bdi>
              {first.date} – {last.date}
            </bdi>
          </span>
          <IconButton label={t('staff.next_week')} onClick={() => setStart(shiftDays(start, 7))}>
            <ChevronRight className="rtl-flip size-5" />
          </IconButton>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setStart(weekStart(new Date()))}>
          {t('staff.this_week')}
        </Button>
        <div className="ms-auto flex flex-wrap gap-2">
          {manage && (
            <Button size="sm" variant="secondary" icon={<Copy className="size-4" />} onClick={() => setCopying(true)}>
              {t('staff.copy_last_week')}
            </Button>
          )}
          <Button size="sm" variant="secondary" icon={<Printer className="size-4" />} onClick={() => print(false)}>
            {t('print.print')}
          </Button>
          <Button size="sm" variant="secondary" icon={<Download className="size-4" />} onClick={() => print(true)}>
            {t('print.download_pdf')}
          </Button>
        </div>
      </div>
      <Card padded={false}>
        {!w ? (
          <div className="p-5">
            <SkeletonRows rows={5} />
          </div>
        ) : w.staff.length === 0 ? (
          <EmptyState icon={<CalendarDays className="size-6" />} title={t('staff.no_staff')} description={t('staff.rota_no_staff_hint')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="sticky start-0 z-10 bg-white px-4 py-3 text-start text-xs font-semibold text-slate-500 dark:bg-slate-900">{t('staff.staff_member')}</th>
                  {w.days.map((d) => {
                    const l = dayLabel(d, i18n.language);
                    return (
                      <th key={d} className={`min-w-32 px-2 py-3 text-center text-xs font-semibold ${d === today ? 'text-brand-700 dark:text-brand-300' : 'text-slate-500'}`}>
                        <span className="block uppercase">{l.weekday}</span>
                        <span className="block font-normal">{l.date}</span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {w.staff.map((s) => (
                  <tr key={s.id}>
                    <td className="sticky start-0 z-10 bg-white px-4 py-2 dark:bg-slate-900">
                      <p className="font-medium whitespace-nowrap" dir="auto">
                        {s.name}
                      </p>
                      {s.position && (
                        <p className="text-xs text-slate-500" dir="auto">
                          {s.position}
                        </p>
                      )}
                    </td>
                    {w.days.map((d) => {
                      const e = cells.get(`${s.id}|${d}`);
                      const sh = e?.shiftId ? shiftsById.get(e.shiftId) : undefined;
                      const tone = e?.kind === 'off' ? OFF_TONE : e?.kind === 'leave' ? LEAVE_TONE : sh ? SHIFT_TONES[sh.color] : '';
                      const value = e ? (e.kind === 'shift' ? (e.shiftId ?? '') : e.kind) : '';
                      return (
                        <td key={d} className="px-1.5 py-1.5">
                          {manage ? (
                            <select
                              aria-label={`${s.name} ${dayLabel(d, i18n.language).weekday} ${d}`}
                              value={value}
                              onChange={(ev) => setCell.mutate({ staffId: s.id, date: d, value: ev.target.value })}
                              className={`w-full min-w-28 cursor-pointer rounded-lg border-0 px-2 py-2 text-xs font-medium ring-1 ${tone || 'bg-white text-slate-400 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700'}`}
                            >
                              <option value="">—</option>
                              {w.shifts.map((x) => (
                                <option key={x.id} value={x.id}>
                                  {x.name} ({x.startTime}–{x.endTime})
                                </option>
                              ))}
                              <option value="off">{t('staff.day_off')}</option>
                              <option value="leave">{t('staff.leave')}</option>
                            </select>
                          ) : (
                            <span className={`block rounded-lg px-2 py-2 text-center text-xs font-medium ring-1 ${tone || 'text-slate-300 ring-transparent'}`}>
                              {e?.kind === 'off' ? t('staff.day_off') : e?.kind === 'leave' ? t('staff.leave') : sh ? `${sh.name} ${sh.startTime}–${sh.endTime}` : '—'}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {w && w.shifts.length === 0 && manage && <p className="text-sm text-amber-700 dark:text-amber-400">{t('staff.no_shifts_hint')}</p>}
      <ConfirmDialog
        open={copying}
        onClose={() => setCopying(false)}
        onConfirm={() => copy.mutate()}
        title={t('staff.copy_last_week')}
        message={t('staff.copy_last_week_body')}
        loading={copy.isPending}
      />
    </div>
  );
}

const PRESETS = [
  { name: 'Morning', startTime: '08:00', endTime: '16:00', color: 'amber' },
  { name: 'Evening', startTime: '16:00', endTime: '00:00', color: 'violet' },
  { name: 'Split', startTime: '11:00', endTime: '15:00', color: 'emerald' },
] as const;

function ShiftsPanel() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toastErr = useToastError();
  const q = useQuery({ queryKey: ['biz', 'rota-shifts'], queryFn: () => api.get<{ items: RotaShift[] }>('/rota/shifts') });
  const [editing, setEditing] = useState<RotaShift | 'new' | null>(null);
  const [removing, setRemoving] = useState<RotaShift | null>(null);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['biz', 'rota-shifts'] });
    void qc.invalidateQueries({ queryKey: ['biz', 'rota'] });
  };
  const addPreset = useMutation({ mutationFn: (p: (typeof PRESETS)[number]) => api.post('/rota/shifts', { ...p, name: t(`staff.preset_${p.name.toLowerCase()}`) }), onSuccess: refresh, onError: toastErr });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/rota/shifts/${id}`),
    onSuccess: () => {
      setRemoving(null);
      refresh();
    },
    onError: toastErr,
  });
  const items = q.data?.items ?? [];
  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
        <p className="text-sm text-slate-500">{t('staff.shifts_hint')}</p>
        <Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
          {t('staff.add_shift')}
        </Button>
      </div>
      {!q.data ? (
        <div className="p-5">
          <SkeletonRows rows={3} />
        </div>
      ) : items.length === 0 ? (
        <div className="space-y-3 p-5">
          <EmptyState icon={<Clock className="size-6" />} title={t('staff.no_shifts')} description={t('staff.no_shifts_presets')} />
          <div className="flex flex-wrap justify-center gap-2">
            {PRESETS.map((p) => (
              <Button key={p.name} size="sm" variant="secondary" onClick={() => addPreset.mutate(p)} disabled={addPreset.isPending}>
                + {t(`staff.preset_${p.name.toLowerCase()}`)} ({p.startTime}–{p.endTime})
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {items.map((s) => (
            <li key={s.id} className="flex items-center gap-3 px-5 py-3">
              <span className={`rounded-lg px-2.5 py-1 text-xs font-semibold ring-1 ${SHIFT_TONES[s.color]}`} dir="auto">
                {s.name}
              </span>
              <span className="flex-1 text-sm text-slate-600 tabular-nums dark:text-slate-300" dir="ltr">
                {s.startTime} – {s.endTime}
              </span>
              <IconButton label={t('common.edit')} onClick={() => setEditing(s)}>
                <Pencil className="size-4" />
              </IconButton>
              <IconButton label={t('common.delete')} onClick={() => setRemoving(s)} className="hover:text-rose-600">
                <Trash2 className="size-4" />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
      {editing && <ShiftDialog shift={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={refresh} />}
      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && remove.mutate(removing.id)}
        title={t('staff.remove_shift')}
        message={t('staff.remove_shift_body', { name: removing?.name ?? '' })}
        confirmLabel={t('common.delete')}
        danger
        loading={remove.isPending}
      />
    </Card>
  );
}

function ShiftDialog({ shift, onClose, onSaved }: { shift: RotaShift | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ name: shift?.name ?? '', startTime: shift?.startTime ?? '08:00', endTime: shift?.endTime ?? '16:00', color: shift?.color ?? 'sky', sortOrder: shift?.sortOrder ?? 0 });
  const save = useMutation({
    mutationFn: () => (shift ? api.put(`/rota/shifts/${shift.id}`, form) : api.post('/rota/shifts', form)),
    onSuccess: () => {
      toast.success(t('common.saved'));
      onSaved();
      onClose();
    },
  });
  const err = useFieldErrors(save.error);
  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      title={shift ? t('staff.edit_shift') : t('staff.add_shift')}
      footer={
        <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!form.name.trim()}>
          {t('common.save')}
        </Button>
      }
    >
      <div className="space-y-4">
        <Input label={t('common.name')} required placeholder={t('staff.preset_morning')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={err('name')} dir="auto" />
        <div className="grid grid-cols-2 gap-3">
          <Input label={t('staff.start_time')} type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} error={err('startTime')} />
          <Input label={t('staff.end_time')} type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} error={err('endTime')} />
        </div>
        <Select label={t('staff.colour')} value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value as RotaShift['color'] })}>
          {SHIFT_COLORS.map((c) => (
            <option key={c} value={c}>
              {t(`staff.colours.${c}`)}
            </option>
          ))}
        </Select>
        <span className={`inline-block rounded-lg px-2.5 py-1 text-xs font-semibold ring-1 ${SHIFT_TONES[form.color]}`} dir="auto">
          {form.name || t('staff.preset_morning')} {form.startTime}–{form.endTime}
        </span>
      </div>
    </Dialog>
  );
}
