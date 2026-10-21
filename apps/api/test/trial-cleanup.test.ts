import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sweepEndedTrials } from "../src/services/trialCleanup";
import {
  Client,
  createSuperAdmin,
  createTestEnv,
  loginSuperAdmin,
  planId,
  resetDb,
  type TestEnv,
} from "./helpers";

const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da6364f8ff1f0003030200efa6c8f00000000049454e44ae426082",
  "hex",
);
const HOUR = 3_600_000;

let env: TestEnv;
let sa: Client;

beforeAll(async () => {
  env = await createTestEnv({ storageDriver: "db" });
});
afterAll(async () => env.close());
beforeEach(async () => {
  await resetDb(env.db);
  await createSuperAdmin(env.db);
  sa = await loginSuperAdmin(env);
  env.mailer.outbox.length = 0;
});

async function signUp(
  name: string,
  product: "pos" | "gravity" | "flow" | "budget" = "gravity",
) {
  const c = new Client(env.app);
  const email = `${name.toLowerCase().replace(/\W/g, "")}@trial.test`;
  const res = await c.post("/api/auth/register", {
    product,
    businessName: name,
    businessType: "cafe",
    ownerName: `Owner ${name}`,
    email,
    phone: "7771234",
    password: "Trial-Pass-1234",
    currency: "MVR",
  });
  expect(res.statusCode, res.body).toBe(201);
  return {
    c,
    id: res.json().registeredBusinessId as string,
    email,
    session: res.json(),
  };
}
const endTrial = (id: string, hoursAgo = 1) =>
  env.db.execute(
    sql`UPDATE subscriptions SET current_period_end = now() - make_interval(hours => ${hoursAgo}) WHERE business_id = ${id}`,
  );
const sweep = (at = new Date()) =>
  sweepEndedTrials(
    {
      db: env.db,
      mailer: env.mailer,
      config: env.app.deps.config,
      removeFiles: (id) => env.app.deps.storage.removeBusinessFiles(id),
    },
    at,
  );
const rowsLeft = async (id: string) => {
  const tables = await env.db.execute<{ t: string }>(
    sql`SELECT table_name AS t FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'business_id' AND table_name NOT IN ('signups', 'hub_clients', 'hub_tickets')`,
  );
  let n = 0;
  for (const { t } of tables.rows)
    n += Number(
      (
        await env.db.execute<{ n: string }>(
          sql`SELECT count(*) AS n FROM ${sql.identifier(t)} WHERE business_id = ${id}`,
        )
      ).rows[0]!.n,
    );
  n += Number(
    (
      await env.db.execute<{ n: string }>(
        sql`SELECT count(*) AS n FROM businesses WHERE id = ${id}`,
      )
    ).rows[0]!.n,
  );
  n += Number(
    (
      await env.db.execute<{ n: string }>(
        sql`SELECT count(*) AS n FROM stored_files WHERE path LIKE ${`businesses/${id}/%`}`,
      )
    ).rows[0]!.n,
  );
  return n;
};

