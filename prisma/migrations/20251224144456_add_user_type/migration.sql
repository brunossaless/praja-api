-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('WORKER', 'USER');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "type" "UserType" NOT NULL DEFAULT 'USER';
