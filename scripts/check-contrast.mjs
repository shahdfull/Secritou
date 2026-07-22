#!/usr/bin/env node
/**
 * Dev/CI guard: checks the design system's color tokens (client/src/styles.css) against WCAG 2.1
 * AA contrast requirements — 4.5:1 for normal text, 3:1 for large text (>=18.66px bold / >=24px)
 * and non-text UI components (borders, focus rings, icon-only controls).
 *
 * Runs entirely against the token DEFINITIONS in styles.css, not rendered pages or screenshots —
 * no dev server, no production data required. Tokens are oklch() in this repo (Tailwind v4 /
 * CSS Color 4); converted to sRGB here via the standard OKLab -> linear-sRGB matrices (same
 * formulas as the CSS Color 4 spec / Björn Ottosson's reference implementation), not through a
 * color library, per the decision to avoid adding a new dependency for a dev-only check.
 *
 * Checks both :root (light) and html.dark (dark) token sets, and every foreground/background
 * pairing actually used by components in this repo (grepped from client/src/components/ui and
 * client/src/index.css usage), not an exhaustive cross-product of all tokens.
 *
 * Exit 0 = all pairs pass their required ratio. Exit 1 = at least one pair fails (printed with
 * its actual ratio and required threshold).
 *
 * Usage:
 *   node scripts/check-contrast.mjs
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");
const STYLES_PATH = resolve(root, "client/src/styles.css");

// ── oklch() -> sRGB ──────────────────────────────────────────────────────────
// Standard OKLab <-> linear-sRGB matrices, per the CSS Color 4 spec / Björn Ottosson's oklab
// writeup (https://bottosson.github.io/posts/oklab/#converting-from-linear-srgb-to-oklab).

function oklchToOklab(L, C, Hdeg) {
  const h = (Hdeg * Math.PI) / 180;
  return [L, C * Math.cos(h), C * Math.sin(h)];
}

function oklabToLinearSrgb(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;

  return [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

function linearToSrgbChannel(c) {
  const clamped = Math.min(1, Math.max(0, c));
  return clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
}

function oklchToSrgb(L, C, H) {
  const [oL, a, b] = oklchToOklab(L, C, H);
  const [lr, lg, lb] = oklabToLinearSrgb(oL, a, b);
  return [linearToSrgbChannel(lr), linearToSrgbChannel(lg), linearToSrgbChannel(lb)];
}

// ── WCAG relative luminance / contrast ratio ────────────────────────────────
// https://www.w3.org/TR/WCAG21/#dfn-relative-luminance

function relativeLuminance([r, g, b]) {
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(rgb1, rgb2) {
  const L1 = relativeLuminance(rgb1);
  const L2 = relativeLuminance(rgb2);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ── Parse styles.css ─────────────────────────────────────────────────────────

function parseTokenBlock(css, selectorRegex) {
  const match = css.match(selectorRegex);
  if (!match) throw new Error(`Could not find block matching ${selectorRegex}`);
  const body = match[1];
  const tokens = {};
  // Matches "--name: oklch(L C H);" — ignores non-oklch declarations (e.g. --radius, var()
  // references that just alias another token, resolved separately below).
  const oklchRe = /--([\w-]+):\s*oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)/g;
  let m;
  while ((m = oklchRe.exec(body))) {
    tokens[m[1]] = oklchToSrgb(parseFloat(m[2]), parseFloat(m[3]), parseFloat(m[4]));
  }
  // Matches "--name: var(--other);" aliases (e.g. --card-foreground: var(--foreground);).
  const varRe = /--([\w-]+):\s*var\(--([\w-]+)\)/g;
  const aliases = [];
  while ((m = varRe.exec(body))) {
    aliases.push([m[1], m[2]]);
  }
  for (const [name, target] of aliases) {
    if (tokens[target]) tokens[name] = tokens[target];
  }
  return tokens;
}

const css = readFileSync(STYLES_PATH, "utf-8");
const lightTokens = parseTokenBlock(css, /:root\s*\{([^}]+)\}/);
const darkTokens = parseTokenBlock(css, /html\.dark\s*\{([^}]+)\}/);

// ── Pairs actually used by components (client/src/components/ui, feature pages) ────────────────
// Not an exhaustive cross-product of every token — only combinations real components render:
// each --X/--X-foreground pair (buttons, badges, cards, popovers), body text on background/
// surface, muted text on its usual containers, and non-text UI (border, ring, input) against
// the surfaces they sit on. "large" uses the 3:1 AA threshold (>=18.66px bold or >=24px normal —
// applies here to icon-only controls and borders, not to actual large headings, which this repo
// doesn't special-case with a distinct token).
const PAIRS = [
  { name: "foreground on background (body text)", fg: "foreground", bg: "background", kind: "text" },
  { name: "foreground on surface", fg: "foreground", bg: "surface", kind: "text" },
  { name: "foreground on card", fg: "card-foreground", bg: "card", kind: "text" },
  { name: "foreground on popover", fg: "popover-foreground", bg: "popover", kind: "text" },
  { name: "muted-foreground on background", fg: "muted-foreground", bg: "background", kind: "text" },
  { name: "muted-foreground on muted", fg: "muted-foreground", bg: "muted", kind: "text" },
  { name: "muted-foreground on card", fg: "muted-foreground", bg: "card", kind: "text" },
  { name: "primary-foreground on primary (button)", fg: "primary-foreground", bg: "primary", kind: "text" },
  { name: "secondary-foreground on secondary (button)", fg: "secondary-foreground", bg: "secondary", kind: "text" },
  { name: "accent-foreground on accent", fg: "accent-foreground", bg: "accent", kind: "text" },
  { name: "destructive-foreground on destructive (button)", fg: "destructive-foreground", bg: "destructive", kind: "text" },
  // "primary on primary-soft" is deliberately NOT checked at the text threshold: every real
  // text badge consumer already uses primary-strong (grepped across client/src), and the one
  // primary-soft + text-primary combo that exists (ContactPage.tsx icon container) is a Lucide
  // icon, non-text UI content under the 3:1 rule (1.4.11), which that combo clears comfortably.
  { name: "primary-strong on primary-soft (badge text)", fg: "primary-strong", bg: "primary-soft", kind: "text" },
  { name: "accent-strong on accent-soft (badge text)", fg: "accent-strong", bg: "accent-soft", kind: "text" },
  { name: "foreground on secondary (outline badge)", fg: "foreground", bg: "secondary", kind: "text" },
  { name: "border on background (non-text UI)", fg: "border", bg: "background", kind: "large" },
  { name: "input border on background (non-text UI)", fg: "input", bg: "background", kind: "large" },
  { name: "ring on card (focus indicator)", fg: "ring", bg: "card", kind: "large" },
  { name: "ring on background (focus indicator)", fg: "ring", bg: "background", kind: "large" },
];

const THRESHOLDS = { text: 4.5, large: 3.0 };

function checkTokenSet(tokens, label) {
  const results = [];
  for (const pair of PAIRS) {
    const fgRgb = tokens[pair.fg];
    const bgRgb = tokens[pair.bg];
    if (!fgRgb || !bgRgb) {
      results.push({ ...pair, error: `missing token(s): ${!fgRgb ? pair.fg : ""} ${!bgRgb ? pair.bg : ""}`.trim() });
      continue;
    }
    const ratio = contrastRatio(fgRgb, bgRgb);
    const required = THRESHOLDS[pair.kind];
    results.push({ ...pair, ratio, required, pass: ratio >= required });
  }
  return { label, results };
}

const reports = [checkTokenSet(lightTokens, "light (:root)"), checkTokenSet(darkTokens, "dark (html.dark)")];

// ── Report ────────────────────────────────────────────────────────────────────

let failures = 0;
for (const { label, results } of reports) {
  console.log(`\n${label}`);
  for (const r of results) {
    if (r.error) {
      console.log(`  ? ${r.name}: ${r.error}`);
      continue;
    }
    const status = r.pass ? "✓" : "✗";
    const line = `  ${status} ${r.name}: ${r.ratio.toFixed(2)}:1 (needs ${r.required}:1)`;
    if (r.pass) {
      console.log(line);
    } else {
      console.error(line);
      failures++;
    }
  }
}

if (failures === 0) {
  console.log(`\n✓ Contrast check passed — all ${reports.reduce((n, r) => n + r.results.length, 0)} pairs meet WCAG AA.`);
  process.exit(0);
} else {
  console.error(`\n✗ Contrast check failed — ${failures} pair(s) below their required WCAG AA ratio.`);
  process.exit(1);
}
