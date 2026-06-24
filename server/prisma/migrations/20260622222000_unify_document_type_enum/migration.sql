-- Unify DocumentType: drop the legacy "type" column, rename "enhancedType" → "type".
-- The DocumentType enum already contains all values from both columns, so no enum change needed.

-- Step 1: Copy enhancedType into type (in case any query reads type before the rename)
UPDATE "Document" SET "type" = "enhancedType"::text::"DocumentType";

-- Step 2: Drop old indexes on type and enhancedType
DROP INDEX IF EXISTS "Document_type_idx";
DROP INDEX IF EXISTS "Document_enhancedType_idx";
DROP INDEX IF EXISTS "Document_companyId_type_idx";
DROP INDEX IF EXISTS "Document_companyId_enhancedType_idx";

-- Step 3: Drop the old type column
ALTER TABLE "Document" DROP COLUMN "type";

-- Step 4: Rename enhancedType → type
ALTER TABLE "Document" RENAME COLUMN "enhancedType" TO "type";

-- Step 5: Recreate indexes under their new names
CREATE INDEX "Document_type_idx" ON "Document"("type");
CREATE INDEX "Document_companyId_type_idx" ON "Document"("companyId", "type");
