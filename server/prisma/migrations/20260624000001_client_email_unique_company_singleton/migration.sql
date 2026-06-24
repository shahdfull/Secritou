-- #5: Add unique constraint on Client.email (NULL values are ignored by PG unique indexes)
CREATE UNIQUE INDEX "Client_email_key" ON "Client"("email") WHERE "email" IS NOT NULL;

-- #6: Add singleton column to Company to enforce at most one row
ALTER TABLE "Company" ADD COLUMN "singleton" BOOLEAN NOT NULL DEFAULT true;
CREATE UNIQUE INDEX "Company_singleton_key" ON "Company"("singleton");
