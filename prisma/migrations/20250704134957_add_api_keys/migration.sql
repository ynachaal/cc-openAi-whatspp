-- CreateTable
CREATE TABLE "ApiKeys" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "googleSheetId" TEXT,
    "openaiKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ApiKeys_googleSheetId_key" ON "ApiKeys"("googleSheetId");
