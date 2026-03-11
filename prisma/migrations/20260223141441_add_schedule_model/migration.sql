-- CreateTable
CREATE TABLE "Schedule" (
    "id" SERIAL NOT NULL,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "observation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "jobId" INTEGER NOT NULL,

    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Schedule_jobId_idx" ON "Schedule"("jobId");

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
