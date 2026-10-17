import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useMoney } from '../../lib/money';
import { useFormat } from '../../lib/format';
import { pdfName } from '../../lib/pdf';
import { SkeletonRows } from '../../components/ui/Card';
import { PrintFrame } from './PrintFrame';
import type { CashClosing } from '../business/CashClosing';

/** The day's closing on paper (Z report): money in by method, the cash drawer, counted and over / short. */
export default function CashClosingPrint() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const money = useMoney();
  const f = useFormat();
  const q = useQuery({ queryKey: ['biz', 'closing', id], queryFn: () => api.get<CashClosing & { business: { name: string } }>(`/pos/closings/${id}`) });
  const d = q.data;
  const line = (label: string, value: string, strong = false) => (
    <div className={`flex justify-between py-1 ${strong ? 'border-t border-slate-400 pt-2 font-bold' : ''}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
  return (
    <PrintFrame ready={!!d} filename={pdfName('closing', d?.business.name, d?.periodEnd.slice(0, 10))} width="105mm">
      {!d ? (
        <SkeletonRows rows={8} />
      ) : (
        <div className="space-y-4 bg-white p-6 text-sm text-slate-900">
          <div className="text-center">
            <p className="text-base font-bold" dir="auto">
              {d.business.name}
            </p>
            <p className="font-semibold">
              {t('closing.print_title')} #{d.number}
            </p>
            <p className="text-xs text-slate-600" dir="auto">
              {[d.outletName, d.closedByName].filter(Boolean).join(' · ')}
            </p>
            <p className="text-xs text-slate-600">{t('closing.period', { from: f.dateTime(d.periodStart), to: f.dateTime(d.periodEnd) })}</p>
          </div>
          <div>
            {line(t('closing.sales'), String(d.salesCount))}
            {line(t('closing.sales_total'), money(d.salesTotal), true)}
          </div>
          <div>
            <p className="font-semibold">{t('closing.money_in')}</p>
            {Object.entries(d.byMethod).map(([m, v]) => <div key={m}>{line(t(`payment_methods.${m}`), money(v))}</div>)}
          </div>
          <div>
            <p className="font-semibold">{t('closing.cash_drawer')}</p>
            {line(t('closing.opening_float'), money(d.openingFloat))}
            {line(t('closing.cash_taken'), money(d.cashIn))}
            {line(t('closing.change_given'), `− ${money(d.changeGiven)}`)}
            {d.cashRefunds > 0 && line(t('closing.cash_refunds'), `− ${money(d.cashRefunds)}`)}
            {line(t('closing.expected_cash'), money(d.expectedCash), true)}
            {line(t('closing.counted_cash'), money(d.countedCash))}
            {line(t('closing.difference'), d.difference === 0 ? t('closing.exact') : d.difference < 0 ? t('closing.short', { amount: money(-d.difference) }) : t('closing.over', { amount: money(d.difference) }), true)}
            {line(t('closing.kept_float'), money(d.keptFloat))}
          </div>
          {d.note && (
            <p className="text-xs" dir="auto">
              {t('closing.note')}: {d.note}
            </p>
          )}
          <div className="grid grid-cols-2 gap-6 pt-8 text-center text-xs text-slate-600">
            <div className="border-t border-slate-400 pt-1">{t('closing.sign_cashier')}</div>
            <div className="border-t border-slate-400 pt-1">{t('closing.sign_manager')}</div>
          </div>
        </div>
      )}
    </PrintFrame>
  );
}
