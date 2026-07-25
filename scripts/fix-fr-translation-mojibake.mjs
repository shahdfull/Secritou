import fs from "node:fs/promises";
import path from "node:path";

const frPath = path.resolve("client/src/i18n/locales/fr/translation.json");
const enPath = path.resolve("client/src/i18n/locales/en/translation.json");

const mojibakePattern = /(Ã.|â€™|â€œ|â€|Â |Ã¢|Ãª|Ã«|Ã¹|Ã»|Ã´|Ã§|Ã€|Ã‰|Ã‚|Ã‡|ÃŠ|ÃŒ|ÃŽ|Ã™|Ã›)/;

function decodeLatin1ToUtf8(value) {
  return Buffer.from(value, "latin1").toString("utf8");
}

function walk(value, visitor, pathParts = []) {
  if (Array.isArray(value)) {
    return value.map((item, index) => walk(item, visitor, [...pathParts, String(index)]));
  }

  if (value && typeof value === "object") {
    const next = {};
    for (const [key, child] of Object.entries(value)) {
      next[key] = walk(child, visitor, [...pathParts, key]);
    }
    return next;
  }

  if (typeof value === "string") {
    return visitor(value, pathParts);
  }

  return value;
}

function countMatchesInString(value) {
  const matches = value.match(new RegExp(mojibakePattern, "g"));
  return matches ? matches.length : 0;
}

function collectSamples(node, samples, pathParts = []) {
  if (typeof node === "string") {
    const count = countMatchesInString(node);
    if (count > 0) {
      samples.push({ path: pathParts.join("."), value: node, count });
    }
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((item, index) => collectSamples(item, samples, [...pathParts, String(index)]));
    return;
  }
  if (node && typeof node === "object") {
    for (const [key, child] of Object.entries(node)) {
      collectSamples(child, samples, [...pathParts, key]);
    }
  }
}

function collectKeyPaths(node, paths, pathParts = []) {
  if (Array.isArray(node)) {
    node.forEach((item, index) => collectKeyPaths(item, paths, [...pathParts, String(index)]));
    return;
  }
  if (node && typeof node === "object") {
    for (const [key, child] of Object.entries(node)) {
      const nextPath = [...pathParts, key];
      paths.add(nextPath.join("."));
      collectKeyPaths(child, paths, nextPath);
    }
  }
}

const frRaw = await fs.readFile(frPath, "utf8");
const enRaw = await fs.readFile(enPath, "utf8");
const frJson = JSON.parse(frRaw);
const enJson = JSON.parse(enRaw);

const samples = [];
collectSamples(frJson, samples);

const sampleChecks = samples.slice(0, 12).map((sample) => {
  const decoded = decodeLatin1ToUtf8(sample.value);
  return {
    path: sample.path,
    before: sample.value,
    after: decoded,
    beforeCount: sample.count,
    afterCount: countMatchesInString(decoded),
  };
});

const corrected = walk(frJson, (value) => {
  if (!mojibakePattern.test(value)) return value;
  const decoded = decodeLatin1ToUtf8(value);
  return decoded;
});

const beforeMatches = samples.length;
const afterSamples = [];
collectSamples(corrected, afterSamples);
const afterMatches = afterSamples.length;

const enKeys = new Set();
const frKeys = new Set();
collectKeyPaths(enJson, enKeys);
collectKeyPaths(corrected, frKeys);
const missingKeys = [...enKeys].filter((key) => !frKeys.has(key));
const extraKeys = [...frKeys].filter((key) => !enKeys.has(key));

if (process.argv.includes("--check")) {
  console.log(JSON.stringify({ beforeMatches, afterMatches, sampleChecks, missingKeys, extraKeys }, null, 2));
  process.exit(0);
}

if (missingKeys.length || extraKeys.length) {
  throw new Error(`Key parity mismatch: missing=${missingKeys.length}, extra=${extraKeys.length}`);
}

await fs.writeFile(frPath, `${JSON.stringify(corrected, null, 2)}\n`, "utf8");

console.log(JSON.stringify({ beforeMatches, afterMatches, sampleChecks, missingKeys, extraKeys }, null, 2));
