// SEC-103: proposalRepository.findAll used to interpolate options.orderBy directly into Prisma's
// orderBy clause (`{ [options.orderBy || "createdAt"]: ... }`) without any whitelist, unlike
// leadRepository which already validates through buildOrderBy/SORTABLE_FIELDS. options.orderBy
// comes straight from req.query.orderBy — an arbitrary client-supplied string, only type-checked
// (typeof === "string"), never validated against real column/relation names — so an unknown or
// nonsensical field name reached Prisma directly and raised a runtime error instead of silently
// falling back to the default sort.
//
// This test calls the real proposalRepository.findAll against a real database with a garbage
// orderBy value, proving it no longer throws and instead falls back to createdAt ordering.
//
// Requires a real database; skipped if unreachable.

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

let prisma: typeof import("../src/config/prisma.js").prisma;
let proposalRepository: typeof import("../src/repositories/proposal.repository.js").proposalRepository;
let dbAvailable = true;

const createdClientIds: string[] = [];
const createdProposalIds: string[] = [];

before(async () => {
  try {
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ proposalRepository } = await import("../src/repositories/proposal.repository.js"));
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (!dbAvailable) return;
  await prisma.proposal.deleteMany({ where: { id: { in: createdProposalIds } } });
  await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
});

describe(
  "proposalRepository.findAll — orderBy whitelist (SEC-103)",
  { skip: !dbAvailable ? "no reachable database" : false },
  () => {
    test("an unknown orderBy field does not throw — falls back to the default sort", async () => {
      const client = await prisma.client.create({ data: { name: "sec103 client" } });
      createdClientIds.push(client.id);
      const proposal = await prisma.proposal.create({ data: { title: "sec103 proposal", clientId: client.id } });
      createdProposalIds.push(proposal.id);

      const result = await proposalRepository.findAll({
        page: 1,
        pageSize: 10,
        orderBy: "not_a_real_column; DROP TABLE",
        orderDir: "desc",
      });

      assert.ok(result.data.some((p) => p.id === proposal.id), "the fallback sort must still return real data");
    });

    test("a whitelisted orderBy field (title) sorts as expected", async () => {
      const client = await prisma.client.create({ data: { name: "sec103 client 2" } });
      createdClientIds.push(client.id);
      const a = await prisma.proposal.create({ data: { title: "AAA sec103", clientId: client.id } });
      const b = await prisma.proposal.create({ data: { title: "ZZZ sec103", clientId: client.id } });
      createdProposalIds.push(a.id, b.id);

      const result = await proposalRepository.findAll({
        page: 1,
        pageSize: 50,
        clientId: client.id,
        orderBy: "title",
        orderDir: "asc",
      });

      const titles = result.data.map((p) => p.title);
      const indexA = titles.indexOf("AAA sec103");
      const indexB = titles.indexOf("ZZZ sec103");
      assert.ok(indexA !== -1 && indexB !== -1 && indexA < indexB, "title asc must order AAA before ZZZ");
    });
  }
);
