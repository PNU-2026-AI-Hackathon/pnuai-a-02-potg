CREATE TABLE "ProgramCaseDocument" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "programCaseId" TEXT NOT NULL,
  "documentType" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProgramCaseDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProgramCaseDocument_programCaseId_documentType_key"
  ON "ProgramCaseDocument"("programCaseId", "documentType");

CREATE INDEX "ProgramCaseDocument_documentType_idx"
  ON "ProgramCaseDocument"("documentType");

ALTER TABLE "ProgramCaseDocument"
  ADD CONSTRAINT "ProgramCaseDocument_programCaseId_fkey"
  FOREIGN KEY ("programCaseId") REFERENCES "ProgramCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
