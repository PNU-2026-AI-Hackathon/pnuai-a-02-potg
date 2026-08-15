ALTER TABLE "StudioDocument"
ADD COLUMN IF NOT EXISTS "anonymousOwnerId" TEXT;

CREATE INDEX IF NOT EXISTS "StudioDocument_anonymousOwnerId_updatedAt_idx"
ON "StudioDocument"("anonymousOwnerId", "updatedAt");
