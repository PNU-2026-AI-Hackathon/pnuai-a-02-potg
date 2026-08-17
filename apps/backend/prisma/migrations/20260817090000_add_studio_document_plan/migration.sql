-- 기획서의 항목 구조를 문서와 함께 보관한다.
-- 본문(content)은 사람이 읽는 글이라 다시 항목으로 쪼갤 수 없어서,
-- 이 열이 없으면 문서를 다시 열었을 때 항목 단위 수정 결과가 사라진 것처럼 보인다.
ALTER TABLE "StudioDocument" ADD COLUMN IF NOT EXISTS "plan" JSONB;
