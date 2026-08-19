# 금정구 프로그램 크롤링·정제 운영 가이드

이 문서는 금정구 공공예약 서비스의 작은도서관 프로그램을 다시 크롤링하고,
MOIRA 프로그램 게시판 데이터로 정제할 때 필요한 실행 기준만 모은 운영 문서다.
이슈 초안, PR 본문, 일회성 검수 기록은 이 문서로 합치고 따로 보관하지 않는다.

## 1. 작업 원칙

- 원문에 없는 내용을 추측해 만들지 않는다.
- 기본정보, 프로그램 내용, 이용 안내, 첨부파일을 분리한다.
- 기본정보와 본문·첨부에 같은 내용이 반복되면 게시 데이터에는 한 번만 둔다.
- 값이 충돌하면 임의로 덮어쓰지 않고 근거와 함께 검수 대상으로 보낸다.
- `AUTO_REVIEW_CANDIDATE`는 자동 게시 승인이 아니라 사람이 원본과 대조할 수 있는 상태다.
- 이미지 OCR 결과는 픽셀 추정이므로 회차 정보를 무리하게 자동 게시하지 않는다.
- 수강신청자 목록처럼 개인정보가 들어갈 수 있는 영역은 수집·표시하지 않는다.
- `.local/`, `.claude/`, 사용자 첨부파일, OCR 자격증명은 커밋하지 않는다.

## 2. 입력 데이터

크롤링 원본은 백엔드 작업 디렉터리 기준으로 아래 위치에 둔다.

```text
apps/backend/.local/geumjeong-small-library-crawl/geumjeong-small-library-programs-<stamp>.json
```

파일 구조는 `{ "records": [...] }`이고, 레코드 키는 `idx`를 사용한다.
스크립트는 파일명이 `geumjeong-small-library-programs-`로 시작하고 `.json`으로 끝나는
파일 중 사전순 마지막 파일을 최신 크롤로 읽는다.

n8n 워크플로우는 아래 파일이 기준이다.

```text
automation/n8n/geumjeong-program-crawler-workflow.json
```

기존 보관본 `automation/n8n/data/geumjeong-programs-349.json`은 2026-07-19 수동 실행 결과다.
그 실행은 35페이지, 349건, 상세 실패 0건이었다. 이후 정제 작업 기록은 351건 재크롤을 기준으로
작성되어 있으므로 새 작업에서는 반드시 최신 크롤 JSON을 다시 생성하거나 받아서 `.local`에 둔다.

## 3. 현재 알려진 데이터 구성

2026-08-15 전후 전체 정제 작업에서 확인한 351건 기준 수치다. 새로 크롤링하면 이 숫자는
반드시 다시 계산한다.

| 구분 | 건수 | 처리 |
| --- | ---: | --- |
| `text_only` | 18 | 본문 정제만으로 처리 |
| `text_with_supplement` | 198 | HWP/PDF는 문서 추출, 이미지는 OCR 큐 |
| `image_only` | 69 | 문서 첨부가 있으면 추출, 나머지는 OCR 큐 |
| `attachment_only` | 66 | 이미지 첨부 중심, OCR 큐 |
| `empty` | 0 | 없음 |

레코드 단위 처리 경로는 `DOC_EXTRACT` 83건, `TEXT_ONLY` 18건,
`TEXT_WITH_IMAGE` 126건, `NO_TEXT_IMAGE_ONLY` 124건이었다.
문서 첨부는 HWP 26개, PDF 57개였고 HWPX는 없었다.

최신 작업 기록상 정제 후에는 회차가 확보된 프로그램 244건, 전체 회차 1,759개,
본문만으로 화면 구성이 가능한 프로그램 227건, 회차도 본문도 없는 프로그램 21건이었다.

## 4. 실행 순서

작업 전 상태를 먼저 확인한다.

```powershell
git branch --show-current
git status --short --branch
git log -5 --oneline
```

백엔드 디렉터리로 이동해 최신 크롤 JSON을 기준으로 인벤토리를 만든다.

```powershell
cd apps/backend
npm run program-attachment-inventory:build -- --profile all
```

