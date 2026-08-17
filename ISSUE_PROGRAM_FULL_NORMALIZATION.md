# feat: 전체 351건 프로그램 첨부 정제 파이프라인 적용 및 검수 분류

## 1. 작업 배경

#140에서 본문 텍스트·HTML 표만으로 구성된 텍스트형 프로그램 17건의 규칙 기반 정제와 게시판 프로토타입을 완료했다.

#145에서는 `text_with_supplement` 유형을 위한 첨부 인벤토리, 첨부 추출 모듈 재검증, 대표 HWP 10건과 PDF 10건의 구간 선택·회차 구조화·본문 병합·검수 UI를 완료했다.

대표 20건 결과는 다음과 같다.

| 항목 | 결과 |
| --- | ---: |
| 병합 프로그램 | 20건 |
| 프로그램 구간 선택 성공 | 20건 |
| 회차가 구조화된 프로그램 | 20건 |
| 구조화된 전체 회차 | 160개 |
| 자동 검토 후보 | 17건 |
| 값 충돌로 수동 검수 필요 | 3건 |
| 첨부에서 새로 추가된 항목 | 65개 |
| 기본정보·본문과 중복되어 제거된 항목 | 67개 |
| 표 머리글 잡음으로 폐기된 항목 | 16개 |
| 해결되지 않은 값 충돌 | 4개 |

`자동 검토 후보`는 자동 게시 승인이 아니다. 병합 규칙이 명확하게 적용되어 사람이 원본과 대조할 수 있는 상태라는 뜻이다.

이 이슈는 대표 20건에서 확정한 규칙을 전체 351건에 일괄 적용하고, 그 결과를 자동 검토 후보와 사람 검수 대상으로 분류하는 것을 목표로 한다. 전체 351건을 사람이 처음부터 재작성하는 방식은 사용하지 않는다. 자동 검증을 통과하지 못한 건만 사람이 확인하는 human-in-the-loop 방식을 유지한다.

관련 문서: `PROGRAM_DATA_NORMALIZATION_RULES.md`, `ISSUE_PROGRAM_ATTACHMENT_ENRICHMENT.md`, `PROGRAM_ATTACHMENT_VALIDATION_RESULTS.md`, `PROGRAM_ATTACHMENT_ENRICHMENT_RESULTS.md`, `PROGRAM_ATTACHMENT_MERGE_RESULTS.md`, `PROGRAM_ATTACHMENT_REVIEW_UI_RESULTS.md`

## 2. 대상 범위

금정구 공공예약 서비스 크롤링 결과 351건 전체를 대상으로 한다. 입력은 `.local/geumjeong-small-library-crawl/`의 최신 크롤링 JSON이다.

`contentProfileOf()` 기준 프로파일별 분류는 다음과 같다.

| 프로파일 | 건수 | 이번 이슈에서의 처리 |
| --- | ---: | --- |
| `text_only` | 18건 | 기존 정제 결과 유지, 회귀 검증만 수행 |
| `text_with_supplement` | 198건 | 문서 첨부 보유 72건만 추출·병합, 나머지 126건은 본문 정제 후 OCR 큐 |
| `image_only` | 69건 | 본문 없음. 문서 첨부 보유 11건만 추출, 58건은 OCR 큐 |
| `attachment_only` | 66건 | 전부 이미지 첨부다. OCR 큐로 분리하고 OCR은 호출하지 않음 |
| `empty` | 0건 | 해당 없음 |

1단계 인벤토리(`--profile all`)로 확정한 실제 수치다. 레코드 단위 처리 경로로 다시 보면 다음과 같다.

| 처리 경로 | 건수 |
| --- | ---: |
| `DOC_EXTRACT` (HWP/PDF 추출 가능) | 83건 |
| `TEXT_ONLY` | 18건 |
| `TEXT_WITH_IMAGE` (본문 있음 + OCR 대기) | 126건 |
| `NO_TEXT_IMAGE_ONLY` (본문 없음 + OCR 대기) | 124건 |

