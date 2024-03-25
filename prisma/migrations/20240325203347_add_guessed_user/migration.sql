/*
  Warnings:

  - You are about to drop the column `userId` on the `Guess` table. All the data in the column will be lost.
  - Added the required column `guessUserId` to the `Guess` table without a default value. This is not possible if the table is not empty.
  - Added the required column `guessedUserId` to the `Guess` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Guess" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "roundId" INTEGER NOT NULL,
    "songId" INTEGER NOT NULL,
    "guessedUserId" TEXT NOT NULL,
    "guessUserId" TEXT NOT NULL,
    CONSTRAINT "Guess_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Guess_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Guess_guessedUserId_fkey" FOREIGN KEY ("guessedUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Guess_guessUserId_fkey" FOREIGN KEY ("guessUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Guess" ("id", "roundId", "songId") SELECT "id", "roundId", "songId" FROM "Guess";
DROP TABLE "Guess";
ALTER TABLE "new_Guess" RENAME TO "Guess";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
