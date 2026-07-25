// RG-025 (GDPR export/erasure, see REFERENTIEL.md §5 and gdpr.service.ts).
//
// This test imports and calls the real gdprService against a real, migrated database — not a
// reimplementation — for both branches of the erasure decision (hard delete vs anonymize) on
// both subject types (Client, User), plus a basic shape check on both export functions.
// Skipped if the database is unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let gdprService: typeof import("../src/services/gdpr.service.js").gdprService;
let dbAvailable = true;

const createdUserIds: string[] = [];
const createdClientIds: string[] = [];
const createdLeadIds: string[] = [];
const createdProjectIds: string[] = [];
const createdContactRequestIds: string[] = [];
const createdProposalIds: string[] = [];
const createdDocumentIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ gdprService } = await import("../src/services/gdpr.service.js"));
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.document.deleteMany({ where: { id: { in: createdDocumentIds } } });
  await prisma.proposal.deleteMany({ where: { id: { in: createdProposalIds } } });
  await prisma.timeEntry.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.invoice.deleteMany({ where: { clientId: { in: createdClientIds } } });
  await prisma.lead.deleteMany({ where: { id: { in: createdLeadIds } } });
  await prisma.contactRequest.deleteMany({ where: { id: { in: createdContactRequestIds } } });
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

// SEC-195: `{ skip: !dbAvailable }` on describe/test is evaluated synchronously before the
// async before() above resolves — checking dbAvailable inside each test body is the pattern
// that actually observes the real value.
describe("gdprService.eraseClient (RG-025)", () => {
  test("a client with an invoice is anonymized, not deleted — the invoice survives untouched", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const uniq = Date.now();
    const client = await prisma.client.create({
      data: { name: `RG025 client ${uniq}`, email: `rg025-${uniq}@test.local`, phone: "+21600000000" },
    });
    createdClientIds.push(client.id);
    const invoice = await prisma.invoice.create({
      data: { number: `RG025-${uniq}`, title: "Test invoice", amount: 100, amountHT: 100, clientId: client.id },
    });

    const result = await gdprService.eraseClient(client.id, { id: "actor-admin", role: "ADMIN" });
    assert.equal(result.mode, "anonymized");

    const anonymized = await prisma.client.findUnique({ where: { id: client.id } });
    assert.ok(anonymized, "the Client row must survive (invoice FK requires it)");
    assert.equal(anonymized?.name, "Anonymisé (RGPD)");
    assert.notEqual(anonymized?.email, `rg025-${uniq}@test.local`);
    assert.equal(anonymized?.phone, null);

    const invoiceStillThere = await prisma.invoice.findUnique({ where: { id: invoice.id } });
    assert.ok(invoiceStillThere, "the Invoice must not be touched or deleted");
    assert.equal(invoiceStillThere?.amount.toString(), "100.000");
  });

  test("a client with no invoice and a converted lead is hard-deleted along with the lead", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const uniq = Date.now() + 1;
    const client = await prisma.client.create({ data: { name: `RG025 clean client ${uniq}` } });
    createdClientIds.push(client.id);
    const lead = await prisma.lead.create({
      data: { name: `RG025 lead ${uniq}`, status: "WON", convertedClientId: client.id },
    });

    const result = await gdprService.eraseClient(client.id, { id: "actor-admin", role: "ADMIN" });
    assert.equal(result.mode, "deleted");

    const goneClient = await prisma.client.findUnique({ where: { id: client.id } });
    assert.equal(goneClient, null);
    const goneLead = await prisma.lead.findUnique({ where: { id: lead.id } });
    assert.equal(goneLead, null);
  });
});

describe("gdprService.eraseUser (RG-025)", () => {
  test("a user with time-tracking history is anonymized, not deleted — the TimeEntry survives", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const uniq = Date.now() + 2;
    const manager = await prisma.user.create({
      data: { email: `rg025-mgr-${uniq}@test.local`, name: `RG025 Manager ${uniq}`, passwordHash: "x", role: "MANAGER" },
    });
    createdUserIds.push(manager.id);
    const client = await prisma.client.create({ data: { name: `RG025 client for TE ${uniq}` } });
    createdClientIds.push(client.id);
    const project = await prisma.project.create({ data: { name: `RG025 project ${uniq}`, clientId: client.id } });
    createdProjectIds.push(project.id);
    const entry = await prisma.timeEntry.create({
      data: { projectId: project.id, userId: manager.id, minutes: 30, date: new Date() },
    });

    const result = await gdprService.eraseUser(manager.id, { id: "actor-admin", role: "ADMIN" });
    assert.equal(result.mode, "anonymized");

    const anonymized = await prisma.user.findUnique({ where: { id: manager.id } });
    assert.ok(anonymized, "the User row must survive (TimeEntry FK requires it)");
    assert.equal(anonymized?.name, "Anonymisé (RGPD)");
    assert.notEqual(anonymized?.email, `rg025-mgr-${uniq}@test.local`);

    const entryStillThere = await prisma.timeEntry.findUnique({ where: { id: entry.id } });
    assert.ok(entryStillThere, "the TimeEntry must not be touched or deleted");
  });

  test("a user with no financial history is hard-deleted", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const uniq = Date.now() + 3;
    const freelancer = await prisma.user.create({
      data: { email: `rg025-clean-${uniq}@test.local`, name: `RG025 Clean ${uniq}`, passwordHash: "x", role: "FREELANCER" },
    });
    createdUserIds.push(freelancer.id);

    const result = await gdprService.eraseUser(freelancer.id, { id: "actor-admin", role: "ADMIN" });
    assert.equal(result.mode, "deleted");

    const gone = await prisma.user.findUnique({ where: { id: freelancer.id } });
    assert.equal(gone, null);
  });
});

