CREATE TABLE "ProgramCase" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "sourceType" TEXT NOT NULL,
  "sourcePostId" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "targetAudience" TEXT NOT NULL,
  "instructor" TEXT NOT NULL,
  "capacity" INTEGER NOT NULL,
  "currentApplicants" INTEGER NOT NULL,
  "applicationStatus" TEXT NOT NULL,
  "educationStartDate" TIMESTAMP(3) NOT NULL,
  "educationEndDate" TIMESTAMP(3) NOT NULL,
  "educationStartDateText" TEXT NOT NULL,
  "educationEndDateText" TEXT NOT NULL,
  "location" TEXT,
  "feeText" TEXT,
  "preparationText" TEXT,
  "contactText" TEXT,
  "notices" TEXT NOT NULL,
  "rawText" TEXT NOT NULL,
  "hasUnparsedAttachments" BOOLEAN NOT NULL,
  "crawledAt" TIMESTAMP(3) NOT NULL,
  "requestSucceeded" BOOLEAN NOT NULL,
  "parseWarnings" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProgramCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProgramCaseSession" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "programCaseId" TEXT NOT NULL,
  "sessionNumber" INTEGER NOT NULL,
  "sessionDate" TIMESTAMP(3),
  "dateText" TEXT NOT NULL,
  "activity" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProgramCaseSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProgramCaseAttachment" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "programCaseId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "fileType" TEXT NOT NULL,
  "extractionStatus" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProgramCaseAttachment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProgramCase_sourceType_sourcePostId_key"
  ON "ProgramCase"("sourceType", "sourcePostId");
CREATE INDEX "ProgramCase_applicationStatus_idx" ON "ProgramCase"("applicationStatus");
CREATE INDEX "ProgramCase_educationStartDate_idx" ON "ProgramCase"("educationStartDate");
CREATE INDEX "ProgramCase_educationEndDate_idx" ON "ProgramCase"("educationEndDate");

CREATE UNIQUE INDEX "ProgramCaseSession_programCaseId_sessionNumber_key"
  ON "ProgramCaseSession"("programCaseId", "sessionNumber");

CREATE UNIQUE INDEX "ProgramCaseAttachment_programCaseId_fileUrl_key"
  ON "ProgramCaseAttachment"("programCaseId", "fileUrl");

ALTER TABLE "ProgramCaseSession"
  ADD CONSTRAINT "ProgramCaseSession_programCaseId_fkey"
  FOREIGN KEY ("programCaseId") REFERENCES "ProgramCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProgramCaseAttachment"
  ADD CONSTRAINT "ProgramCaseAttachment_programCaseId_fkey"
  FOREIGN KEY ("programCaseId") REFERENCES "ProgramCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
