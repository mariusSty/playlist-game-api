/*
  Warnings:

  - A unique constraint covering the columns `[pin]` on the table `Room` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Room_pin_key" ON "Room"("pin");
