-- CreateTable
CREATE TABLE "RoundReady" (
    "roundId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "RoundReady_roundId_idx" ON "RoundReady"("roundId");

-- CreateIndex
CREATE INDEX "RoundReady_userId_idx" ON "RoundReady"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RoundReady_roundId_userId_key" ON "RoundReady"("roundId", "userId");

-- AddForeignKey
ALTER TABLE "RoundReady" ADD CONSTRAINT "RoundReady_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundReady" ADD CONSTRAINT "RoundReady_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
