-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('RESIDENT', 'LIBRARIAN', 'ADMIN');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('FEMALE', 'MALE', 'OTHER');

-- CreateEnum
CREATE TYPE "AttachmentExtractionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ProgramCaseDocumentChunkType" AS ENUM ('CORE', 'SESSIONS', 'ATTACHMENT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "accountType" "AccountType" NOT NULL DEFAULT 'RESIDENT',
    "gender" "Gender",
    "birthDate" TIMESTAMP(3),
    "region" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Interest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserInterest" (
    "userId" TEXT NOT NULL,
    "interestId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserInterest_pkey" PRIMARY KEY ("userId","interestId")
);

-- CreateTable
CREATE TABLE "CommunityPost" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "boardSlug" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityPost_pkey" PRIMARY KEY ("id")
);

-- Legacy table preserved for production schema compatibility.
CREATE TABLE "BoardPost" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "author" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BoardPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "ProgramCaseAttachment" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "programCaseId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT,
    "detectedFileType" TEXT,
    "detectedMimeType" TEXT,
    "fileSizeBytes" INTEGER,
    "checksumSha256" TEXT,
    "extractionStatus" "AttachmentExtractionStatus" NOT NULL DEFAULT 'PENDING',
    "rawText" TEXT,
    "cleanedText" TEXT,
    "extractorType" TEXT,
    "extractorVersion" TEXT,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptedAt" TIMESTAMP(3),
    "extractedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramCaseAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateIndex
CREATE UNIQUE INDEX "User_userId_key" ON "User"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "CommunityPost_boardSlug_idx" ON "CommunityPost"("boardSlug");

-- CreateIndex
CREATE INDEX "CommunityPost_type_idx" ON "CommunityPost"("type");

-- CreateIndex
CREATE INDEX "CommunityPost_createdAt_idx" ON "CommunityPost"("createdAt");

-- CreateIndex
CREATE INDEX "BoardPost_category_idx" ON "BoardPost"("category");

-- CreateIndex
CREATE INDEX "BoardPost_createdAt_idx" ON "BoardPost"("createdAt");

-- CreateIndex
CREATE INDEX "ProgramCase_applicationStatus_idx" ON "ProgramCase"("applicationStatus");

-- CreateIndex
CREATE INDEX "ProgramCase_educationStartDate_idx" ON "ProgramCase"("educationStartDate");

-- CreateIndex
CREATE INDEX "ProgramCase_educationEndDate_idx" ON "ProgramCase"("educationEndDate");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramCase_sourceType_sourcePostId_key" ON "ProgramCase"("sourceType", "sourcePostId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramCaseSession_programCaseId_sessionNumber_key" ON "ProgramCaseSession"("programCaseId", "sessionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramCaseAttachment_programCaseId_fileUrl_key" ON "ProgramCaseAttachment"("programCaseId", "fileUrl");

-- CreateIndex
CREATE INDEX "ProgramCaseDocument_documentType_idx" ON "ProgramCaseDocument"("documentType");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramCaseDocument_programCaseId_documentType_key" ON "ProgramCaseDocument"("programCaseId", "documentType");

-- CreateIndex
CREATE INDEX "ProgramCaseDocumentChunk_programCaseDocumentId_chunkOrder_idx" ON "ProgramCaseDocumentChunk"("programCaseDocumentId", "chunkOrder");

-- CreateIndex
CREATE INDEX "ProgramCaseDocumentChunk_programCaseAttachmentId_idx" ON "ProgramCaseDocumentChunk"("programCaseAttachmentId");

-- CreateIndex
CREATE INDEX "ProgramCaseDocumentChunk_chunkType_idx" ON "ProgramCaseDocumentChunk"("chunkType");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramCaseDocumentChunk_programCaseDocumentId_chunkKey_key" ON "ProgramCaseDocumentChunk"("programCaseDocumentId", "chunkKey");

-- AddForeignKey
ALTER TABLE "UserInterest" ADD CONSTRAINT "UserInterest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInterest" ADD CONSTRAINT "UserInterest_interestId_fkey" FOREIGN KEY ("interestId") REFERENCES "Interest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramCaseSession" ADD CONSTRAINT "ProgramCaseSession_programCaseId_fkey" FOREIGN KEY ("programCaseId") REFERENCES "ProgramCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramCaseAttachment" ADD CONSTRAINT "ProgramCaseAttachment_programCaseId_fkey" FOREIGN KEY ("programCaseId") REFERENCES "ProgramCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramCaseDocument" ADD CONSTRAINT "ProgramCaseDocument_programCaseId_fkey" FOREIGN KEY ("programCaseId") REFERENCES "ProgramCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramCaseDocumentChunk" ADD CONSTRAINT "ProgramCaseDocumentChunk_programCaseDocumentId_fkey" FOREIGN KEY ("programCaseDocumentId") REFERENCES "ProgramCaseDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramCaseDocumentChunk" ADD CONSTRAINT "ProgramCaseDocumentChunk_programCaseAttachmentId_fkey" FOREIGN KEY ("programCaseAttachmentId") REFERENCES "ProgramCaseAttachment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
