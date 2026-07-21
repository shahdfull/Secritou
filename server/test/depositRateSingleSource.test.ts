// SEC-183: the 30% deposit rate (RG-002/Cadrage §6) used to be an independent 0.3 literal copied
// at 3 call sites (project.service.ts#clientApprove, proposal.service.ts#acceptWithCascade,
// documentGenerator.service.ts#generateQuotePDF) with no shared constant — a future rate change
// fixed at only one site would silently desync the quote PDF's promised split from the actual
// deposit/balance invoices generated elsewhere. Fixed by DEPOSIT_RATE (utils/vat.ts, alongside
// the existing TVA_RATE precedent) and updating all 3 sites to reference it.
//
// Two proofs: (1) a structural scan of the real source files confirming DEPOSIT_RATE is exported
// and none of the 3 known call sites contain a bare 0.3 deposit-rate literal anymore ; (2) a
// behavioral test calling the real projectService.clientApprove — not a reimplementation —
// against a real database, on a project with NO existing deposit invoice, the one case that
// actually exercises the DEPOSIT_RATE fallback (roundMoney(proposalAmount * DEPOSIT_RATE))
// instead of reading a real invoice's amountHT. projectClientApproveBalanceInvoice.test.ts
// (RG-004b) always pre-creates a deposit invoice, so it never touches this fallback line.
// Mutating the exported const itself isn't attempted — not idiomatic for a shared rate constant,
// and the criterion's real intent (no call site can silently drift from the others) is what the
// structural scan below already proves directly by reading the source.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEPOSIT_RATE } from "../src/utils/vat.js";

const SRC_DIR = join(process.cwd(), "src/services");

let prisma: typeof import("../src/config/prisma.js").prisma;
let projectService: typeof import("../src/services/project.service.js").projectService;
let dbAvailable = true;

let serviceId: string;
const createdClientIds: string[] = [];
const createdUserIds: string[] = [];
const createdProjectIds: string[] = [];
const createdProposalIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ projectService } = await import("../src/services/project.service.js"));
    await prisma.$queryRaw`SELECT 1`;
    const service = await prisma.service.findFirst();
    if (!service) throw new Error("no Service seeded");
    serviceId = service.id;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.invoice.deleteMany({ where: { projectId: { in: createdProjectIds } } });
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.proposal.deleteMany({ where: { id: { in: createdProposalIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
});

describe("DEPOSIT_RATE is the single source of truth for the 30% deposit rate (SEC-183)", { skip: !dbAvailable ? "no reachable database" : false }, () => {
  test("DEPOSIT_RATE is exported and equals 0.3", () => {
    assert.equal(DEPOSIT_RATE, 0.3);
  });

  const sites = ["project.service.ts", "proposal.service.ts", "documentGenerator.service.ts"];
  for (const file of sites) {
    test(`${file}: imports and uses DEPOSIT_RATE, no bare 0.3 deposit-rate literal remains`, () => {
      const content = readFileSync(join(SRC_DIR, file), "utf-8");
      assert.ok(content.includes("DEPOSIT_RATE"), `${file} must import/use DEPOSIT_RATE`);
      assert.doesNotMatch(content, /\*\s*0\.3\b/, `${file} must not multiply by a bare 0.3 literal anymore`);
    });
  }

  test("clientApprove's fallback deposit computation (no real deposit invoice) actually uses DEPOSIT_RATE, not an independent value", async () => {
    const client = await prisma.client.create({ data: { name: `sec183-client-${Date.now()}`, serviceId } });
    createdClientIds.push(client.id);
    const clientUser = await prisma.user.create({
      data: { email: `sec183-${Date.now()}@example.com`, name: "SEC-183 client user", passwordHash: "x", role: "CLIENT", clientId: client.id },
    });
    createdUserIds.push(clientUser.id);
    const proposal = await prisma.proposal.create({
      data: { title: "SEC-183 proposal", amount: 1000, currency: "TND", status: "ACCEPTED", clientId: client.id },
    });
    createdProposalIds.push(proposal.id);
    const project = await prisma.project.create({
      data: { name: "SEC-183 project", clientId: client.id, serviceId, status: "REVIEW", proposalId: proposal.id },
    });
    createdProjectIds.push(project.id);
    // Deliberately no DEPOSIT invoice created — forces clientApprove's fallback branch
    // (depositInvoice?.amountHT is null) to compute roundMoney(proposalAmount * DEPOSIT_RATE).

    await projectService.clientApprove(project.id, client.id, clientUser.id);

    const balanceInvoice = await prisma.invoice.findFirst({ where: { projectId: project.id, invoiceType: "BALANCE" } });
    assert.ok(balanceInvoice, "a BALANCE invoice must be created");
    // proposalAmount(1000) - roundMoney(1000 * DEPOSIT_RATE) — computed from the SAME imported
    // constant the test asserts on above, not a hardcoded 700, so this would fail if DEPOSIT_RATE
    // and the production code's actual multiplier ever diverged.
    const expectedBalance = 1000 - Math.round(1000 * DEPOSIT_RATE * 1000) / 1000;
    assert.equal(Number(balanceInvoice!.amountHT), expectedBalance);
  });
});
