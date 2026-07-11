// Tests for proposal.service.acceptWithCascade business logic : no DB, no real imports.
// Pattern (matches proposal.service.test.ts): mirror the service's transaction logic against
// in-memory fakes injected as deps, and assert the cascade outcomes.
// Source: src/services/proposal.service.ts (acceptWithCascade)

import test, { describe } from "node:test";
import assert from "node:assert/strict";

type Proposal = {
  id: string;
  companyId: string;
  clientId: string;
  title: string;
  description: string | null;
  status: "DRAFT" | "SENT" | "VIEWED" | "ACCEPTED" | "REJECTED" | "EXPIRED";
  version: number;
  amount: number | null;
  currency: string;
  expiresAt: Date | null;
  leadId: string | null;
  clientName: string | null;
  email: string | null;
  acceptedAt: Date | null;
  linkedProject: { id: string; serviceId: string | null } | null;
  invoice: { id: string } | null;
  project: { serviceId: string | null } | null;
};

function makeProposal(overrides: Partial<Proposal> = {}): Proposal {
  return {
    id: "proposal-1",
    companyId: "company-1",
    clientId: "client-1",
    title: "Refonte site web",
    description: "Site vitrine",
    status: "SENT",
    version: 1,
    amount: 5000,
    currency: "EUR",
    expiresAt: null,
    leadId: "lead-1",
    clientName: "Acme Corp",
    email: "contact@acme.com",
    acceptedAt: null,
    linkedProject: null,
    invoice: null,
    project: null,
    ...overrides,
  };
}

// Fake transactional store + tx client mirroring the prisma calls acceptWithCascade makes.
function makeWorld(proposal: Proposal) {
  const state = {
    proposal: { ...proposal },
    leads: new Map<string, { status: string; convertedClientId: string | null }>([
      ["lead-1", { status: "QUALIFIED", convertedClientId: null }],
    ]),
    projects: [] as Array<{ id: string; proposalId: string; companyId: string; status: string; budget?: string; deadline?: Date | null; clientId: string }>,
    invoices: [] as Array<{ id: string; proposalId: string; companyId: string; amount: number; status: string }>,
    invites: [] as Array<{ clientId: string }>,
  };
  let projectSeq = 0;
  let invoiceSeq = 0;

  const tx = {
    proposal: {
      findUnique: async () => ({ ...state.proposal }),
      update: async ({ data }: { data: Partial<Proposal> }) => {
        Object.assign(state.proposal, data);
        return { ...state.proposal };
      },
    },
    lead: {
      updateMany: async ({ where, data }: { where: { id: string; status: { not: string } }; data: { status: string } }) => {
        const lead = state.leads.get(where.id);
        if (lead && lead.status !== where.status.not) {
          lead.status = data.status;
          return { count: 1 };
        }
        return { count: 0 };
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        const lead = state.leads.get(where.id);
        return lead ? { convertedClientId: lead.convertedClientId } : null;
      },
      update: async ({ where, data }: { where: { id: string }; data: { convertedClientId?: string; archivedAt?: Date } }) => {
        const lead = state.leads.get(where.id);
        if (!lead) return null;
        if (data.convertedClientId !== undefined) lead.convertedClientId = data.convertedClientId;
        return { ...lead };
      },
    },
    project: {
      create: async ({ data }: { data: { proposalId: string; companyId: string; status: string; budget?: string; deadline?: Date | null; clientId: string } }) => {
        if (state.projects.some((p) => p.proposalId === data.proposalId)) {
          const err: { code: string; meta: { target: string[] } } & Error = Object.assign(new Error("P2002"), { code: "P2002", meta: { target: ["proposalId"] } });
          throw err;
        }
        const p = { id: `project-${++projectSeq}`, ...data };
        state.projects.push(p);
        return { id: p.id };
      },
      findFirst: async ({ where }: { where: { proposalId: string } }) => state.projects.find((p) => p.proposalId === where.proposalId) ?? null,
    },
    invoice: {
      count: async () => state.invoices.length,
      create: async ({ data }: { data: { proposalId: string; companyId: string; amount: number; status: string } }) => {
        if (state.invoices.some((i) => i.proposalId === data.proposalId)) {
          const err: { code: string; meta: { target: string[] } } & Error = Object.assign(new Error("P2002"), { code: "P2002", meta: { target: ["proposalId"] } });
          throw err;
        }
        const i = { id: `invoice-${++invoiceSeq}`, ...data };
        state.invoices.push(i);
        return { ...i };
      },
      findFirst: async ({ where }: { where: { proposalId: string } }) => state.invoices.find((i) => i.proposalId === where.proposalId) ?? null,
    },
  };

  return { state, tx };
}

