import { useQuery } from '@tanstack/react-query';
import type { Fuel, FuelShedConfig } from '@oceanx/shared';
import { api } from '../../../lib/api';
import { useMoney } from '../../../lib/money';

export interface FuelTankStock {
  id: string;
  key: string;
  name: string;
  fuel: Fuel;
  storage: 'tank' | 'drums';
  capacityL: number;
  reorderL: number;
  drumSizeL: number;
  stockL: number;
  measured: boolean;
  lastDipAt: string | null;
}
export interface FuelNozzle {
  id: string;
  name: string;
  tankKey: string;
  openingMeter: number;
}
export interface FuelSale {
  id: string;
  fuel: Fuel;
  litres: number;
  pricePerL: number;
  fuelAmount: number;
  deliveryCharge: number;
  total: number;
  payment: 'cash' | 'card' | 'transfer' | 'credit';
  customerId: string | null;
  customerName: string | null;
  nozzleName: string | null;
  vehicle: string;
  createdByName: string;
  createdAt: string;
  voided: boolean;
}
export interface FuelDashboard {
  setupDone: boolean;
  config: FuelShedConfig;
  today: { count: number; total: number; byPayment: Record<FuelSale['payment'], number>; litresByFuel: Record<Fuel, number> };
  owed: { total: number; customers: number };
  tanks: FuelTankStock[];
  nozzles: FuelNozzle[];
  week: { day: string; total: number; litres: number }[];
  recent: FuelSale[];
}
export interface FuelCustomer {
  id: string;
  name: string;
  phone: string;
  creditLimit: number;
  note: string;
  owed: number;
}

export const FUEL_KEYS = {
  dashboard: ['fuel', 'dashboard'] as const,
  sales: (daysAgo: number) => ['fuel', 'sales', daysAgo] as const,
  tanks: ['fuel', 'tanks'] as const,
  customers: ['fuel', 'customers'] as const,
  customer: (id: string) => ['fuel', 'customer', id] as const,
};

export const useFuelDashboard = () => useQuery({ queryKey: FUEL_KEYS.dashboard, queryFn: () => api.get<FuelDashboard>('/fuel/dashboard'), refetchInterval: 30_000 });
export const useFuelCustomers = (enabled = true) =>
  useQuery({ queryKey: FUEL_KEYS.customers, queryFn: () => api.get<{ customers: FuelCustomer[] }>('/fuel/customers'), enabled });

/** The API sends rufiyaa (2 decimals); show them in the shed's money format. */
export function useMvr() {
  const money = useMoney();
  return (n: number) => money(Math.round(n * 100));
}

/** Everything that changes after a sale, a delivery, a dip or a payment. */
export const FUEL_INVALIDATE = { queryKey: ['fuel'] as const };
