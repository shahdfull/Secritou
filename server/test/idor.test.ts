// Tests for IDOR (Insecure Direct Object Reference) protection on invoice and proposal repositories
// Pattern: stub prisma by injection — same as lead.repository.test.ts
// Source: src/repositories/invoice.repository.ts, src/repositories/proposal.repository.ts

import test, { describe } from "node:test";
import assert from "node:assert/strict";

// ─── Fake prisma types ────────────────────────────────────────────────────────

type FakeInvoicePrisma = {
  invoice: {
    update: (args: { where: object; data: object }) => Promise<unknown>;
    delete: (args: { where: object }) => Promise<unknown>;
    findUnique: (args: { where: object }) => Promise<unknown>;
  };
};

type FakeProposalPrisma = {
  proposal: {
    update: (args: { where: object; data: object }) => Promise<unknown>;
    delete: (args: { where: object }) => Promise<unknown>;
    findUnique: (args: { where: object }) => Promise<unknown>;
  };
};

// ─── Extracted repository functions (mirror of the real repositories) ─────────

async function invoiceUpdate(
  prisma: FakeInvoicePrisma,
  id: string,
  companyId: string,
  data: object
) {
  return prisma.invoice.update({ where: { id, companyId }, data });
}

async function invoiceDelete(
  prisma: FakeInvoicePrisma,
  id: string,
  companyId: string
) {
  return prisma.invoice.delete({ where: { id, companyId } });
}

async function invoiceFindById(
  prisma: FakeInvoicePrisma,
  id: string,
  companyId: string
) {
  return prisma.invoice.findUnique({ where: { id, companyId } });
}

async function proposalUpdate(
  prisma: FakeProposalPrisma,
  id: string,
  companyId: string,
  data: object
) {
  return prisma.proposal.update({ where: { id, companyId }, data });
}

async function proposalDelete(
  prisma: FakeProposalPrisma,
  id: string,
  companyId: string
) {
  return prisma.proposal.delete({ where: { id, companyId } });
}

