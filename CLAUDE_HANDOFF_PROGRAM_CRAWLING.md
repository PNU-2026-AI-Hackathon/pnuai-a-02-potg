# Claude 인수인계: 금정구 프로그램 크롤링·정제 후속 작업

## 이 문서의 목적

이 문서는 금정구 공공예약 서비스의 작은도서관 프로그램 데이터를 모이라 프로그램 게시판에 맞게 정제하는 작업의 현재 상태와 후속 계획을 전달한다.

Claude가 이 문서를 처음 읽고 수행할 작업은 **구현이 아니라 다음 GitHub 이슈 초안 작성**이다. 아래의 `Claude에게 바로 요청할 첫 작업`을 먼저 수행하고, 사용자의 별도 지시 전에는 351건 전체 변환이나 UI 수정에 착수하지 않는다.

## 현재 Git 상태

- 기준 브랜치: `main`
- 최신 원격 main 반영 완료
- 현재 HEAD: `02c1cfa Merge pull request #145 from PNU-2026-AI-Hackathon/feat/program-attachment-inventory`
- 병합된 핵심 커밋: `bf67448 feat: 프로그램 첨부 정제 규칙 확장`
- PR #145에서 대표 HWP/PDF 20건의 첨부 정제 규칙과 검수 UI가 병합됨
- `.claude/`는 사용자 소유 미추적 디렉터리이므로 수정하거나 커밋하지 말 것

작업을 시작할 때 반드시 다음을 확인한다.

```powershell
git branch --show-current
git status --short --branch
git log -5 --oneline
```

## 전체 목표

금정구 공공예약 서비스에서 크롤링한 프로그램 351건을 모이라 프로그램 게시판 구조로 정제한다.

정제 결과는 단순히 원문을 복사하는 것이 아니라 다음 네 영역으로 나눈다.

1. 프로그램 기본 정보
2. 프로그램 내용
3. 이용 안내
4. 첨부파일

프로그램 내용에는 가능하면 회차별 활동, 세부 커리큘럼, 선정도서, 준비물, 교수방법, 참고 이미지 등을 구조화해 표시한다. 기본 정보와 반복되는 본문·첨부 내용은 제거하되 목표와 소개처럼 사용자에게 필요한 의미 정보까지 제거해서는 안 된다.

LLM API는 비용 문제로 사용하지 않는 것이 기본 방침이다. 규칙 기반 파서, 문서 표 구조, 로컬 추출 모듈을 우선 사용한다. OCR은 별도 비용·정확도 정책이 확정되기 전까지 자동 호출하지 않는다.

## 지금까지 완료한 작업

### 1. 텍스트형 프로그램 정제

- 본문 텍스트 또는 HTML 표 중심의 대표 프로그램을 정제함
- 기본 정보와 본문 중복 제거
- 프로그램 소개, 회차별 활동, 이용 안내 분류
- 모집인원이 기본정보와 본문에서 다르면 명확한 본문 언급을 우선하는 규칙 적용
- 온라인 접수 여부 줄바꿈 정리
- 프로그램 게시판 프로토타입 경로 구현

관련 문서:

- `PROGRAM_DATA_NORMALIZATION_RULES.md`
- `PR_140.md`

### 2. 텍스트+첨부 인벤토리와 처리 상태 모델

- 약 198건의 `text_with_supplement` 유형을 위한 첨부 인벤토리 생성 CLI 구현
- 본문 게시 가능 상태와 첨부 확인 상태를 분리
- 첨부가 있다는 이유만으로 본문을 무시하거나, 본문이 충분하다는 이유로 첨부를 생략하지 않도록 설계
- 다운로드·형식 판별·HWP/PDF 추출 모듈을 실제 금정구 표본으로 재검증

관련 파일:

- `ISSUE_PROGRAM_ATTACHMENT_ENRICHMENT.md`
- `PROGRAM_ATTACHMENT_VALIDATION_RESULTS.md`
- `apps/backend/src/cli/buildProgramAttachmentInventory.ts`
- `apps/backend/src/cli/validateGeumjeongAttachmentSamples.ts`

### 3. 대표 HWP 10건 + PDF 10건 정제

대표 20건에서 총 160회차를 구조화했다.

