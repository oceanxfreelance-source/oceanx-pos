import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { languageDir } from '@oceanx/shared';
import { api } from '../../lib/api';
import { useBizSession } from '../../auth/business';
import { pdfName } from '../../lib/pdf';
import { useErrorMessage } from '../../lib/useApiError';
import { Alert, SkeletonRows } from '../../components/ui/Card';
import { dayLabel, LEAVE_TONE, OFF_TONE, SHIFT_TONES, shiftDays, weekStart, type RotaWeek } from '../business/Rota';
import { PrintFrame } from './PrintFrame';

/** One week of the duty rota as a printable page / PDF (A4 landscape) to pin up for staff. */
export default function RotaPrint() {
  const [params] = useSearchParams();
  const { t, i18n } = useTranslation();
  const session = useBizSession();
  const errMsg = useErrorMessage();
  const start = /^\d{4}-\d{2}-\d{2}$/.test(params.get('start') ?? '') ? params.get('start')! : weekStart(new Date());
  const q = useQuery({ queryKey: ['biz', 'rota-print', start], queryFn: () => api.get<RotaWeek>(`/rota?start=${start}`) });
  const w = q.data;
  const cells = useMemo(() => new Map((w?.entries ?? []).map((e) => [`${e.staffId}|${e.date}`, e])), [w]);
  const shifts = useMemo(() => new Map((w?.shifts ?? []).map((s) => [s.id, s])), [w]);
  const first = dayLabel(start, i18n.language).date;
  const last = dayLabel(shiftDays(start, 6), i18n.language).date;
  return (
    <PrintFrame ready={!!w} filename={pdfName(session.business.name, 'duty-rota', start)} landscape width="297mm">
      {q.error ? (
        <div className="p-6">
          <Alert tone="red">{errMsg(q.error)}</Alert>
        </div>
      ) : !w ? (
        <SkeletonRows rows={8} />
      ) : (
        <article lang={i18n.language} dir={languageDir(i18n.language)} className="space-y-5 p-8 text-[12px] text-slate-900">
          <header className="flex items-end justify-between gap-6 border-b border-slate-200 pb-4" data-pdf-block>
            <p className="text-lg font-bold" dir="auto">
              {session.business.name}
            </p>
            <div className="text-end">
              <p className="text-2xl font-bold tracking-tight">{t('staff.rota_title')}</p>
              <p className="font-semibold">
                <bdi>
                  {first} – {last}
                </bdi>
              </p>
            </div>
          </header>
          <table className="w-full table-fixed border-collapse">
            <thead>
              <tr>
                <th className="w-40 border border-slate-300 px-2 py-2 text-start">{t('staff.staff_member')}</th>
                {w.days.map((d) => {
                  const l = dayLabel(d, i18n.language);
                  return (
                    <th key={d} className="border border-slate-300 px-1 py-2 text-center">
                      <span className="block uppercase">{l.weekday}</span>
                      <span className="block font-normal text-slate-500">{l.date}</span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {w.staff.map((s) => (
                <tr key={s.id}>
                  <td className="border border-slate-300 px-2 py-2">
                    <p className="font-semibold" dir="auto">
                      {s.name}
                    </p>
                    {s.position && (
                      <p className="text-[11px] text-slate-500" dir="auto">
                        {s.position}
                      </p>
                    )}
                  </td>
                  {w.days.map((d) => {
                    const e = cells.get(`${s.id}|${d}`);
                    const sh = e?.shiftId ? shifts.get(e.shiftId) : undefined;
                    const tone = e?.kind === 'off' ? OFF_TONE : e?.kind === 'leave' ? LEAVE_TONE : sh ? SHIFT_TONES[sh.color] : '';
                    return (
                      <td key={d} className="border border-slate-300 p-1 text-center">
                        {e && (
                          <span className={`block rounded px-1 py-1.5 font-medium ${tone}`}>
                            {e.kind === 'off' ? t('staff.day_off') : e.kind === 'leave' ? t('staff.leave') : sh ? (
                              <>
                                <span className="block" dir="auto">
                                  {sh.name}
                                </span>
                                <span className="block text-[10px]" dir="ltr">
                                  {sh.startTime}–{sh.endTime}
                                </span>
                              </>
                            ) : null}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {w.shifts.length > 0 && (
            <p className="flex flex-wrap gap-2 text-[11px]" data-pdf-block>
              {w.shifts.map((s) => (
                <span key={s.id} className={`rounded px-2 py-1 ${SHIFT_TONES[s.color]}`}>
                  <span dir="auto">{s.name}</span> <span dir="ltr">{s.startTime}–{s.endTime}</span>
                </span>
              ))}
            </p>
          )}
        </article>
      )}
    </PrintFrame>
  );
}
