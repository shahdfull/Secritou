import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// Simulate what the service does
async function getFlat(locale) {
  const rows = await prisma.siteContent.findMany({ where: { locale }, orderBy: [{ section: "asc" }, { key: "asc" }] });
  const map = {};
  for (const r of rows) map[r.key] = r.value;
  return map;
}

const fr = await getFlat("fr");
const en = await getFlat("en");
console.log(`FR keys: ${Object.keys(fr).length}`);
console.log(`EN keys: ${Object.keys(en).length}`);
console.log("Sample FR hero.tagline:", fr["hero.tagline"]);
console.log("Sample EN hero.tagline:", en["hero.tagline"]);
console.log("Sample FR contact.title:", fr["contact.title"]);
console.log("Sample EN contact.title:", en["contact.title"]);
await prisma.$disconnect();
