/*
  Warnings:

  - A unique constraint covering the columns `[roundId,userId]` on the table `Pick` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Pick_roundId_userId_key" ON "Pick"("roundId", "userId");
