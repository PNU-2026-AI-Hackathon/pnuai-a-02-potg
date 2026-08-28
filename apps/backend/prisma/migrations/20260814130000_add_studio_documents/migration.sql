CREATE TABLE IF NOT EXISTS "StudioDocument" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "ownerId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "stage" TEXT NOT NULL DEFAULT '기획 중',
  "conditions" JSONB,
  "agenda" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StudioDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StudioDocument_ownerId_updatedAt_idx" ON "StudioDocument"("ownerId", "updatedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'StudioDocument_ownerId_fkey'
  ) THEN
    ALTER TABLE "StudioDocument"
    ADD CONSTRAINT "StudioDocument_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