- 프로그램 구간 선택 성공: 20건
- 회차 구조화 프로그램: 20건
- 구조화된 회차: 160개
- 자동 검토 후보: 17건
- 값 충돌로 수동 검수 필요: 3건

`자동 검토 후보`는 자동 게시 승인이 아니다. 사람이 원본과 비교할 수 있는 상태라는 의미다.

관련 문서:

- `PROGRAM_ATTACHMENT_ENRICHMENT_RESULTS.md`
- `PROGRAM_ATTACHMENT_MERGE_RESULTS.md`
- `PROGRAM_ATTACHMENT_REVIEW_UI_RESULTS.md`
- `PR_PROGRAM_ATTACHMENT_ENRICHMENT.md`

### 4. 검수 UI

로컬 개발 서버 실행 후 다음 경로에서 대표 20건을 확인할 수 있다.

```text
http://127.0.0.1:3000/programs/attachment-review
http://127.0.0.1:3000/programs/attachment-review/{sourceId}
```

상세 화면에는 다음이 표시된다.

- 공공예약 원문과 원사이트 링크
- 자동 선택한 첨부 구간과 첨부 링크
- 신규 추가·중복 제거·잡음 폐기·충돌 내역
- 최종 게시판 미리보기
- 회차별 활동, 교수방법, 준비물, 비고, 참고도서, 참고 이미지

관련 파일:

- `apps/frontend/src/app/programs/attachment-review/page.tsx`
- `apps/frontend/src/app/programs/attachment-review/[sourceId]/page.tsx`
- `apps/frontend/src/lib/program-attachment-review.ts`

## 확정된 핵심 정제 규칙

### 기본 원칙

1. 공공예약 상단 정형 테이블의 기본 정보는 기준값으로 유지한다.
2. 본문·첨부와 기본 정보가 같으면 한 번만 표시한다.
3. 목표·프로그램 소개는 프로그램명과 같은 추출 문자열에 붙어 있더라도 셀 경계를 먼저 복원한 뒤 중복을 판단한다.
4. 값이 다르면 임의로 덮어쓰지 않고 충돌 근거와 함께 수동 검수 대상으로 보낸다.
5. 첨부 전체 원문을 최종 게시판에 그대로 반복 표시하지 않는다.
6. 개인정보가 포함될 수 있는 수강신청자 목록은 수집·표시하지 않는다.

### 영역 배치

- 기본 정보: 운영 도서관, 강사, 대상, 모집인원, 교육기간, 교육시간, 신청기간, 온라인 접수 여부, 비용 등
- 프로그램 내용: 목표, 소개, 회차별 활동, 프로그램 전체 참고자료
- 이용 안내: 비대면 전환, 일정 변경, 취소·대기, 장애인 전화접수, 재료 배부 등
- 첨부파일: 원본 HWP/PDF/이미지 링크

### HWP 규칙

- 기본 파서가 도형 속 회차 제목을 놓치면 `hwp.js` 보조 파서를 사용한다.
- 표 셀 안의 참고도서명과 임베디드 이미지를 추출한다.
- 이미지와 회차의 셀 연결이 확인될 때만 해당 회차에 배치한다.
- HWP 체크박스의 `온라인 가능 여부`는 `온라인 접수 여부`와 구분한다.

관련 파일:

- `apps/backend/src/services/programAttachmentEnrichment/hwpAlternativeExtractor.ts`
- `apps/backend/src/services/programAttachmentEnrichment/hwpEmbeddedContentExtractor.ts`
- `apps/backend/src/cli/inspectHwpEmbeddedImages.ts`

### PDF 규칙

- 평탄화된 PDF 텍스트보다 원본 표 셀 구조를 우선한다.
- 공백·기호·태그 차이를 제거해 제목을 비교한다.
- `창의력up`처럼 중간 문구가 추가되어도 핵심 제목 단어가 일치하면 후보로 인정한다.
- 여러 프로그램이 들어 있는 공유 PDF는 프로그램별 페이지를 선택한다.
- 동일 파일명의 원 URL이 실패하면 검증 가능한 다른 정상 URL을 탐색한다.
- `차시(날짜)` 같은 결합 머리글을 처리한다.
- 다음 페이지로 이어지는 회차 표를 연결한다.
- 병합 셀의 분류는 병합 범위의 회차에 상속한다.
- 교수방법, 준비물, 비고는 하나로 합치지 않고 독립 필드로 보존한다.
- 표 내부 이미지 수와 회차 수가 일치하고 순서가 확인될 때만 회차 이미지로 연결한다.
- 이미지 수가 다르거나 셀 연결 근거가 없으면 자동 배치하지 않고 검수 대상으로 보낸다.

