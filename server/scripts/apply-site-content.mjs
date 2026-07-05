import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  await prisma.$executeRawUnsafe(`
    DO $body$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SiteContentType') THEN
        CREATE TYPE "SiteContentType" AS ENUM ('TEXT', 'RICHTEXT', 'IMAGE', 'BOOLEAN');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SiteContentSection') THEN
        CREATE TYPE "SiteContentSection" AS ENUM ('HERO', 'SERVICES', 'ABOUT', 'TESTIMONIALS', 'CONTACT', 'SEO');
      END IF;
    END $body$
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "SiteContent" (
      "key"       TEXT NOT NULL,
      "value"     TEXT NOT NULL,
      "type"      "SiteContentType" NOT NULL DEFAULT 'TEXT',
      "section"   "SiteContentSection" NOT NULL,
      "label"     VARCHAR(120) NOT NULL,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "SiteContent_pkey" PRIMARY KEY ("key")
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "SiteContent_section_idx" ON "SiteContent"("section")`
  );
  console.log("✅ SiteContent table ready");
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
