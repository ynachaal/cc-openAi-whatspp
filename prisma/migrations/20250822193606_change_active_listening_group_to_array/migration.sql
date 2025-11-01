/*
  Warnings:

  - You are about to drop the column `activeListeningGroup` on the `WhatsAppSession` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WhatsAppSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionName" TEXT NOT NULL,
    "isLoggedIn" BOOLEAN NOT NULL DEFAULT false,
    "activeListeningGroups" TEXT DEFAULT '[]',
    "firstAnalyzedMessageDate" DATETIME,
    "lastAnalyzedMessageDate" DATETIME,
    "lastUpdated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_WhatsAppSession" ("createdAt", "firstAnalyzedMessageDate", "id", "isLoggedIn", "lastAnalyzedMessageDate", "lastUpdated", "sessionName") SELECT "createdAt", "firstAnalyzedMessageDate", "id", "isLoggedIn", "lastAnalyzedMessageDate", "lastUpdated", "sessionName" FROM "WhatsAppSession";
DROP TABLE "WhatsAppSession";
ALTER TABLE "new_WhatsAppSession" RENAME TO "WhatsAppSession";
CREATE UNIQUE INDEX "WhatsAppSession_sessionName_key" ON "WhatsAppSession"("sessionName");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
