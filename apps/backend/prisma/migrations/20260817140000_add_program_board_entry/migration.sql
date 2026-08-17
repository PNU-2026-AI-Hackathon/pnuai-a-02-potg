-- 프로그램 게시판이 보여 주는 정제 결과를 담는다.
--
-- 그동안 프런트가 apps/backend/.local/program-board/programs.json 을 직접 읽었다.
-- 두 앱을 한 기계에서 띄울 때만 되는 방식이라, 프런트를 따로 배포하면 파일이 없어
-- 게시판이 빈 채로 열린다. 데이터를 DB에 두고 API로 내주기 위한 표다.
--
-- payload 는 정제 결과 전체다. 배치가 통째로 다시 만드는 산출물이라 관계형으로
-- 쪼개지 않는다. 나머지 열은 목록 화면이 거르고 세우는 데 쓰는 값만 꺼내 둔 것이다.
CREATE TABLE IF NOT EXISTS "ProgramBoardEntry" (
    "sourceId" INTEGER NOT NULL,
    "seriesKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "libraryName" TEXT,
    "targetGroup" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "occurrenceLabel" TEXT,
    -- 목록 카드가 모집인원을 보여 준다. capacity 가 없으면 원사이트 표기를 대신 띄운다.
    "capacity" INTEGER,
    "capacityText" TEXT,
    -- 날짜는 원본이 'YYYY-MM-DD' 글자이고 화면도 글자로 견준다.
    -- 시각으로 바꾸면 표준시 때문에 하루가 밀릴 수 있어 그대로 둔다.
    "programStartDate" TEXT,
    "programEndDate" TEXT,
    "applyStartDate" TEXT,
    "applyEndDate" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramBoardEntry_pkey" PRIMARY KEY ("sourceId")
);

CREATE INDEX IF NOT EXISTS "ProgramBoardEntry_seriesKey_idx" ON "ProgramBoardEntry"("seriesKey");
CREATE INDEX IF NOT EXISTS "ProgramBoardEntry_applyStartDate_idx" ON "ProgramBoardEntry"("applyStartDate");
