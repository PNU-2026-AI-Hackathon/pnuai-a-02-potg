-- 자유게시판에 속한 공유 게시글 데이터만 제거한다.
-- ideas, library-news 등 다른 CommunityPost 게시판 데이터는 유지한다.
DELETE FROM "CommunityPost"
WHERE "boardSlug" = 'free';

-- 더 이상 Prisma 모델이나 API에서 사용하지 않는 자유게시판 전용 테이블을 제거한다.
DROP TABLE IF EXISTS "BoardPost";