describe("gdprService export functions (RG-025)", () => {
  test("exportClient returns the client record plus its converted leads", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const uniq = Date.now() + 4;
    const client = await prisma.client.create({
      data: { name: `RG025 export client ${uniq}`, email: `rg025-export-${uniq}@test.local` },
    });
    createdClientIds.push(client.id);
    const lead = await prisma.lead.create({
      data: { name: `RG025 export lead ${uniq}`, status: "WON", convertedClientId: client.id },
    });
    createdLeadIds.push(lead.id);

    const bundle = await gdprService.exportClient(client.id);
    assert.equal(bundle.client.id, client.id);
    assert.equal(bundle.convertedLeads.length, 1);
    assert.equal(bundle.convertedLeads[0]?.id, lead.id);
  });

  test("exportUser returns the user record", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const uniq = Date.now() + 5;
    const user = await prisma.user.create({
      data: { email: `rg025-export-user-${uniq}@test.local`, name: `RG025 Export User ${uniq}`, passwordHash: "x", role: "MANAGER" },
    });
    createdUserIds.push(user.id);

    const bundle = await gdprService.exportUser(user.id);
    assert.equal(bundle.user.id, user.id);
    assert.equal(bundle.user.email, `rg025-export-user-${uniq}@test.local`);
  });

  // SEC-222: metadata-only export was the gap — this proves a document with a fileKey now
  // carries a real signed downloadUrl, and one without a fileKey stays null (no crash on a
  // document that was never actually uploaded, e.g. a placeholder row).
  test("exportClient attaches a signed downloadUrl for documents that have a fileKey, and null otherwise", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const uniq = Date.now() + 6;
    const client = await prisma.client.create({ data: { name: `RG025 doc client ${uniq}` } });
    createdClientIds.push(client.id);
    const withKey = await prisma.document.create({
      data: { name: `RG025 doc ${uniq}`, title: `RG025 doc ${uniq}`, url: "https://example.local/doc", fileKey: `rg025/${uniq}.pdf`, clientId: client.id },
    });
    createdDocumentIds.push(withKey.id);
    const withoutKey = await prisma.document.create({
      data: { name: `RG025 doc no key ${uniq}`, title: `RG025 doc no key ${uniq}`, url: "https://example.local/doc2", clientId: client.id },
    });
    createdDocumentIds.push(withoutKey.id);

    const bundle = await gdprService.exportClient(client.id);
    const docWithKey = bundle.documents.find((d) => d.id === withKey.id);
    const docWithoutKey = bundle.documents.find((d) => d.id === withoutKey.id);
    assert.ok(docWithKey, "document with fileKey must be present in the export");
    assert.ok(typeof docWithKey?.downloadUrl === "string" && docWithKey.downloadUrl.length > 0, "must carry a signed download URL");
    assert.equal(docWithoutKey?.downloadUrl, null, "a document with no fileKey must not get a URL");
  });
});

