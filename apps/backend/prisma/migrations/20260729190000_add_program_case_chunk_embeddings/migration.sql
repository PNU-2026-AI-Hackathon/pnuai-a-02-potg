BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE "ProgramCaseDocumentChunkEmbeddingStatus"
  AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

CREATE TABLE "ProgramCaseDocumentChunkEmbedding" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "programCaseDocumentChunkId" TEXT NOT NULL,
  "embedding" VECTOR(1024),
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "modelRevision" TEXT NOT NULL,
  "embeddingVersion" TEXT NOT NULL,
  "dimension" INTEGER NOT NULL,
  "embeddedContentHash" TEXT,
  "status" "ProgramCaseDocumentChunkEmbeddingStatus" NOT NULL DEFAULT 'PENDING',
  "failureCode" TEXT,
  "failureMessage" VARCHAR(500),
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lastAttemptedAt" TIMESTAMP(3),
  "embeddedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProgramCaseDocumentChunkEmbedding_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProgramCaseDocumentChunkEmbedding_dimension_check" CHECK ("dimension" = 1024)
);

CREATE UNIQUE INDEX "ProgramCaseChunkEmbedding_chunkId_key"
  ON "ProgramCaseDocumentChunkEmbedding"("programCaseDocumentChunkId");

CREATE INDEX "ProgramCaseDocumentChunkEmbedding_status_idx"
  ON "ProgramCaseDocumentChunkEmbedding"("status");

CREATE INDEX "ProgramCaseChunkEmbedding_modelRevision_idx"
  ON "ProgramCaseDocumentChunkEmbedding"("provider", "model", "modelRevision");

ALTER TABLE "ProgramCaseDocumentChunkEmbedding"
  ADD CONSTRAINT "ProgramCaseChunkEmbedding_chunkId_fkey"
  FOREIGN KEY ("programCaseDocumentChunkId") REFERENCES "ProgramCaseDocumentChunk"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
