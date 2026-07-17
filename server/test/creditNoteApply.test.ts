// SEC-022 (ANOMALIES.yaml): creditNoteService.applyCredit used a conditional
// `tx.creditNote.update({ where: { id, appliedAt: null, clientId } })` to guard against
// applying an already-applied credit note, expecting Prisma to return null on no match — but
// Prisma throws PrismaClientKnownRequestError (P2025) instead, which was never caught. The
// intended `HttpError(409, ..., "CREDIT_ALREADY_APPLIED")` never fired; the raw Prisma error
// fell through to the generic 500 handler in error.middleware.ts. This test imports and calls
// the real applyCredit against a real database — not a reimplementation — to prove the fix.
//
// Requires a real database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let creditNoteService: typeof import("../src/services/creditNote.service.js").creditNoteService;
let HttpError: typeof import("../src/utils/httpError.js").HttpError;
let dbAvailable = true;

let serviceId: string;
const createdClientIds: string[] = [];

after(async () => {
  if (!dbAvailable) return;
  const clients = await prisma.client.findMany({ where: { id: { in: createdClientIds } }, select: { id: true } });
  const clientIds = clients.map((c) => c.id);
  await prisma.creditNote.deleteMany({ where: { clientId: { in: clientIds } } });
  await prisma.invoice.deleteMany({ where: { clientId: { in: clientIds } } });
  await prisma.client.deleteMany({ where: { id: { in: clientIds } } });
});

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ creditNoteService } = await import("../src/services/creditNote.service.js"));
    ({ HttpError } = await import("../src/utils/httpError.js"));
    await prisma.$queryRaw`SELECT 1`;
    const service = await prisma.service.findFirst();
    if (!service) throw new Error("no Service seeded");
    serviceId = service.id;
  } catch {
    dbAvailable = false;
  }
});

async function makeInvoiceWithCreditNote(opts: { creditNoteAlreadyApplied: boolean }) {
  const client = await prisma.client.create({ data: { name: "SEC-022 test client", serviceId, creditBalance: 100 } });
  createdClientIds.push(client.id);
  const invoice = await prisma.invoice.create({
    data: { number: `SEC-022-${Date.now()}`, title: "Test", amount: 500, amountPaid: 200, status: "PARTIAL", currency: "TND", clientId: client.id },
  });
  const creditNote = await prisma.creditNote.create({
    data: {
      number: `CN-SEC022-${Date.now()}`,
      amount: 50,
      reason: "test",
      invoiceId: invoice.id,
      clientId: client.id,
      ...(opts.creditNoteAlreadyApplied ? { appliedAt: new Date(), appliedToInvoiceId: invoice.id } : {}),
    },
  });
  return { client, invoice, creditNote };
}

describe("creditNoteService.applyCredit — P2025 handling (SEC-022)", { skip: !dbAvailable ? "no reachable database" : false }, () => {
  test("applying an already-applied credit note throws a real 409 HttpError, not a raw Prisma error", async () => {
    const { invoice, creditNote } = await makeInvoiceWithCreditNote({ creditNoteAlreadyApplied: true });

    await assert.rejects(
      () => creditNoteService.applyCredit(creditNote.id, invoice.id),
      (err: unknown) => {
        assert.ok(err instanceof HttpError, `expected an HttpError, got ${(err as Error)?.constructor?.name}`);
        assert.equal((err as InstanceType<typeof HttpError>).statusCode, 409);
        assert.equal((err as InstanceType<typeof HttpError>).code, "CREDIT_ALREADY_APPLIED");
        return true;
      }
    );
  });

  test("applying a fresh credit note succeeds and actually reduces the client's credit balance", async () => {
    const { client, invoice, creditNote } = await makeInvoiceWithCreditNote({ creditNoteAlreadyApplied: false });

    const result = await creditNoteService.applyCredit(creditNote.id, invoice.id);
    assert.equal(result.appliedAmount, 50);

    const updatedInvoice = await prisma.invoice.findUnique({ where: { id: invoice.id } });
    assert.equal(Number(updatedInvoice!.amountPaid), 250);

    const updatedClient = await prisma.client.findUnique({ where: { id: client.id } });
    assert.equal(Number(updatedClient!.creditBalance), 50, "creditBalance must be decremented by the applied amount");
  });
});