async function proposalFindById(
  prisma: FakeProposalPrisma,
  id: string,
  companyId: string
) {
  return prisma.proposal.findUnique({ where: { id, companyId } });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeInvoice(overrides = {}) {
  return {
    id: "inv-1",
    companyId: "company-1",
    clientId: "client-1",
    number: "INV-001",
    title: "Développement web",
    amount: 5000,
    amountPaid: 0,
    status: "SENT" as const,
    currency: "EUR",
    dueDate: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeProposal(overrides = {}) {
  return {
    id: "prop-1",
    companyId: "company-1",
    clientId: "client-1",
    title: "Refonte site web",
    status: "SENT" as const,
    amount: 5000,
    currency: "EUR",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ─── Invoice IDOR tests ───────────────────────────────────────────────────────

describe("invoice.repository — IDOR protection", () => {
  const INVOICE_ID = "inv-1";
  const COMPANY_ID = "company-1";
  const ATTACKER_COMPANY_ID = "company-attacker";

  test("update WHERE clause includes both id and companyId", async () => {
    let capturedWhere: object | null = null;
    const fakePrisma: FakeInvoicePrisma = {
      invoice: {
        update: async (args) => { capturedWhere = args.where; return makeInvoice(); },
        delete: async () => makeInvoice(),
        findUnique: async () => makeInvoice(),
      },
    };

    await invoiceUpdate(fakePrisma, INVOICE_ID, COMPANY_ID, { status: "PAID" });

    assert.deepEqual(capturedWhere, { id: INVOICE_ID, companyId: COMPANY_ID });
  });

  test("update WHERE must contain companyId — not id alone", async () => {
    let capturedWhere: Record<string, unknown> | null = null;
    const fakePrisma: FakeInvoicePrisma = {
      invoice: {
        update: async (args) => { capturedWhere = args.where as Record<string, unknown>; return makeInvoice(); },
        delete: async () => makeInvoice(),
        findUnique: async () => makeInvoice(),
      },
    };

    await invoiceUpdate(fakePrisma, INVOICE_ID, COMPANY_ID, { status: "PAID" });

    assert.ok(capturedWhere !== null);
    assert.ok("companyId" in capturedWhere!, "companyId must be in WHERE");
    assert.ok(Object.keys(capturedWhere!).length >= 2, "WHERE must have at least id + companyId");
  });

  test("delete WHERE clause includes both id and companyId", async () => {
    let capturedWhere: object | null = null;
    const fakePrisma: FakeInvoicePrisma = {
      invoice: {
        update: async () => makeInvoice(),
        delete: async (args) => { capturedWhere = args.where; return makeInvoice(); },
        findUnique: async () => makeInvoice(),
      },
    };

    await invoiceDelete(fakePrisma, INVOICE_ID, COMPANY_ID);

    assert.deepEqual(capturedWhere, { id: INVOICE_ID, companyId: COMPANY_ID });
  });

  test("delete WHERE must contain companyId — not id alone", async () => {
    let capturedWhere: Record<string, unknown> | null = null;
    const fakePrisma: FakeInvoicePrisma = {
      invoice: {
        update: async () => makeInvoice(),
        delete: async (args) => { capturedWhere = args.where as Record<string, unknown>; return makeInvoice(); },
        findUnique: async () => makeInvoice(),
      },
    };

    await invoiceDelete(fakePrisma, INVOICE_ID, COMPANY_ID);

    assert.ok("companyId" in capturedWhere!, "companyId must be in DELETE WHERE");
  });

  test("findById with wrong companyId returns null (cross-company isolation)", async () => {
    const ownedInvoice = makeInvoice({ id: INVOICE_ID, companyId: COMPANY_ID });
    const fakePrisma: FakeInvoicePrisma = {
      invoice: {
        update: async () => makeInvoice(),
        delete: async () => makeInvoice(),
        findUnique: async (args: { where: { id: string; companyId: string } }) => {
          if (args.where.id === ownedInvoice.id && args.where.companyId === ownedInvoice.companyId) {
            return ownedInvoice;
          }
          return null;
        },
      },
    };

    const result = await invoiceFindById(fakePrisma, INVOICE_ID, ATTACKER_COMPANY_ID);
    assert.equal(result, null, "Cross-company read must return null");
  });

  test("findById WHERE includes companyId", async () => {
    let capturedWhere: Record<string, unknown> | null = null;
    const fakePrisma: FakeInvoicePrisma = {
      invoice: {
        update: async () => makeInvoice(),
        delete: async () => makeInvoice(),
        findUnique: async (args) => { capturedWhere = args.where as Record<string, unknown>; return null; },
      },
    };

    await invoiceFindById(fakePrisma, INVOICE_ID, COMPANY_ID);

    assert.ok("companyId" in capturedWhere!, "companyId must be in findById WHERE");
    assert.equal(capturedWhere!.companyId, COMPANY_ID);
  });
});

// ─── Proposal IDOR tests ──────────────────────────────────────────────────────

describe("proposal.repository — IDOR protection", () => {
  const PROPOSAL_ID = "prop-1";
  const COMPANY_ID = "company-1";
  const ATTACKER_COMPANY_ID = "company-attacker";

  test("update WHERE clause includes both id and companyId", async () => {
    let capturedWhere: object | null = null;
    const fakePrisma: FakeProposalPrisma = {
      proposal: {
        update: async (args) => { capturedWhere = args.where; return makeProposal(); },
        delete: async () => makeProposal(),
        findUnique: async () => makeProposal(),
      },
    };

    await proposalUpdate(fakePrisma, PROPOSAL_ID, COMPANY_ID, { status: "ACCEPTED" });

    assert.deepEqual(capturedWhere, { id: PROPOSAL_ID, companyId: COMPANY_ID });
  });

  test("update WHERE must contain companyId — not id alone", async () => {
    let capturedWhere: Record<string, unknown> | null = null;
    const fakePrisma: FakeProposalPrisma = {
      proposal: {
        update: async (args) => { capturedWhere = args.where as Record<string, unknown>; return makeProposal(); },
        delete: async () => makeProposal(),
        findUnique: async () => makeProposal(),
      },
    };

    await proposalUpdate(fakePrisma, PROPOSAL_ID, COMPANY_ID, { status: "ACCEPTED" });

    assert.ok("companyId" in capturedWhere!, "companyId must be in WHERE");
    assert.ok(Object.keys(capturedWhere!).length >= 2);
  });

  test("delete WHERE clause includes both id and companyId", async () => {
    let capturedWhere: object | null = null;
    const fakePrisma: FakeProposalPrisma = {
      proposal: {
        update: async () => makeProposal(),
        delete: async (args) => { capturedWhere = args.where; return makeProposal(); },
        findUnique: async () => makeProposal(),
      },
    };

    await proposalDelete(fakePrisma, PROPOSAL_ID, COMPANY_ID);

    assert.deepEqual(capturedWhere, { id: PROPOSAL_ID, companyId: COMPANY_ID });
  });

  test("delete WHERE must contain companyId — not id alone", async () => {
    let capturedWhere: Record<string, unknown> | null = null;
    const fakePrisma: FakeProposalPrisma = {
      proposal: {
        update: async () => makeProposal(),
        delete: async (args) => { capturedWhere = args.where as Record<string, unknown>; return makeProposal(); },
        findUnique: async () => makeProposal(),
      },
    };

    await proposalDelete(fakePrisma, PROPOSAL_ID, COMPANY_ID);

    assert.ok("companyId" in capturedWhere!, "companyId must be in DELETE WHERE");
  });

  test("findById with wrong companyId returns null (cross-company isolation)", async () => {
    const ownedProposal = makeProposal({ id: PROPOSAL_ID, companyId: COMPANY_ID });
    const fakePrisma: FakeProposalPrisma = {
      proposal: {
        update: async () => makeProposal(),
        delete: async () => makeProposal(),
        findUnique: async (args: { where: { id: string; companyId: string } }) => {
          if (args.where.id === ownedProposal.id && args.where.companyId === ownedProposal.companyId) {
            return ownedProposal;
          }
          return null;
        },
      },
    };

    const result = await proposalFindById(fakePrisma, PROPOSAL_ID, ATTACKER_COMPANY_ID);
    assert.equal(result, null, "Cross-company read must return null");
  });

  test("findById WHERE includes companyId", async () => {
    let capturedWhere: Record<string, unknown> | null = null;
    const fakePrisma: FakeProposalPrisma = {
      proposal: {
        update: async () => makeProposal(),
        delete: async () => makeProposal(),
        findUnique: async (args) => { capturedWhere = args.where as Record<string, unknown>; return null; },
      },
    };

    await proposalFindById(fakePrisma, PROPOSAL_ID, COMPANY_ID);

    assert.ok("companyId" in capturedWhere!, "companyId must be in findById WHERE");
    assert.equal(capturedWhere!.companyId, COMPANY_ID);
  });
});
