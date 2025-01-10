/*
  Warnings:

  - You are about to drop the `Guess` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Song` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Step` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Theme` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `songId` on the `Pick` table. All the data in the column will be lost.
  - You are about to drop the column `actualRoundId` on the `Game` table. All the data in the column will be lost.
  - You are about to drop the column `isFinished` on the `Round` table. All the data in the column will be lost.
  - You are about to drop the column `stepId` on the `Round` table. All the data in the column will be lost.
  - You are about to drop the column `themeId` on the `Round` table. All the data in the column will be lost.
  - You are about to drop the column `isFinished` on the `Vote` table. All the data in the column will be lost.
  - You are about to drop the column `roundId` on the `Vote` table. All the data in the column will be lost.
  - You are about to drop the column `songId` on the `Vote` table. All the data in the column will be lost.
  - Added the required column `song` to the `Pick` table without a default value. This is not possible if the table is not empty.
  - Added the required column `theme` to the `Round` table without a default value. This is not possible if the table is not empty.
  - Added the required column `guessUserId` to the `Vote` table without a default value. This is not possible if the table is not empty.
  - Added the required column `guessedUserId` to the `Vote` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pickId` to the `Vote` table without a default value. This is not possible if the table is not empty.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Guess";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Song";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Step";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Theme";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Pick" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "roundId" INTEGER NOT NULL,
    "song" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteId" INTEGER,
    CONSTRAINT "Pick_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Pick_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Pick" ("id", "roundId", "userId") SELECT "id", "roundId", "userId" FROM "Pick";
DROP TABLE "Pick";
ALTER TABLE "new_Pick" RENAME TO "Pick";
CREATE UNIQUE INDEX "Pick_roundId_userId_key" ON "Pick"("roundId", "userId");
CREATE TABLE "new_Game" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "roomId" INTEGER NOT NULL,
    "isFinished" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Game_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Game" ("id", "isFinished", "roomId") SELECT "id", "isFinished", "roomId" FROM "Game";
DROP TABLE "Game";
ALTER TABLE "new_Game" RENAME TO "Game";
CREATE UNIQUE INDEX "Game_roomId_key" ON "Game"("roomId");
CREATE TABLE "new_Round" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "gameId" INTEGER NOT NULL,
    "themeMasterId" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    CONSTRAINT "Round_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Round_themeMasterId_fkey" FOREIGN KEY ("themeMasterId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Round" ("gameId", "id", "themeMasterId") SELECT "gameId", "id", "themeMasterId" FROM "Round";
DROP TABLE "Round";
ALTER TABLE "new_Round" RENAME TO "Round";
CREATE UNIQUE INDEX "Round_themeMasterId_key" ON "Round"("themeMasterId");
CREATE TABLE "new_Vote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pickId" INTEGER NOT NULL,
    "guessedUserId" TEXT NOT NULL,
    "guessUserId" TEXT NOT NULL,
    CONSTRAINT "Vote_pickId_fkey" FOREIGN KEY ("pickId") REFERENCES "Pick" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Vote_guessedUserId_fkey" FOREIGN KEY ("guessedUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Vote_guessUserId_fkey" FOREIGN KEY ("guessUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Vote" ("id") SELECT "id" FROM "Vote";
DROP TABLE "Vote";
ALTER TABLE "new_Vote" RENAME TO "Vote";
CREATE UNIQUE INDEX "Vote_pickId_key" ON "Vote"("pickId");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