**현재 규칙으로 첨부 내용을 실제 추출할 수 있는 대상은 351건 중 83건이다.** 실첨부 확장자는 `.hwp` 26, `.pdf` 57, `.jpg` 125, `.png` 31이며 `.hwpx`는 0건이다.

1~2단계 실행 결과와 확인된 규칙 한계는 `PROGRAM_FULL_NORMALIZATION_PARTIAL_RESULTS.md`에 기록했다.

### 제외 범위

- 실제 프로그램 게시판 운영 UI 수정, 표 열 너비·이미지 크기·반응형 통일 (후속 이슈 B)
- 신청하기 버튼, 접수 상태, 검색·필터 연결 (후속 이슈 B)
- 유사도 검색용 부모-자식 문서 구조 설계와 임베딩 (후속 이슈 C)
- 운영 DB 반영과 배포
- OCR 엔진 실제 호출, OCR 과금 정책 확정
- LLM API를 이용한 정제
- 사서용 프로그램 등록 화면

## 3. 형식별 처리 경로

인벤토리의 `ExtractionRoute`를 그대로 사용하고, 전체 배치에서는 각 경로의 종료 상태를 반드시 기록한다.

| 경로 | 대상 | 처리 |
| --- | --- | --- |
| `TEXT_ONLY` | 첨부·이미지 없는 본문 | 기존 `program-board/v1` 정제 결과를 그대로 사용 |
| `HWP_TEXT` | `.hwp` | 기본 파서 → 도형 속 회차 제목 누락 시 `hwp.js` 보조 파서 → 표 셀 참고도서·임베디드 이미지 추출 |
| `HWPX_TEXT` | `.hwpx` | HWP 경로와 동일 규칙. 표본이 없으면 실패 사유를 남기고 검수 대상으로 분리 |
| `PDF_CLASSIFY` (텍스트 레이어) | 텍스트 PDF | 원본 표 셀 구조 우선, 공유 PDF는 프로그램별 페이지 선택, 연속 페이지 표 연결, 병합 셀 상속 |
| `PDF_CLASSIFY` (스캔·이미지 PDF) | 텍스트 레이어 없음 | 추출하지 않고 `OCR_REQUIRED` 큐로 분리 |
| `IMAGE_OCR` | JPG·PNG 등 | 형식·크기 검증과 전처리까지만. OCR 호출하지 않고 `OCR_REQUIRED` 큐로 분리 |
| `UNKNOWN_REVIEW` | 판별 실패 확장자, 다운로드 실패 | `EXTRACTION_FAILED`로 기록하고 재시도 가능 여부를 남김 |

경로 선택과 실패 판정은 모두 파일 확장자만이 아니라 실제 다운로드 후 형식 판별 결과를 근거로 한다. 첨부가 여러 개인 프로그램은 각 첨부의 경로와 구간 매칭 결과를 개별로 기록하고, 최종 병합에는 매칭 점수가 가장 높은 구간을 사용한다.

## 4. 상태 정의

기존 두 축(게시 가능 상태, 첨부 확인 상태)을 유지하고, 배치 결과 분류를 위한 최종 상태를 명시한다.

### 4.1 게시 가능 상태 (기존)

- `TEXT_READY`: 본문만으로 기본 화면 구성 가능
- `TEXT_PARTIAL`: 기본 정보는 있으나 프로그램 내용 부족
- `TEXT_INSUFFICIENT`: 첨부 없이는 프로그램 내용 구성 불가

### 4.2 첨부 확인 상태 (기존)

- `ATTACHMENT_UNCHECKED`
- `ATTACHMENT_ENRICHED`
- `ATTACHMENT_NO_NEW_INFO`
- `ATTACHMENT_REQUIRED`
- `MANUAL_REVIEW_REQUIRED`

### 4.3 배치 최종 분류 상태 (이번 이슈에서 확정)