그다음 전체 배치를 경로별로 실행한다. 경로별 실행 결과는
`.local/program-attachment-batch/full.json`에 누적된다.

```powershell
npm run program-attachment-batch:run -- --route HWP_TEXT
npm run program-attachment-batch:run -- --route PDF_CLASSIFY
npm run program-attachment-batch:run -- --route TEXT_ONLY
npm run program-attachment-batch:run -- --route IMAGE_OCR
npm run program-attachment-batch:report
```

`IMAGE_OCR` 경로는 이 단계에서 OCR API를 호출하지 않는다. 이미지 대상 레코드를
`OCR_REQUIRED`로 분류하고 `ocr-queue.json`을 만든다.

부분 실행이나 재실행이 필요하면 아래 옵션을 쓴다.

```powershell
npm run program-attachment-batch:run -- --route PDF_CLASSIFY --limit 30
npm run program-attachment-batch:run -- --source-id 2708 2709
npm run program-attachment-batch:run -- --resume
npm run program-attachment-batch:run -- --retry-failed
```

정제 결과를 게시판용 단일 JSON으로 만들려면 아래 명령을 쓴다.

```powershell
npm run program-board:build -- --profile all
```

출력은 `.local/program-board/programs.json`이다. 기본적으로
`.local/program-attachment-batch/full.json`의 회차 보강 결과를 붙인다.

## 5. 주요 산출물

| 파일 | 용도 |
| --- | --- |
| `.local/program-attachment-inventory/inventory-all.json` | 전체 351건 인벤토리 |
| `.local/program-attachment-batch/full.json` | 전체 정제·병합 결과 |
| `.local/program-attachment-batch/evidence.json` | 검수용 첨부 추출문. 게시 데이터에 넣지 않음 |
| `.local/program-attachment-batch/auto-review.json` | 자동 규칙이 명확히 적용된 후보 |
| `.local/program-attachment-batch/single-session-events.json` | 회차표가 없는 하루짜리 행사 |
| `.local/program-attachment-batch/manual-review.json` | 사람이 원본과 대조해야 하는 항목 |
| `.local/program-attachment-batch/ocr-queue.json` | OCR 대상 이미지 큐 |
| `.local/program-attachment-batch/failures.json` | 다운로드·판별·파서 실패 항목 |
| `.local/program-attachment-batch/stats.json` | 상태별 통계와 검수량 |
| `.local/program-attachment-ocr/dry-run.json` | OCR 드라이런 결과 |
| `.local/program-attachment-ocr/results.json` | OCR 실제 실행 결과 |
| `.local/program-board/programs.json` | 게시판이 읽는 정제 데이터 |

검수 화면은 배치 결과가 있으면 `full.json`과 `evidence.json`을 우선 읽는다.

```text
http://127.0.0.1:3000/programs/attachment-review
http://127.0.0.1:3000/programs/attachment-review/{sourceId}
```

## 6. 상태 해석

| 상태 | 의미 |
| --- | --- |
| `AUTO_REVIEW_CANDIDATE` | 규칙이 명확히 적용되어 사람이 대조할 수 있는 상태 |
| `MANUAL_REVIEW_REQUIRED` | 값 충돌, 회차 미추출, 신규 형식 등으로 사람 판단 필요 |
| `SINGLE_SESSION_EVENT` | 하루짜리 행사라 회차표가 없는 것이 정상 |
| `OCR_REQUIRED` | 이미지 OCR이 있어야 내용을 보강할 수 있음 |
| `OCR_BUDGET_EXCEEDED` | OCR 누적 호출 상한 때문에 남겨둔 대상 |
| `EXTRACTION_FAILED` | 다운로드, 파일 형식 판별, 파서 단계 실패 |

`bodyPublishable: true`는 본문만으로 화면을 구성할 수 있다는 뜻이다.
첨부나 OCR 확인이 끝났다는 뜻이 아니므로 정제 완료로 보지 않는다.

## 7. 정제 규칙 요약

원사이트는 세 구간으로 본다.

