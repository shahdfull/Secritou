// SEC-100: this file used to reimplement proposalService.reject/send/update/accept locally
// ("mirrors proposalService.…") with a fake proposalRepository/userRepository/clientRepository,
// and a `companyId` field that doesn't exist anywhere in this mono-tenant repo (CLAUDE.md/
// SEC-004/SEC-005) — the vrai proposalService has no companyId parameter at all on reject/send.
// A reimplementation stays green even if the real service's behavior drifts, since it never
// imports or calls the production code.
//
// This test calls the real proposalService (reject, send, update, acceptWithCascade) against a
// real, migrated database — not a reimplementation — proving:
// - reject/send actually transition status and enforce their real state guards
// (INVALID_PROPOSAL_TRANSITION)
// - update reverts a live (SENT/VIEWED) proposal to DRAFT and bumps version on a real content
//   change, but not on a no-op or non-content field change (matches update()'s real logic)
// - acceptWithCascade's real version guard (PROPOSAL_VERSION_MISMATCH) rejects a stale
//   expectedVersion
//
// Requires a real database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let proposalService: typeof import("../src/services/proposal.service.js").proposalService;
let HttpError: typeof import("../src/utils/httpError.js").HttpError;
let dbAvailable = true;

const createdClientIds: string[] = [];
const createdProposalIds: string[] = [];
const createdProjectIds: string[] = [];
const createdInvoiceIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ proposalService } = await import("../src/services/proposal.service.js"));
    ({ HttpError } = await import("../src/utils/httpError.js"));
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.invoice.deleteMany({ where: { id: { in: createdInvoiceIds } } });
  await prisma.proposal.deleteMany({ where: { id: { in: createdProposalIds } } });
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
});

async function makeSentProposal(namePrefix: string, extra: { amount?: number; currency?: string } = {}) {
  const client = await prisma.client.create({ data: { name: `${namePrefix} client` } });
  createdClientIds.push(client.id);
  const proposal = await prisma.proposal.create({
    data: { title: `${namePrefix} proposal`, clientId: client.id, status: "SENT", ...extra },
  });
  createdProposalIds.push(proposal.id);
  return { client, proposal };
}

describe(
  "proposalService.reject/send/update/acceptWithCascade — real behavior (SEC-100)",
  { skip: !dbAvailable ? "no reachable database" : false },
  () => {
    test("reject transitions a SENT proposal to REJECTED", async () => {
      const { proposal } = await makeSentProposal("sec100-reject");
      const updated = await proposalService.reject(proposal.id, "Budget trop élevé");
      assert.equal(updated.status, "REJECTED");
      assert.ok(updated.rejectedAt);
    });

    test("reject refuses a DRAFT proposal (INVALID_PROPOSAL_TRANSITION)", async () => {
      const client = await prisma.client.create({ data: { name: "sec100-reject-draft client" } });
      createdClientIds.push(client.id);
      const proposal = await prisma.proposal.create({ data: { title: "sec100-reject-draft proposal", clientId: client.id, status: "DRAFT" } });
      createdProposalIds.push(proposal.id);

      await assert.rejects(
        () => proposalService.reject(proposal.id),
        (err: unknown) => {
          assert.ok(err instanceof HttpError);
          assert.equal((err as InstanceType<typeof HttpError>).statusCode, 409);
          return true;
        }
      );
    });

    test("send transitions a DRAFT proposal to SENT", async () => {
      const client = await prisma.client.create({ data: { name: "sec100-send client" } });
      createdClientIds.push(client.id);
      const proposal = await prisma.proposal.create({ data: { title: "sec100-send proposal", clientId: client.id, status: "DRAFT" } });
      createdProposalIds.push(proposal.id);

      const updated = await proposalService.send(proposal.id, "uploader-id");
      assert.equal(updated.status, "SENT");
    });

    test("update reverts a SENT proposal to DRAFT and bumps version on a real content change", async () => {
      const { proposal } = await makeSentProposal("sec100-update-content");
      assert.equal(proposal.version, 1);

      const updated = await proposalService.update(proposal.id, { title: "Nouveau titre" });
      assert.equal(updated?.status, "DRAFT");
      assert.equal(updated?.version, 2);

      const history = await prisma.proposalHistory.findMany({ where: { proposalId: proposal.id } });
      assert.ok(history.some((h) => h.action === "REVERTED_TO_DRAFT"));
    });

    test("update does NOT revert a SENT proposal when the new title is identical (no-op)", async () => {
      const { proposal } = await makeSentProposal("sec100-update-noop");

      const updated = await proposalService.update(proposal.id, { title: proposal.title });
      assert.equal(updated?.status, "SENT");
      assert.equal(updated?.version, 1);
    });

    test("update does NOT revert a SENT proposal when only a non-content field (pdfUrl) changes", async () => {
      const { proposal } = await makeSentProposal("sec100-update-noncontent");

      const updated = await proposalService.update(proposal.id, { pdfUrl: "https://cdn.example.com/new.pdf" });
      assert.equal(updated?.status, "SENT");
      assert.equal(updated?.version, 1);
    });

    test("acceptWithCascade rejects a stale expectedVersion with PROPOSAL_VERSION_MISMATCH", async () => {
      const client = await prisma.client.create({ data: { name: "sec100-version client" } });
      createdClientIds.push(client.id);
      const proposal = await prisma.proposal.create({
        data: { title: "sec100-version proposal", clientId: client.id, status: "SENT", amount: 1000, currency: "TND" },
      });
      createdProposalIds.push(proposal.id);
      // Bump the real version once so expectedVersion: 1 below is genuinely stale.
      await proposalService.update(proposal.id, { title: "Titre modifié" });

      await assert.rejects(
        () => proposalService.acceptWithCascade(proposal.id, 1),
        (err: unknown) => {
          assert.ok(err instanceof HttpError);
          assert.equal((err as InstanceType<typeof HttpError>).code, "PROPOSAL_VERSION_MISMATCH");
          return true;
        }
      );
    });

    test("acceptWithCascade succeeds and creates a project when expectedVersion matches", async () => {
      const { proposal } = await makeSentProposal("sec100-accept-ok", { amount: 500, currency: "TND" });

      const result = await proposalService.acceptWithCascade(proposal.id, proposal.version);
      createdProjectIds.push(result.projectId!);
      if (result.invoiceId) createdInvoiceIds.push(result.invoiceId);

      assert.ok(result.projectId);
      const updated = await prisma.proposal.findUnique({ where: { id: proposal.id } });
      assert.equal(updated?.status, "ACCEPTED");
    });
  }
);
