import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const n = await p.siteContent.count();
console.log("SiteContent rows:", n);
if (n > 0) {
  const rows = await p.siteContent.findMany({ take: 3 });
  rows.forEach(r => console.log(" -", r.key, "=", r.value.slice(0, 50)));
}
await p.$disconnect();
