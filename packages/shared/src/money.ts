/**
 * Authoritative money calculation. All amounts are integer MINOR units (e.g. laari / cents),
 * quantities are decimals (up to 3 places). The API always recomputes totals with this
 * function — totals sent by a client are never trusted. The web app uses the same
 * function only to preview totals.
 *
 * Rules:
 *  - line gross = round(qty × unit price); line discount ≤ line gross
 *  - order discount is allocated proportionally across lines (largest-remainder safe)
 *  - service charge = rate × (net after discounts)
 *  - tax per line uses the line's rate (product override or business rate);
 *    service charge is taxed at the business rate
 *  - pricesIncludeTax: tax is extracted from the amounts instead of added on top
 */

export interface TaxConfig {
  taxEnabled: boolean;
  taxRate: number;
  pricesIncludeTax: boolean;
  serviceChargeEnabled: boolean;
  serviceChargeRate: number;
}

export interface CalcLine {
  quantity: number;
  unitPrice: number; // minor units
  discount?: number; // minor units, whole line
  taxRate?: number | null; // percent; null/undefined → business rate
  serviceCharge?: boolean; // default true
}

export interface CalcLineResult {
  gross: number;
  discount: number;
  net: number; // after line + allocated order discount
  tax: number;
  total: number; // amount the line contributes incl. tax (exclusive mode) or inclusive amount
}

export interface CalcResult {
  lines: CalcLineResult[];
  subtotal: number; // Σ gross
  discount: number; // line + order discounts
  serviceCharge: number;
  tax: number;
  total: number;
}

const r = (n: number) => Math.round(n);

export function toMinor(amount: number | string, decimals = 2): number {
  return Math.round(Number(amount) * 10 ** decimals);
}

export function fromMinor(minor: number, decimals = 2): string {
  return (minor / 10 ** decimals).toFixed(decimals);
}

export function calculateTotals(lines: CalcLine[], tax: TaxConfig, orderDiscount = 0): CalcResult {
  const gross = lines.map((l) => r(l.quantity * l.unitPrice));
  const lineDisc = lines.map((l, i) => Math.min(Math.max(0, r(l.discount ?? 0)), gross[i]!));
  const afterLine = gross.map((g, i) => g - lineDisc[i]!);
  const base = afterLine.reduce((a, b) => a + b, 0);
  const od = Math.min(Math.max(0, r(orderDiscount)), base);

  // Proportional allocation of the order discount.
  const alloc = afterLine.map((v) => (base > 0 ? Math.floor((v * od) / base) : 0));
  let rest = od - alloc.reduce((a, b) => a + b, 0);
  for (let i = 0; rest > 0 && i < alloc.length; i++) {
    if (afterLine[i]! - alloc[i]! > 0) {
      alloc[i]! += 1;
      rest--;
    }
  }
  const net = afterLine.map((v, i) => v - alloc[i]!);

  const scBase = net.reduce((a, n, i) => a + (lines[i]!.serviceCharge === false ? 0 : n), 0);
  const serviceCharge = tax.serviceChargeEnabled ? r((scBase * tax.serviceChargeRate) / 100) : 0;

  const rateOf = (l: CalcLine) => (tax.taxEnabled ? (l.taxRate ?? tax.taxRate) : 0);
  const lineTax = net.map((n, i) => {
    const rate = rateOf(lines[i]!);
    if (!rate) return 0;
    return tax.pricesIncludeTax ? n - r(n / (1 + rate / 100)) : r((n * rate) / 100);
  });
  const bizRate = tax.taxEnabled ? tax.taxRate : 0;
  const scTax = bizRate ? (tax.pricesIncludeTax ? serviceCharge - r(serviceCharge / (1 + bizRate / 100)) : r((serviceCharge * bizRate) / 100)) : 0;

  const taxTotal = lineTax.reduce((a, b) => a + b, 0) + scTax;
  const netTotal = net.reduce((a, b) => a + b, 0);
  const total = tax.pricesIncludeTax ? netTotal + serviceCharge : netTotal + serviceCharge + taxTotal;

  return {
    lines: lines.map((_, i) => ({
      gross: gross[i]!,
      discount: lineDisc[i]! + alloc[i]!,
      net: net[i]!,
      tax: lineTax[i]!,
      total: tax.pricesIncludeTax ? net[i]! : net[i]! + lineTax[i]!,
    })),
    subtotal: gross.reduce((a, b) => a + b, 0),
    discount: lineDisc.reduce((a, b) => a + b, 0) + od,
    serviceCharge,
    tax: taxTotal,
    total,
  };
}

/** Product option groups (sizes, toppings, extras). Stored on the product, snapshotted on sale lines. */
export interface OptionChoice {
  name: string;
  price: number; // minor units added to the unit price
}
export interface OptionGroup {
  name: string;
  required: boolean;
  multiple: boolean;
  choices: OptionChoice[];
}

/**
 * Resolve selected options against the product's definition (server-side).
 * Returns the price delta and the snapshot, or an error code.
 */
export function resolveOptions(
  groups: OptionGroup[],
  selected: { group: string; choice: string }[],
): { ok: true; delta: number; snapshot: { group: string; choice: string; price: number }[] } | { ok: false; error: string } {
  const snapshot: { group: string; choice: string; price: number }[] = [];
  for (const g of groups) {
    const picks = selected.filter((s) => s.group === g.name);
    if (g.required && picks.length === 0) return { ok: false, error: 'option_required' };
    if (!g.multiple && picks.length > 1) return { ok: false, error: 'option_single' };
    for (const p of picks) {
      const c = g.choices.find((x) => x.name === p.choice);
      if (!c) return { ok: false, error: 'option_invalid' };
      snapshot.push({ group: g.name, choice: c.name, price: c.price });
    }
  }
  if (selected.some((s) => !groups.some((g) => g.name === s.group))) return { ok: false, error: 'option_invalid' };
  return { ok: true, delta: snapshot.reduce((a, s) => a + s.price, 0), snapshot };
}
