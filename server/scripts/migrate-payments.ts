import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

async function main() {
  const dropTable = hasFlag("--drop-table");
  const dryRun = !hasFlag("--apply");

  const invoicePaymentTable = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'InvoicePayment'
    ) AS "exists"
  `;

  const paymentTable = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'Payment'
    ) AS "exists"
  `;

  const legacyExists = invoicePaymentTable[0]?.exists ?? false;
  const paymentExists = paymentTable[0]?.exists ?? false;

  if (!paymentExists) {
    throw new Error('Payment table does not exist. Run prisma migrate first.');
  }

  const paymentHasInvoiceId = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'Payment'
        AND column_name = 'invoiceId'
    ) AS "exists"
  `;

  if (!legacyExists) {
    console.log("No legacy InvoicePayment table found. Nothing to migrate.");
    return;
  }

  const legacyCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count FROM "InvoicePayment"
  `;
  const targetCount = paymentHasInvoiceId[0]?.exists
    ? await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count FROM "Payment" WHERE "invoiceId" IS NOT NULL
      `
    : [{ count: 0n }];

  console.log(`Legacy rows: ${legacyCount[0]?.count ?? 0n}`);
  console.log(`Already migrated invoice-linked payments: ${targetCount[0]?.count ?? 0n}`);
  console.log(`Mode: ${dryRun ? "dry-run" : "apply"}`);

  if (dryRun) {
    console.log("No changes made. Re-run with --apply to migrate data.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    if (!paymentHasInvoiceId[0]?.exists) {
      await tx.$executeRaw`ALTER TABLE "Payment" ADD COLUMN "invoiceId" TEXT`;
      await tx.$executeRaw`ALTER TABLE "Payment" ADD COLUMN "method" TEXT`;
      await tx.$executeRaw`ALTER TABLE "Payment" ADD COLUMN "recordedById" TEXT`;
      await tx.$executeRaw`ALTER TABLE "Payment" ADD COLUMN "reference" TEXT`;
      await tx.$executeRaw`CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId")`;
      await tx.$executeRaw`CREATE INDEX "Payment_recordedById_idx" ON "Payment"("recordedById")`;
      await tx.$executeRaw`
        ALTER TABLE "Payment"
        ADD CONSTRAINT "Payment_invoiceId_fkey"
        FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE
      `;
      await tx.$executeRaw`
        ALTER TABLE "Payment"
        ADD CONSTRAINT "Payment_recordedById_fkey"
        FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
      `;
      await tx.$executeRaw`ALTER TABLE "Payment" ALTER COLUMN "onboardingStepId" DROP NOT NULL`;
    }

    await tx.$executeRaw`
      INSERT INTO "Payment" (
        "id",
        "invoiceId",
        "amount",
        "method",
        "reference",
        "recordedById",
        "paidAt",
        "createdAt",
        "updatedAt"
      )
      SELECT
        ip."id",
        ip."invoiceId",
        ip."amount",
        ip."method",
        ip."reference",
        ip."recordedById",
        ip."paidAt",
        ip."createdAt",
        ip."createdAt"
      FROM "InvoicePayment" ip
      WHERE NOT EXISTS (
        SELECT 1 FROM "Payment" p WHERE p."id" = ip."id"
      )
    `;

    const migrated = await tx.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM "Payment" WHERE "invoiceId" IS NOT NULL
    `;
    console.log(`Invoice-linked payments now in Payment: ${migrated[0]?.count ?? 0n}`);

    if (dropTable) {
      await tx.$executeRaw`DROP TABLE "InvoicePayment"`;
      console.log("Dropped legacy InvoicePayment table.");
    } else {
      console.log("Legacy InvoicePayment table kept in place. Use --drop-table to remove it.");
    }
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