// Mirrors acceptWithCascade's transaction body + post-commit invite. Kept in lockstep with the
// real service. `inviteThrows409` simulates a client that already has a portal account.
async function runCascade(
  world: ReturnType<typeof makeWorld>,
  opts: { expectedVersion?: number; inviteThrows409?: boolean } = {}
) {
  const { tx, state } = world;
  const isP2002 = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";

  const result = await (async () => {
    const proposal = await tx.proposal.findUnique();
    if (!proposal) throw new Error("Proposal not found");

    const alreadyAccepted = proposal.status === "ACCEPTED";
    if (!alreadyAccepted) {
      if (opts.expectedVersion !== undefined && opts.expectedVersion !== proposal.version) {
        throw Object.assign(new Error("PROPOSAL_VERSION_MISMATCH"), { code: "VERSION" });
      }
      if (!["SENT", "VIEWED"].includes(proposal.status)) {
        throw Object.assign(new Error("INVALID_PROPOSAL_TRANSITION"), { code: "TRANSITION" });
      }
      if (proposal.expiresAt && proposal.expiresAt < new Date()) {
        throw Object.assign(new Error("PROPOSAL_EXPIRED"), { code: "EXPIRED" });
      }
      await tx.proposal.update({ data: { status: "ACCEPTED", acceptedAt: new Date() } });
    }

    if (proposal.leadId) {
      await tx.lead.updateMany({ where: { id: proposal.leadId, status: { not: "WON" } }, data: { status: "WON" } });
      // Mirrors linkLeadToClientTx: auto-link the lead to the proposal's (already-existing)
      // client, unless it was already converted.
      const current = await tx.lead.findUnique({ where: { id: proposal.leadId } });
      if (current && !current.convertedClientId) {
        await tx.lead.update({ where: { id: proposal.leadId }, data: { convertedClientId: proposal.clientId, archivedAt: new Date() } });
      }
    }

    let projectId = proposal.linkedProject?.id ?? null;
    if (!projectId) {
      try {
        const project = await tx.project.create({
          data: {
            proposalId: proposal.id,
            companyId: proposal.companyId,
            status: "PLANNING",
            clientId: proposal.clientId,
            budget: proposal.amount != null ? String(proposal.amount) : undefined,
            deadline: proposal.expiresAt ?? undefined,
          },
        });
        projectId = project.id;
      } catch (err) {
        if (isP2002(err)) {
          const existing = await tx.project.findFirst({ where: { proposalId: proposal.id } });
          projectId = existing?.id ?? null;
        } else throw err;
      }
    }

    let invoiceId = proposal.invoice?.id ?? null;
    if (!invoiceId && proposal.amount != null) {
      const depositAmount = Math.round(Number(proposal.amount) * 0.3 * 100) / 100;
      try {
        const invoice = await tx.invoice.create({
          data: { proposalId: proposal.id, companyId: proposal.companyId, amount: depositAmount, status: "DRAFT" },
        });
        invoiceId = invoice.id;
      } catch (err) {
        if (isP2002(err)) {
          const existing = await tx.invoice.findFirst({ where: { proposalId: proposal.id } });
          invoiceId = existing?.id ?? null;
        } else throw err;
      }
    }

    return { clientId: proposal.clientId, projectId, invoiceId };
  })();

  // Post-commit: best-effort client invite.
  let clientInvited = false;
  try {
    if (opts.inviteThrows409) {
      throw Object.assign(new Error("Client already has a portal account"), { statusCode: 409 });
    }
    state.invites.push({ clientId: result.clientId });
    clientInvited = true;
  } catch (e) {
    if ((e as { statusCode?: number }).statusCode !== 409) throw e;
  }

  return { ...result, clientInvited };
}

const VERSION = 1;

