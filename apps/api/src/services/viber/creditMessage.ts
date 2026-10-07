import { and, eq } from 'drizzle-orm';
import type { DB } from '../../db/client';
import { businesses, customers, messageLog, sales } from '../../db/schema';
import type { ViberProvider } from './provider';

/**
 * Viber Credit (Pay Later) messaging — a self-contained module, called AFTER a sale has been committed.
 * It never throws and is never awaited by checkout, so it cannot block, slow down or fail a sale.
 *
 * A message is sent only when ALL are true:
 *   1. Super Admin enabled the feature for the business   (superadmin_viber_credit_enabled)
 *   2. the manager turned it on                            (manager_viber_credit_enabled)
 *   3. the sale used Credit (Pay Later)                    (a credit portion remains due on the sale)
 *   4. the customer has a registered Viber/phone number
 * and the platform has a Viber provider configured. The message is exactly: "Total: {transaction total}/-".
 */

/** "Total: 40/-", "Total: 1,250/-", "Total: 12.50/-" — Western digits, comma thousands separator. */
export function creditMessage(totalMinor: number): string {
  const major = totalMinor / 100;
  const text = Number.isInteger(major)
    ? major.toLocaleString('en-US', { maximumFractionDigits: 0 })
    : major.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `Total: ${text}/-`;
}

/** International number without "+" (as Viber business APIs expect), or null if unusable. */
export function normalizeViberNumber(raw: string, countryCode: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let digits = trimmed.replace(/[^\d]/g, '');
  if (trimmed.startsWith('+')) {
    /* already international */
  } else if (digits.startsWith('00')) digits = digits.slice(2);
  else if (countryCode && !digits.startsWith(countryCode)) digits = countryCode + digits.replace(/^0+/, '');
  return digits.length >= 7 && digits.length <= 15 ? digits : null;
}

export type CreditMessageOutcome = { sent: false; reason: string } | { sent: true; to: string; body: string };

export async function sendCreditSaleMessage(db: DB, provider: ViberProvider | null, saleId: string, log?: { warn: (o: object, m: string) => void }): Promise<CreditMessageOutcome> {
  try {
    const [row] = await db
      .select({ sale: sales, biz: businesses, customer: customers })
      .from(sales)
      .innerJoin(businesses, eq(businesses.id, sales.businessId))
      .leftJoin(customers, and(eq(customers.id, sales.customerId), eq(customers.businessId, sales.businessId)))
      .where(eq(sales.id, saleId));
    if (!row) return { sent: false, reason: 'sale_not_found' };
    const { sale, biz, customer } = row;
    if (!biz.superadminViberCreditEnabled) return { sent: false, reason: 'not_enabled_by_platform' };
    if (!biz.managerViberCreditEnabled) return { sent: false, reason: 'turned_off_by_manager' };
    if (sale.status !== 'completed' || sale.balanceDue <= 0) return { sent: false, reason: 'not_a_credit_sale' };
    if (!customer) return { sent: false, reason: 'no_customer' };
    const to = normalizeViberNumber(customer.viberPhone || customer.phone, biz.viberCountryCode);
    if (!to) return { sent: false, reason: 'no_viber_number' };
    if (!provider) return { sent: false, reason: 'no_provider' };

    const body = creditMessage(sale.total);
    // One message per sale, even if called twice (unique sale_id + channel).
    const [entry] = await db
      .insert(messageLog)
      .values({ businessId: sale.businessId, saleId: sale.id, customerId: customer.id, channel: 'viber', recipient: to, body, status: 'queued' })
      .onConflictDoNothing()
      .returning({ id: messageLog.id });
    if (!entry) return { sent: false, reason: 'already_sent' };
    try {
      const res = await provider.send(to, body);
      await db.update(messageLog).set({ status: 'sent', providerMessageId: res.id ?? null, sentAt: new Date() }).where(eq(messageLog.id, entry.id));
      return { sent: true, to, body };
    } catch (err) {
      await db.update(messageLog).set({ status: 'failed', error: String((err as Error).message ?? err).slice(0, 500) }).where(eq(messageLog.id, entry.id));
      log?.warn({ err, saleId }, 'viber credit message failed');
      return { sent: false, reason: 'provider_error' };
    }
  } catch (err) {
    log?.warn({ err, saleId }, 'viber credit message skipped (unexpected error)');
    return { sent: false, reason: 'error' };
  }
}
