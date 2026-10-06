import { useTranslation } from 'react-i18next';
import { useBiz } from '../auth/business';
import { localeFor } from './format';

/** API money values are integer minor units (2 decimals). Display follows the business currency settings. */
export function useMoney() {
  const { session } = useBiz();
  const { i18n } = useTranslation();
  const symbol = session?.regional.currencySymbol || session?.business.currency || '';
  const decimals = session?.regional.currencyDecimals ?? 2;
  const nf = new Intl.NumberFormat(localeFor(i18n.language), { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const format = (minor: number | null | undefined) => `⁦${symbol} ${nf.format((minor ?? 0) / 100)}⁩`;
  return Object.assign(format, { symbol, plain: (minor: number) => ((minor ?? 0) / 100).toFixed(2), decimals });
}

/** Parse a major-unit text input ("12.50") into a number (NaN-safe). */
export const parseAmount = (v: string) => {
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