1. 기본정보: 제목부터 온라인 접수 여부 및 첨부파일까지의 표
2. 프로그램 내용: 기본정보 다음부터 `<안내 사항>` 직전까지
3. 이용 안내: `<안내 사항>`부터 수강신청자 목록 직전까지

기본정보 필드는 운영 도서관, 프로그램명, 대상, 강사, 모집인원, 교육기간,
교육시간, 신청기간, 온라인 접수 여부, 비용을 우선한다.

중복 제거는 보수적으로 한다.

- 대상, 강사, 모집인원, 비용, 온라인 접수 여부가 기본정보와 같으면 본문·첨부 쪽 반복은 제거한다.
- 교육기간, 신청기간, 장소, 비용에 시간·강의실·환불정책 같은 추가 정보가 있으면 보존한다.
- 프로그램명과 같은 소개 문장은 제거하되, 목표나 실제 소개 문장은 보존한다.
- 원문은 게시 데이터에 반복 노출하지 않고 검수 근거에 남긴다.

회차 공통 필드는 아래 형태로 유지한다.

```text
session, date, category, activity, teachingMethod, materials, notes, referenceBooks, referenceImages
```

UI는 값이 있는 경우에만 `교수방법`, `준비물`, `비고` 열을 보여준다.

## 8. HWP/PDF 처리 규칙

HWP와 PDF는 평탄화된 텍스트보다 표 셀 구조를 우선한다.

- `1회차`, `1차시`, `1주차`처럼 단위가 붙은 회차 번호를 숫자로 정규화한다.
- HWP 공유 문서는 `프로그램명`, `강좌명`, `강의명` 머리말을 기준으로 구간 분리한다.
- 첨부 본문에 제목이 없고 파일명만 제목과 맞으면 파일명을 매칭 근거로 사용할 수 있다.
- 제목의 연도·기수 토큰은 매칭에서 과하게 중요하게 보지 않는다.
- `담당강사` 열은 활동 내용에 섞지 않는다.
- 표 아래 `※` 안내 문구는 마지막 회차 비고가 아니라 이용 안내로 보낸다.
- 병합 셀은 병합 범위의 회차에 상속한다.
- 다음 페이지로 이어지는 PDF 표는 연결한다.
- 공유 PDF는 프로그램별 페이지를 선택한다.
- 표 내부 이미지는 셀 연결 근거가 있을 때만 해당 회차에 배치한다.

대표적으로 이미 방어한 케이스는 공유 HWP의 여러 프로그램 섞임, PDF의 다음 페이지 연속 표,
`차시(날짜)` 결합 머리글, HWP 표의 줄바꿈 손실, `<도서명>` 표기 누락, 안내문이 비고에
붙는 문제다. 새 형식이 나오면 한 사례만 고치지 말고 같은 유형 전체에 적용 가능한 규칙인지
먼저 판단한다.

## 9. OCR 운영 기준

OCR은 CLOVA OCR General을 사용한다. 실제 호출은 사용자가 환경변수를 넣고
`CLOVA_OCR_ENABLED=true`를 설정했을 때만 일어난다.

```powershell
$env:CLOVA_OCR_ENABLED='true'
$env:CLOVA_OCR_INVOKE_URL='<issued-url>'
$env:CLOVA_OCR_SECRET='<secret>'
$env:ATTACHMENT_OCR_MAX_CALLS='500'
$env:ATTACHMENT_OCR_MIN_CONFIDENCE='0.8'
```

실행 전에는 반드시 드라이런으로 다운로드, 형식 판별, 체크섬 중복 접기, 예상 호출 수를 본다.

```powershell
cd apps/backend
npm run program-ocr-batch:dry-run
```

실제 실행은 본문이 없는 이미지부터 처리하고, 그다음 본문이 있는 이미지를 처리한다.

```powershell
npm run program-ocr-batch:run -- --group no-body
npm run program-ocr-batch:run -- --group with-body
```

OCR 결과를 배치 결과에 연결하려면 이미지 경로를 다시 실행한다.

```powershell
npm run program-attachment-batch:run -- --route IMAGE_OCR --resume
npm run program-attachment-batch:report
```

운영 기준은 다음과 같다.