관련 파일:

- `apps/backend/src/services/programAttachmentEnrichment/documentCurriculumExtractor.ts`
- `apps/backend/src/services/programAttachmentEnrichment/sectionMatcher.ts`
- `apps/backend/src/services/programAttachmentEnrichment/mergeProgramAttachment.ts`
- `apps/backend/src/cli/buildProgramAttachmentEnrichmentSamples.ts`
- `apps/backend/src/cli/buildProgramAttachmentMergedSamples.ts`

### 회차 UI 규칙

공통 데이터 필드는 다음과 같다.

- `session`
- `date`
- `category`
- `activity`
- `teachingMethod`
- `materials`
- `notes`
- `referenceBooks`
- `referenceImages`

UI는 값이 있는 경우에만 `교수방법`, `준비물`, `비고` 열을 표시한다. 최종 표 너비와 이미지 크기는 전체 351건 적용 후 별도 UI 이슈에서 조정한다.

## 대표적으로 해결한 예외

- `2456 알콩달콩 책놀이 세상`: HWP 도형 속 회차 제목 복원
- `2484 마음과 만나는 그림책 테라피`: 참고도서명과 표지 8개 연결
- `2700 책과 나를 연결하는 하브루타`: 공유 PDF 4페이지에서 8회차 복원
- `2701 보드게임이랑 놀자`: 목표 복원, 교수방법 열 분리
- `2702 어린이 과학탐구교실`: 결합 머리글, 8회차 이미지, 비대면 변경 안내 복원
- `2703 Reading with phonics`: 프로그램 소개와 교수방법 복원
- `2704 I Love story`: 실패 URL 대체, 목표, 책 표지 8개, sub-books 복원
- `2705 영어로 배우는 사회과학`: Society·Policy·Math·Science 병합 셀과 일자별 도서명·표지 분리
- `2706 생각톡톡! 미술아 놀자`: 2페이지 연속 표, 강의목표 경계, 준비물과 이미지 복원

## 재현 명령

크롤링 입력 파일은 `.local/geumjeong-small-library-crawl/`의 최신 JSON을 사용한다. `.local` 산출물은 저장소에 커밋하지 않는다.

```powershell
cd apps/backend

# 첨부 인벤토리
npm run program-attachment-inventory:build

# 실제 첨부 모듈 표본 검증
npm run program-attachment-samples:validate -- --per-type 2

# 대표 HWP/PDF 20건 생성
npm run program-attachment-enrichment:samples -- --per-type 10

# 본문·첨부 병합
npm run program-attachment-merge:samples
```

테스트 환경 변수와 명령:

```powershell
cd apps/backend
$env:PROGRAM_BOARD_CRAWL='.local/geumjeong-small-library-crawl/<crawl-file>.json'
$env:PROGRAM_ATTACHMENT_ENRICHMENT='.local/program-attachment-enrichment/samples.json'
npm run test:program-attachment-inventory
npm run test:program-attachment-section-matcher
npm run test:program-attachment-merge

cd ../frontend
npx tsc --noEmit --incremental false
```

## 현재 알려진 한계

1. 확정된 HWP/PDF 규칙은 대표 20건에서 검증했으며 전체 351건에는 아직 일괄 적용하지 않았다.
2. 이미지·첨부만 있는 프로그램과 스캔 PDF는 OCR이 필요할 수 있다.
3. OCR 비용, 엔진, 최소 신뢰도, 사람 검수 정책은 아직 확정하지 않았다.
4. 이미지와 회차의 연결 근거가 약하면 자동 배치하지 않는다.
5. 자유문 라벨과 문서 형식이 새로운 유형이면 수동 검수 대상으로 보내야 한다.
6. 검수 UI의 표 너비와 이미지 크기는 데이터 형태에 따라 들쑥날쑥하며 최종 UI 이슈에서 조정한다.
7. 전체 351건을 사람이 처음부터 재작성하는 방식은 피한다. 자동 검증 실패 건만 사람이 확인하는 human-in-the-loop 방식을 사용한다.

