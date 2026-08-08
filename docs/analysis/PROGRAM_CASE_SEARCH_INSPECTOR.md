# AI Search Data Inspector

## 실행

```powershell
cd apps/backend
npm.cmd run program-case-search-corpus -- --all
npm.cmd run dev

cd ../frontend
npm.cmd run dev
```

브라우저에서 `http://localhost:3000/ai-search-data-inspector`를 연다.

## 기능

제목·ProgramCase ID·Group ID 검색과 파일 유형, 공유 binary, 안전 상태 필터를 제공한다. 상세 화면은 원천 공개 필드, Attachment 구조, section/candidate/safety, 그룹 근거, Core-only/Safe corpus, raw JSON을 보여준다. PNG/JPEG는 원본 preview 위에 OCR block overlay를 선택적으로 표시한다. PDF/HWP는 이번 MVP에서 구조 결과를 표시한다.

Frontend는 `.local`을 직접 읽지 않고 Next.js proxy를 거쳐 backend 내부 API만 호출한다. API는 read-only이며 `Cache-Control: no-store`, SHA-256 allowlist, 고정 asset root 검증을 적용한다. production에서는 `ENABLE_PROGRAM_CASE_SEARCH_INSPECTOR=true`가 없으면 404다. 수정·삭제·DB write API는 없다.

## 한계

field/line/section/candidate overlay 버튼은 확장 지점이며 현재 실제 geometry overlay는 OCR block에만 구현됐다. PDF/HWP 전용 viewer는 제공하지 않는다. Inspector는 개발·검수 도구이며 운영 공개를 전제로 하지 않는다.
