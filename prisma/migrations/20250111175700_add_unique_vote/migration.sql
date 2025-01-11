/*
  Warnings:

  - A unique constraint covering the columns `[pickId,guessUserId]` on the table `Vote` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Vote_pickId_key";

-- CreateIndex
CREATE UNIQUE INDEX "Vote_pickId_guessUserId_key" ON "Vote"("pickId", "guessUserId");
