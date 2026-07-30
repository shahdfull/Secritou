// RG-017 (REFERENTIEL.md §5) : "Le rôle Client ne doit jamais avoir accès à des outils
// d'exécution de commande, y compris via le module IA." RG-016 has no code-execution sandbox
// because no execution primitive exists at all in the codebase — confirmed by direct scan below,
// not just RG-016's own absence claim.
//
// SEC-040/SEC-044: the AI persona endpoints this file used to gate directly
// (agentOrchestratorService.executeAgent, /ai/brief, /ai/tasks) and /ai/chat itself were all
// removed as dead code — no client/src code ever called any of them. Only the grep-level proof
// remains here; the role-authorization test moved to ai.endpoint.test.ts (authorize() covers the
// one remaining AI route, /ai/conversations/*).

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

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
