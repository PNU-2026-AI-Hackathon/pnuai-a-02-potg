DELETE FROM "StudioDocument"
WHERE "ownerId" IS NULL;

ALTER TABLE "StudioDocument"
ALTER COLUMN "ownerId" SET NOT NULL;

ALTER TABLE "StudioDocument"
DROP CONSTRAINT IF EXISTS "StudioDocument_ownerId_fkey";

ALTER TABLE "StudioDocument"
ADD CONSTRAINT "StudioDocument_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
