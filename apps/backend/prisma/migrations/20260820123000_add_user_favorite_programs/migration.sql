CREATE TABLE "UserFavoriteProgram" (
    "userId" TEXT NOT NULL,
    "programSourceId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserFavoriteProgram_pkey" PRIMARY KEY ("userId", "programSourceId")
);

CREATE INDEX "UserFavoriteProgram_programSourceId_idx" ON "UserFavoriteProgram"("programSourceId");
CREATE INDEX "UserFavoriteProgram_userId_createdAt_idx" ON "UserFavoriteProgram"("userId", "createdAt");

ALTER TABLE "UserFavoriteProgram" ADD CONSTRAINT "UserFavoriteProgram_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserFavoriteProgram" ADD CONSTRAINT "UserFavoriteProgram_programSourceId_fkey"
FOREIGN KEY ("programSourceId") REFERENCES "ProgramBoardEntry"("sourceId") ON DELETE CASCADE ON UPDATE CASCADE;
