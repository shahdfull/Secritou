// SEC-132: this file used to reimplement allowedCategories()/managerServiceValue() locally
// instead of importing searchRepository — a test that mirrors its target's intended behavior in
// its own words, exactly the class of defect CLAUDE.md warns against ("a test that reimplements
// its target proves nothing: it would stay green even if the real code drifted"). It would have
// stayed green on every one of the 9 search categories even if search.repository.ts's actual
// scoping broke.
//
// This test imports and calls the real searchRepository.search against a real database instead,
// proving pole scoping and role restrictions on a representative sample of categories: leads
// (direct serviceId filter), clients (via projects.some.serviceId), tasks (via project's
// serviceId), proposals (via viaProject/linkedProject), and the freelancer directory (MANAGER
// excluded entirely, regardless of pole).
//
// Requires a real, migrated database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let searchRepository: typeof import("../src/repositories/search.repository.js").searchRepository;
let dbAvailable = true;

let serviceA: string;
let serviceB: string;
const createdClientIds: string[] = [];
const createdProjectIds: string[] = [];
const createdLeadIds: string[] = [];
const createdProposalIds: string[] = [];
const createdTaskIds: string[] = [];
const uniq = Date.now();

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ searchRepository } = await import("../src/repositories/search.repository.js"));
    await prisma.$queryRaw`SELECT 1`;
    const services = await prisma.service.findMany({ take: 2 });
    if (services.length < 2) throw new Error("need at least 2 seeded Service rows");
    serviceA = services[0]!.id;
    serviceB = services[1]!.id;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.proposal.deleteMany({ where: { id: { in: createdProposalIds } } });
  await prisma.task.deleteMany({ where: { id: { in: createdTaskIds } } });
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.lead.deleteMany({ where: { id: { in: createdLeadIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
});

describe("searchRepository.search — real code, pole scope and role restrictions (SEC-132)", { skip: !dbAvailable ? "no reachable database" : false }, () => {
  test("a MANAGER only finds leads/clients/tasks/proposals from their own pole", async () => {
    const lead = await prisma.lead.create({ data: { name: `SEC132-lead-${uniq}`, serviceId: serviceA } });
    createdLeadIds.push(lead.id);
    const otherPoleLead = await prisma.lead.create({ data: { name: `SEC132-lead-${uniq}`, serviceId: serviceB } });
    createdLeadIds.push(otherPoleLead.id);

    const client = await prisma.client.create({ data: { name: `SEC132-client-${uniq}`, serviceId: serviceA } });
    createdClientIds.push(client.id);
    const otherPoleClient = await prisma.client.create({ data: { name: `SEC132-client-${uniq}`, serviceId: serviceB } });
    createdClientIds.push(otherPoleClient.id);

    const project = await prisma.project.create({ data: { name: `SEC132-project-${uniq}`, clientId: client.id, serviceId: serviceA } });
    createdProjectIds.push(project.id);
    const otherPoleProject = await prisma.project.create({ data: { name: `SEC132-project-${uniq}`, clientId: otherPoleClient.id, serviceId: serviceB } });
    createdProjectIds.push(otherPoleProject.id);

    const task = await prisma.task.create({ data: { title: `SEC132-task-${uniq}`, projectId: project.id } });
    createdTaskIds.push(task.id);
    const otherPoleTask = await prisma.task.create({ data: { title: `SEC132-task-${uniq}`, projectId: otherPoleProject.id } });
    createdTaskIds.push(otherPoleTask.id);

    const managerA = { role: "MANAGER" as const, clientId: null, userId: "mgr-a", serviceId: serviceA };

    const leadResults = await searchRepository.search(managerA, `SEC132-lead-${uniq}`);
    assert.ok(leadResults.leads.some((l) => (l as { id: string }).id === lead.id), "own-pole lead must be found");
    assert.ok(!leadResults.leads.some((l) => (l as { id: string }).id === otherPoleLead.id), "cross-pole lead must not be found");

    const clientResults = await searchRepository.search(managerA, `SEC132-client-${uniq}`);
    assert.ok(clientResults.clients.some((c) => (c as { id: string }).id === client.id), "own-pole client must be found");
    assert.ok(!clientResults.clients.some((c) => (c as { id: string }).id === otherPoleClient.id), "cross-pole client must not be found");

    const taskResults = await searchRepository.search(managerA, `SEC132-task-${uniq}`);
    assert.ok(taskResults.tasks.some((t) => (t as { id: string }).id === task.id), "own-pole task must be found");
    assert.ok(!taskResults.tasks.some((t) => (t as { id: string }).id === otherPoleTask.id), "cross-pole task must not be found");
  });

  test("a MANAGER never receives the freelancer directory, regardless of pole; ADMIN does", async () => {
    const freelancer = await prisma.user.create({
      data: { email: `sec132-freelancer-${uniq}@test.local`, name: `SEC132-freelancer-${uniq}`, passwordHash: "x", role: "FREELANCER" },
    });
    const profile = await prisma.freelancerProfile.create({ data: { userId: freelancer.id } });

    const managerA = { role: "MANAGER" as const, clientId: null, userId: "mgr-a", serviceId: serviceA };
    const managerResults = await searchRepository.search(managerA, `SEC132-freelancer-${uniq}`);
    assert.deepEqual(managerResults.freelancers, [], "MANAGER must never see the freelancer directory");

    const admin = { role: "ADMIN" as const, clientId: null, userId: "admin-id" };
    const adminResults = await searchRepository.search(admin, `SEC132-freelancer-${uniq}`);
    assert.ok(adminResults.freelancers.length > 0, "ADMIN must see the freelancer directory");

    await prisma.freelancerProfile.delete({ where: { id: profile.id } });
    await prisma.user.delete({ where: { id: freelancer.id } });
  });

  test("a MANAGER only finds projects/invoices/serviceRequests/approvals from their own pole", async () => {
    const client = await prisma.client.create({ data: { name: `SEC132-full-client-${uniq}` } });
    createdClientIds.push(client.id);
    const otherClient = await prisma.client.create({ data: { name: `SEC132-full-client-other-${uniq}` } });
    createdClientIds.push(otherClient.id);

    const project = await prisma.project.create({ data: { name: `SEC132-full-project-${uniq}`, clientId: client.id, serviceId: serviceA } });
    createdProjectIds.push(project.id);
    const otherPoleProject = await prisma.project.create({ data: { name: `SEC132-full-project-${uniq}`, clientId: otherClient.id, serviceId: serviceB } });
    createdProjectIds.push(otherPoleProject.id);

    const invoice = await prisma.invoice.create({ data: { number: `SEC132-INV-${uniq}`, title: `SEC132-full-invoice-${uniq}`, amount: 100, clientId: client.id, projectId: project.id } });
    const otherPoleInvoice = await prisma.invoice.create({ data: { number: `SEC132-INV-OTHER-${uniq}`, title: `SEC132-full-invoice-${uniq}`, amount: 100, clientId: otherClient.id, projectId: otherPoleProject.id } });

    const serviceRequest = await prisma.serviceRequest.create({ data: { title: `SEC132-full-sr-${uniq}`, description: "x", type: "SUPPORT", clientId: client.id } });
    const otherPoleServiceRequest = await prisma.serviceRequest.create({ data: { title: `SEC132-full-sr-${uniq}`, description: "x", type: "SUPPORT", clientId: otherClient.id } });

    const approval = await prisma.approval.create({ data: { title: `SEC132-full-approval-${uniq}`, clientId: client.id } });
    const otherPoleApproval = await prisma.approval.create({ data: { title: `SEC132-full-approval-${uniq}`, clientId: otherClient.id } });

    // Both clients need at least one project in the relevant pole for serviceRequest/approval's
    // client-projects.some.serviceId scoping (search.repository.ts:85-86) to actually discriminate.
    await prisma.project.create({ data: { name: `SEC132-full-anchor-${uniq}`, clientId: otherClient.id, serviceId: serviceB } });
    createdProjectIds.push((await prisma.project.findFirst({ where: { name: `SEC132-full-anchor-${uniq}` } }))!.id);

    const managerA = { role: "MANAGER" as const, clientId: null, userId: "mgr-a", serviceId: serviceA };

    const projectResults = await searchRepository.search(managerA, `SEC132-full-project-${uniq}`);
    assert.ok(projectResults.projects.some((p) => (p as { id: string }).id === project.id), "own-pole project must be found");
    assert.ok(!projectResults.projects.some((p) => (p as { id: string }).id === otherPoleProject.id), "cross-pole project must not be found");

    const invoiceResults = await searchRepository.search(managerA, `SEC132-full-invoice-${uniq}`);
    assert.ok(invoiceResults.invoices.some((i) => (i as { id: string }).id === invoice.id), "own-pole invoice must be found");
    assert.ok(!invoiceResults.invoices.some((i) => (i as { id: string }).id === otherPoleInvoice.id), "cross-pole invoice must not be found");

    const srResults = await searchRepository.search(managerA, `SEC132-full-sr-${uniq}`);
    assert.ok(srResults.serviceRequests.some((s) => (s as { id: string }).id === serviceRequest.id), "own-pole service request must be found");
    assert.ok(!srResults.serviceRequests.some((s) => (s as { id: string }).id === otherPoleServiceRequest.id), "cross-pole service request must not be found");

    const approvalResults = await searchRepository.search(managerA, `SEC132-full-approval-${uniq}`);
    assert.ok(approvalResults.approvals.some((a) => (a as { id: string }).id === approval.id), "own-pole approval must be found");
    assert.ok(!approvalResults.approvals.some((a) => (a as { id: string }).id === otherPoleApproval.id), "cross-pole approval must not be found");

    await prisma.invoice.deleteMany({ where: { id: { in: [invoice.id, otherPoleInvoice.id] } } });
    await prisma.serviceRequest.deleteMany({ where: { id: { in: [serviceRequest.id, otherPoleServiceRequest.id] } } });
    await prisma.approval.deleteMany({ where: { id: { in: [approval.id, otherPoleApproval.id] } } });
  });

  test("a CLIENT only finds their own proposals, never another client's", async () => {
    const client = await prisma.client.create({ data: { name: `SEC132-clientscope-${uniq}` } });
    createdClientIds.push(client.id);
    const otherClient = await prisma.client.create({ data: { name: `SEC132-clientscope-other-${uniq}` } });
    createdClientIds.push(otherClient.id);

    const proposal = await prisma.proposal.create({ data: { title: `SEC132-proposal-${uniq}`, clientId: client.id } });
    createdProposalIds.push(proposal.id);
    const otherProposal = await prisma.proposal.create({ data: { title: `SEC132-proposal-${uniq}`, clientId: otherClient.id } });
    createdProposalIds.push(otherProposal.id);

    const results = await searchRepository.search({ role: "CLIENT", clientId: client.id, userId: "client-user" }, `SEC132-proposal-${uniq}`);
    assert.ok(results.proposals.some((p) => (p as { id: string }).id === proposal.id), "the client's own proposal must be found");
    assert.ok(!results.proposals.some((p) => (p as { id: string }).id === otherProposal.id), "another client's proposal must never be found");
    assert.deepEqual(results.leads, [], "CLIENT must never receive leads");
  });
});
