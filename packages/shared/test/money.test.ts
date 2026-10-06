import { describe, expect, it } from 'vitest';
import { calculateTotals, resolveOptions, toMinor } from '../src/money';

const noTax = { taxEnabled: false, taxRate: 0, pricesIncludeTax: false, serviceChargeEnabled: false, serviceChargeRate: 0 };

describe('calculateTotals', () => {
  it('sums lines in minor units', () => {
    const r = calculateTotals([{ quantity: 2, unitPrice: 1050 }, { quantity: 0.5, unitPrice: 999 }], noTax);
    expect(r.subtotal).toBe(2100 + 500);
    expect(r.total).toBe(2600);
  });

  it('allocates an order discount across lines without losing a cent', () => {
    const r = calculateTotals([{ quantity: 1, unitPrice: 1000 }, { quantity: 1, unitPrice: 1000 }, { quantity: 1, unitPrice: 1000 }], noTax, 100);
    expect(r.lines.map((l) => l.discount).reduce((a, b) => a + b, 0)).toBe(100);
    expect(r.total).toBe(2900);
  });

  it('never discounts below zero', () => {
    const r = calculateTotals([{ quantity: 1, unitPrice: 500, discount: 900 }], noTax, 900);
    expect(r.total).toBe(0);
  });

  it('adds service charge and taxes it at the business rate (exclusive prices)', () => {
    const r = calculateTotals([{ quantity: 1, unitPrice: 10000 }], { taxEnabled: true, taxRate: 8, pricesIncludeTax: false, serviceChargeEnabled: true, serviceChargeRate: 10 });
    expect(r.serviceCharge).toBe(1000);
    expect(r.tax).toBe(800 + 80);
    expect(r.total).toBe(11880);
  });

  it('extracts tax from tax-inclusive prices and honours per-product rates', () => {
    const r = calculateTotals([{ quantity: 1, unitPrice: 10800 }, { quantity: 1, unitPrice: 1000, taxRate: 0 }], { taxEnabled: true, taxRate: 8, pricesIncludeTax: true, serviceChargeEnabled: false, serviceChargeRate: 0 });
    expect(r.tax).toBe(800);
    expect(r.total).toBe(11800);
  });

  it('converts major units safely', () => {
    expect(toMinor(0.1 + 0.2)).toBe(30);
    expect(toMinor('12.345')).toBe(1235);
  });
});

describe('resolveOptions', () => {
  const groups = [
    { name: 'Size', required: true, multiple: false, choices: [{ name: 'S', price: 0 }, { name: 'L', price: 500 }] },
    { name: 'Extras', required: false, multiple: true, choices: [{ name: 'Cheese', price: 200 }, { name: 'Patty', price: 900 }] },
  ];
  it('prices valid selections', () => {
    const r = resolveOptions(groups, [{ group: 'Size', choice: 'L' }, { group: 'Extras', choice: 'Cheese' }, { group: 'Extras', choice: 'Patty' }]);
    expect(r.ok && r.delta).toBe(1600);
  });
  it('rejects missing, duplicate-single and unknown choices', () => {
    expect(resolveOptions(groups, [])).toEqual({ ok: false, error: 'option_required' });
    expect(resolveOptions(groups, [{ group: 'Size', choice: 'S' }, { group: 'Size', choice: 'L' }])).toEqual({ ok: false, error: 'option_single' });
    expect(resolveOptions(groups, [{ group: 'Size', choice: 'XXL' }])).toEqual({ ok: false, error: 'option_invalid' });
    expect(resolveOptions(groups, [{ group: 'Size', choice: 'S' }, { group: 'Hack', choice: 'x' }])).toEqual({ ok: false, error: 'option_invalid' });
  });
});
