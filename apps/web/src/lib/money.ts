import { createContext, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { useBiz } from '../auth/business';
import { localeFor } from './format';

/** Shows money in another currency inside it (Gravity Budget's dollars, kept apart from the main money). */
export const MoneySymbolContext = createContext<string | null>(null);

/** API money values are integer minor units (2 decimals). Display follows the business currency settings. */
export function useMoney() {
  const { session } = useBiz();
  const { i18n } = useTranslation();
  const override = useContext(MoneySymbolContext);
  const symbol = override ?? (session?.regional.currencySymbol || session?.business.currency || '');
  const decimals = override ? 2 : (session?.regional.currencyDecimals ?? 2);
  const nf = new Intl.NumberFormat(localeFor(i18n.language), { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const format = (minor: number | null | undefined) => `⁦${symbol} ${nf.format((minor ?? 0) / 100)}⁩`;
  return Object.assign(format, { symbol, plain: (minor: number) => ((minor ?? 0) / 100).toFixed(2), decimals });
}

/** Parse a major-unit text input ("12.50") into a number (NaN-safe). */
export const parseAmount = (v: string) => {
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