| 상태 | 의미 | 판정 조건 |
| --- | --- | --- |
| `AUTO_REVIEW_CANDIDATE` | 자동 규칙이 명확히 적용되어 사람이 대조만 하면 되는 상태 | 구간 매칭 성공, 값 충돌 없음, 차단성 추출 경고 없음 |
| `MANUAL_REVIEW_REQUIRED` | 사람이 원본과 비교해 판단해야 하는 상태 | 기본정보·첨부 값 충돌, 회차 수와 이미지 수 불일치, 낮은 매칭 점수, 새로운 자유문 라벨·문서 형식 |
| `OCR_REQUIRED` | 텍스트 추출 경로가 없어 OCR 없이는 진행 불가 | 스캔 PDF, 이미지 전용 첨부, `image_only` 프로파일 |
| `EXTRACTION_FAILED` | 다운로드·형식 판별·파서 단계에서 실패 | HTTP 실패, 형식 판별 실패, 파서 예외. 재시도 가능 여부를 함께 기록 |

`AUTO_REVIEW_CANDIDATE`는 자동 게시 승인이 아니다. 이 이슈의 어떤 산출물도 사람 확인 없이 게시 상태로 넘어가지 않는다.

`OCR_REQUIRED`와 `EXTRACTION_FAILED`는 이번 이슈에서 새로 추가되는 값이다. 기존 `MANUAL_REVIEW_REQUIRED` 안에 섞여 있던 두 사유를 분리해, 사람이 지금 처리할 수 있는 건과 정책·비용 결정이 선행되어야 하는 건을 구분한다.

## 5. 입력·출력 스키마

### 5.1 입력

| 입력 | 경로 | 비고 |
| --- | --- | --- |
| 크롤링 원본 | `.local/geumjeong-small-library-crawl/geumjeong-small-library-programs-*.json` | `records[]`, 레코드 키는 `idx` |
| 첨부 인벤토리 | `.local/program-attachment-inventory/inventory.json` | 1단계에서 전체 프로파일로 재생성 |

### 5.2 출력

`schemaVersion: 'program-board-attachment-batch/v1'`

기존 `program-board-attachment-merge-batch/v1`을 확장한다. 필드 이름과 의미는 대표 20건 산출물과 동일하게 유지하고, 배치용 필드만 추가한다.

```jsonc
{
  "schemaVersion": "program-board-attachment-batch/v1",
  "generatedAt": "ISO8601",
  "sourceCrawlFile": "geumjeong-small-library-programs-<stamp>.json",
  "count": 351,
  "summary": {
    "byProfile": { "text_only": 0, "text_with_supplement": 0, "image_only": 0, "attachment_only": 0, "empty": 0 },
    "byRoute": { "TEXT_ONLY": 0, "HWP_TEXT": 0, "HWPX_TEXT": 0, "PDF_CLASSIFY": 0, "IMAGE_OCR": 0, "UNKNOWN_REVIEW": 0 },
    "byStatus": {
      "AUTO_REVIEW_CANDIDATE": 0,
      "MANUAL_REVIEW_REQUIRED": 0,
      "OCR_REQUIRED": 0,
      "EXTRACTION_FAILED": 0
    },
    "curriculumPrograms": 0,
    "curriculumSessions": 0,
    "addedItems": 0,
    "skippedDuplicates": 0,
    "discardedNoise": 0,
    "conflicts": 0,
    "manualReviewReasons": { "<코드>": 0 },
    "failureReasons": { "<코드>": 0 }
  },
  "items": [
    {
      "schemaVersion": "program-board-attachment-merge/v1",
      "sourceId": 2484,
      "title": "마음과 만나는 그림책 테라피",
      "contentProfile": "text_with_supplement",
      "extractionRoute": "HWP_TEXT",
      "textReadiness": "TEXT_PARTIAL",
      "attachmentReviewStatus": "ATTACHMENT_ENRICHED",
      "reviewStatus": "AUTO_REVIEW_CANDIDATE",
      "basicInfo": [{ "label": "운영 도서관", "value": "..." }],
      "board": { "intro": [], "sections": [], "notices": [] },
      "curriculum": [
        {
          "session": 1,
          "date": null,
          "category": null,
          "activity": "",
          "teachingMethod": null,
          "materials": null,
          "notes": null,
          "referenceBooks": [],
          "referenceImages": []
        }
      ],
      "attachmentEvidence": {
        "name": "", "url": "", "matchStatus": "", "selectedPages": [], "confidence": 0, "reason": ""
      },
      "attachments": [],
      "extractionWarnings": [{ "code": "", "message": "" }],
      "mergeAudit": {
        "added": [{ "section": "", "label": "", "value": "" }],
        "skippedDuplicates": [{ "label": "", "value": "" }],
        "discardedNoise": [{ "label": "", "value": "", "reason": "" }],
        "warnings": [{ "code": "", "label": "", "basicValue": null, "attachmentValue": "" }]
      }
    }
  ]
}
```

