import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Input } from './ui/Form';

/**
 * Shops keep store stock in cases. Quantities are always stored in pieces; these helpers show and take them
 * as "3 cases + 4 pcs" when a product has more than one piece per case.
 */
export function fmtCases(t: TFunction, qty: number, packSize: number, unit: string): string {
  if (!(packSize > 1)) return `${qty} ${unit}`;
  const sign = qty < 0 ? '-' : '';
  const abs = Math.abs(qty);
  const cases = Math.floor(abs / packSize + 1e-9);
  const rest = Math.round((abs - cases * packSize) * 1000) / 1000;
  const parts = [];
  if (cases || !rest) parts.push(t('inventory.case_count', { count: cases }));
  if (rest) parts.push(`${rest} ${unit}`);
  return sign + parts.join(' + ');
}

/** "Cases" and "loose pieces" boxes that together give a quantity in pieces. */
export function CaseQtyInput({
  packSize,
  unit,
  cases,
  pieces,
  onChange,
  casesLabel,
}: {
  packSize: number;
  unit: string;
  cases: string;
  pieces: string;
  onChange: (cases: string, pieces: string) => void;
  casesLabel?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-2 gap-3">
      <Input
        type="number"
        min={0}
        step="1"
        label={casesLabel ?? t('inventory.cases')}
        hint={t('inventory.per_case_hint', { n: packSize, unit })}
        value={cases}
        onChange={(e) => onChange(e.target.value, pieces)}
        autoFocus
      />
      <Input type="number" min={0} step="0.001" label={t('inventory.loose_pieces', { unit })} value={pieces} onChange={(e) => onChange(cases, e.target.value)} />
    </div>
  );
}

export const caseTotal = (cases: string, pieces: string, packSize: number) => (Number(cases) || 0) * packSize + (Number(pieces) || 0);
