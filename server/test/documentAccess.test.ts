// Tests for document access-level enforcement : pure logic, no DB.
// Mirrors visibleAccessLevels in document.repository.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { visibleAccessLevels } from "../src/repositories/document.repository.js";

describe("document access levels by role", () => {
  test("ADMIN sees every access level (incl. ADMIN_ONLY)", () => {
    const levels = visibleAccessLevels("ADMIN");
    assert.ok(levels.includes("ADMIN_ONLY"));
    assert.ok(levels.includes("ALL"));
  });

  test("MANAGER is treated as agency staff (sees ADMIN_ONLY)", () => {
    assert.ok(visibleAccessLevels("MANAGER").includes("ADMIN_ONLY"));
  });

  test("FREELANCER never sees ADMIN_ONLY or CLIENT_ADMIN", () => {
    const levels = visibleAccessLevels("FREELANCER");
    assert.ok(!levels.includes("ADMIN_ONLY"));
    assert.ok(!levels.includes("CLIENT_ADMIN"));
    assert.deepEqual(levels.sort(), ["ADMIN_FREELANCER", "ALL"]);
  });

  test("CLIENT never sees ADMIN_ONLY or ADMIN_FREELANCER", () => {
    const levels = visibleAccessLevels("CLIENT");
    assert.ok(!levels.includes("ADMIN_ONLY"));
    assert.ok(!levels.includes("ADMIN_FREELANCER"));
    assert.deepEqual(levels.sort(), ["ALL", "CLIENT_ADMIN"]);
  });
});

// SEC-130: the 4 tests above only prove visibleAccessLevels() as an isolated pure function — none
// call documentRepository.findById/findAll, the real query where it's actually wired in
// (document.repository.ts:91, :43-44). A future miswiring of that where.accessLevel clause would
// stay invisible to this file as written.
describe("document access levels — wired into the real query (SEC-130)", () => {
  let prisma: typeof import("../src/config/prisma.js").prisma;
  let documentRepository: typeof import("../src/repositories/document.repository.js").documentRepository;
  let dbAvailable = true;
  const createdDocIds: string[] = [];

  before(async () => {
    try {
      ({ prisma } = await import("../src/config/prisma.js"));
      ({ documentRepository } = await import("../src/repositories/document.repository.js"));
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      dbAvailable = false;
    }
  });

  after(async () => {
    if (!dbAvailable) return;
    await prisma.document.deleteMany({ where: { id: { in: createdDocIds } } });
  });

  test("a CLIENT cannot fetch an ADMIN_ONLY document by direct id", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const doc = await prisma.document.create({
      data: { name: "internal.pdf", title: "Internal only", type: "OTHER", url: "https://example.test/x", accessLevel: "ADMIN_ONLY" },
    });
    createdDocIds.push(doc.id);

    const found = await documentRepository.findById(doc.id, { role: "CLIENT", clientId: null });
    assert.equal(found, null, "ADMIN_ONLY must be filtered out of where.accessLevel for CLIENT");
  });

  test("an ADMIN can fetch that same ADMIN_ONLY document", async (t) => {
    if (!dbAvailable) return t.skip("no database available");
    const doc = await prisma.document.create({
      data: { name: "internal2.pdf", title: "Internal only 2", type: "OTHER", url: "https://example.test/y", accessLevel: "ADMIN_ONLY" },
    });
    createdDocIds.push(doc.id);

    const found = await documentRepository.findById(doc.id, { role: "ADMIN" });
    assert.ok(found, "ADMIN must still see ADMIN_ONLY documents");
    assert.equal(found!.id, doc.id);
  });
});
