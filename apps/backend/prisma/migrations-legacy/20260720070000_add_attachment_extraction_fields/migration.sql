CREATE TYPE "AttachmentExtractionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

ALTER TABLE "ProgramCaseAttachment"
  ALTER COLUMN "fileType" DROP NOT NULL,
  ALTER COLUMN "extractionStatus" DROP DEFAULT,
  ALTER COLUMN "extractionStatus" TYPE "AttachmentExtractionStatus"
    USING ("extractionStatus"::"AttachmentExtractionStatus"),
  ALTER COLUMN "extractionStatus" SET DEFAULT 'PENDING',
  ADD COLUMN "detectedFileType" TEXT,
  ADD COLUMN "detectedMimeType" TEXT,
  ADD COLUMN "fileSizeBytes" INTEGER,
  ADD COLUMN "checksumSha256" TEXT,
  ADD COLUMN "rawText" TEXT,
  ADD COLUMN "cleanedText" TEXT,
  ADD COLUMN "extractorType" TEXT,
  ADD COLUMN "extractorVersion" TEXT,
  ADD COLUMN "failureCode" TEXT,
  ADD COLUMN "failureMessage" TEXT,
  ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastAttemptedAt" TIMESTAMP(3),
  ADD COLUMN "extractedAt" TIMESTAMP(3),
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
