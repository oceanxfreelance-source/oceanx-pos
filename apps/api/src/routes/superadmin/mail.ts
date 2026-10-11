import type { FastifyInstance } from 'fastify';
import { and, desc, eq, inArray, isNull, sql, type SQL } from 'drizzle-orm';
import { MAIL_MAX_RECIPIENTS, mailAudienceSchema, mailMessageSchema } from '@oceanx/shared';
import type { z } from 'zod';
import type { Executor } from '../../db/client';
import { businesses, plans, platformEmails, subscriptions, superAdmins, users } from '../../db/schema';
import { saCtx } from '../../guards/superadmin';
import { audit } from '../../lib/audit';
import { AppError } from '../../lib/errors';
import { parse } from '../../lib/validation';
import { appUrlFor, type AppConfig } from '../../config';

type Audience = z.infer<typeof mailAudienceSchema>;
interface Recipient {
  businessId: string;
  business: string;
  product: string;
  name: string;
  email: string;
  periodEnd: Date | null;
  price: string | null;
  currency: string | null;
}

/** Business owners in the chosen group (never addresses typed by the client). */
async function findRecipients(db: Executor, a: Audience): Promise<Recipient[]> {
  const conds: SQL[] = [isNull(businesses.deletedAt)];
  if (a.product !== 'all') conds.push(eq(businesses.product, a.product));
  const end = subscriptions.currentPeriodEnd;
  if (a.segment === 'trialing') conds.push(sql`${subscriptions.status} = 'trialing' AND ${end} > now()`);
  if (a.segment === 'trial_ending') conds.push(sql`${subscriptions.status} = 'trialing' AND ${end} > now() AND ${end} <= now() + make_interval(hours => ${a.hours})`);
  if (a.segment === 'expired') conds.push(sql`(${subscriptions.status} IN ('expired','cancelled') OR ${end} < now())`);
  if (a.segment === 'active') conds.push(sql`${subscriptions.status} = 'active' AND ${end} > now()`);
  if (a.segment === 'selected') {
    if (!a.businessIds.length) return [];
    conds.push(inArray(businesses.id, a.businessIds));
  }
  const rows = await db
    .select({
      businessId: businesses.id,
      business: businesses.name,
      product: businesses.product,
      businessEmail: businesses.email,
      ownerName: users.name,
      ownerEmail: users.email,
      periodEnd: end,
      price: plans.priceMonthly,
      currency: plans.currency,
    })
    .from(businesses)
    .leftJoin(subscriptions, eq(subscriptions.businessId, businesses.id))
    .leftJoin(plans, eq(plans.id, subscriptions.planId))
    .leftJoin(users, and(eq(users.businessId, businesses.id), eq(users.isOwner, true), isNull(users.deletedAt)))
    .where(and(...conds))
    .orderBy(end, businesses.name);
  const seen = new Set<string>();
  const out: Recipient[] = [];
  for (const r of rows) {
    const email = (r.ownerEmail || r.businessEmail || '').trim();
    // One email per business, and only to a real address.
    if (!email.includes('@') || seen.has(r.businessId)) continue;
    seen.add(r.businessId);
    out.push({ businessId: r.businessId, business: r.business, product: r.product, name: r.ownerName || r.business, email, periodEnd: r.periodEnd, price: r.price, currency: r.currency });
  }
  return out;
}

function timeLeft(end: Date | null) {
  if (!end) return '';
  const min = Math.max(0, Math.round((end.getTime() - Date.now()) / 60_000));
  if (min >= 2880) return `${Math.round(min / 1440)} days`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return [h && `${h} h`, (m || !h) && `${m} min`].filter(Boolean).join(' ');
}

/** The message for one person: {{name}}, {{business}}, {{ends}}, {{time_left}}, {{price}}, {{link}}. */
function personalise(template: string, r: Recipient, config: AppConfig) {
  const ends = r.periodEnd
    ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Indian/Maldives', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(r.periodEnd)
    : '';
  const price = r.price && r.currency ? `${r.currency} ${Number(r.price).toFixed(2)}` : '';
  const values: Record<string, string> = { name: r.name, business: r.business, ends, time_left: timeLeft(r.periodEnd), price, link: appUrlFor(config, r.product) };
  return template.replace(/\{\{\s*(name|business|ends|time_left|price|link)\s*\}\}/g, (_, k: string) => values[k] ?? '');
}

/** Send to many without waiting for each one in turn (Gmail is slow per message). */
async function sendAll<T>(items: T[], limit: number, fn: (item: T) => Promise<boolean>) {
  const results: boolean[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]!).catch(() => false);
      }
    }),
  );
  return results;
}

export async function mailRoutes(app: FastifyInstance) {
  const { db, mailer, config } = app.deps;

  // Who would get it, and how it reads for the first person.
  app.post('/mail/preview', async (req) => {
    const body = parse(mailMessageSchema, req.body);
    const list = await findRecipients(db, body.audience);
    const first = list[0];
    return {
      count: list.length,
      max: MAIL_MAX_RECIPIENTS,
      recipients: list.slice(0, 200).map((r) => ({ businessId: r.businessId, business: r.business, product: r.product, name: r.name, email: r.email, periodEnd: r.periodEnd })),
      sample: first ? { to: first.email, subject: personalise(body.subject, first, config), text: personalise(body.body, first, config) } : null,
    };
  });

  app.post('/mail/send', async (req) => {
    const ctx = saCtx(req);
    const body = parse(mailMessageSchema, req.body);
    const list = await findRecipients(db, body.audience);
    if (!list.length) throw new AppError('validation_failed', 'Nobody to send to', { fields: { audience: { code: 'required' } } });
    if (list.length > MAIL_MAX_RECIPIENTS) throw new AppError('validation_failed', `At most ${MAIL_MAX_RECIPIENTS} people per email`, { fields: { audience: { code: 'too_big' } } });
    const results = await sendAll(list, 5, async (r) => {
      await mailer.send({ to: r.email, subject: personalise(body.subject, r, config), text: personalise(body.body, r, config) });
      return true;
    });
    const recipients = list.map((r, i) => ({ email: r.email, business: r.business, ok: results[i] === true }));
    const sentCount = recipients.filter((r) => r.ok).length;
    const [row] = await db
      .insert(platformEmails)
      .values({ subject: body.subject, body: body.body, audience: body.audience, recipients, sentCount, failedCount: recipients.length - sentCount, sentBy: ctx.admin.id })
      .returning({ id: platformEmails.id });
    await audit(db, { actorType: 'super_admin', actorId: ctx.admin.id, actorName: ctx.admin.name, action: 'superadmin.mail_sent', entityType: 'platform_email', entityId: row!.id, metadata: { subject: body.subject, sent: sentCount, failed: recipients.length - sentCount }, req });
    return { id: row!.id, sent: sentCount, failed: recipients.length - sentCount };
  });

  app.get('/mail', async () => {
    const rows = await db
      .select({ mail: platformEmails, by: superAdmins.name })
      .from(platformEmails)
      .leftJoin(superAdmins, eq(superAdmins.id, platformEmails.sentBy))
      .orderBy(desc(platformEmails.createdAt))
      .limit(100);
    return { items: rows.map((r) => ({ ...r.mail, sentByName: r.by ?? '' })) };
  });
}
