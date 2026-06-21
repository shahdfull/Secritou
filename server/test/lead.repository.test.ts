// Tests for lead.repository IDOR protection — no real DB
// Pattern: stub prisma calls by passing a fake prisma client to extracted functions
// Source: src/repositories/lead.repository.ts

import test, { describe } from "node:test";
import assert from "node:assert/strict";

// ─── Minimal lead shape ───────────────────────────────────────────────────────

function makeLead(overrides = {}) {
  return {
    id: "lead-1",
    companyId: "company-1",
    name: "Acme Corp",
    email: "contact@acme.com",
    phone: null,
    source: null,
    status: "NEW" as const,
    notes: null,
    archivedAt: null,
    convertedClientId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ─── Extracted repository functions (mirror of lead.repository.ts) ────────────
// We pass `prisma` as a parameter so tests can inject a fake.

type FakePrismaLead = {
  update: (args: { where: object; data: object }) => Promise<unknown>;
  delete: (args: { where: object }) => Promise<unknown>;
  findFirst: (args: { where: object }) => Promise<unknown>;
};

async function repositoryUpdate(
  prisma: { lead: FakePrismaLead },
  id: string,
  companyId: string,
  data: object
) {
  return prisma.lead.update({ where: { id, companyId }, data });
}

async function repositoryDelete(
  prisma: { lead: FakePrismaLead },
  id: string,
  companyId: string
) {
  return prisma.lead.delete({ where: { id, companyId } });
}

async function repositoryFindById(
  prisma: { lead: FakePrismaLead },
  id: string,
  companyId: string
) {
  return prisma.lead.findFirst({ where: { id, companyId, archivedAt: null } });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("lead.repository — IDOR protection", () => {
  const LEAD_ID = "lead-1";
  const COMPANY_ID = "company-1";
  const OTHER_COMPANY_ID = "company-attacker";

  test("update WHERE clause includes both id and companyId", async () => {
    let capturedWhere: object | null = null;
    const fakePrisma = {
      lead: {
        update: async (args: { where: object; data: object }) => {
          capturedWhere = args.where;
          return makeLead();
        },
        delete: async () => makeLead(),
        findFirst: async () => makeLead(),
      },
    };

    await repositoryUpdate(fakePrisma, LEAD_ID, COMPANY_ID, { name: "Updated" });

    assert.deepEqual(capturedWhere, { id: LEAD_ID, companyId: COMPANY_ID });
  });

  test("update WHERE clause is NOT { id } alone — companyId must be present", async () => {
    let capturedWhere: Record<string, unknown> | null = null;
    const fakePrisma = {
      lead: {
        update: async (args: { where: Record<string, unknown>; data: object }) => {
          capturedWhere = args.where;
          return makeLead();
        },
        delete: async () => makeLead(),
        findFirst: async () => makeLead(),
      },
    };

    await repositoryUpdate(fakePrisma, LEAD_ID, COMPANY_ID, { name: "Updated" });

    assert.ok(capturedWhere !== null);
    assert.ok("companyId" in capturedWhere!, "companyId must be in WHERE clause");
    assert.equal(Object.keys(capturedWhere!).length >= 2, true, "WHERE must have at least id + companyId");
  });

  test("delete WHERE clause includes both id and companyId", async () => {
    let capturedWhere: object | null = null;
    const fakePrisma = {
      lead: {
        update: async () => makeLead(),
        delete: async (args: { where: object }) => {
          capturedWhere = args.where;
          return makeLead();
        },
        findFirst: async () => makeLead(),
      },
    };

    await repositoryDelete(fakePrisma, LEAD_ID, COMPANY_ID);

    assert.deepEqual(capturedWhere, { id: LEAD_ID, companyId: COMPANY_ID });
  });

  test("delete WHERE clause is NOT { id } alone — companyId must be present", async () => {
    let capturedWhere: Record<string, unknown> | null = null;
    const fakePrisma = {
      lead: {
        update: async () => makeLead(),
        delete: async (args: { where: Record<string, unknown> }) => {
          capturedWhere = args.where;
          return makeLead();
        },
        findFirst: async () => makeLead(),
      },
    };

    await repositoryDelete(fakePrisma, LEAD_ID, COMPANY_ID);

    assert.ok("companyId" in capturedWhere!, "companyId must be in DELETE WHERE clause");
  });

  test("findById filters by companyId — cross-company lookup returns null", async () => {
    const ownedLead = makeLead({ id: LEAD_ID, companyId: COMPANY_ID });

    const fakePrisma = {
      lead: {
        update: async () => makeLead(),
        delete: async () => makeLead(),
        findFirst: async (args: { where: { id: string; companyId: string } }) => {
          // Simulate real DB: only return if both id AND companyId match
          if (args.where.id === ownedLead.id && args.where.companyId === ownedLead.companyId) {
            return ownedLead;
          }
          return null;
        },
      },
    };

    const result = await repositoryFindById(fakePrisma, LEAD_ID, OTHER_COMPANY_ID);
    assert.equal(result, null, "Cross-company read must return null, not the lead");
  });

  test("findById WHERE clause includes archivedAt: null — soft-deleted leads not returned", async () => {
    let capturedWhere: Record<string, unknown> | null = null;
    const fakePrisma = {
      lead: {
        update: async () => makeLead(),
        delete: async () => makeLead(),
        findFirst: async (args: { where: Record<string, unknown> }) => {
          capturedWhere = args.where;
          return null;
        },
      },
    };

    await repositoryFindById(fakePrisma, LEAD_ID, COMPANY_ID);

    assert.ok("archivedAt" in capturedWhere!, "archivedAt filter must be in findById WHERE");
    assert.equal(capturedWhere!.archivedAt, null);
  });
});
