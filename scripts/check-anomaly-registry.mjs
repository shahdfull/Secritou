#!/usr/bin/env node
/**
 * CI guard: SEC-101 — the anomaly registry (anomalies/_index.yaml + anomalies/<perimetre>.yaml)
 * has no automated check that a declared "resolu" status is backed by real evidence. Pattern
 * confirmed 5 times in one mission (SEC-095/096/066/071/072): a status changed in one file but
 * never mirrored in the other, or a status left stale after the real fix had already landed.
 *
 * Checks two things only — deliberately not semantic/content verification (out of scope for a
 * simple guard script, see anomalies/transverse.yaml#SEC-101 for the reasoning):
 *
 *   1. Cross-file status consistency: every anomaly ID in anomalies/_index.yaml must have the
 *      same `statut` as its entry in the matching anomalies/<perimetre>.yaml detail file (and
 *      vice-versa — every ID in a detail file must exist in _index.yaml with a matching status).
 *
 *   2. Commit existence: for every anomaly with `statut: resolu`, every commit SHA mentioned in
 *      its text fields (titre, note, source, critere_de_resolution, note_degel — whatever is
 *      present) must exist in this repository's git history (`git cat-file -e`). Does not check
 *      whether the commit actually contains the described fix, or whether CI was green on it —
 *      only that the cited SHA isn't a typo or a hallucination.
 *
 * Exit 0 = both checks pass on every anomaly. Exit 1 = at least one violation (all printed, not
 * just the first).
 *
 * Usage:
 *   node scripts/check-anomaly-registry.mjs
 */

import { readFileSync, readdirSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";
import yaml from "js-yaml";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");
const ANOMALIES_DIR = resolve(root, "anomalies");

function loadYaml(path) {
  return yaml.load(readFileSync(path, "utf8"));
}

function commitExists(sha) {
  try {
    execFileSync("git", ["cat-file", "-e", `${sha}^{commit}`], { cwd: root, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// A commit SHA preceded by the word "commit" (French text in this registry) — 7 to 40 hex chars.
// Deliberately anchored on the keyword rather than any 7+ hex string: anomaly IDs (SEC-024),
// dates, and other identifiers can look like partial hex sequences out of context.
const COMMIT_MENTION_RE = /commit\s+`?([0-9a-f]{7,40})`?/gi;

const errors = [];

const indexPath = join(ANOMALIES_DIR, "_index.yaml");
const index = loadYaml(indexPath);

if (!index || !Array.isArray(index.anomalies)) {
  console.error(`FAIL: ${indexPath} did not parse to an object with an "anomalies" array.`);
  process.exit(1);
}

const indexById = new Map(index.anomalies.map((a) => [a.id, a]));

// Collect every anomalies/<perimetre>.yaml (everything in the dir except _index.yaml itself).
const detailFiles = readdirSync(ANOMALIES_DIR).filter(
  (f) => f.endsWith(".yaml") && f !== "_index.yaml"
);

const detailById = new Map(); // id -> { statut, file }

for (const file of detailFiles) {
  const path = join(ANOMALIES_DIR, file);
  const detail = loadYaml(path);
  if (!detail || !Array.isArray(detail.anomalies)) {
    errors.push(`${file}: did not parse to an object with an "anomalies" array.`);
    continue;
  }
  for (const a of detail.anomalies) {
    if (!a.id) {
      errors.push(`${file}: an entry is missing its "id" field.`);
      continue;
    }
    if (detailById.has(a.id)) {
      errors.push(
        `${a.id}: appears in both ${detailById.get(a.id).file} and ${file} — an ID must live in exactly one detail file.`
      );
      continue;
    }
    detailById.set(a.id, { statut: a.statut, file });
  }
}

// Check 1: cross-file status consistency, both directions.
for (const [id, indexEntry] of indexById) {
  const detail = detailById.get(id);
  if (!detail) {
    errors.push(`${id}: present in _index.yaml but not found in any anomalies/<perimetre>.yaml detail file.`);
    continue;
  }
  if (indexEntry.statut !== detail.statut) {
    errors.push(
      `${id}: statut mismatch — _index.yaml says "${indexEntry.statut}", ${detail.file} says "${detail.statut}".`
    );
  }
}
for (const [id, detail] of detailById) {
  if (!indexById.has(id)) {
    errors.push(`${id}: present in ${detail.file} but not found in anomalies/_index.yaml.`);
  }
}

// Check 2: commit SHAs cited in "resolu" anomalies must exist in this repo's history.
// Runs against whichever registry has the fuller text (detail file) for each ID, falling back
// to the index entry for IDs whose only text lives there.
const checkedShas = new Map(); // sha -> exists (cache — the same SHA can be cited many times)

function checkCommitMentions(id, statut, textFields) {
  if (statut !== "resolu") return;
  const text = Object.values(textFields).filter(Boolean).join("\n");
  for (const match of text.matchAll(COMMIT_MENTION_RE)) {
    const sha = match[1];
    if (!checkedShas.has(sha)) {
      checkedShas.set(sha, commitExists(sha));
    }
    if (!checkedShas.get(sha)) {
      errors.push(`${id}: cites commit "${sha}" (statut: resolu) but this SHA does not exist in git history.`);
    }
  }
}

for (const file of detailFiles) {
  const path = join(ANOMALIES_DIR, file);
  const detail = loadYaml(path);
  if (!detail || !Array.isArray(detail.anomalies)) continue;
  for (const a of detail.anomalies) {
    if (!a.id) continue;
    checkCommitMentions(a.id, a.statut, {
      titre: a.titre,
      note: a.note,
      source: a.source,
      critere_de_resolution: a.critere_de_resolution,
      note_degel: a.note_degel,
    });
  }
}
// Also scan _index.yaml's own (lighter) text fields, for IDs that only carry a "note" there.
for (const a of index.anomalies) {
  checkCommitMentions(a.id, a.statut, { titre: a.titre, note: a.note });
}

if (errors.length > 0) {
  console.error(`FAIL: ${errors.length} registry consistency violation(s):\n`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(
  `OK — ${indexById.size} anomalies checked across _index.yaml + ${detailFiles.length} detail file(s): status consistent, ${checkedShas.size} distinct commit SHA(s) cited by resolu entries all exist.`
);
