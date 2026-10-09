import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Executor } from '../../db/client';
import { inventoryTransactions, outlets, products, recipeItems, stockLevels } from '../../db/schema';
import { AppError } from '../../lib/errors';
import { round3 } from '../../lib/tenant';
import { notifyPermission } from '../notifications';

export interface StockMove {
  businessId: string;
  outletId: string;
  productId: string;
  delta: number;
  type: string;
  referenceType?: string;
  referenceId?: string;
  unitCost?: number;
  note?: string;
  userId?: string | null;
  allowNegative?: boolean;
  /** Shops: 'shop' = on the rack (default, what the POS sells from), 'store' = stock room. */
  location?: 'shop' | 'store';
}

/**
 * Apply one stock movement atomically: lock (or create) the stock row, check availability,
 * update the balance and write an inventory transaction. Call inside a DB transaction.
 */
export async function moveStock(tx: Executor, m: StockMove): Promise<number> {
  await tx.execute(sql`
    INSERT INTO stock_levels (business_id, outlet_id, product_id, quantity)
    VALUES (${m.businessId}, ${m.outletId}, ${m.productId}, 0)
    ON CONFLICT (outlet_id, product_id) DO NOTHING`);
  const store = m.location === 'store';
  const locked = await tx.execute<{ quantity: string; store_quantity: string }>(sql`
    SELECT quantity, store_quantity FROM stock_levels WHERE outlet_id = ${m.outletId} AND product_id = ${m.productId} AND business_id = ${m.businessId} FOR UPDATE`);
  const current = Number((store ? locked.rows[0]?.store_quantity : locked.rows[0]?.quantity) ?? 0);
  const next = round3(current + m.delta);
  if (next < 0 && !m.allowNegative) {
    throw new AppError('insufficient_stock', 'Not enough stock', { details: { productId: m.productId, available: current, requested: -m.delta, location: m.location ?? 'shop' } });
  }
  await tx
    .update(stockLevels)
    .set(store ? { storeQuantity: next, updatedAt: new Date() } : { quantity: next, updatedAt: new Date() })
    .where(and(eq(stockLevels.outletId, m.outletId), eq(stockLevels.productId, m.productId)));
  await tx.insert(inventoryTransactions).values({
    businessId: m.businessId,
    outletId: m.outletId,
    productId: m.productId,
    type: m.type,
    quantity: round3(m.delta),
    balanceAfter: next,
    location: store ? 'store' : 'shop',
    unitCost: m.unitCost ?? 0,
    referenceType: m.referenceType ?? null,
    referenceId: m.referenceId ?? null,
    note: m.note ?? '',
    userId: m.userId ?? null,
  });
  return next;
}

/**
 * Consume stock for sold quantities: tracked products directly, and (with the recipes add-on)
 * ingredients through recipes. Returns products that fell to/below their minimum stock.
 */
