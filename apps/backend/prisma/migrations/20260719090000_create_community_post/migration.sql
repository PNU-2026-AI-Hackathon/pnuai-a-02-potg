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

CREATE INDEX "CommunityPost_boardSlug_idx" ON "CommunityPost"("boardSlug");
CREATE INDEX "CommunityPost_type_idx" ON "CommunityPost"("type");
CREATE INDEX "CommunityPost_createdAt_idx" ON "CommunityPost"("createdAt");
