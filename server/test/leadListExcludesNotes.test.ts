// SEC-171: leadRepository.findAll (the main leads list endpoint, up to 500 rows/call since
// LEADS_MAX_PAGE_SIZE) had no `select` at all — every column, including Lead.notes (a free-text
// Text field), was fetched for every row. LeadsKanban.tsx and every other list/kanban consumer
// only ever read name/email/phone/status (confirmed by grep on client/src/features/leads: notes
// is only read on the single lead detail view, which calls findById, not findAll). Fixed with an
// explicit select allow-list (leadListSelect) that omits notes.
//
// This test imports and calls the real leadRepository.findAll against a real database — not a
// reimplementation — and confirms a lead created with a long notes value does NOT carry notes in
// the list result, while findById still returns it (proving the detail path is unaffected).
//
// Requires a real, migrated database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let leadRepository: typeof import("../src/repositories/lead.repository.js").leadRepository;
let dbAvailable = true;

const createdLeadIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ leadRepository } = await import("../src/repositories/lead.repository.js"));
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.lead.deleteMany({ where: { id: { in: createdLeadIds } } });
});

// SEC-195: `{ skip: !dbAvailable }` is evaluated SYNCHRONOUSLY when describe/test runs, before
// the async before() above has any chance to set the real value. Checking dbAvailable inside
// each test body (via t.skip()) is the only pattern that actually runs after before() resolves.
describe("leadRepository.findAll excludes notes from the list payload (SEC-171)", () => {
  test("a lead with long notes does not carry notes in the list result, but findById still returns it", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const longNotes = "x".repeat(5000);
    const lead = await prisma.lead.create({ data: { name: `sec171-lead-${Date.now()}`, notes: longNotes, status: "NEW" } });
    createdLeadIds.push(lead.id);

    const listResult = await leadRepository.findAll({ page: 1, pageSize: 50, orderDir: "desc" });
    const found = listResult.data.find((l) => l.id === lead.id);
    assert.ok(found, "the lead must appear in the list");
    assert.equal("notes" in found!, false, "notes must not be present in the list payload at all");

    const detail = await leadRepository.findById(lead.id);
    assert.equal(detail!.notes, longNotes, "the detail view (findById) must still return the full notes");
  });
});
