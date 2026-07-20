// Qualité de code, signalée par le porteur du projet (casquette ingénieur full-stack, session du
// 2026-07-18) : project.repository.ts and projectMeeting.repository.ts used prismaRead for
// reads, but task.repository.ts used prisma (primary) for findAll/findById/findByIdAdmin — a
// real inconsistency, wasted load on the primary on a high-traffic module (Kanban, lists).
// projectProgress.ts did the same (raw query on prisma instead of prismaRead), despite being
// called on every project list.
//
// Investigation found something more serious than reported: project.repository.ts imported
// prismaRead but ALIASED it `as prisma` and used that alias for EVERYTHING — including
// create/update/delete. If DATABASE_READ_URL is ever pointed at a real read-only replica, every
// write on Project would fail outright. Currently invisible because without DATABASE_READ_URL
// configured, prismaRead === prisma (same underlying client) — no observable symptom in this
// environment, which is exactly why this kind of bug hides until the day a replica is actually
// wired up.
//
// Fixed: project.repository.ts now imports both prisma and prismaRead properly, using prisma
// only for writes and for pre-write reads (findByIdAdmin, read immediately before write in the
// same caller) ; task.repository.ts's pure reads (findAll/findById/existsInCompany) moved to
// prismaRead, findByIdAdmin kept on prisma for the same pre-write reason ; projectProgress.ts's
// raw aggregate query moved to prismaRead.
//
// SEC-133/SEC-135 (session ultérieure) : le premier passage n'avait vérifié que 2 des 29
// repositories qui utilisent prismaRead. Étendre à tous a trouvé le même défaut racine
// (prismaRead aliasé `as prisma`, utilisé pour des écritures) sur 4 fichiers supplémentaires —
// client.repository.ts, lead.repository.ts, user.repository.ts, et comment.repository.ts#create
// (qui importait pourtant DÉJÀ prisma sous le nom writePrisma, mais create() était resté sur
// l'alias de lecture par une incohérence interne au fichier). Les 4 corrigés de la même manière
// que project.repository.ts.
//
// Since DATABASE_READ_URL is not configured in this environment, prismaRead and prisma are
// literally the same client — a behavioral test can't distinguish them here. This test instead
// verifies the fix structurally, across every repository that imports prismaRead: every write
// method calls `prisma.<model>.<mutatingMethod>`, never `prismaRead.<model>.<mutatingMethod>`,
// and prismaRead is never aliased as `prisma` — by scanning the real source files, not a
// description of intent.

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const MUTATING_METHODS = ["create", "update", "updateMany", "delete", "deleteMany", "upsert"];
const REPO_DIR = join(process.cwd(), "src/repositories");

function findMutations(content: string, prismaIdentifier: string): string[] {
  const offenders: string[] = [];
  for (const method of MUTATING_METHODS) {
    const re = new RegExp(`${prismaIdentifier}\\.\\w+\\.${method}\\(`, "g");
    const matches = content.match(re);
    if (matches) offenders.push(...matches);
  }
  return offenders;
}

// Every repository file that imports prismaRead at all — the ones with nothing to separate
// (pure-read repositories) are harmless by construction and simply produce zero offenders below;
// this still catches them if a write is ever added without prismaRead being dropped.
const repositoriesUsingPrismaRead = readdirSync(REPO_DIR)
  .filter((f) => f.endsWith(".repository.ts"))
  .filter((f) => readFileSync(join(REPO_DIR, f), "utf-8").includes("prismaRead"));

describe("prismaRead is never used for a write, across every repository that imports it (SEC-133)", () => {
  test("at least the known 29 repositories using prismaRead are actually being scanned (canary against a silent drop)", () => {
    assert.ok(repositoriesUsingPrismaRead.length >= 29, `expected >= 29 repositories importing prismaRead, found ${repositoriesUsingPrismaRead.length}`);
  });

  for (const file of repositoriesUsingPrismaRead) {
    test(`${file}: no mutating call ever goes through the read connection, aliased or not`, () => {
      const content = readFileSync(join(REPO_DIR, file), "utf-8");
      const isAliased = /prismaRead as prisma/.test(content);
      // Unaliased: `prismaRead.<model>.<mutatingMethod>(` is always a bug. Aliased (`prismaRead as
      // prisma`): every call reads `prisma.<model>.<method>(` in the source regardless of which
      // connection it actually hits, so THAT is the pattern to scan for a write on — the alias
      // itself is only a problem if a write is routed through it, not merely by existing (see
      // analytics/executiveMetrics/search/summary: aliased, but genuinely read-only).
      const offenders = isAliased ? findMutations(content, "prisma") : findMutations(content, "prismaRead");
      assert.deepEqual(offenders, [], `found write(s) routed through the read connection: ${offenders.join(", ")}`);
    });
  }
});
