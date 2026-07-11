CREATE TYPE "AccountType" AS ENUM ('RESIDENT', 'LIBRARIAN', 'ADMIN');
CREATE TYPE "Gender" AS ENUM ('FEMALE', 'MALE', 'OTHER');

ALTER TABLE "User"
  ADD COLUMN "userId" TEXT,
  ADD COLUMN "accountType" "AccountType" NOT NULL DEFAULT 'RESIDENT',
  ADD COLUMN "gender" "Gender",
  ADD COLUMN "birthDate" TIMESTAMP(3),
  ADD COLUMN "region" TEXT,
  ADD COLUMN "phone" TEXT;

CREATE UNIQUE INDEX "User_userId_key" ON "User"("userId");

CREATE TABLE "Interest" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Interest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserInterest" (
  "userId" TEXT NOT NULL,
  "interestId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserInterest_pkey" PRIMARY KEY ("userId", "interestId")
);

CREATE UNIQUE INDEX "Interest_name_key" ON "Interest"("name");
CREATE INDEX "UserInterest_interestId_idx" ON "UserInterest"("interestId");

ALTER TABLE "UserInterest"
  ADD CONSTRAINT "UserInterest_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserInterest"
  ADD CONSTRAINT "UserInterest_interestId_fkey"
  FOREIGN KEY ("interestId") REFERENCES "Interest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "Interest" ("id", "name", "updatedAt") VALUES
  ('reading', '독서', CURRENT_TIMESTAMP),
  ('children', '아동', CURRENT_TIMESTAMP),
  ('youth', '청소년', CURRENT_TIMESTAMP),
  ('senior', '노년층', CURRENT_TIMESTAMP),
  ('digital-education', '디지털 교육', CURRENT_TIMESTAMP),
  ('environment', '환경', CURRENT_TIMESTAMP),
  ('culture-art', '문화예술', CURRENT_TIMESTAMP),
  ('career', '진로', CURRENT_TIMESTAMP),
  ('writing', '글쓰기', CURRENT_TIMESTAMP),
  ('local-issues', '지역문제', CURRENT_TIMESTAMP);