배치에서 추가되는 항목 단위 필드는 `contentProfile`, `extractionRoute`, `textReadiness`, `attachmentReviewStatus`, 그리고 `EXTRACTION_FAILED`·`OCR_REQUIRED` 항목의 `failure` 블록(`code`, `message`, `retryable`)이다. 기존 대표 20건 산출물의 필드는 이름과 의미를 그대로 유지해 검수 UI가 두 산출물을 동일하게 읽을 수 있게 한다.

회차 공통 필드는 `session`, `date`, `category`, `activity`, `teachingMethod`, `materials`, `notes`, `referenceBooks`, `referenceImages`로 고정한다.

### 5.3 산출물 위치

| 파일 | 내용 |
| --- | --- |
| `.local/program-attachment-batch/full.json` | 351건 전체 병합 결과 |
| `.local/program-attachment-batch/auto-review.json` | `AUTO_REVIEW_CANDIDATE`만 |
| `.local/program-attachment-batch/manual-review.json` | `MANUAL_REVIEW_REQUIRED`와 사유 |
| `.local/program-attachment-batch/ocr-queue.json` | `OCR_REQUIRED` 목록. 첨부 URL과 판별 근거만 보관 |
| `.local/program-attachment-batch/failures.json` | `EXTRACTION_FAILED`와 재시도 가능 여부 |
| `.local/program-attachment-batch/stats.json` | 형식별 성공률·실패 사유·사람 검수량 |

`.local/` 산출물은 저장소에 커밋하지 않는다. 통계와 대표 사례만 결과 문서에 옮긴다.

## 6. 원문 근거 추적

정제 결과는 항상 원문으로 되돌아갈 수 있어야 한다.

1. `sourceId`와 공공예약 원문 URL을 모든 항목에 보존한다.
2. `attachmentEvidence`에 첨부 파일명, URL, 매칭 상태, 선택 페이지, 매칭 점수, 선택 사유를 남긴다.
3. `mergeAudit.added`는 어떤 값이 어느 구획에 새로 들어갔는지 기록한다.
4. `mergeAudit.skippedDuplicates`는 중복으로 제거된 값을 남긴다.
5. `mergeAudit.discardedNoise`는 폐기 값과 폐기 사유를 남긴다.
6. `mergeAudit.warnings`는 기본정보 값과 첨부 값을 함께 남겨 사람이 판단할 수 있게 한다.
7. `extractionWarnings`는 추출기가 읽지 못한 항목을 코드와 함께 남긴다.
8. 첨부 전체 추출 원문은 최종 게시 데이터에 넣지 않고 검수용 파일에만 보존한다.

## 7. 중복 제거와 충돌 처리 원칙

대표 20건에서 확정한 규칙을 그대로 전체에 적용한다.

