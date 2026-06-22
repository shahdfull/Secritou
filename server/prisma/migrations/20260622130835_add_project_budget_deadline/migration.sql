-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "budget" VARCHAR(255),
ADD COLUMN     "deadline" TIMESTAMPTZ(6);
