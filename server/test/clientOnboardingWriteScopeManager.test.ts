// SEC-025: clientOnboardingService/repository — updateOnboarding, updateStep, and the
// create/update methods for Contract/Payment (and the other 5 sub-entities, same pattern) never
// received or checked managerServiceId, unlike findAll/findById/findByProjectId which already
// scope reads by pole (where.project.serviceId). A MANAGER of another pole could create/modify
// contracts and payments — contractual/financial documents — for any client's onboarding.
//
// This test imports and calls the real clientOnboardingService against a real database — not a
// reimplementation — confirming a pole-A Manager is refused write access to a pole-B onboarding's
// contract/payment/step/onboarding record, while a same-pole Manager and ADMIN still succeed.
//
// Requires a real, migrated database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let clientOnboardingService: typeof import("../src/services/clientOnboarding.service.js").clientOnboardingService;
let dbAvailable = true;

let serviceA: string;
let serviceB: string;
const createdClientIds: string[] = [];
const createdProjectIds: string[] = [];
const createdOnboardingIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ clientOnboardingService } = await import("../src/services/clientOnboarding.service.js"));
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
  await prisma.clientOnboarding.deleteMany({ where: { id: { in: createdOnboardingIds } } });
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
});

async function makeOnboardingInPole(serviceId: string, namePrefix: string) {
  const client = await prisma.client.create({ data: { name: `${namePrefix} client`, serviceId } });
  createdClientIds.push(client.id);
  const project = await prisma.project.create({ data: { name: `${namePrefix} project`, clientId: client.id, serviceId } });
  createdProjectIds.push(project.id);
  const onboarding = await prisma.clientOnboarding.create({
    data: {
      projectId: project.id,
      clientId: client.id,
      steps: { create: [{ stepType: "contract", title: "Contrat", orderIndex: 1 }, { stepType: "payment", title: "Paiement", orderIndex: 2 }] },
    },
    include: { steps: true },
  });
  createdOnboardingIds.push(onboarding.id);
  const contractStep = onboarding.steps.find((s) => s.stepType === "contract")!;
  const paymentStep = onboarding.steps.find((s) => s.stepType === "payment")!;
  return { onboarding, contractStep, paymentStep };
}

describe("SEC-025: clientOnboardingService write paths enforce Manager pole scope", () => {
  test("a pole-A Manager cannot update a pole-B onboarding", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const { onboarding } = await makeOnboardingInPole(serviceB, "sec025-update-onboarding-b");

    await assert.rejects(() => clientOnboardingService.updateOnboarding(onboarding.id, {}, undefined, serviceA));
  });

  test("a same-pole Manager can update the onboarding", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const { onboarding } = await makeOnboardingInPole(serviceA, "sec025-update-onboarding-a");

    const updated = await clientOnboardingService.updateOnboarding(onboarding.id, {}, undefined, serviceA);
    assert.equal(updated.id, onboarding.id);
  });

  test("a pole-A Manager cannot update a step on a pole-B onboarding", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const { contractStep } = await makeOnboardingInPole(serviceB, "sec025-update-step-b");

    await assert.rejects(() => clientOnboardingService.updateStep(contractStep.id, { status: "COMPLETED" }, undefined, serviceA));
  });

  test("a pole-A Manager cannot create a contract on a pole-B onboarding's step", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const { contractStep } = await makeOnboardingInPole(serviceB, "sec025-create-contract-b");

    await assert.rejects(() => clientOnboardingService.createContract(contractStep.id, { status: "PENDING" }, undefined, serviceA));
  });

  test("a same-pole Manager can create a contract", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const { contractStep } = await makeOnboardingInPole(serviceA, "sec025-create-contract-a");

    const contract = await clientOnboardingService.createContract(contractStep.id, { status: "PENDING" }, undefined, serviceA);
    assert.equal(contract.onboardingStepId, contractStep.id);
  });

  test("a pole-A Manager cannot update a contract belonging to a pole-B onboarding", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const { contractStep } = await makeOnboardingInPole(serviceB, "sec025-update-contract-b");
    const contract = await clientOnboardingService.createContract(contractStep.id, { status: "PENDING" }, undefined, serviceB);

    await assert.rejects(() => clientOnboardingService.updateContract(contract.id, { status: "SIGNED" }, undefined, serviceA));
  });

  test("a pole-A Manager cannot create a payment on a pole-B onboarding's step", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const { paymentStep } = await makeOnboardingInPole(serviceB, "sec025-create-payment-b");

    await assert.rejects(() => clientOnboardingService.createPayment(paymentStep.id, { status: "UNPAID" }, undefined, serviceA));
  });

  test("a same-pole Manager can create a payment", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const { paymentStep } = await makeOnboardingInPole(serviceA, "sec025-create-payment-a");

    const payment = await clientOnboardingService.createPayment(paymentStep.id, { status: "UNPAID" }, undefined, serviceA);
    assert.equal(payment.onboardingStepId, paymentStep.id);
  });

  test("an ADMIN (unscoped) can update an onboarding and create a contract from any pole", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const { onboarding, contractStep } = await makeOnboardingInPole(serviceB, "sec025-admin-b");

    const updated = await clientOnboardingService.updateOnboarding(onboarding.id, {}, undefined, undefined);
    assert.equal(updated.id, onboarding.id);
    const contract = await clientOnboardingService.createContract(contractStep.id, { status: "PENDING" }, undefined, undefined);
    assert.equal(contract.onboardingStepId, contractStep.id);
  });
});