describe("Gravity free trials: no approval, then deleted 48 hours after an unpaid trial ends", () => {
  it("Gravity owners start at once; Super Admin sees each Gravity sign-up (POS still waits for approval)", async () => {
    const g = await signUp("Grav One");
    expect(g.session.state).toBe("ok");
    await signUp("Grav Two");
    const pos = await signUp("Cafe One", "pos");
    expect(pos.session.state).toBe("business_pending");
    const list = (await sa.get("/api/superadmin/signups")).json();
    expect(list.trialDeleteHours).toBe(48);
    expect(
      list.items.map((i: { businessName: string }) => i.businessName).sort(),
    ).toEqual(["Grav One", "Grav Two"]);
    expect(list.items[0]).toMatchObject({
      product: "gravity",
      email: expect.stringContaining("@trial.test"),
      phone: "7771234",
      state: "trial",
    });
    expect(
      (await sa.get("/api/superadmin/signups?q=two")).json().items,
    ).toHaveLength(1);
  });

  it("trial ends → owner emailed and told on screen → 48 hours later the account and all its data are gone; the sign-up record stays", async () => {
    const shop = await signUp("Busy Studio");
    const other = await signUp("Other Studio");
    const { c } = shop;
    // A real working account: customer, quotation turned into an invoice, a payment, logo.
    const cust = (
      await c.post("/api/customers", { name: "Ali", phone: "7770000" })
    ).json();
    const qt = await c.post("/api/quotations", {
      customerId: cust.id,
      quotationDate: "2026-10-01",
      validUntil: "2026-10-30",
      items: [{ name: "Logo design", quantity: 1, unitPrice: 1500 }],
    });
    expect(qt.statusCode, qt.body).toBe(201);
    const inv = await c.post("/api/invoices", {
      customerId: cust.id,
      invoiceDate: "2026-10-01",
      dueDate: "2026-10-30",
      items: [{ name: "Business cards", quantity: 2, unitPrice: 250 }],
    });
    expect(inv.statusCode, inv.body).toBe(201);
    expect(
      (
        await c.request("PUT", "/api/settings/logo", PNG, {
          "content-type": "image/png",
        })
      ).statusCode,
    ).toBe(200);
    expect(await rowsLeft(shop.id)).toBeGreaterThan(10);

    // Still on trial: nothing happens.
    expect(await sweep()).toEqual({ noticed: 0, deleted: 0 });

    await endTrial(shop.id);
    const now = new Date();
    expect(await sweep(now)).toEqual({ noticed: 1, deleted: 0 });
    const mail = env.mailer.outbox.find((m) => m.to === shop.email)!;
    expect(mail.subject).toContain("Busy Studio");
    expect(mail.text).toContain("deleted permanently");
    // Told once only.
    expect(await sweep(now)).toEqual({ noticed: 0, deleted: 0 });
    // The trial-ended screen shows when it will be deleted.
    const session = (await c.get("/api/auth/session")).json();
    expect(session.state).toBe("subscription_expired");
    expect(new Date(session.subscription.deleteAt).getTime()).toBe(
      now.getTime() + 48 * HOUR,
    );

    // 47 hours later: still there. 48 hours: gone, with everything in it.
    expect((await sweep(new Date(now.getTime() + 47 * HOUR))).deleted).toBe(0);
    expect(await sweep(new Date(now.getTime() + 48 * HOUR + 1000))).toEqual({
      noticed: 0,
      deleted: 1,
    });
    expect(await rowsLeft(shop.id)).toBe(0);
    expect((await c.get("/api/auth/session")).statusCode).toBe(401);
    expect(
      (
        await new Client(env.app).post("/api/auth/login", {
          email: shop.email,
          password: "Trial-Pass-1234",
        })
      ).statusCode,
    ).toBe(401);

    // Other accounts are untouched; Super Admin still has the sign-up details.
    expect(await rowsLeft(other.id)).toBeGreaterThan(0);
    const rec = (await sa.get("/api/superadmin/signups?q=busy")).json()
      .items[0];
    expect(rec).toMatchObject({
      businessName: "Busy Studio",
      email: shop.email,
      phone: "7771234",
      state: "deleted",
      businessId: null,
    });
    // The same email can sign up again, but the free trial was already used: it has to pay to use it.
    expect((await signUp("Busy Studio")).session.state).toBe("subscription_expired");
  });

  it("a trial that ended before this rule gets the full 48 hours from the notice", async () => {
    const old = await signUp("Old Studio");
    await endTrial(old.id, 24 * 30);
    const now = new Date();
    expect(await sweep(now)).toEqual({ noticed: 1, deleted: 0 });
    expect((await sweep(new Date(now.getTime() + 47 * HOUR))).deleted).toBe(0);
    expect((await sweep(new Date(now.getTime() + 49 * HOUR))).deleted).toBe(1);
  });

  it("Gravity Flow: an unpaid trial is deleted 24 hours after it ends (its own setting); paying in time keeps it", async () => {
    const flow = await signUp("Flow Shop", "flow");
    const paying = await signUp("Flow Payer", "flow");
    await endTrial(flow.id);
    await endTrial(paying.id);
    const now = new Date();
    expect(await sweep(now)).toEqual({ noticed: 2, deleted: 0 });
    expect(env.mailer.outbox.filter((m) => m.subject.startsWith("Your free trial has ended")).length).toBe(2);
    // The owner sees when it will be deleted: 24 hours from the notice.
    const deleteAt = (await flow.c.get("/api/auth/session")).json().subscription.deleteAt;
    expect(Math.round((new Date(deleteAt).getTime() - now.getTime()) / HOUR)).toBe(24);
    // One of them sends a slip in time.
    const plan = (await paying.c.get("/api/billing")).json().plans[0].id;
    expect((await paying.c.request("POST", `/api/billing/payments?planId=${plan}&months=1&reference=FL1`, PNG, { "content-type": "image/png" })).statusCode).toBe(201);
    expect((await sweep(new Date(now.getTime() + 23 * HOUR))).deleted).toBe(0);
    expect((await sweep(new Date(now.getTime() + 25 * HOUR))).deleted).toBe(1);
    expect(await rowsLeft(flow.id)).toBe(0);
    expect(await rowsLeft(paying.id)).toBeGreaterThan(0);
    // Super Admin's Flow sign-ups list keeps the record, marked deleted, with Flow's 24 hours.
    const list = (await sa.get("/api/superadmin/signups?product=flow")).json();
    expect(list.flowTrialDeleteHours).toBe(24);
    expect(list.items.find((r: { businessName: string }) => r.businessName === "Flow Shop").state).toBe("deleted");
    // Gravity keeps its own 48 hours; Flow's can be changed (0 = never).
    expect((await sa.patch("/api/superadmin/settings", { flowTrialDeleteHours: 0 })).statusCode).toBe(200);
    const kept = await signUp("Flow Kept", "flow");
    await endTrial(kept.id);
    expect(await sweep(new Date(now.getTime() + 100 * HOUR))).toEqual({ noticed: 0, deleted: 0 });
    expect(await rowsLeft(kept.id)).toBeGreaterThan(0);
  });

  it("never deleted: POS and Gravity Budget trials, payment waiting for review, activated by Super Admin, or the rule switched off", async () => {
    await sa.patch("/api/superadmin/settings", { registrationMode: "open" });
    const pos = await signUp("Pos Cafe", "pos");
    const budget = await signUp("Budget Person", "budget");
    await endTrial(pos.id);
    await endTrial(budget.id);
    const reviewing = await signUp("Paying Studio");
    const activated = await signUp("Friend Studio");
    const off = await signUp("Kept Studio");
    const basic = await planId(sa, "gravity");
    await endTrial(reviewing.id);
    expect(
      (
        await reviewing.c.request(
          "POST",
          `/api/billing/payments?planId=${basic}&months=1&reference=FT1`,
          PNG,
          { "content-type": "image/png" },
        )
      ).statusCode,
    ).toBe(201);
    await endTrial(activated.id);
    // Super Admin activates it (e.g. a demo or a friend): no longer a trial, so never auto-deleted.
    expect(
      (
        await sa.post(
          `/api/superadmin/businesses/${activated.id}/subscription/change-plan`,
          {
            planId: basic,
            status: "active",
            periodEnd: new Date(Date.now() - HOUR).toISOString(),
          },
        )
      ).statusCode,
    ).toBe(200);
    const later = new Date(Date.now() + 100 * HOUR);
    await sweep();
    expect((await sweep(later)).deleted).toBe(0);
    expect(await rowsLeft(reviewing.id)).toBeGreaterThan(0);
    expect(await rowsLeft(activated.id)).toBeGreaterThan(0);
    expect(await rowsLeft(pos.id)).toBeGreaterThan(0);
    expect(await rowsLeft(budget.id)).toBeGreaterThan(0);
    expect(
      (await pos.c.get("/api/auth/session")).json().subscription.deleteAt,
    ).toBeNull();

    await endTrial(off.id);
    await sa.patch("/api/superadmin/settings", { trialDeleteHours: 0 });
    expect(await sweep(later)).toEqual({ noticed: 0, deleted: 0 });
    expect(await rowsLeft(off.id)).toBeGreaterThan(0);
    expect(
      (await off.c.get("/api/auth/session")).json().subscription.deleteAt,
    ).toBeNull();
  });

  it("the cron address runs the same check, and only with the secret when one is set", async () => {
    const res = await env.app.inject({
      method: "GET",
      url: "/api/cron/trials",
    });
    expect(res.json()).toEqual({ noticed: 0, deleted: 0 });
    const locked = await createTestEnv({
      env: { CRON_SECRET: "cron-secret-123" },
    });
    try {
      expect(
        (await locked.app.inject({ method: "GET", url: "/api/cron/trials" }))
          .statusCode,
      ).toBe(401);
      expect(
        (
          await locked.app.inject({
            method: "GET",
            url: "/api/cron/trials",
            headers: { authorization: "Bearer cron-secret-123" },
          })
        ).statusCode,
      ).toBe(200);
    } finally {
      await locked.close();
    }
  });
});
