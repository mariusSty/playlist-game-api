/*
  Warnings:

  - You are about to drop the column `song` on the `Pick` table. All the data in the column will be lost.
  - Added the required column `trackId` to the `Pick` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "Track" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "artists" TEXT NOT NULL
);

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Pick" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "roundId" INTEGER NOT NULL,
    "trackId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Pick_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Pick_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Pick_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Pick" ("id", "roundId", "userId") SELECT "id", "roundId", "userId" FROM "Pick";
DROP TABLE "Pick";
ALTER TABLE "new_Pick" RENAME TO "Pick";
CREATE UNIQUE INDEX "Pick_roundId_userId_key" ON "Pick"("roundId", "userId");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
