ALTER TABLE "CommunityPost" ADD COLUMN "authorId" TEXT;
ALTER TABLE "CommunityComment" ADD COLUMN "authorId" TEXT;

CREATE TABLE "CommunityPostLike" (
  "userId" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommunityPostLike_pkey" PRIMARY KEY ("userId", "postId")
);

CREATE TABLE "CommunityPostSave" (
  "userId" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommunityPostSave_pkey" PRIMARY KEY ("userId", "postId")
);

CREATE INDEX "CommunityPost_authorId_createdAt_idx" ON "CommunityPost"("authorId", "createdAt");
CREATE INDEX "CommunityComment_authorId_createdAt_idx" ON "CommunityComment"("authorId", "createdAt");
CREATE INDEX "CommunityPostLike_postId_idx" ON "CommunityPostLike"("postId");
CREATE INDEX "CommunityPostLike_userId_createdAt_idx" ON "CommunityPostLike"("userId", "createdAt");
CREATE INDEX "CommunityPostSave_postId_idx" ON "CommunityPostSave"("postId");
CREATE INDEX "CommunityPostSave_userId_createdAt_idx" ON "CommunityPostSave"("userId", "createdAt");

ALTER TABLE "CommunityPost"
  ADD CONSTRAINT "CommunityPost_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CommunityComment"
  ADD CONSTRAINT "CommunityComment_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CommunityPostLike"
  ADD CONSTRAINT "CommunityPostLike_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityPostLike"
  ADD CONSTRAINT "CommunityPostLike_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommunityPostSave"
  ADD CONSTRAINT "CommunityPostSave_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityPostSave"
  ADD CONSTRAINT "CommunityPostSave_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
