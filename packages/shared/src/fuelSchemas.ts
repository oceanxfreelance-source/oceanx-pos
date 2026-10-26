import { z } from 'zod';

/**
 * Theyo Fihaara (fuel sheds): what a shed sets up itself — how it works, what it sells and at what price,
 * where the fuel is kept (tanks or drums) and the nozzles that draw from them, plus the extras it uses.
 */
export const FUELS = ['petrol', 'diesel'] as const;
export type Fuel = (typeof FUELS)[number];
export const FUEL_STORAGE = ['tank', 'drums'] as const;

const amount = (max: number) => z.coerce.number().min(0).max(max);

export const fuelShedConfigSchema = z.object({
  /** 'one': one person, the day is closed at night. 'shifts': staff take turns, each shift is closed. */
  mode: z.enum(['one', 'shifts']),
  fuels: z.array(z.enum(FUELS)).min(1).max(FUELS.length),
  /** Price per litre (MVR) for each fuel it sells. */
  prices: z.object({ petrol: amount(1000).optional(), diesel: amount(1000).optional() }),
  deliveryCharge: z.object({ on: z.boolean(), type: z.enum(['fixed', 'per_litre']), amount: amount(100_000) }),
  printer: z.enum(['off', '80mm', 'a4']),
  receiptDefault: z.enum(['none', 'viber', 'pdf']),
  credit: z.boolean(),
  /** The most a customer added at the till may owe until the owner checks them. */
  tillCustomerLimit: amount(1_000_000),
  quotations: z.boolean(),
  /** Cash over/short at a close above this needs a note. */
  cashTolerance: amount(100_000),
  /** Tank dip vs book stock above this percentage raises an alert. */
  variancePercent: z.coerce.number().min(0).max(20),
});
export type FuelShedConfig = z.infer<typeof fuelShedConfigSchema>;

export const defaultFuelShedConfig = (): FuelShedConfig => ({
  mode: 'shifts',
  fuels: ['petrol', 'diesel'],
  prices: {},
  deliveryCharge: { on: false, type: 'fixed', amount: 0 },
  printer: 'off',
  receiptDefault: 'none',
  credit: true,
  tillCustomerLimit: 500,
  quotations: false,
  cashTolerance: 100,
  variancePercent: 1,
});

export const fuelTankSchema = z.object({
  id: z.string().uuid().optional(),
  /** Links nozzles to a tank before it is saved (an existing tank uses its id). */
  key: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(40),
  fuel: z.enum(FUELS),
  storage: z.enum(FUEL_STORAGE),
  /** Litres it holds (for drums: all the drums together). */
  capacityL: z.coerce.number().positive().max(1_000_000),
  reorderL: z.coerce.number().min(0).max(1_000_000),
  drumSizeL: z.coerce.number().int().min(20).max(1000).default(200),
});

export const fuelNozzleSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(20),
  tankKey: z.string().trim().min(1).max(64),
  /** The meter (totaliser) reading when the shed starts using Theyo Fihaara. */
  openingMeter: z.coerce.number().min(0).max(100_000_000),
});

export const fuelSetupSchema = z
  .object({
    config: fuelShedConfigSchema,
    tanks: z.array(fuelTankSchema).min(1).max(20),
    nozzles: z.array(fuelNozzleSchema).min(1).max(40),
  })
  .superRefine((v, ctx) => {
    for (const f of v.config.fuels) if (!(v.config.prices[f]! > 0)) ctx.addIssue({ code: 'custom', path: ['config', 'prices', f], message: 'required' });
    const keys = new Set(v.tanks.map((t) => t.key));
    if (keys.size !== v.tanks.length) ctx.addIssue({ code: 'custom', path: ['tanks'], message: 'duplicate' });
    v.tanks.forEach((t, i) => {
      if (!v.config.fuels.includes(t.fuel)) ctx.addIssue({ code: 'custom', path: ['tanks', i, 'fuel'], message: 'invalid_option' });
      if (t.reorderL > t.capacityL) ctx.addIssue({ code: 'custom', path: ['tanks', i, 'reorderL'], message: 'too_big' });
    });
    const names = new Set<string>();
    v.nozzles.forEach((n, i) => {
      if (!keys.has(n.tankKey)) ctx.addIssue({ code: 'custom', path: ['nozzles', i, 'tankKey'], message: 'invalid_option' });
      const name = n.name.toLowerCase();
      if (names.has(name)) ctx.addIssue({ code: 'custom', path: ['nozzles', i, 'name'], message: 'duplicate' });
      names.add(name);
    });
    // Every tank is used by at least one nozzle.
    for (const [i, t] of v.tanks.entries()) if (!v.nozzles.some((n) => n.tankKey === t.key)) ctx.addIssue({ code: 'custom', path: ['tanks', i], message: 'no_nozzle' });
  });
export type FuelSetup = z.infer<typeof fuelSetupSchema>;
