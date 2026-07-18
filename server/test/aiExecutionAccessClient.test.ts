// RG-017 (REFERENTIEL.md §5) : "Le rôle Client ne doit jamais avoir accès à des outils
// d'exécution de commande, y compris via le module IA." Previously `[À CONFIRMER]` — the v0.2.0
// IMPLEMENTED claim ("guaranteed by RG-014") was a deduction (no execution tool exists in the
// code, combined with a role check elsewhere), never a direct observation, and only holds
// conditionally on RG-016 (no code-execution sandbox exists at all, so there is genuinely
// nothing to gate — but that's a separate fact, not proof that CLIENT is specifically denied).
//
// Module 4.11 (agent-service) is GELÉ; this targeted read/test was explicitly authorized by the
// project owner for RG-017 verification only (session 2026-07-18) — no functional change, no
// feature added, module re-frozen immediately after.
//
// This test imports and calls the real agentOrchestratorService.executeAgent — the actual
// business-logic gate behind both /ai/brief and /ai/tasks, not a reimplementation — and confirms
// it rejects a CLIENT role with 403, independently of the route-level authorize() middleware
// (already covered by ai.endpoint.test.ts). Also confirms grep-level: no exec/spawn/eval
// primitive exists anywhere in server/src (RG-016's own no-sandbox-because-no-execution basis).

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { agentOrchestratorService } from "../src/services/agentOrchestrator.service.js";
import { HttpError } from "../src/utils/httpError.js";

function walkTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) results.push(...walkTsFiles(full));
    else if (full.endsWith(".ts")) results.push(full);
  }
  return results;
}

describe("RG-017 : no execution-tool access for CLIENT, via the AI module or otherwise", () => {
  test("agentOrchestratorService.executeAgent rejects role CLIENT with 403, independently of route middleware", async () => {
    await assert.rejects(
      () => agentOrchestratorService.executeAgent("brief-generator", {}, "some-client-user-id", "CLIENT"),
      (err: unknown) => {
        assert.ok(err instanceof HttpError, `expected an HttpError, got ${(err as Error)?.constructor?.name}`);
        assert.equal((err as InstanceType<typeof HttpError>).statusCode, 403);
        return true;
      }
    );
  });

  test("agentOrchestratorService.executeAgent rejects role FREELANCER with 403 too", async () => {
    await assert.rejects(
      () => agentOrchestratorService.executeAgent("task-planner", {}, "some-freelancer-id", "FREELANCER"),
      (err: unknown) => {
        assert.ok(err instanceof HttpError);
        assert.equal((err as InstanceType<typeof HttpError>).statusCode, 403);
        return true;
      }
    );
  });

  test("no command-execution primitive (child_process/spawn/eval) exists anywhere in server/src", () => {
    const srcDir = join(process.cwd(), "src");
    const files = walkTsFiles(srcDir);
    const offenders: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, "utf-8");
      if (/child_process|execSync|\bspawn\(|\beval\(/.test(content)) {
        offenders.push(file);
      }
    }
    assert.deepEqual(offenders, [], "RG-016 has no execution sandbox because no execution primitive exists at all — confirmed by direct scan, not just RG-016's own absence claim");
  });
});
