// SEC-203: same over-fetching pattern as SEC-171 (Lead/Task), found on 2 more repositories —
// documentRepository.findAll and proposalRepository.findAll used a plain `include` with no
// field-level `select`, carrying each row's full `description` (Text, potentially long) on every
// list-endpoint page, even though neither DocumentsPage.tsx nor ProposalsPage.tsx (admin/manager
// list) renders it (grep confirmed: DocumentsPage.tsx's only "description" matches are the
// create/edit form; ProposalsPage.tsx's dialogs reuse the already-fetched list item but none
// render description). Fixed with dedicated documentListSelect/proposalListSelect
// (server/src/utils/prismaSelects.ts) for findAll only; findById keeps returning the full row.
//
// proposalRepository.findAllByClientId (client portal, /proposals/my) is intentionally NOT
// touched: ProposalsClientPage.tsx uses that single endpoint for both the list AND the
// detail-in-place dialog (no separate findById round-trip) — description and sections[].content
// are genuinely rendered from that same response.
//
// This test imports and calls the real documentService.getAll/getById and
// proposalService.getAll/getById against a real database — not a reimplementation — and confirms
// a row with a long description does NOT carry it in the list result, while the detail call
// still returns it.
//
// Requires a real, migrated database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let documentService: typeof import("../src/services/document.service.js").documentService;
let proposalService: typeof import("../src/services/proposal.service.js").proposalService;
let dbAvailable = true;

let clientId: string;
let documentId: string;
let proposalId: string;

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ documentService } = await import("../src/services/document.service.js"));
    ({ proposalService } = await import("../src/services/proposal.service.js"));
    await prisma.$queryRaw`SELECT 1`;

    const client = await prisma.client.create({ data: { name: "sec203 client" } });
    clientId = client.id;

    const longDescription = "x".repeat(5000);
    const document = await prisma.document.create({
      data: {
        name: "sec203 doc",
        title: "sec203 doc",
        url: "https://example.com/sec203.pdf",
        description: longDescription,
        clientId: client.id,
        accessLevel: "ALL",
      },
    });
    documentId = document.id;

    const proposal = await prisma.proposal.create({
      data: { title: "sec203 proposal", description: longDescription, clientId: client.id },
    });
    proposalId = proposal.id;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.proposal.deleteMany({ where: { id: proposalId } });
  await prisma.document.deleteMany({ where: { id: documentId } });
  await prisma.client.deleteMany({ where: { id: clientId } });
});

// SEC-195: `{ skip: !dbAvailable }` is evaluated SYNCHRONOUSLY when describe/test runs, before
// the async before() above has any chance to set the real value. Checking dbAvailable inside
// each test body (via t.skip()) is the only pattern that actually runs after before() resolves.
describe("documentRepository/proposalRepository findAll exclude description from the list payload (SEC-203)", () => {
  test("a document with a long description does not carry it in the list result, but getById still returns it", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const viewer = { role: "ADMIN" as const };
    const listResult = await documentService.getAll({ clientId, page: 1, pageSize: 50, orderDir: "desc" }, viewer);
    const found = listResult.data.find((d) => d.id === documentId);
    assert.ok(found, "the document must appear in the list");
    assert.equal("description" in found!, false, "description must not be present in the list payload at all");

    const detail = await documentService.getById(documentId, viewer);
    assert.equal(detail?.description, "x".repeat(5000), "the detail view (getById) must still return the full description");
  });

  test("a proposal with a long description does not carry it in the admin/manager list result, but getById still returns it", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const listResult = await proposalService.getAll({ clientId, page: 1, pageSize: 50, orderDir: "desc" });
    const found = listResult.data.find((p) => p.id === proposalId);
    assert.ok(found, "the proposal must appear in the list");
    assert.equal("description" in found!, false, "description must not be present in the list payload at all");

    const detail = await proposalService.getById(proposalId);
    assert.equal(detail.description, "x".repeat(5000), "the detail view (getById) must still return the full description");
  });
});
