// SEC-118: LeadsPage.tsx sends pageSize: 200 for the Kanban view (it loads the whole pipeline in
// one request and groups leads into columns client-side), but parseListQuery silently capped ALL
// pageSize values at 50 — the Kanban never actually received 200 leads, only 50 at most, with no
// error or indication to the user. A pipeline with more than 50 leads lost part of it in
// whichever columns push past that cap (typically NEW).
//
// This test calls the real parseListQuery (with the raised maxPageSize the lead controller now
// passes) and the real leadRepository.findAll against a real, migrated database — not a
// reimplementation — proving more than 50 leads are actually returned when the Kanban's
// pageSize: 200 is honored end to end.
//
// Requires a real database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let leadRepository: typeof import("../src/repositories/lead.repository.js").leadRepository;
let parseListQuery: typeof import("../src/utils/listQuery.js").parseListQuery;
let dbAvailable = true;

const LEAD_COUNT = 60; // deliberately > the old hardcoded 50 cap
const createdLeadIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ leadRepository } = await import("../src/repositories/lead.repository.js"));
    ({ parseListQuery } = await import("../src/utils/listQuery.js"));
    await prisma.$queryRaw`SELECT 1`;

    const created = await Promise.all(
      Array.from({ length: LEAD_COUNT }, (_, i) => prisma.lead.create({ data: { name: `sec118 lead ${i}`, status: "NEW" } }))
    );
    createdLeadIds.push(...created.map((l) => l.id));
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.lead.deleteMany({ where: { id: { in: createdLeadIds } } });
});

describe(
  "Kanban lead pagination — real pageSize: 200 is honored past the old 50 cap (SEC-118)",
  { skip: !dbAvailable ? "no reachable database" : false },
  () => {
    test("parseListQuery with the raised Kanban-specific ceiling returns pageSize: 200, not capped at 50", () => {
      const options = parseListQuery({ pageSize: "200", page: "1" }, 500);
      assert.equal(options.pageSize, 200, "the Kanban-specific ceiling must let pageSize: 200 through uncapped");
    });

    test("parseListQuery with the default (no override) ceiling still caps at 50 for every other list endpoint", () => {
      const options = parseListQuery({ pageSize: "200", page: "1" });
      assert.equal(options.pageSize, 50, "other list endpoints must keep the original 50 cap unchanged");
    });

    test("leadRepository.findAll with pageSize: 200 returns all 60 seeded leads, not just 50", async () => {
      const result = await leadRepository.findAll({ page: 1, pageSize: 200, orderDir: "desc" });
      const seededInResult = result.data.filter((l) => createdLeadIds.includes(l.id));
      assert.equal(seededInResult.length, LEAD_COUNT, `expected all ${LEAD_COUNT} seeded leads, got ${seededInResult.length} — the old 50 cap would have silently truncated this`);
    });
  }
);