1. 공공예약 상단 정형 테이블의 기본 정보를 기준값으로 유지한다.
2. 기본정보·본문·첨부에서 같은 내용이 반복되면 한 번만 표시한다.
3. 목표·프로그램 소개가 프로그램명과 같은 추출 문자열에 붙어 있으면 셀 경계를 먼저 복원한 뒤 중복을 판단한다.
4. 교육기간·장소에 더 구체적인 시간·휴강일·전환 장소가 있으면 추가 정보로 보존한다.
5. 값이 충돌하면 자동으로 덮어쓰지 않고 근거와 함께 `MANUAL_REVIEW_REQUIRED`로 보낸다. 모집인원처럼 이미 합의된 우선순위 규칙이 있는 필드만 규칙을 적용한다.
6. 첨부 제목이 다르지만 구간 매칭이 명확하면 `첨부 표기명`으로 보존한다.
7. 표 머리글·꼬리말 잡음은 게시 데이터에서 제거하고 감사 기록에 남긴다.
8. 교수방법·준비물·비고는 하나로 합치지 않고 독립 필드로 보존한다.
9. 표 내부 이미지는 이미지 수와 회차 수가 일치하고 셀·페이지 순서 근거가 확인될 때만 회차에 연결한다. 그렇지 않으면 자동 배치하지 않고 검수 대상으로 보낸다.
10. 회차 일자는 교육 시작일~종료일의 7일 간격 날짜 수와 회차 수가 정확히 같을 때만 자동 보완한다.
11. 비대면 전환·일정 변경·취소·대기·장애인 전화접수·재료 배부 안내는 프로그램 소개가 아니라 `이용 안내 > 운영 안내`로 분류한다.
12. 개인정보가 포함될 수 있는 수강신청자 목록은 수집·표시하지 않는다.
13. 첨부 전체 원문을 최종 게시판에 그대로 반복 표시하지 않는다.

## 8. 배치 실행과 재시도

### 8.1 실행 명령

```powershell
cd apps/backend

# 1) 전체 프로파일 인벤토리
npm run program-attachment-inventory:build -- --profile all

# 2) 전체 배치 정제 (형식별로 나눠 실행 가능)
npm run program-attachment-batch:run -- --route HWP_TEXT
npm run program-attachment-batch:run -- --route PDF_CLASSIFY
npm run program-attachment-batch:run -- --route TEXT_ONLY

# 3) 통계와 분류 산출물 생성
npm run program-attachment-batch:report
```

`program-attachment-batch:run`과 `program-attachment-batch:report`는 이번 이슈에서 신규 추가하는 CLI다. 기존 `program-attachment-enrichment:samples`와 `program-attachment-merge:samples`는 대표 표본 재현용으로 유지한다.

### 8.2 필요한 옵션

| 옵션 | 용도 |
| --- | --- |
| `--route <ROUTE>` | 특정 추출 경로만 실행 |
| `--source-id <id...>` | 특정 프로그램만 재처리 |
| `--limit <n>` | 부분 실행으로 중간 확인 |
| `--resume` | 이미 성공한 항목을 건너뛰고 실패·미처리만 실행 |
| `--retry-failed` | `failures.json`의 `retryable: true` 항목만 재실행 |
| `--concurrency <n>` | 다운로드 동시 실행 수 (기본 2, 상한 4) |

### 8.3 재시도 원칙

1. 배치는 중단 후 재개할 수 있어야 하며, 성공한 항목의 결과는 재실행해도 동일해야 한다.
2. 다운로드한 첨부는 임시 디렉터리에서 처리한 뒤 삭제한다. 캐시가 필요하면 `.local/` 아래에 두고 커밋하지 않는다.
3. 원 URL이 실패하면 동일 파일명의 검증 가능한 대체 URL을 탐색하고, 대체 근거를 `attachmentEvidence.reason`에 남긴다.
4. 재시도해도 실패하면 `EXTRACTION_FAILED`, `retryable: false`로 확정한다.
5. 공공예약 서버 부하를 고려해 동시 실행 수와 요청 간격을 제한한다.

## 9. 통계 산출

`stats.json`과 결과 문서에 다음을 기록한다.

