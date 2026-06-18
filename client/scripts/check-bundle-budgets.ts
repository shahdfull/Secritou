import fs from "node:fs";
import path from "node:path";

type Budget = {
  label: string;
  filePattern: RegExp;
  maxBytes: number;
};

const cwdDist = path.resolve("dist");
const clientDist = fs.existsSync(cwdDist) ? cwdDist : path.resolve("client/dist");
const budgets: Budget[] = [
  { label: "javascript", filePattern: /\.js$/i, maxBytes: 350 * 1024 },
  { label: "css", filePattern: /\.css$/i, maxBytes: 120 * 1024 },
];

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

const files = walk(clientDist);
const chunks = files.filter((file) => budgets.some((budget) => budget.filePattern.test(file)));

if (chunks.length === 0) {
  console.error(`No bundle artifacts found in ${clientDist}. Run the client build first.`);
  process.exit(1);
}

let failed = false;
for (const budget of budgets) {
  const matching = files.filter((file) => budget.filePattern.test(file));
  const totalBytes = matching.reduce((sum, file) => sum + fs.statSync(file).size, 0);
  const totalKb = Math.round((totalBytes / 1024) * 10) / 10;
  const maxKb = Math.round((budget.maxBytes / 1024) * 10) / 10;

  const oversized = matching.filter((file) => fs.statSync(file).size > budget.maxBytes);

  if (totalBytes > budget.maxBytes * 4 || oversized.length > 0) {
    failed = true;
    console.error(`Bundle budget exceeded for ${budget.label}: ${totalKb} KiB aggregate > ${maxKb} KiB per-file budget`);
    for (const file of matching.sort()) {
      const sizeKb = Math.round((fs.statSync(file).size / 1024) * 10) / 10;
      console.error(`  - ${path.relative(process.cwd(), file)}: ${sizeKb} KiB`);
    }
  } else {
    console.log(`Bundle budget ok for ${budget.label}: ${totalKb} KiB <= ${maxKb} KiB`);
  }
}

if (failed) {
  process.exit(1);
}