- 호출 상한은 누적 기준으로 관리한다.
- 최소 평균 신뢰도는 0.8이다.
- `blog.kakaocdn.net`은 이 OCR 배치에서만 추가 허용한다.
- `data:image/...;base64,...` 본문 이미지는 다운로드하지 않고 디코딩한다.
- 체크섬이 같은 이미지는 한 번만 호출하고 결과를 재사용한다.
- OCR이 글자를 읽어도 회차표 셀 경계가 불확실하면 회차를 게시 데이터에 싣지 않는다.
- 회차표가 있는데 복원하지 못한 항목은 `OCR_CURRICULUM_NOT_PUBLISHED` 경고와 함께 검수 대상으로 둔다.

2026-08-15 실행 기록에서는 244개 URL 기준 이미지가 체크섬 접기 후 186회 호출로 처리됐고,
상한 300회 안에서 끝났다. 새 크롤에서는 드라이런 수치를 기준으로 다시 판단한다.

## 10. 수동 보정

규칙을 계속 늘리면 다른 문서가 깨질 정도로 특이한 계획서는 수동 보정에 넣는다.
기준 위치는 코드다.

```text
apps/backend/src/services/programAttachmentEnrichment/manualCurriculum/
```

수동 보정은 자동 추출보다 우선한다. 각 항목에는 어떤 원본을 보고 넣었는지 `source`를 남긴다.

상태는 아래처럼 해석한다.

| 상태 | 의미 |
| --- | --- |
| `CURRICULUM_ENTERED_MANUALLY` | 사람이 원본을 보고 회차를 넣음 |
| `CURRICULUM_CONFIRMED_ABSENT` | 회차표가 없는 문서임을 확인함 |
| `FIELDS_ENTERED_MANUALLY` | 회차는 자동 추출을 유지하고 다른 칸만 보정함 |
| `CURRICULUM_UNNUMBERED` | 원본에 회차 번호가 없어 번호 없는 수업 내용으로 표시함 |

원본에 회차 번호가 없으면 임의 번호를 붙이지 않는다. 원본 자체가 중복되거나 비어 있으면
있는 그대로 기록하고 검수 근거를 남긴다.

## 11. 검증 명령

크롤 파일을 명시하고 핵심 회귀 테스트를 실행한다.

```powershell
cd apps/backend
$env:PROGRAM_BOARD_CRAWL='.local/geumjeong-small-library-crawl/<crawl-file>.json'
$env:PROGRAM_ATTACHMENT_ENRICHMENT='.local/program-attachment-enrichment/samples.json'

npm run test:program-board-data
npm run test:program-attachment-inventory
npm run test:program-attachment-section-matcher
npm run test:program-attachment-merge
npm run test:program-attachment-batch
npm run test:program-ocr-batch
npm run test:program-ocr-layout
```

프론트 타입 확인은 별도로 실행한다.

```powershell
cd apps/frontend
npx tsc --noEmit --incremental false
```

백엔드 전체 `npm run build`가 기존 Prisma 타입 불일치로 실패할 수 있다. 그 경우 이번 변경 파일의
테스트와 오류 위치를 분리해서 확인한다.

## 12. 다음 재크롤 때 확인할 것

- 전체 레코드 수가 이전 351건과 얼마나 달라졌는지 확인한다.
- HWP/PDF/이미지 확장자 분포와 `UNKNOWN_REVIEW` 건수를 먼저 본다.
- `DOC_EXTRACT`에서 `EXTRACTION_FAILED`가 생기면 다운로드 실패인지 파서 실패인지 분리한다.
- `MANUAL_REVIEW_REQUIRED` 사유 중 값 충돌과 회차 미추출을 나눠 본다.
- `OCR_REQUIRED`는 본문 있음/없음으로 나눠 비용 대비 우선순위를 정한다.
- 시간대만 다른 단일 행사는 합치지 말고 원사이트 레코드 단위로 유지한다.
- 검색, 임베딩, 운영 DB 적재, 게시판 UI 마무리는 크롤링·정제 배치가 안정된 뒤 별도 작업으로 다룬다.
