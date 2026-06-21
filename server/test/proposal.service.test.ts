// Tests for proposal.service business logic — no DB, no real imports
// Pattern: stub dependencies inline, mirror real service logic
// Source: src/services/proposal.service.ts

import test, { describe } from "node:test";
import assert from "node:assert/strict";

// ─── Minimal proposal shape ───────────────────────────────────────────────────

function makeProposal(overrides = {}) {
  return {
    id: "proposal-1",
    companyId: "company-1",
    clientId: "client-1",
    title: "Refonte site web",
    description: null,
    status: "SENT" as const,
    version: 1,
    amount: 5000,
    currency: "EUR",
    expiresAt: null,
    pdfUrl: null,
    viewedAt: null,
    acceptedAt: null,
    rejectedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    client: { name: "Acme Corp", id: "client-1" },
    sections: [],
    history: [],
    invoice: null,
    ...overrides,
  };
}

// ─── Extracted service logic (mirrors proposal.service.ts) ───────────────────
// Dependencies injected as parameters so tests pass stubs.

type Deps = {
  proposalRepository: {
    findById: (id: string, companyId: string) => Promise<ReturnType<typeof makeProposal> | null>;
    update: (id: string, companyId: string, data: object) => Promise<ReturnType<typeof makeProposal>>;
  };
  userRepository: {
    findAdminsByCompanyId: (companyId: string) => Promise<Array<{ email: string; name: string }>>;
    findByClientId: (clientId: string) => Promise<Array<{ email: string; name: string }>>;
  };
  clientRepository: {
    findById: (id: string, companyId: string) => Promise<{ name: string } | null>;
  };
  enqueueEmails: (items: Array<{ to: string; subject: string; html: string }>) => void;
  frontendUrl: string;
};

async function serviceReject(
  deps: Deps,
  id: string,
  companyId: string,
  comment?: string
) {
  const proposal = await deps.proposalRepository.findById(id, companyId);
  const updated = await deps.proposalRepository.update(id, companyId, {
    status: "REJECTED",
    rejectedAt: new Date(),
  });

  if (proposal) {
    const [admins, client] = await Promise.all([
      deps.userRepository.findAdminsByCompanyId(companyId),
      deps.clientRepository.findById(proposal.clientId, companyId),
    ]);

    deps.enqueueEmails(
      admins.map((admin) => ({
        to: admin.email,
        subject: `Proposition refusée — ${proposal.title}`,
        html: `Bonjour ${admin.name}, ${client?.name ?? "Le client"} a refusé. ${comment ?? ""}`,
      }))
    );
  }

  return updated;
}

