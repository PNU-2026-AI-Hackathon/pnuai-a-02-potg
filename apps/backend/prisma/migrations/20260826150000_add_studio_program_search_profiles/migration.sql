CREATE TABLE "StudioProgramSearchProfile" (
  "id" TEXT NOT NULL,
  "sourceId" INTEGER NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "target" TEXT,
  "libraryName" TEXT,
  "summary" TEXT NOT NULL,
  "profileData" JSONB NOT NULL,
  "embeddingText" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "modelRevision" TEXT NOT NULL,
  "embeddingVersion" TEXT NOT NULL,
  "dimension" INTEGER NOT NULL,
  "embedding" vector(1024) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StudioProgramSearchProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudioProgramSearchProfile_sourceId_key"
  ON "StudioProgramSearchProfile"("sourceId");
CREATE INDEX "StudioProgramSearchProfile_model_idx"
  ON "StudioProgramSearchProfile"("provider", "model", "modelRevision");