1. 프로파일별 건수와 비율
2. 추출 경로별 건수, 구간 매칭 성공률, 회차 구조화 성공률
3. 상태별 건수 (`AUTO_REVIEW_CANDIDATE` / `MANUAL_REVIEW_REQUIRED` / `OCR_REQUIRED` / `EXTRACTION_FAILED`)
4. 수동 검수 사유별 건수 (값 충돌, 이미지-회차 불일치, 낮은 매칭 점수, 신규 라벨·형식 등)
5. 실패 사유별 건수 (다운로드 실패, 형식 판별 실패, 파서 예외 등)
6. 병합 감사 합계 (추가·중복 제거·잡음 폐기·충돌)
7. 사람이 실제로 확인해야 하는 총 건수와 프로그램당 평균 검수 항목 수
8. 자동 구조화된 전체 회차 수

성공률 100%는 목표가 아니다. 자동 처리 대상과 사람 검수 대상을 정확히 나누는 것이 목표이며, 근거가 약한 자동 배치보다 검수 대상 분류가 낫다.

## 10. 회귀 테스트

전체 적용으로 기존 결과가 나빠지지 않았음을 확인한다.

```powershell
cd apps/backend
$env:PROGRAM_BOARD_CRAWL='.local/geumjeong-small-library-crawl/<crawl-file>.json'
$env:PROGRAM_ATTACHMENT_ENRICHMENT='.local/program-attachment-enrichment/samples.json'
npm run test:program-board-data
npm run test:program-attachment-inventory
npm run test:program-attachment-section-matcher
npm run test:program-attachment-merge
npm run test:program-attachment-batch

cd ../frontend
npx tsc --noEmit --incremental false
```

회귀 기준은 다음과 같다.

1. 텍스트형 17건의 정제 결과가 기존과 동일하다.
2. 대표 HWP/PDF 20건이 배치 경로로 실행해도 동일한 회차 수와 동일한 상태로 나온다. 구조화 회차 160개, 자동 검토 후보 17건, 수동 검수 3건 기준을 유지하거나 개선한다.
3. `PROGRAM_ATTACHMENT_MERGE_RESULTS.md`에 기록된 예외 사례 9건이 그대로 복원된다.
4. 검수 UI가 배치 산출물을 읽어도 대표 20건 화면이 동일하게 렌더링된다.
5. 상태값이 바뀐 항목은 사유와 함께 결과 문서에 기록한다.

`npm run test:program-attachment-batch`는 이번 이슈에서 신규 추가하는 테스트다.

## 11. OCR 비용 원칙

1. 이 이슈에서는 외부 OCR API를 호출하지 않는다.
2. 스캔 PDF와 이미지 전용 첨부는 판별만 하고 `OCR_REQUIRED` 큐로 분리한다.
3. OCR 큐에는 `sourceId`, 첨부 URL, 판별 근거, 예상 페이지 수만 남긴다. 이미지 파일 자체는 저장하지 않는다.
4. OCR 엔진, 최소 신뢰도, 과금 한도, 사람 검수 정책은 별도 이슈에서 확정한다.
5. LLM API도 사용하지 않는다. 정제는 규칙 기반 파서, 문서 표 구조, 로컬 추출 모듈만 사용한다.

## 12. 단계별 작업 순서와 확인 시점