async function serviceSend(
  deps: Deps,
  id: string,
  companyId: string
) {
  const proposal = await deps.proposalRepository.findById(id, companyId);
  const updated = await deps.proposalRepository.update(id, companyId, { status: "SENT" });

  if (proposal) {
    const clientUsers = await deps.userRepository.findByClientId(proposal.clientId);
    const viewUrl = `${deps.frontendUrl}/client/proposals/${id}`;

    deps.enqueueEmails(
      clientUsers.map((user) => ({
        to: user.email,
        subject: `Nouvelle proposition : "${proposal.title}"`,
        html: `Bonjour ${user.name}, consultez votre proposition. <a href="${viewUrl}">Voir</a>`,
      }))
    );
  }

  return updated;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

const PROPOSAL_ID = "proposal-1";
const COMPANY_ID = "company-1";
const CLIENT_EMAIL = "contact@acme.com";

function makeBaseDeps(overrides: Partial<Deps> = {}): Deps {
  return {
    proposalRepository: {
      findById: async () => makeProposal(),
      update: async (_id, _cid, data) => makeProposal(data),
    },
    userRepository: {
      findAdminsByCompanyId: async () => [{ email: "admin@co.com", name: "Admin" }],
      findByClientId: async () => [{ email: CLIENT_EMAIL, name: "Acme" }],
    },
    clientRepository: {
      findById: async () => ({ name: "Acme Corp" }),
    },
    enqueueEmails: () => {},
    frontendUrl: "https://app.example.com",
    ...overrides,
  };
}

describe("proposal.service.reject", () => {
  test("calls proposalRepository.update with status REJECTED", async () => {
    const updateCalls: Array<{ id: string; companyId: string; data: object }> = [];

    const deps = makeBaseDeps({
      proposalRepository: {
        findById: async () => makeProposal(),
        update: async (id, companyId, data) => {
          updateCalls.push({ id, companyId, data });
          return makeProposal(data);
        },
      },
    });

    await serviceReject(deps, PROPOSAL_ID, COMPANY_ID, "Budget trop élevé");

    assert.equal(updateCalls.length, 1);
    assert.equal(updateCalls[0].id, PROPOSAL_ID);
    assert.equal(updateCalls[0].companyId, COMPANY_ID);
    assert.equal((updateCalls[0].data as { status: string }).status, "REJECTED");
  });

  test("includes comment in admin notification email", async () => {
    const enqueuedItems: Array<{ to: string; subject: string; html: string }> = [];
    const COMMENT = "Budget trop élevé";

    const deps = makeBaseDeps({
      enqueueEmails: (items) => enqueuedItems.push(...items),
    });

    await serviceReject(deps, PROPOSAL_ID, COMPANY_ID, COMMENT);

    assert.equal(enqueuedItems.length, 1);
    assert.ok(
      enqueuedItems[0].html.includes(COMMENT),
      `Email body must contain comment "${COMMENT}"`
    );
  });

  test("does not throw when comment is undefined", async () => {
    const deps = makeBaseDeps();
    await assert.doesNotReject(() => serviceReject(deps, PROPOSAL_ID, COMPANY_ID, undefined));
  });

  test("sends email to each admin", async () => {
    const enqueuedTos: string[] = [];

    const deps = makeBaseDeps({
      userRepository: {
        findAdminsByCompanyId: async () => [
          { email: "admin1@co.com", name: "Admin1" },
          { email: "admin2@co.com", name: "Admin2" },
        ],
        findByClientId: async () => [],
      },
      enqueueEmails: (items) => enqueuedTos.push(...items.map((i) => i.to)),
    });

    await serviceReject(deps, PROPOSAL_ID, COMPANY_ID);

    assert.deepEqual(enqueuedTos.sort(), ["admin1@co.com", "admin2@co.com"]);
  });

  test("does not call enqueueEmails when proposal is not found", async () => {
    let enqueueCalled = false;

    const deps = makeBaseDeps({
      proposalRepository: {
        findById: async () => null,
        update: async (_id, _cid, data) => makeProposal(data),
      },
      enqueueEmails: () => { enqueueCalled = true; },
    });

    await serviceReject(deps, PROPOSAL_ID, COMPANY_ID, "comment");

    assert.equal(enqueueCalled, false);
  });
});

describe("proposal.service.send", () => {
  test("calls enqueueEmails with client email", async () => {
    const enqueuedItems: Array<{ to: string }> = [];

    const deps = makeBaseDeps({
      enqueueEmails: (items) => enqueuedItems.push(...items),
    });

    await serviceSend(deps, PROPOSAL_ID, COMPANY_ID);

    assert.ok(
      enqueuedItems.some((i) => i.to === CLIENT_EMAIL),
      `Expected email to ${CLIENT_EMAIL}, got: ${JSON.stringify(enqueuedItems)}`
    );
  });

  test("calls proposalRepository.update with status SENT", async () => {
    const updateCalls: Array<{ data: object }> = [];

    const deps = makeBaseDeps({
      proposalRepository: {
        findById: async () => makeProposal(),
        update: async (_id, _cid, data) => { updateCalls.push({ data }); return makeProposal(data); },
      },
    });

    await serviceSend(deps, PROPOSAL_ID, COMPANY_ID);

    assert.equal((updateCalls[0].data as { status: string }).status, "SENT");
  });

  test("email subject contains proposal title", async () => {
    const enqueuedItems: Array<{ subject: string }> = [];

    const deps = makeBaseDeps({
      enqueueEmails: (items) => enqueuedItems.push(...items),
    });

    await serviceSend(deps, PROPOSAL_ID, COMPANY_ID);

    assert.ok(
      enqueuedItems[0].subject.includes("Refonte site web"),
      "Subject must include proposal title"
    );
  });

  test("does not call enqueueEmails when proposal is not found", async () => {
    let enqueueCalled = false;

    const deps = makeBaseDeps({
      proposalRepository: {
        findById: async () => null,
        update: async (_id, _cid, data) => makeProposal(data),
      },
      enqueueEmails: () => { enqueueCalled = true; },
    });

    await serviceSend(deps, PROPOSAL_ID, COMPANY_ID);

    assert.equal(enqueueCalled, false);
  });

  test("view URL in email contains proposal id", async () => {
    const enqueuedItems: Array<{ html: string }> = [];

    const deps = makeBaseDeps({
      enqueueEmails: (items) => enqueuedItems.push(...items),
    });

    await serviceSend(deps, PROPOSAL_ID, COMPANY_ID);

    assert.ok(
      enqueuedItems[0].html.includes(PROPOSAL_ID),
      "Email HTML must include proposal id in view URL"
    );
  });
});

// ─── Edit-after-send guards (P0 #1) — mirrors proposalService.update / accept ─────

type GuardProposal = ReturnType<typeof makeProposal>;

// Mirrors proposalService.update: content edits on a live proposal revert it to DRAFT,
// bump version, and record history. Non-content fields do not trigger a revert.
async function serviceUpdate(
  proposal: GuardProposal,
  data: Partial<{ title: string; description: string; amount: number; status: string; pdfUrl: string }>,
  history: Array<{ action: string }>
) {
  const isLive = proposal.status === "SENT" || proposal.status === "VIEWED";
  const contentChanged =
    (data.title !== undefined && data.title !== proposal.title) ||
    (data.description !== undefined && data.description !== proposal.description) ||
    (data.amount !== undefined &&
      Number(data.amount) !== (proposal.amount != null ? Number(proposal.amount) : null));

  if (isLive && contentChanged && data.status === undefined) {
    history.push({ action: "REVERTED_TO_DRAFT" });
    return { ...proposal, ...data, status: "DRAFT", version: proposal.version + 1 };
  }
  return { ...proposal, ...data };
}

// Mirrors the version guard in proposalService.accept.
function assertVersionMatch(proposal: GuardProposal, expectedVersion?: number) {
  if (expectedVersion !== undefined && expectedVersion !== proposal.version) {
    throw Object.assign(new Error("PROPOSAL_VERSION_MISMATCH"), { code: "PROPOSAL_VERSION_MISMATCH" });
  }
}

describe("proposal.service.update — edit-after-send guard", () => {
  test("editing title on a SENT proposal reverts to DRAFT and bumps version", async () => {
    const history: Array<{ action: string }> = [];
    const result = await serviceUpdate(makeProposal({ status: "SENT", version: 1 }), { title: "Nouveau titre" }, history);
    assert.equal(result.status, "DRAFT");
    assert.equal(result.version, 2);
    assert.equal(history[0].action, "REVERTED_TO_DRAFT");
  });

  test("editing amount on a VIEWED proposal reverts to DRAFT", async () => {
    const history: Array<{ action: string }> = [];
    const result = await serviceUpdate(makeProposal({ status: "VIEWED", amount: 5000 }), { amount: 6000 }, history);
    assert.equal(result.status, "DRAFT");
    assert.equal(history.length, 1);
  });

  test("changing pdfUrl (non-content) does NOT revert to DRAFT", async () => {
    const history: Array<{ action: string }> = [];
    const result = await serviceUpdate(makeProposal({ status: "SENT" }), { pdfUrl: "https://cdn/new.pdf" }, history);
    assert.equal(result.status, "SENT");
    assert.equal(result.version, 1);
    assert.equal(history.length, 0);
  });

  test("setting the same title (no real change) does NOT revert", async () => {
    const history: Array<{ action: string }> = [];
    const result = await serviceUpdate(makeProposal({ status: "SENT", title: "Same" }), { title: "Same" }, history);
    assert.equal(result.status, "SENT");
    assert.equal(history.length, 0);
  });

  test("editing a DRAFT proposal stays DRAFT without history entry", async () => {
    const history: Array<{ action: string }> = [];
    const result = await serviceUpdate(makeProposal({ status: "DRAFT", version: 3 }), { title: "x" }, history);
    assert.equal(result.status, "DRAFT");
    assert.equal(result.version, 3);
    assert.equal(history.length, 0);
  });
});

describe("proposal.service.accept — version guard", () => {
  test("accepts when expectedVersion matches", () => {
    assert.doesNotThrow(() => assertVersionMatch(makeProposal({ version: 2 }), 2));
  });

  test("throws PROPOSAL_VERSION_MISMATCH when stale", () => {
    assert.throws(
      () => assertVersionMatch(makeProposal({ version: 3 }), 2),
      /PROPOSAL_VERSION_MISMATCH/
    );
  });

  test("skips the guard when expectedVersion is omitted", () => {
    assert.doesNotThrow(() => assertVersionMatch(makeProposal({ version: 5 }), undefined));
  });
});
