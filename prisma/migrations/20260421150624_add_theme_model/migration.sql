/*
  Migration: add Theme model, refactor Round.theme.

  - Drops Round.theme (string).
  - Adds Round.themeId (FK -> Theme, nullable) and Round.customTheme (text, nullable).
  - Preserves existing non-empty Round.theme values by copying them into Round.customTheme.
*/

-- CreateTable
CREATE TABLE "Theme" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,

    CONSTRAINT "Theme_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Theme_key_key" ON "Theme"("key");

-- AlterTable: add new columns first
ALTER TABLE "Round"
    ADD COLUMN "customTheme" TEXT,
    ADD COLUMN "themeId" INTEGER;

-- Data migration: move existing non-empty themes into customTheme
UPDATE "Round" SET "customTheme" = "theme" WHERE "theme" IS NOT NULL AND "theme" <> '';

-- AlterTable: drop the old column
ALTER TABLE "Round" DROP COLUMN "theme";

-- CreateIndex
CREATE INDEX "Round_themeId_idx" ON "Round"("themeId");

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme"("id") ON DELETE SET NULL ON UPDATE CASCADE;
