/*
  Warnings:

  - Added the required column `requesterId` to the `Schedule` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Schedule" ADD COLUMN     "requesterId" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "Schedule_requesterId_idx" ON "Schedule"("requesterId");

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
