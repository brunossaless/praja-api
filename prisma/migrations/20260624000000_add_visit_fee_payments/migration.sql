-- CreateEnum
CREATE TYPE "PaymentPurpose" AS ENUM ('VISIT_FEE', 'BUDGET');

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_budgetId_fkey";

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "purpose" "PaymentPurpose" NOT NULL DEFAULT 'BUDGET',
ADD COLUMN     "scheduleId" INTEGER,
ALTER COLUMN "budgetId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Payment_scheduleId_idx" ON "Payment"("scheduleId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
