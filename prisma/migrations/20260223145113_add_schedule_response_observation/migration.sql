-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- AlterTable
ALTER TABLE "Schedule" ADD COLUMN     "responseObservation" TEXT,
ADD COLUMN     "status" "ScheduleStatus" NOT NULL DEFAULT 'PENDING';
