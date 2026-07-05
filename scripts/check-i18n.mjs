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

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
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
