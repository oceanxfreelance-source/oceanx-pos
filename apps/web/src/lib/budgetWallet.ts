import { useSyncExternalStore } from 'react';
import { useBizSession } from '../auth/business';

/**
 * Gravity Budget: which money is on screen — the main currency, or dollars kept apart ("Rf and $").
 * Each has its own budgets, savings and totals; they are never mixed or exchanged. Remembered on this phone.
 */
export type BudgetWallet = 'main' | 'usd';

const KEY = 'ox.budget.wallet';
const listeners = new Set<() => void>();
function read(): BudgetWallet {
  try {
    return localStorage.getItem(KEY) === 'usd' ? 'usd' : 'main';
  } catch {
    return 'main';
  }
}
export function setBudgetWallet(w: BudgetWallet) {
  try {
    localStorage.setItem(KEY, w);
  } catch {
    /* storage blocked: stays for this visit only */
  }
  current = w;
  for (const l of listeners) l();
}
let current: BudgetWallet | null = null;

/** The money on screen, and whether dollars are turned on at all. */
export function useBudgetWallet(): { wallet: BudgetWallet; usdOn: boolean; setWallet: (w: BudgetWallet) => void } {
  const usdOn = !!useBizSession().budgetUsdWallet;
  const stored = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => (current ??= read()),
    () => 'main' as BudgetWallet,
  );
  return { wallet: usdOn ? stored : 'main', usdOn, setWallet: setBudgetWallet };
}
