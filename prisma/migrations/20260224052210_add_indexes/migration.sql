-- AlterTable
ALTER TABLE "_GameToUser" ADD CONSTRAINT "_GameToUser_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_GameToUser_AB_unique";

-- CreateIndex
CREATE INDEX "Game_roomId_idx" ON "Game"("roomId");

-- CreateIndex
CREATE INDEX "Pick_roundId_idx" ON "Pick"("roundId");

-- CreateIndex
CREATE INDEX "Pick_trackId_idx" ON "Pick"("trackId");

-- CreateIndex
CREATE INDEX "Pick_userId_idx" ON "Pick"("userId");

-- CreateIndex
CREATE INDEX "Round_gameId_idx" ON "Round"("gameId");

-- CreateIndex
CREATE INDEX "Round_themeMasterId_idx" ON "Round"("themeMasterId");

-- CreateIndex
CREATE INDEX "User_roomId_idx" ON "User"("roomId");

-- CreateIndex
CREATE INDEX "Vote_pickId_idx" ON "Vote"("pickId");

-- CreateIndex
CREATE INDEX "Vote_guessedUserId_idx" ON "Vote"("guessedUserId");

-- CreateIndex
CREATE INDEX "Vote_guessUserId_idx" ON "Vote"("guessUserId");
