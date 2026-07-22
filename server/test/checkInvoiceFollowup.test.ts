// SEC-014/SEC-015 (ANOMALIES.yaml): checkInvoiceFollowup previously computed daysOverdue
// from Invoice.createdAt instead of dueDate (SEC-014), and only ever queried
// status IN ["SENT","PARTIAL"] — once a job elsewhere flips an invoice to OVERDUE, it
// silently stopped receiving any further reminder forever (SEC-015). This test imports
// and calls the real function against a real, migrated database — not a reimplementation
// of its date-tier logic — so it stays red if the real code regresses.
//
// Requires a real database (DATABASE_URL); skipped automatically if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "a".repeat(32);
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? "b".repeat(32);
process.env.FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";

let prisma: typeof import("../src/config/prisma.js").prisma;
let checkInvoiceFollowup: typeof import("../src/jobs/processors/ceoAlerts.processor.js").checkInvoiceFollowup;
let dbAvailable = true;

let clientId: string;
let serviceId: string;
const createdInvoiceIds: string[] = [];

async function makeInvoice(overrides: {
  status: "SENT" | "PARTIAL" | "OVERDUE";
  dueDate: Date;
  createdAt: Date;
  number: string;
}) {
  const inv = await prisma.invoice.create({
    data: {
      number: overrides.number,
      title: "Test invoice",
      amount: 1000,
      currency: "TND",
      status: overrides.status,
      dueDate: overrides.dueDate,
      clientId,
      createdAt: overrides.createdAt,
    },
  });
  createdInvoiceIds.push(inv.id);
  return inv;
}

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86_400_000);
}

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ checkInvoiceFollowup } = await import("../src/jobs/processors/ceoAlerts.processor.js"));
    await prisma.$queryRaw`SELECT 1`;

    const service = await prisma.service.findFirst();
    if (!service) throw new Error("no Service seeded");
    serviceId = service.id;
    const client = await prisma.client.create({ data: { name: "SEC-014-015 test client", serviceId } });
    clientId = client.id;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.invoiceReminder.deleteMany({ where: { invoiceId: { in: createdInvoiceIds } } });
  await prisma.invoice.deleteMany({ where: { id: { in: createdInvoiceIds } } });
  await prisma.client.delete({ where: { id: clientId } }).catch(() => {});
});

// SEC-195: `describe`/`test`'s own `skip` option is evaluated SYNCHRONOUSLY at registration
// time, before the async `before()` above has any chance to resolve and set `dbAvailable` — it
// worked only by accident of timing locally. Checking `dbAvailable` inside each test body (and
// returning early) is the only pattern that actually runs after `before()` has resolved.
describe("checkInvoiceFollowup — tier by dueDate, not createdAt (SEC-014)", () => {
  test("an invoice created recently but with dueDate 14 days in the past gets the SECOND tier", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const inv = await makeInvoice({
      status: "SENT",
      // createdAt is recent (1 day ago) — if the bug were still present (tiering off
      // createdAt), this invoice would get NO tier at all (daysOverdue ~= 1 < 7).
      createdAt: daysAgo(1),
      // dueDate is 14 days in the past — a real "invoice edited/backdated then sent late"
      // scenario, exactly what the original bug's classA note describes.
      dueDate: daysAgo(14),
      number: `SEC-014-${Date.now()}-A`,
    });

    await checkInvoiceFollowup();

    const reminders = await prisma.invoiceReminder.findMany({ where: { invoiceId: inv.id } });
    assert.equal(reminders.length, 1, "exactly one reminder should have been sent");
    assert.equal(reminders[0]!.type, "SECOND", "14 days overdue by dueDate must select the SECOND tier, not FIRST or none");
  });

  test("an invoice with dueDate only 3 days in the past gets no reminder yet (below the 7-day FIRST threshold)", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const inv = await makeInvoice({
      status: "SENT",
      createdAt: daysAgo(30), // old creation date must not matter
      dueDate: daysAgo(3),
      number: `SEC-014-${Date.now()}-B`,
    });

    await checkInvoiceFollowup();

    const reminders = await prisma.invoiceReminder.findMany({ where: { invoiceId: inv.id } });
    assert.equal(reminders.length, 0, "3 days overdue by dueDate is below the FIRST tier (7 days) — no reminder expected");
  });
});

describe("checkInvoiceFollowup — OVERDUE invoices keep receiving tiered reminders (SEC-015)", () => {
  test("an invoice already in OVERDUE status still receives a FINAL reminder at 30+ days overdue", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const inv = await makeInvoice({
      status: "OVERDUE",
      createdAt: daysAgo(35),
      dueDate: daysAgo(35),
      number: `SEC-015-${Date.now()}-A`,
    });

    await checkInvoiceFollowup();

    const reminders = await prisma.invoiceReminder.findMany({ where: { invoiceId: inv.id } });
    assert.equal(reminders.length, 1, "an OVERDUE invoice must still receive a reminder — this is exactly what SEC-015 found broken");
    assert.equal(reminders[0]!.type, "FINAL");
  });

  test("an OVERDUE invoice does not get a duplicate reminder for a tier it already received", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const inv = await makeInvoice({
      status: "OVERDUE",
      createdAt: daysAgo(10),
      dueDate: daysAgo(10),
      number: `SEC-015-${Date.now()}-B`,
    });
    await prisma.invoiceReminder.create({ data: { invoiceId: inv.id, type: "FIRST" } });

    await checkInvoiceFollowup();

    const reminders = await prisma.invoiceReminder.findMany({ where: { invoiceId: inv.id } });
    assert.equal(reminders.length, 1, "the FIRST tier was already sent — checkInvoiceFollowup must not re-send it");
  });
});
