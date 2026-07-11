#!/usr/bin/env node
/**
 * CI guard: verifies that FR and EN translation files are structurally in sync.
 *
 * Checks:
 *   1. Every leaf key present in FR exists in EN (and vice-versa).
 *   2. No single-brace interpolations like {var} remain (must be {{var}}).
 *   3. No string values contain the literal "undefined" or "null".
 *
 * Exit 0 = OK. Exit 1 = errors found (list printed to stdout).
 *
 * Usage:
 *   node scripts/check-i18n.mjs
 *   # or add to package.json: "i18n:check": "node scripts/check-i18n.mjs"
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");

const FR_PATH = resolve(root, "client/src/i18n/locales/fr/translation.json");
const EN_PATH = resolve(root, "client/src/i18n/locales/en/translation.json");

const fr = JSON.parse(readFileSync(FR_PATH, "utf-8"));
const en = JSON.parse(readFileSync(EN_PATH, "utf-8"));

const errors = [];

// ── Helpers ──────────────────────────────────────────────────────────────────

function leafPaths(obj, prefix = "") {
  const paths = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      paths.push(...leafPaths(v, path));
    } else {
      paths.push({ path, value: v });
    }
  }
  return paths;
}

function getByPath(obj, dotPath) {
  return dotPath.split(".").reduce((o, k) => (o != null ? o[k] : undefined), obj);
}

// ── Check 1: key symmetry ─────────────────────────────────────────────────────

const frLeaves = leafPaths(fr);
const enLeaves = leafPaths(en);
const frKeys = new Set(frLeaves.map((l) => l.path));
const enKeys = new Set(enLeaves.map((l) => l.path));

for (const key of frKeys) {
  if (!enKeys.has(key)) {
    errors.push(`[MISSING_EN] "${key}" exists in FR but not in EN`);
  }
}
for (const key of enKeys) {
  if (!frKeys.has(key)) {
    errors.push(`[MISSING_FR] "${key}" exists in EN but not in FR`);
  }
}

// ── Check 2: single-brace interpolations ─────────────────────────────────────

const singleBrace = /(?<!\{)\{(?!\{)[a-zA-Z_][a-zA-Z0-9_]*\}(?!\})/;

for (const { path, value } of frLeaves) {
  if (typeof value === "string" && singleBrace.test(value)) {
    errors.push(`[SINGLE_BRACE_FR] "${path}": ${JSON.stringify(value)}`);
  }
}
for (const { path, value } of enLeaves) {
  if (typeof value === "string" && singleBrace.test(value)) {
    errors.push(`[SINGLE_BRACE_EN] "${path}": ${JSON.stringify(value)}`);
  }
}

// ── Check 3: literal "undefined" / "null" values ─────────────────────────────

for (const { path, value } of [...frLeaves, ...enLeaves]) {
  if (value === "undefined" || value === "null") {
    errors.push(`[BAD_VALUE] "${path}": ${JSON.stringify(value)}`);
  }
}

// ── Check 4: key-usage scan (t("key") calls in client source) ────────────────
// Collects all t("...") and t('...') literal calls in the client source and
// verifies every key exists in both translation files.

function walkDir(dir, exts = [".ts", ".tsx"]) {
  const results = [];
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        results.push(...walkDir(full, exts));
      } else if (exts.some((e) => full.endsWith(e))) {
        results.push(full);
      }
    }
  } catch { /* ignore unreadable dirs */ }
  return results;
}

const CLIENT_SRC = resolve(root, "client/src");
const usedKeys = new Set();
// Match t("key") and t('key') — only literal string keys (not variable calls).
const tCallRe = /\bt\(\s*["']([^"']+)["']/g;

for (const file of walkDir(CLIENT_SRC)) {
  const src = readFileSync(file, "utf-8");
  let m;
  while ((m = tCallRe.exec(src)) !== null) {
    usedKeys.add(m[1]);
  }
}

function pathPassesThroughArray(obj, segments) {
  let cur = obj;
  for (const seg of segments) {
    if (cur == null) return false;
    if (Array.isArray(cur) && /^\d+$/.test(seg)) return true;
    cur = cur[seg];
  }
  return false;
}

for (const key of usedKeys) {
  // Skip dynamic interpolations (e.g. `ns:${var}`)
  if (key.includes("${")) continue;
  // Skip empty suffixes from template literals like `prefix.${var}` where var="" at parse time
  if (key.endsWith(".")) continue;
  // Known exact match — no issue
  if (frKeys.has(key) || enKeys.has(key)) continue;
  // Handle array-indexed access at any depth: "a.0.title" where "a" is an array
  const segments = key.split(".");
  if (pathPassesThroughArray(fr, segments) || pathPassesThroughArray(en, segments)) continue;
  errors.push(`[MISSING_KEY] "${key}" used in source but absent from translation files`);
}

// ── Report ────────────────────────────────────────────────────────────────────

if (errors.length === 0) {
  console.log("✓ i18n check passed — FR and EN are in sync.");
  process.exit(0);
} else {
  console.error(`✗ i18n check failed — ${errors.length} issue(s) found:\n`);
  for (const e of errors) {
    console.error(`  ${e}`);
  }
  process.exit(1);
}
