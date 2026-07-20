// SEC-155 (ANOMALIES.yaml): leadService.createLead had no duplicate-by-email check, unlike the
// public contact form (contact.service.ts, explicit find-or-update). Two managers manually
// creating a lead for the same prospect's email produced two silent rows, inflating pipeline
// volume/conversion metrics. Per the project owner's decision (reject, not merge — a manually
// typed lead shouldn't be silently folded into someone else's), createLead now checks for an
// active (non-archived) lead with the same email first and throws 409 LEAD_EMAIL_ALREADY_EXISTS.
//
// This test imports and calls the real leadService.createLead — not a reimplementation —
// against a real, migrated database. Requires a real database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

process.env.FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";

let prisma: typeof import("../src/config/prisma.js").prisma;
let leadService: typeof import("../src/services/lead.service.js").leadService;
let dbAvailable = true;

const createdLeadIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ leadService } = await import("../src/services/lead.service.js"));
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.lead.deleteMany({ where: { id: { in: createdLeadIds } } });
});

describe("leadService.createLead rejects duplicate active emails (SEC-155)", { skip: !dbAvailable ? "no reachable database" : false }, () => {
  test("creating a second lead with the same email as an existing active lead throws 409 LEAD_EMAIL_ALREADY_EXISTS", async () => {
    const email = `sec155-${Date.now()}@example.com`;

    const first = await leadService.createLead({ name: "First entry", email });
    createdLeadIds.push(first.id);

    await assert.rejects(
      () => leadService.createLead({ name: "Second entry, same prospect", email }),
      (err: unknown) => {
        const httpErr = err as { statusCode?: number; code?: string };
        return httpErr.statusCode === 409 && httpErr.code === "LEAD_EMAIL_ALREADY_EXISTS";
      },
      "a second createLead with the same email as an active lead must be rejected"
    );

    const leadsWithEmail = await prisma.lead.findMany({ where: { email } });
    assert.equal(leadsWithEmail.length, 1, "the rejected attempt must never have inserted a second row");
  });

  test("a lead can be created with the same email as an ARCHIVED (lost/won) lead — a re-entry is legitimate", async () => {
    const email = `sec155-archived-${Date.now()}@example.com`;

    const original = await leadService.createLead({ name: "Original prospect", email });
    createdLeadIds.push(original.id);
    await prisma.lead.update({ where: { id: original.id }, data: { archivedAt: new Date(), status: "LOST" } });

    const reEntry = await leadService.createLead({ name: "Re-engaged prospect", email });
    createdLeadIds.push(reEntry.id);

    assert.notEqual(reEntry.id, original.id);
    const leadsWithEmail = await prisma.lead.findMany({ where: { email } });
    assert.equal(leadsWithEmail.length, 2, "an archived lead must not block a legitimate re-entry for the same email");
  });

  test("a lead created with no email at all is never checked for duplicates (multiple no-email leads are legitimate)", async () => {
    const first = await leadService.createLead({ name: "No email lead 1" });
    createdLeadIds.push(first.id);
    const second = await leadService.createLead({ name: "No email lead 2" });
    createdLeadIds.push(second.id);

    assert.notEqual(first.id, second.id);
    assert.equal(first.email, null);
    assert.equal(second.email, null);
  });
});
