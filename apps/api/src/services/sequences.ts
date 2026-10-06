import { sql } from 'drizzle-orm';
import { formatDocumentNumber, numberingPeriodKey, type NumberingSettings } from '@oceanx/shared';
import type { Executor } from '../db/client';

export type DocType = 'invoice' | 'quotation' | 'receipt' | 'purchase' | 'credit_note';

/**
 * Allocate the next document number atomically.
 *
 * A single `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` takes a row lock on
 * the counter, so concurrent requests are serialized by PostgreSQL and can
 * never receive the same number. Call inside the transaction that inserts the
 * document so a rollback also releases the number (no gaps from failures).
 */
export async function allocateDocumentNumber(
  db: Executor,
  opts: { businessId: string; docType: DocType; numbering: NumberingSettings; outletId?: string | null; date?: Date },
): Promise<{ number: string; sequence: number }> {
  const date = opts.date ?? new Date();
  const period = numberingPeriodKey(opts.numbering.reset, date);
  const scope = opts.outletId ? `outlet:${opts.outletId}` : 'business';
  const start = opts.numbering.startNumber;
  const result = await db.execute<{ last_number: number }>(sql`
    INSERT INTO document_sequences (business_id, scope, doc_type, period, last_number, updated_at)
    VALUES (${opts.businessId}, ${scope}, ${opts.docType}, ${period}, ${start}, now())
    ON CONFLICT (business_id, scope, doc_type, period)
    DO UPDATE SET last_number = GREATEST(document_sequences.last_number + 1, ${start}), updated_at = now()
    RETURNING last_number
  `);
  const seq = Number(result.rows[0]?.last_number);
  return { sequence: seq, number: formatDocumentNumber(opts.numbering, seq, date) };
}
