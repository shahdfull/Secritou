// SEC-165: Commission, ProjectCommissionSplit and TimeEntry all cascade-delete on their
// partner/user relation (schema.prisma:1326,1342,1603) — userService.deleteUser had no guard
// against deleting a User who already had financial history attached, so an ADMIN deleting one
// of the 3 associates would silently destroy their entire commission/billed-time trail. Fixed by
// userRepository.hasFinancialHistory (user.repository.ts), checked in userService.deleteUser
// before the delete, mirroring the existing LAST_ADMIN 409 guard.
//
// This test imports and calls the real userService.deleteUser against a real, migrated database
// — not a reimplementation — and confirms the User (and its TimeEntry/ProjectCommissionSplit
// rows) survive the rejected call. Skipped if the database is unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let userService: typeof import("../src/services/user.service.js").userService;
let dbAvailable = true;

const createdUserIds: string[] = [];
const createdClientIds: string[] = [];
const createdProjectIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ userService } = await import("../src/services/user.service.js"));
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.timeEntry.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.projectCommissionSplit.deleteMany({ where: { partnerId: { in: createdUserIds } } });
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

async function makeManagerWithProject(uniq: number) {
  const manager = await prisma.user.create({
    data: { email: `sec165-mgr-${uniq}@test.local`, name: `SEC165 Manager ${uniq}`, passwordHash: "x", role: "MANAGER" },
  });
  createdUserIds.push(manager.id);
  const client = await prisma.client.create({ data: { name: `SEC165 client ${uniq}` } });
  createdClientIds.push(client.id);
  const project = await prisma.project.create({ data: { name: `SEC165 project ${uniq}`, clientId: client.id } });
  createdProjectIds.push(project.id);
  return { manager, project };
}

// SEC-195: `{ skip: !dbAvailable }` is evaluated SYNCHRONOUSLY when describe/test runs, before
// the async before() above has any chance to set the real value. Checking dbAvailable inside
// each test body (via t.skip()) is the only pattern that actually runs after before() resolves.
describe("userService.deleteUser refuses to destroy financial history (SEC-165)", () => {
  test("deleting a user with a TimeEntry is refused with 409, and the TimeEntry survives", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const uniq = Date.now();
    const { manager, project } = await makeManagerWithProject(uniq);
    const entry = await prisma.timeEntry.create({
      data: { projectId: project.id, userId: manager.id, minutes: 60, date: new Date() },
    });

    await assert.rejects(
      () => userService.deleteUser(manager.id, { id: "actor-admin", role: "ADMIN" }),
      (err: InstanceType<typeof import("../src/utils/httpError.js").HttpError>) => {
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, "USER_HAS_FINANCIAL_HISTORY");
        return true;
      }
    );

    const stillThere = await prisma.timeEntry.findUnique({ where: { id: entry.id } });
    assert.ok(stillThere, "the TimeEntry must not have been cascade-deleted");
    const userStillThere = await prisma.user.findUnique({ where: { id: manager.id } });
    assert.ok(userStillThere, "the User must not have been deleted");
  });

  test("deleting a user with a ProjectCommissionSplit is refused with 409, and the split survives", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const uniq = Date.now() + 1;
    const { manager, project } = await makeManagerWithProject(uniq);
    const split = await prisma.projectCommissionSplit.create({
      data: { projectId: project.id, partnerId: manager.id, ratePct: 10 },
    });

    await assert.rejects(
      () => userService.deleteUser(manager.id, { id: "actor-admin", role: "ADMIN" }),
      (err: InstanceType<typeof import("../src/utils/httpError.js").HttpError>) => {
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, "USER_HAS_FINANCIAL_HISTORY");
        return true;
      }
    );

    const stillThere = await prisma.projectCommissionSplit.findUnique({ where: { id: split.id } });
    assert.ok(stillThere, "the ProjectCommissionSplit must not have been cascade-deleted");
  });

  test("deleting a user with no financial history is still allowed", async (t) => {
    if (!dbAvailable) { t.skip("no reachable database"); return; }
    const uniq = Date.now() + 2;
    const manager = await prisma.user.create({
      data: { email: `sec165-clean-${uniq}@test.local`, name: `SEC165 Clean ${uniq}`, passwordHash: "x", role: "MANAGER" },
    });
    createdUserIds.push(manager.id);

    await assert.doesNotReject(() => userService.deleteUser(manager.id, { id: "actor-admin", role: "ADMIN" }));

    const gone = await prisma.user.findUnique({ where: { id: manager.id } });
    assert.equal(gone, null);
  });
});
