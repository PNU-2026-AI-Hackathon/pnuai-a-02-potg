CREATE TABLE "StudioDocumentVote" (
  "id" TEXT NOT NULL,
  "studioDocumentId" TEXT NOT NULL,
  "voterKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudioDocumentVote_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudioDocumentVote_studioDocumentId_fkey"
    FOREIGN KEY ("studioDocumentId") REFERENCES "StudioDocument"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "StudioDocumentVote_studioDocumentId_voterKey_key"
ON "StudioDocumentVote"("studioDocumentId", "voterKey");

CREATE INDEX "StudioDocumentVote_studioDocumentId_createdAt_idx"
ON "StudioDocumentVote"("studioDocumentId", "createdAt");
