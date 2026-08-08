CREATE TYPE "ProgramCaseDocumentChunkType" AS ENUM ('CORE', 'SESSIONS', 'ATTACHMENT');

CREATE TABLE "ProgramCaseDocumentChunk" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "programCaseDocumentId" TEXT NOT NULL,
  "programCaseAttachmentId" TEXT,
  "chunkKey" TEXT NOT NULL,
  "chunkOrder" INTEGER NOT NULL,
  "chunkType" "ProgramCaseDocumentChunkType" NOT NULL,
  "sourceLabel" TEXT,
  "content" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "builderVersion" TEXT NOT NULL,
  "characterCount" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProgramCaseDocumentChunk_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProgramCaseDocumentChunk_programCaseDocumentId_chunkKey_key"
  ON "ProgramCaseDocumentChunk"("programCaseDocumentId", "chunkKey");

CREATE INDEX "ProgramCaseDocumentChunk_programCaseDocumentId_chunkOrder_idx"
  ON "ProgramCaseDocumentChunk"("programCaseDocumentId", "chunkOrder");

CREATE INDEX "ProgramCaseDocumentChunk_programCaseAttachmentId_idx"
  ON "ProgramCaseDocumentChunk"("programCaseAttachmentId");

CREATE INDEX "ProgramCaseDocumentChunk_chunkType_idx"
  ON "ProgramCaseDocumentChunk"("chunkType");

ALTER TABLE "ProgramCaseDocumentChunk"
  ADD CONSTRAINT "ProgramCaseDocumentChunk_programCaseDocumentId_fkey"
  FOREIGN KEY ("programCaseDocumentId") REFERENCES "ProgramCaseDocument"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProgramCaseDocumentChunk"
  ADD CONSTRAINT "ProgramCaseDocumentChunk_programCaseAttachmentId_fkey"
  FOREIGN KEY ("programCaseAttachmentId") REFERENCES "ProgramCaseAttachment"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
