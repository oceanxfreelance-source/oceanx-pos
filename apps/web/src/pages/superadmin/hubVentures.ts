import { useQuery } from '@tanstack/react-query';
import { saApi } from '../../lib/api';
import type { BadgeTone } from '../../components/ui/Card';

/** OceanX's own projects (business lines) in the Hub. Small module so the console layout can list them. */
export interface Venture {
  id: string;
  name: string;
  kind: 'pos' | 'gravity' | 'custom';
  description: string;
  color: string;
  isActive: boolean;
  sortOrder: number;
  leadsOpen: number;
  jobsActive: number;
  ticketsOpen: number;
  amountDue: number;
  /** Built-in product projects: active accounts and payments waiting for review. */
  accountsActive?: number;
  paymentsPending?: number;
  posBusinessesActive?: number;
  posPaymentsPending?: number;
}
/** Accent per project colour key. */
export const VENTURE_TONE: Record<string, { dot: string; ring: string; tone: BadgeTone }> = {
  blue: { dot: 'bg-blue-500', ring: 'ring-blue-200 dark:ring-blue-900', tone: 'blue' },
  violet: { dot: 'bg-violet-500', ring: 'ring-violet-200 dark:ring-violet-900', tone: 'violet' },
  green: { dot: 'bg-emerald-500', ring: 'ring-emerald-200 dark:ring-emerald-900', tone: 'green' },
  amber: { dot: 'bg-amber-500', ring: 'ring-amber-200 dark:ring-amber-900', tone: 'amber' },
  rose: { dot: 'bg-rose-500', ring: 'ring-rose-200 dark:ring-rose-900', tone: 'red' },
  slate: { dot: 'bg-slate-500', ring: 'ring-slate-200 dark:ring-slate-800', tone: 'gray' },
};
export function useVentures() {
  return useQuery({ queryKey: ['sa', 'hub', 'ventures'], queryFn: () => saApi.get<{ items: Venture[] }>('/hub/ventures'), staleTime: 60_000 }).data?.items ?? [];
}