describe("proposal.service.acceptWithCascade", () => {
  test("happy path: proposal ACCEPTED, lead WON, one PLANNING project, one 30% DRAFT invoice, client invited", async () => {
    const world = makeWorld(makeProposal());
    const res = await runCascade(world, { expectedVersion: VERSION });

    assert.equal(world.state.proposal.status, "ACCEPTED");
    assert.ok(world.state.proposal.acceptedAt);
    assert.equal(world.state.leads.get("lead-1")!.status, "WON");
    // Auto-conversion : the lead is linked to the proposal's client in the same transaction,
    // no separate step that could fail silently.
    assert.equal(world.state.leads.get("lead-1")!.convertedClientId, "client-1");
    assert.equal(world.state.projects.length, 1);
    assert.equal(world.state.projects[0].status, "PLANNING");
    assert.equal(world.state.projects[0].budget, "5000");
    assert.equal(world.state.invoices.length, 1);
    assert.equal(world.state.invoices[0].amount, 1500); // 30% of 5000
    assert.equal(world.state.invoices[0].status, "DRAFT");
    assert.equal(res.clientInvited, true);
    assert.equal(res.projectId, "project-1");
    assert.equal(res.invoiceId, "invoice-1");
  });

  test("idempotent: re-accepting an ACCEPTED proposal creates no duplicates", async () => {
    const world = makeWorld(makeProposal());
    await runCascade(world, { expectedVersion: VERSION });
    // Second call: proposal now ACCEPTED, project + invoice already exist.
    world.state.proposal.linkedProject = { id: world.state.projects[0].id, serviceId: null };
    world.state.proposal.invoice = { id: world.state.invoices[0].id };
    const res2 = await runCascade(world);

    assert.equal(world.state.projects.length, 1);
    assert.equal(world.state.invoices.length, 1);
    assert.equal(res2.projectId, "project-1");
    assert.equal(res2.invoiceId, "invoice-1");
  });

  test("reconcile: already ACCEPTED but missing invoice : backfills the invoice only", async () => {
    const world = makeWorld(makeProposal({ status: "ACCEPTED", linkedProject: { id: "project-9", serviceId: null } }));
    // Seed the pre-existing project so the cascade doesn't recreate it.
    world.state.projects.push({ id: "project-9", proposalId: "proposal-1", companyId: "company-1", status: "PLANNING", clientId: "client-1" });
    const res = await runCascade(world);

    assert.equal(world.state.projects.length, 1);
    assert.equal(world.state.invoices.length, 1);
    assert.equal(res.invoiceId, "invoice-1");
  });

  test("no amount: project created but no invoice", async () => {
    const world = makeWorld(makeProposal({ amount: null }));
    await runCascade(world, { expectedVersion: VERSION });
    assert.equal(world.state.projects.length, 1);
    assert.equal(world.state.invoices.length, 0);
  });

  test("no leadId: skips lead update, still creates project + invoice", async () => {
    const world = makeWorld(makeProposal({ leadId: null }));
    await runCascade(world, { expectedVersion: VERSION });
    assert.equal(world.state.leads.get("lead-1")!.status, "QUALIFIED"); // untouched
    assert.equal(world.state.projects.length, 1);
    assert.equal(world.state.invoices.length, 1);
  });

  test("lead already converted to a different client: auto-conversion does not overwrite it", async () => {
    const world = makeWorld(makeProposal());
    world.state.leads.get("lead-1")!.convertedClientId = "client-9";
    await runCascade(world, { expectedVersion: VERSION });
    assert.equal(world.state.leads.get("lead-1")!.status, "WON");
    assert.equal(world.state.leads.get("lead-1")!.convertedClientId, "client-9");
  });

  test("existing portal user: invite 409 is swallowed, acceptance still succeeds", async () => {
    const world = makeWorld(makeProposal());
    const res = await runCascade(world, { expectedVersion: VERSION, inviteThrows409: true });
    assert.equal(world.state.proposal.status, "ACCEPTED");
    assert.equal(res.clientInvited, false);
    assert.equal(world.state.invites.length, 0);
  });

  test("version mismatch throws and nothing is created", async () => {
    const world = makeWorld(makeProposal({ version: 3 }));
    await assert.rejects(() => runCascade(world, { expectedVersion: 1 }), /PROPOSAL_VERSION_MISMATCH/);
    assert.equal(world.state.projects.length, 0);
    assert.equal(world.state.invoices.length, 0);
  });

  test("non-live status (DRAFT) throws", async () => {
    const world = makeWorld(makeProposal({ status: "DRAFT" }));
    await assert.rejects(() => runCascade(world), /INVALID_PROPOSAL_TRANSITION/);
  });

  test("expired proposal throws", async () => {
    const world = makeWorld(makeProposal({ expiresAt: new Date(Date.now() - 86_400_000) }));
    await assert.rejects(() => runCascade(world, { expectedVersion: VERSION }), /PROPOSAL_EXPIRED/);
  });
});
