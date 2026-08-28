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

CREATE INDEX "BoardPost_category_idx" ON "BoardPost"("category");
CREATE INDEX "BoardPost_createdAt_idx" ON "BoardPost"("createdAt");