export async function consumeForSale(
  tx: Executor,
  opts: { businessId: string; outletId: string; saleId: string; userId: string | null; lines: { productId: string; quantity: number }[]; useRecipes: boolean; allowNegative: boolean; reverse?: boolean },
) {
  const sign = opts.reverse ? 1 : -1;
  const ids = [...new Set(opts.lines.map((l) => l.productId))];
  if (!ids.length) return [];
  const prods = await tx
    .select({ id: products.id, trackStock: products.trackStock, minStock: products.minStock, name: products.name, costPrice: products.costPrice })
    .from(products)
    .where(and(eq(products.businessId, opts.businessId), inArray(products.id, ids)));
  const recipes = opts.useRecipes
    ? await tx
        .select()
        .from(recipeItems)
        .where(and(eq(recipeItems.businessId, opts.businessId), inArray(recipeItems.productId, ids)))
    : [];
  // Aggregate movements per product so each stock row is locked once (deterministic order avoids deadlocks).
  const moves = new Map<string, number>();
  for (const l of opts.lines) {
    const p = prods.find((x) => x.id === l.productId);
    if (!p) continue;
    const recipe = recipes.filter((r) => r.productId === p.id);
    if (recipe.length) {
      for (const r of recipe) moves.set(r.ingredientId, (moves.get(r.ingredientId) ?? 0) + r.quantity * l.quantity);
    } else if (p.trackStock) {
      moves.set(p.id, (moves.get(p.id) ?? 0) + l.quantity);
    }
  }
  const low: { productId: string; balance: number }[] = [];
  const minMap = new Map<string, number>();
  if (moves.size) {
    const all = await tx
      .select({ id: products.id, minStock: products.minStock, trackStock: products.trackStock })
      .from(products)
      .where(and(eq(products.businessId, opts.businessId), inArray(products.id, [...moves.keys()])));
    for (const p of all) minMap.set(p.id, p.minStock);
  }
  for (const productId of [...moves.keys()].sort()) {
    const quantity = moves.get(productId)!;
    const isRecipeIngredient = !prods.some((p) => p.id === productId && p.trackStock);
    const balance = await moveStock(tx, {
      businessId: opts.businessId,
      outletId: opts.outletId,
      productId,
      delta: sign * quantity,
      type: opts.reverse ? 'sale_void' : isRecipeIngredient ? 'recipe' : 'sale',
      referenceType: 'sale',
      referenceId: opts.saleId,
      userId: opts.userId,
      allowNegative: opts.reverse ? true : opts.allowNegative,
    });
    const min = minMap.get(productId) ?? 0;
    if (!opts.reverse && min > 0 && balance <= min) low.push({ productId, balance });
  }
  return low;
}

export async function notifyLowStock(tx: Executor, businessId: string, low: { productId: string; balance: number }[], shop?: { outletId: string }) {
  if (!low.length) return;
  const rows = await tx
    .select({ id: products.id, name: products.name })
    .from(products)
    .where(and(eq(products.businessId, businessId), inArray(products.id, low.map((l) => l.productId))));
  // Shops: "low on the rack", with how much is waiting in the store to refill it.
  const store = shop ? await storeStockOf(tx, businessId, shop.outletId, rows.map((r) => r.id)) : null;
  for (const r of rows) {
    const quantity = low.find((l) => l.productId === r.id)!.balance;
    if (store) await notifyPermission(tx, businessId, 'inventory.view', 'notify.low_on_rack', { product: r.name, quantity, store: store.get(r.id) ?? 0 }, '/inventory');
    else await notifyPermission(tx, businessId, 'inventory.view', 'notify.low_stock', { product: r.name, quantity }, '/inventory');
  }
}

export async function storeStockOf(tx: Executor, businessId: string, outletId: string, productIds: string[]): Promise<Map<string, number>> {
  if (!productIds.length) return new Map();
  const rows = await tx
    .select({ productId: stockLevels.productId, quantity: stockLevels.storeQuantity })
    .from(stockLevels)
    .where(and(eq(stockLevels.businessId, businessId), eq(stockLevels.outletId, outletId), inArray(stockLevels.productId, productIds)));
  return new Map(rows.map((r) => [r.productId, Number(r.quantity)]));
}

export async function stockOf(tx: Executor, businessId: string, outletId: string, productIds: string[]): Promise<Map<string, number>> {
  if (!productIds.length) return new Map();
  const rows = await tx
    .select({ productId: stockLevels.productId, quantity: stockLevels.quantity })
    .from(stockLevels)
    .where(and(eq(stockLevels.businessId, businessId), eq(stockLevels.outletId, outletId), inArray(stockLevels.productId, productIds)));
  return new Map(rows.map((r) => [r.productId, Number(r.quantity)]));
}

export async function outletBelongs(tx: Executor, businessId: string, outletId: string): Promise<boolean> {
  const [o] = await tx
    .select({ id: outlets.id })
    .from(outlets)
    .where(and(eq(outlets.businessId, businessId), eq(outlets.id, outletId)));
  return !!o;
}


