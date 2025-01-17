/*
  Warnings:

  - The primary key for the `Track` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `artists` on the `Track` table. All the data in the column will be lost.
  - Added the required column `artist` to the `Track` table without a default value. This is not possible if the table is not empty.
  - Added the required column `previewUrl` to the `Track` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Track" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "previewUrl" TEXT NOT NULL
);
INSERT INTO "new_Track" ("id", "title") SELECT "id", "title" FROM "Track";
DROP TABLE "Track";
ALTER TABLE "new_Track" RENAME TO "Track";
CREATE UNIQUE INDEX "Track_id_key" ON "Track"("id");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