| 단계 | 작업 | 산출물 | 사용자 확인 |
| --- | --- | --- | --- |
| 0 | 이슈 초안 확정, 브랜치 생성 | 이 문서 | 필요. 범위와 새 상태값 승인 |
| 1 | 전체 프로파일 인벤토리 생성 | `inventory.json`, 프로파일·경로별 실제 건수 | 필요. 추정치와 실제 수치 차이 확인 |
| 2 | 배치 러너 구현, `--limit 30` 부분 실행 | 부분 배치 결과, 초기 통계 | 필요. 대표 20건 밖 형식에서 규칙이 무너지는지 확인 |
| 3 | HWP 경로 전체 실행 | HWP 결과와 실패 목록 | 선택. 실패율이 높으면 확인 |
| 4 | PDF 경로 전체 실행 | PDF 결과, 공유 PDF 페이지 선택 결과 | 선택. 공유 PDF 오배정 표본 확인 |
| 5 | 텍스트 전용·잔여 프로파일 처리, OCR 큐 분리 | `ocr-queue.json`, `failures.json` | 필요. OCR 큐 규모와 처리 방향 결정 |
| 6 | 통계·분류 산출물 생성 | `stats.json`, 상태별 파일 | 필요. 사람 검수량이 감당 가능한 규모인지 확인 |
| 7 | 회귀 테스트와 결과 문서화 | 테스트 통과, `PROGRAM_FULL_NORMALIZATION_RESULTS.md` | 필요. 최종 승인 |

각 단계는 이전 단계 산출물을 입력으로 사용하며, 중간 단계에서 규칙이 크게 무너지면 전체 실행을 계속하지 않고 규칙을 먼저 수정한다.

## 13. 완료 조건

- [ ] 351건 전체가 하나의 재현 가능한 명령 흐름으로 처리된다.
- [ ] 모든 항목에 `contentProfile`, `extractionRoute`, `textReadiness`, `attachmentReviewStatus`, `reviewStatus`가 기록된다.
- [ ] 첨부가 있는 항목이 확인 없이 정제 완료로 분류되지 않는다.
- [ ] `AUTO_REVIEW_CANDIDATE` / `MANUAL_REVIEW_REQUIRED` / `OCR_REQUIRED` / `EXTRACTION_FAILED` 4개 산출물이 분리 생성된다.
- [ ] 모든 항목에서 원문 URL, 첨부 근거, 병합 감사 내역을 따라갈 수 있다.
- [ ] 형식별 성공률, 실패 사유, 사람 검수량 통계가 생성된다.
- [ ] 텍스트형 17건과 대표 20건에 회귀가 없다.
- [ ] 외부 OCR·LLM API 호출이 0건이다.
- [ ] 배치가 중단 후 재개 가능하고 동일 입력에서 동일 결과를 낸다.
- [ ] 개인정보(수강신청자 목록)가 산출물에 포함되지 않는다.
- [ ] `.local/` 산출물이 커밋되지 않는다.
- [ ] 결과와 알려진 한계가 `PROGRAM_FULL_NORMALIZATION_RESULTS.md`에 기록된다.

## 14. 후속 이슈

1. **후속 이슈 B: 실제 프로그램 게시판 연결 및 UI 마무리** — 정제 결과를 운영 게시판 데이터 소스에 연결, 표 열 너비·줄바꿈·이미지 크기·반응형 통일, 신청하기 버튼·접수 상태·검색 필터 연결, `/programs/attachment-review`와 운영 UI 역할 분리
2. **후속 이슈 C: 유사도 검색 데이터 구조** — 프로그램(부모)과 회차(자식) 문서 분리, 정형 필터와 벡터 검색 분리, 프로그램 단위 검색 후 회차 검색 순서
3. **OCR 정책 확정 이슈** — 엔진, 최소 신뢰도, 과금 한도, 사람 검수 절차 확정 후 `OCR_REQUIRED` 큐 처리
4. **사람 검수·수정·승인 도구 이슈** — `MANUAL_REVIEW_REQUIRED` 항목의 수정과 승인 기록

## 15. 주의사항

- `자동 검토 후보`를 `자동 게시 승인`으로 표현하지 않는다.
- 값이 충돌할 때 임의로 선택하지 않는다.
- 표 내부 이미지를 추출 순서만으로 회차에 연결하지 않는다.
- 첨부 전체 원문을 최종 게시판에 반복 노출하지 않는다.
- `.claude/`, `.local/`, 사용자 첨부파일을 커밋하지 않는다.
- 전체 변환 전에 이슈 초안과 단계 구성을 사용자에게 승인받는다.
