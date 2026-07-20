// SEC-092: projectMeetingRepository.findDueForReminder filtered archivedAt but never deletedAt
// nor a COMPLETED status — a soft-deleted or finished project with a lingering
// meetingFrequency would keep generating reminders indefinitely via checkMeetingReminders
// (ceoAlerts.processor.ts).
//
// This test imports and calls the real projectMeetingRepository.findDueForReminder against a
// real database — not a reimplementation — proving a due project is excluded when soft-deleted
// or COMPLETED, while an otherwise-identical open project is still found.
//
// Requires a real database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let projectMeetingRepository: typeof import("../src/repositories/projectMeeting.repository.js").projectMeetingRepository;
let dbAvailable = true;

let serviceA: string;
const createdClientIds: string[] = [];
const createdProjectIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ projectMeetingRepository } = await import("../src/repositories/projectMeeting.repository.js"));
    await prisma.$queryRaw`SELECT 1`;
    const services = await prisma.service.findMany({ take: 1 });
    if (services.length < 1) throw new Error("need at least 1 seeded Service row");
    serviceA = services[0]!.id;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
});

async function makeDueProject(namePrefix: string, overrides: Record<string, unknown> = {}) {
  const client = await prisma.client.create({ data: { name: `${namePrefix} client`, serviceId: serviceA } });
  createdClientIds.push(client.id);
  const now = new Date();
  const project = await prisma.project.create({
    data: {
      name: `${namePrefix} project`,
      clientId: client.id,
      serviceId: serviceA,
      meetingFrequency: "WEEKLY",
      nextMeetingDate: now,
      ...overrides,
    },
  });
  createdProjectIds.push(project.id);
  return project;
}

describe("projectMeetingRepository.findDueForReminder exclusions — SEC-092", () => {
  test("excludes a soft-deleted project even though its meeting is due", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const now = new Date();
    const windowEnd = new Date(now.getTime() + 60_000);
    const project = await makeDueProject("reminder-deleted", { deletedAt: now });

    const due = await projectMeetingRepository.findDueForReminder(now, windowEnd);
    assert.ok(!due.some((p) => p.id === project.id), "a soft-deleted project must never generate a meeting reminder");
  });

  test("excludes a COMPLETED project even though its meeting is due", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const now = new Date();
    const windowEnd = new Date(now.getTime() + 60_000);
    const project = await makeDueProject("reminder-completed", { status: "COMPLETED" });

    const due = await projectMeetingRepository.findDueForReminder(now, windowEnd);
    assert.ok(!due.some((p) => p.id === project.id), "a COMPLETED project must never generate a meeting reminder");
  });

  test("still finds an open, non-deleted project whose meeting is due", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const now = new Date();
    const windowEnd = new Date(now.getTime() + 60_000);
    const project = await makeDueProject("reminder-open");

    const due = await projectMeetingRepository.findDueForReminder(now, windowEnd);
    assert.ok(due.some((p) => p.id === project.id), "an open project with a due meeting must still be found");
  });
});
