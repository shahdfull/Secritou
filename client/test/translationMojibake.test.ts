import { test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const frPath = path.resolve(import.meta.dirname, "../src/i18n/locales/fr/translation.json");
const enPath = path.resolve(import.meta.dirname, "../src/i18n/locales/en/translation.json");

const knownMojibakePatterns = [
  "Ã©",
  "Ã¨",
  "Ãª",
  "Ã«",
  "Ã ",
  "Ã¢",
  "Ã®",
  "Ã¯",
  "Ã´",
  "Ã»",
  "Ã§",
  "Ã‰",
  "Ãˆ",
  "ÃŠ",
  "Ã‹",
  "Ã€",
  "Ã‚",
  "ÃŽ",
  "Ãœ",
  "â€™",
  "â€œ",
  "â€",
  "â€",
  "Â ",
];

function collectKeyPaths(node: unknown, paths: Set<string>, pathParts: string[] = []) {
  if (Array.isArray(node)) {
    node.forEach((item, index) => collectKeyPaths(item, paths, [...pathParts, String(index)]));
    return;
  }
  if (node && typeof node === "object") {
    for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
      const nextPath = [...pathParts, key];
      paths.add(nextPath.join("."));
      collectKeyPaths(child, paths, nextPath);
    }
  }
}

test("French translation file contains no known mojibake sequences and stays key-parity aligned", () => {
  const frText = fs.readFileSync(frPath, "utf8");
  const enText = fs.readFileSync(enPath, "utf8");
  const frJson = JSON.parse(frText) as unknown;
  const enJson = JSON.parse(enText) as unknown;

  for (const pattern of knownMojibakePatterns) {
    expect(frText.includes(pattern), `unexpected mojibake sequence: ${pattern}`).toBe(false);
  }

  const frPaths = new Set<string>();
  const enPaths = new Set<string>();
  collectKeyPaths(frJson, frPaths);
  collectKeyPaths(enJson, enPaths);

  expect([...frPaths].sort(), "French and English translation key paths must match").toEqual([...enPaths].sort());
});
