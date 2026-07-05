import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Drop old table and re-create with bilingual schema
  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "SiteContent" CASCADE`);

  // Re-create enums if missing
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
    CREATE TABLE "SiteContent" (
      "id"        TEXT NOT NULL DEFAULT gen_random_uuid(),
      "key"       VARCHAR(120) NOT NULL,
      "locale"    VARCHAR(5) NOT NULL,
      "value"     TEXT NOT NULL,
      "type"      "SiteContentType" NOT NULL DEFAULT 'TEXT',
      "section"   "SiteContentSection" NOT NULL,
      "label"     VARCHAR(120) NOT NULL,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "SiteContent_pkey" PRIMARY KEY ("id")
    )
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "SiteContent" ADD CONSTRAINT "SiteContent_key_locale_key" UNIQUE ("key", "locale")
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX "SiteContent_locale_section_idx" ON "SiteContent"("locale", "section")
  `);

  console.log("✅ SiteContent table recreated (bilingual)");
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