describe("gdprService.eraseLead / exportLead (RG-025, SEC-220)", () => {
  test("a lead not converted, with no linked proposal, is hard-deleted along with its source contact request", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const uniq = Date.now() + 7;
    const contactRequest = await prisma.contactRequest.create({
      data: { name: `RG025 contact ${uniq}`, email: `rg025-contact-${uniq}@test.local`, serviceType: "web", company: `RG025 co ${uniq}`, message: "hello" },
    });
    createdContactRequestIds.push(contactRequest.id);
    const lead = await prisma.lead.create({
      data: { name: `RG025 lead ${uniq}`, email: `rg025-lead-${uniq}@test.local`, sourceContactId: contactRequest.id },
    });
    createdLeadIds.push(lead.id);

    const result = await gdprService.eraseLead(lead.id, { id: "actor-admin", role: "ADMIN" });
    assert.equal(result.mode, "deleted");

    const goneLead = await prisma.lead.findUnique({ where: { id: lead.id } });
    assert.equal(goneLead, null);
    const goneContact = await prisma.contactRequest.findUnique({ where: { id: contactRequest.id } });
    assert.equal(goneContact, null, "the source ContactRequest must be erased together with the Lead");
  });

  test("a lead with a linked proposal is anonymized, not deleted — the proposal survives untouched", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const uniq = Date.now() + 8;
    const client = await prisma.client.create({ data: { name: `RG025 proposal client ${uniq}` } });
    createdClientIds.push(client.id);
    const lead = await prisma.lead.create({
      data: { name: `RG025 lead with proposal ${uniq}`, email: `rg025-lp-${uniq}@test.local` },
    });
    createdLeadIds.push(lead.id);
    const proposal = await prisma.proposal.create({
      data: { title: `RG025 proposal ${uniq}`, clientId: client.id, leadId: lead.id },
    });
    createdProposalIds.push(proposal.id);

    const result = await gdprService.eraseLead(lead.id, { id: "actor-admin", role: "ADMIN" });
    assert.equal(result.mode, "anonymized");

    const anonymized = await prisma.lead.findUnique({ where: { id: lead.id } });
    assert.ok(anonymized, "the Lead row must survive (Proposal points back to it)");
    assert.equal(anonymized?.name, "Anonymisé (RGPD)");
    assert.equal(anonymized?.email, null);

    const proposalStillThere = await prisma.proposal.findUnique({ where: { id: proposal.id } });
    assert.ok(proposalStillThere, "the Proposal must not be touched or deleted");
    assert.equal(proposalStillThere?.leadId, lead.id);
  });

  test("erasing an already-converted lead delegates to eraseClient", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const uniq = Date.now() + 9;
    const client = await prisma.client.create({ data: { name: `RG025 converted-lead client ${uniq}` } });
    createdClientIds.push(client.id);
    const lead = await prisma.lead.create({
      data: { name: `RG025 converted lead ${uniq}`, status: "WON", convertedClientId: client.id },
    });

    const result = await gdprService.eraseLead(lead.id, { id: "actor-admin", role: "ADMIN" });
    assert.equal(result.mode, "deleted", "no invoice on this client — delegated eraseClient hard-deletes it and its converted leads");

    const goneClient = await prisma.client.findUnique({ where: { id: client.id } });
    assert.equal(goneClient, null);
    const goneLead = await prisma.lead.findUnique({ where: { id: lead.id } });
    assert.equal(goneLead, null);
  });

  test("exportLead returns the lead's own fields when not converted", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const uniq = Date.now() + 10;
    const lead = await prisma.lead.create({
      data: { name: `RG025 export lead ${uniq}`, email: `rg025-explead-${uniq}@test.local` },
    });
    createdLeadIds.push(lead.id);

    const bundle = await gdprService.exportLead(lead.id);
    assert.equal(bundle.subjectType, "lead");
    assert.equal(bundle.lead.id, lead.id);
  });
});

describe("gdprService.eraseContactRequest / exportContactRequest (RG-025, SEC-221)", () => {
  test("a contact request never converted to a lead is hard-deleted directly", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const uniq = Date.now() + 11;
    const contactRequest = await prisma.contactRequest.create({
      data: { name: `RG025 raw contact ${uniq}`, email: `rg025-raw-${uniq}@test.local`, serviceType: "web", company: `RG025 co ${uniq}`, message: "hi" },
    });

    const result = await gdprService.eraseContactRequest(contactRequest.id, { id: "actor-admin", role: "ADMIN" });
    assert.equal(result.mode, "deleted");

    const gone = await prisma.contactRequest.findUnique({ where: { id: contactRequest.id } });
    assert.equal(gone, null);
  });

  test("a contact request already converted to a lead delegates to eraseLead", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const uniq = Date.now() + 12;
    const contactRequest = await prisma.contactRequest.create({
      data: { name: `RG025 converted contact ${uniq}`, email: `rg025-cc-${uniq}@test.local`, serviceType: "web", company: `RG025 co ${uniq}`, message: "hi", convertedAt: new Date() },
    });
    const lead = await prisma.lead.create({
      data: { name: `RG025 lead from contact ${uniq}`, sourceContactId: contactRequest.id },
    });

    const result = await gdprService.eraseContactRequest(contactRequest.id, { id: "actor-admin", role: "ADMIN" });
    assert.equal(result.mode, "deleted", "no proposal on this lead — hard-deleted, cascading to the contact request");

    const goneLead = await prisma.lead.findUnique({ where: { id: lead.id } });
    assert.equal(goneLead, null);
    const goneContact = await prisma.contactRequest.findUnique({ where: { id: contactRequest.id } });
    assert.equal(goneContact, null);
  });

  test("exportContactRequest returns its own fields when not converted", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const uniq = Date.now() + 13;
    const contactRequest = await prisma.contactRequest.create({
      data: { name: `RG025 export contact ${uniq}`, email: `rg025-explead2-${uniq}@test.local`, serviceType: "web", company: `RG025 co ${uniq}`, message: "hi" },
    });
    createdContactRequestIds.push(contactRequest.id);

    const bundle = await gdprService.exportContactRequest(contactRequest.id);
    assert.equal(bundle.subjectType, "contactRequest");
    assert.equal(bundle.contactRequest.id, contactRequest.id);
  });
});