## 앞으로의 권장 작업 순서

### 후속 이슈 A: 전체 351건 일괄 변환 및 검수 분류

- 대표 20건에서 확정한 파이프라인을 전체 크롤링 데이터에 적용
- 형식별 성공·실패·수동 검수 통계 생성
- 프로그램별 품질 검증 결과와 실패 사유 기록
- 자동 검수 통과 데이터와 수동 검수 대상을 분리
- OCR이 필요한 데이터는 비용을 발생시키지 않고 별도 큐로 분리
- 원문·정제 결과·근거를 추적할 수 있는 산출물 생성

### 후속 이슈 B: 실제 프로그램 게시판 연결 및 UI 마무리

- 전체 정제 결과를 실제 게시판 데이터 소스에 연결
- 표 열 너비, 줄바꿈, 이미지 크기와 반응형 UI 통일
- 신청하기 버튼, 접수 상태, 검색·필터 연결
- 임시 `/programs/attachment-review` UI와 운영 UI의 역할 분리

### 후속 이슈 C: 유사도 검색 데이터 구조

프로그램과 회차를 부모-자식 문서로 분리하는 방식을 권장한다.

- 부모 프로그램 검색 문서: 제목, 소개, 목표, 대상, 주제, 유형, 도서관, 회차 요약
- 자식 회차 문서: 프로그램 ID, 회차, 활동, 참고도서, 준비물, 활동 분류
- 날짜, 신청기간, 접수 상태, 비용, 도서관은 벡터 유사도보다 정형 필터로 처리
- 검색 순서: 프로그램 단위 검색 → 상위 프로그램 선정 → 해당 프로그램 내부 회차 검색 → 일치 회차와 프로그램 함께 표시

## Claude에게 바로 요청할 첫 작업

다음 GitHub 이슈를 만들기 위한 **이슈 초안 Markdown 문서만 작성**한다. 아직 구현하거나 새 브랜치를 만들지 않는다.

권장 제목:

```text
feat: 전체 351건 프로그램 첨부 정제 파이프라인 적용 및 검수 분류
```

이슈 초안에 반드시 포함할 내용:

1. 배경과 현재 대표 20건 검증 결과
2. 351건 전체를 대상으로 하는 정확한 범위
3. 텍스트·HWP·PDF·이미지·스캔 PDF별 처리 경로
4. 자동 검수 통과, 수동 검수 필요, OCR 필요, 추출 실패 상태 정의
5. 입력·출력 JSON 스키마 또는 필요한 필드
6. 원문 근거와 정제 결과 추적 방식
7. 중복 제거와 충돌 처리 원칙
8. 배치 실행 명령과 재시도 가능성
9. 형식별 성공률·실패 사유·사람 검수량 통계
10. 기존 대표 20건과 텍스트형 데이터 회귀 테스트
11. OCR은 자동 호출하지 않고 별도 대상으로 분리한다는 비용 원칙
12. 실제 게시판 UI 수정과 유사도 검색은 제외 범위로 명시
13. 단계별 작업 순서와 각 단계에서 사용자가 확인할 시점
14. 완료 조건과 후속 이슈

권장 파일명:

```text
ISSUE_PROGRAM_FULL_NORMALIZATION.md
```

이슈 초안을 작성한 뒤에는 사용자에게 제목, 파일명, 핵심 범위와 확인이 필요한 결정만 보고하고 다음 지시를 기다린다.

## 주의사항

- 문서와 코드에서 `자동 검토 후보`를 `자동 게시 승인`으로 표현하지 말 것
- 값이 충돌할 때 임의 선택하지 말 것
- 표 내부 이미지를 단순 추출 순서만으로 연결하지 말고 회차 수와 문서 구조 근거를 확인할 것
- 원본 첨부 전체 텍스트를 최종 게시판에 반복 노출하지 말 것
- `.claude/`, `.local/`, 사용자 첨부파일을 임의로 커밋하지 말 것
- 전체 변환 전에 반드시 이슈 초안과 단계 구성을 사용자에게 승인받을 것
