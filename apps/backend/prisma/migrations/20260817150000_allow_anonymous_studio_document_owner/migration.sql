-- 로그인 없이 만든 기획서가 저장되지 않던 것을 고친다.
--
-- 20260814140000 이 ownerId 를 NOT NULL 로 묶고 FK 를 ON DELETE CASCADE 로 걸었다.
-- 그 다음 20260815100000 이 익명 소유자(anonymousOwnerId)를 들여왔지만 NOT NULL 은
-- 풀지 않았다. 그래서 Prisma 스키마는 `ownerId String?` 인데 DB만 NOT NULL 로 남아,
-- 로그인하지 않은 사람이 기획서를 만들면 INSERT 가 23502 로 떨어졌다.
-- 화면에는 「저장하지 못했습니다」만 뜨고 원인이 드러나지 않는다.
ALTER TABLE "StudioDocument"
ALTER COLUMN "ownerId" DROP NOT NULL;

-- 주인이 탈퇴해도 문서는 남기고 주인만 지운다. CASCADE 로 두면 사람을 지울 때
-- 그 사람이 만든 기획서까지 같이 사라진다. 스키마(onDelete: SetNull)와도 어긋난다.
ALTER TABLE "StudioDocument"
DROP CONSTRAINT IF EXISTS "StudioDocument_ownerId_fkey";

ALTER TABLE "StudioDocument"
ADD CONSTRAINT "StudioDocument_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
