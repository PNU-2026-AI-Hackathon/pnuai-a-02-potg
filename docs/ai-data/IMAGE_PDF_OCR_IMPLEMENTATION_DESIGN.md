# 이미지 및 스캔 PDF OCR 실행 환경과 구현 설계

- 분석일: 2026-07-21
- 기준 브랜치: `feat/image-pdf-ocr`
- 기준 커밋: `bc90e55` (`main`, `origin/main`)
- 범위: #78 구현 전 환경·DB·코드 분석과 설계
- 제외: 패키지/시스템 도구 설치, OCR 실행, 원본 다운로드, DB 및 schema 변경

## 1. 결론

권장 조합은 **Tesseract 5 CLI(`kor+eng`) + Sharp 전처리 + Poppler `pdftocairo` PNG 렌더링**이다. Node.js는 파이프라인과 상태를 제어하고 OCR·렌더링은 자식 프로세스로 격리한다. 911 MiB, swap 없음인 운영 EC2에서는 동시성 1, 페이지 단위 직렬 처리, 픽셀/DPI 제한과 timeout이 전제다.

기존 다운로드·보안·형식 판별·PDF.js·상태 관리 코드는 재사용한다. OCR 실행기, 이미지 검사/전처리, PDF 페이지 렌더러, 페이지 결과 병합기는 route/controller가 아니라 독립 service로 추가한다.

일반 이미지 OCR과 `OCR_REQUIRED` PDF의 MVP는 현재 schema로 구현할 수 있다. MIXED PDF도 최종 합본만 저장하면 migration 없이 가능하지만 페이지별 성공 정보, 안전한 재개, 기존 성공과 OCR 보강 실패의 동시 표현은 불가능하다. 첫 구현은 무 migration으로 제한하고 운영 안정화 단계에서 페이지 실행 모델을 검토한다.

## 2. Git 및 #77 포함 상태

- 작업 시작 당시 `main`은 `origin/main`과 일치했고 pull 결과도 `Already up to date`였다.
- `bc90e55`는 PR #79 병합 커밋이며 #77 PDF 추출 구현과 `20260720070000_add_attachment_extraction_fields` migration을 포함한다.
- 기존 미추적 문서 2개는 사용자 지시에 따라 삭제했다.
- 분석용 `feat/image-pdf-ocr` 브랜치를 생성했다.

## 3. 읽기 전용 DB 현황

`BEGIN READ ONLY` 트랜잭션에서 집계했다. URL, 연결 문자열, checksum, 본문, 전체 attachment ID는 출력하지 않았다.

| 항목 | 실제 값 |
|---|---:|
| `ProgramCase` / `ProgramCaseSession` | 349 / 20 |
| 전체 / 활성 `ProgramCaseAttachment` | 237 / 237 |
| HWP / PDF / JPG / PNG | 26 / 55 / 125 / 31 |
| 이미지 `PENDING` / `PROCESSING` / `COMPLETED` / `FAILED` | 156 / 0 / 0 / 0 |
| `PDFJS_TEXT` / `PDFJS_TEXT_PARTIAL` | 54 / 1 |
| `failureCode = OCR_REQUIRED` PDF | 0 |

이미지 156건은 아직 `fileSizeBytes`와 `checksumSha256`가 비어 있다. DB 메타데이터만으로 대형/소형 및 checksum 중복 표본을 확정할 수 없다. 원본을 내려받지 않았으므로 텍스트 밀도, 사진형 여부, 실제 가로·세로 크기도 미확인이다.

## 4. 실행 환경과 위험

### 로컬

| 도구 | 상태 |
|---|---|
| Node.js / npm / Python | `v22.17.0` / `10.9.2` / `3.12.10` |
| Tesseract / `pdftocairo` / ImageMagick | 없음 |
| `pdftoppm` | Codex 번들 경로에서만 확인; 프로젝트/시스템 설치로 간주하지 않음 |
| `convert` | Windows 파일시스템 도구이며 ImageMagick이 아님 |

### 문서에 기록된 운영 EC2

- Ubuntu 24.04 x86_64, Node.js 22, Python 3.12, 2 vCPU
- 메모리 약 911 MiB, swap 없음, 관찰 시 가용 메모리 약 412 MiB
- 이번 단계에서는 EC2에 접속하거나 설치 상태를 재확인하지 않았다.

Node/PM2와 OCR/렌더러의 메모리 첨두가 합산되고, 한글·영문 모델과 고해상도 RGBA decode는 입력 파일보다 큰 메모리를 쓴다. swap이 없어 순간 초과도 프로세스 종료로 이어질 수 있다. PM2 자동 재시작은 중복 실행과 `PROCESSING` 고착을 만들 수 있으므로 웹 요청이 아닌 수동 CLI/별도 worker에서 동시성 1로 실행한다.

## 5. 기존 코드 재사용 경계

### 그대로 재사용

- `attachmentDownloader.ts`: HTTPS/allowlist, redirect별 재검증, DNS·private/reserved IP 차단, timeout, 30 MiB 제한, streaming, SHA-256, 제한 권한 임시 경로와 cleanup.
- `fileTypeDetector.ts`: magic bytes 기반 PDF/JPEG/PNG 판별, HTML 및 메타데이터 불일치 거부.
- `pdfTextExtractor.ts`: 페이지 순서와 `[Page N]`, 정규화, 페이지/문서 분류, OCR 후보 페이지.
- `attachmentErrors.ts`: 제한된 failure code와 안전한 메시지 변환 패턴.
- `attachmentExtractionService.ts`: 조건부 claim, attempt 증가, 순차 처리, dry-run, 실패 후 다음 파일 진행 패턴.
- `extractProgramAttachments.ts`: 엄격한 option parsing, limit, JSON 요약 출력 형태.

### 확장 또는 분리

- 설정에 OCR/렌더 timeout, 최대 dimensions/pixels/pages, DPI, 출력 상한, 실행 파일 경로를 추가한다.
- 현재 PDF 전용 selector/claim을 IMAGE와 PDF_OCR로 확장한다.
- 다운로드·추출·상태·cleanup이 한 service에 결합되어 있으므로 orchestration과 순수 실행기를 분리한다.
- MIXED PDF는 현재 `PENDING/FAILED` claim으로 선택할 수 없고 페이지 분류도 DB에 남지 않아 다시 PDF.js를 실행해야 한다.
- lease/heartbeat가 없어 강제 종료 시 `PROCESSING` 복구 기준이 없다.

```text
services/attachment/
  imageMetadata.ts        dimensions/pixels/alpha/EXIF 검사
  imagePreprocessor.ts    Sharp rotate/flatten/grayscale/resize/normalize
  subprocessRunner.ts     shell 없는 제한형 자식 프로세스
  tesseractOcr.ts         kor+eng OCR와 결과 정규화
  pdfPageRenderer.ts      지정 페이지만 PNG로 직렬 렌더링
  pdfOcrMerger.ts         PDF.js/OCR 페이지의 결정적 병합
  imageOcrService.ts      이미지 상태 orchestration
  pdfOcrService.ts        MIXED/OCR_REQUIRED orchestration
```

route/controller에는 OCR 로직을 두지 않는다.

## 6. 도구 비교와 권고

### 이미지 OCR

| 후보 | 한글 | 메모리·격리 | 설치/Node 연동 | 판단 |
|---|---|---|---|---|
| Tesseract CLI | `kor+eng` | native process를 작업별 종료·kill 가능 | Ubuntu 패키지와 traineddata, `spawn` | **권장** |
| Tesseract.js | 언어 모델 제공 | WASM worker와 모델이 Node 메모리 예산을 공유 | npm API는 편하나 worker/cache 관리 필요 | 1 GiB 미만 서버에는 후순위 |
| Python + Tesseract | CLI와 동일 | Python process 비용 추가 | Python package와 binary 모두 필요 | Python 전처리 채택 시만 이점 |
| 기타 무료 OCR | 편차 큼 | 별도 평가 필요 | 새 runtime/API | 현재 근거 부족 |

Tesseract 공식 문서는 엔진과 언어 traineddata가 별도이며 `-l`로 언어를 지정한다고 설명한다. Tesseract.js는 Node를 지원하지만 WASM worker를 사용하고 PDF 자체는 지원하지 않는다. 작은 메모리 예산과 강제 종료 요구에는 CLI가 적합하다.

### PDF 페이지 렌더링

| 후보 | 특징 | 판단 |
|---|---|---|
| `pdftoppm` | PPM/PNG/JPEG 출력 | 가능하나 기본 PPM 오사용 시 디스크 급증 위험 |
| `pdftocairo` | PNG, page range, DPI 지정이 명확 | **권장**: 후보 페이지만 `-f N -l N -singlefile -png -r 200` |
| PDF.js canvas | 기존 JS 의존성 | Node canvas native dependency와 렌더 메모리가 Node에 결합 | 후순위 |
| 기타 renderer | 새 runtime·라이선스 검토 | 현재 이점 없음 |

MIXED PDF는 `ocrCandidatePages`만, OCR_REQUIRED도 전체를 한 번에 만들지 않고 한 페이지 생성→OCR→삭제를 반복한다.

### 이미지 전처리

| 후보 | 장점 | 단점 | 판단 |
|---|---|---|---|
| Sharp | Node API, EXIF rotate, resize, flatten, normalize, pixel limit | libvips native package | **권장** |
| ImageMagick CLI | 강력한 변환과 resource limit | 추가 subprocess·policy 관리 | fallback |
| Pillow/OpenCV | 풍부한 영상 처리 | Python 경로 추가 | deskew 실험 단계 |
| 없음 | 단순 | EXIF·투명 배경·과대 픽셀·저대비 대응 불가 | 비권장 |

초기는 자동 회전, 알파를 흰색으로 합성, grayscale, 제한적 normalize와 과대 이미지 축소만 적용한다. deskew, threshold, 영역 분할은 fixture 품질 비교 뒤 선택한다. 원본은 덮어쓰지 않는다.

## 7. subprocess 보안 계약

1. `shell: true`, 문자열 명령 조합, 사용자 입력 기반 실행 파일 선택을 금지한다.
2. 고정된 executable과 코드가 만든 argument array만 `spawn`/`execFile`에 전달한다.
3. 입출력은 downloader가 만든 작업 디렉터리 내부 고정 파일명만 허용하고 resolve 후 containment를 재검증한다.
4. 언어, DPI, PSM, 페이지 번호는 allowlist 또는 정수 범위 검증을 거친다.
5. 이미지 OCR 60초, 페이지 렌더 30초를 초기값으로 두고 fixture 계측 뒤 조정한다.
6. timeout 시 process tree를 종료하고 종료 완료를 기다린다.
7. stdout/stderr는 각각 64 KiB까지만 보관한다. OCR 본문은 stdout 대신 작업 파일을 크기 제한·UTF-8 검증 후 읽는다.
8. code/signal/timeout을 `OCR_PROCESS_FAILED`, `OCR_TIMEOUT`, `PDF_RENDER_FAILED`, `PDF_RENDER_TIMEOUT` 등으로 변환한다.
9. 로그에는 마스킹 ID, 단계, duration, bytes/pixels/pages, error code만 남긴다. URL/query, 전체 경로/checksum, OCR 본문/stack은 금지한다.
10. `finally`에서 파생 이미지와 작업 디렉터리를 삭제한다.
11. attachment/page당 child 하나, CLI 전체 동시성 기본/최대 1로 병렬 subprocess 생성을 막는다.

## 8. 이미지 입력 제한 후보

초기값은 안전한 실험 시작점이며 fixture 계측 후 조정한다.

| 제한 | 후보값 | 처리 |
|---|---:|---|
| 다운로드 | 기존 30 MiB | 초과 시 `FILE_TOO_LARGE` |
| 폭 / 높이 | 각 12,000 px | 비정상 비율은 거부, 정상 문서는 안전 축소 검토 |
| 총 픽셀 | 40 MP | decode 전 metadata 검사, 초과 시 축소 또는 실패 |
| OCR 입력 긴 변 | 4,000 px | 작은 글씨 fixture로 품질 검증 |
| decode 메모리 | 동시 한 장, 추정 160 MiB 이하 | `width × height × 4`를 하한 추정치로 사용 |
| PDF 페이지 | 50쪽 | `PDF_PAGE_LIMIT_EXCEEDED` |
| PDF render | 200 DPI | 250/300 DPI는 표본 비교 전 기본화 금지 |

- EXIF orientation은 `rotate()`로 정규화하고 투명 PNG는 흰색으로 flatten한다.
- animation/multi-page 이미지는 첫 프레임만 묵시 처리하지 않고 거부한다.
- 0 dimension, 손상 파일, 극단적 aspect ratio는 명시 실패한다.
- decompression bomb는 byte limit만으로 막을 수 없어 `limitInputPixels`와 metadata 검사를 병행한다.

## 9. 일반 이미지 상태 계약

```text
PENDING --조건부 claim--> PROCESSING
PROCESSING --OCR 정상 종료--> COMPLETED
PROCESSING --검증/전처리/OCR/timeout 실패--> FAILED
```

- 텍스트가 있으면 raw/cleaned text, `extractorType=TESSERACT_OCR`, 실제 engine version, `extractedAt`을 저장한다.
- OCR이 정상 종료했지만 텍스트가 없으면 **COMPLETED**와 빈 문자열, `failureCode=null`로 저장한다. 유효한 무텍스트 결과이며 재시도 폭주를 막는다.
- decode, timeout, binary, language data, size/pixel 제한은 각각 안전한 전용 failure code로 `FAILED` 처리한다.
- cleanup 실패와 본 처리 성공을 현재 단일 `failureCode`로 함께 표현하기 어렵다. 구현 전에 별도 경고 로그 정책을 고정한다.

현재 필드로 일반 이미지 MVP를 표현할 수 있어 migration은 필요하지 않다.

## 10. MIXED PDF 병합 계약

MIXED PDF는 기본 대상이 아니며 `--mixed-only`로만 선택한다.

1. `COMPLETED + PDFJS_TEXT_PARTIAL + isActive`를 조건으로 claim하고 일시적으로 `PROCESSING`으로 바꾼다.
2. claim 전 raw/cleaned text, extractor type/version, `extractedAt`을 메모리 snapshot으로 잡는다. 긴 OCR 동안 DB transaction을 열어 두지 않는다.
3. 원본을 다시 받아 PDF.js 페이지 구조를 재산출하고 `ocrCandidatePages`만 원 페이지 번호 순서로 렌더·OCR한다.
4. 합본 raw text는 모든 페이지를 정확히 한 번씩 `[Page N]`으로 출력한다. 후보 페이지의 기존 빈/저밀도 텍스트를 OCR로 **교체**하고 나머지는 PDF.js 텍스트를 유지한다. append는 금지한다.
5. cleaned text도 같은 선택 결과를 순서대로 정규화한다. 반복 실행 시 같은 입력은 같은 합본을 내야 한다.
6. 모든 후보 페이지와 단일 최종 update가 성공해야 `COMPLETED + PDFJS_TEXT_OCR_MERGED`, 합성 version, 새 `extractedAt`을 저장한다.
7. 한 페이지라도 실패하면 새 합본을 저장하지 않고 snapshot을 `COMPLETED/PDFJS_TEXT_PARTIAL`로 복원한다. 기존 성공 텍스트를 `FAILED`로 덮지 않고 CLI 결과와 구조화 로그로 보고한다.

요구사항의 여섯 질문에 대한 결정은 다음과 같다.

1. 동시 실행 방지를 위해 OCR 중에는 `PROCESSING`으로 바꾼다.
2. 보강 실패 시 기존 `COMPLETED` 결과를 복원한다.
3. snapshot은 필요하며 최종 저장만 짧은 transaction/conditional update로 한다.
4. 성공 페이지 목록은 현 schema에 영속 표현할 수 없다. MVP는 전부 성공 시만 저장하고 실행 로그에서 보고한다.
5. 재개·감사·부분 성공이 요구되면 별도 page execution model이 필요하다.
6. 전부 성공/전부 폐기 방식의 안전한 MVP는 migration 없이 가능하다.

프로세스가 죽으면 메모리 snapshot으로 자동 복구할 수 없다. 구현 전 `lastAttemptedAt` 기반 stale recovery 명령을 마련하고 장기적으로 lease와 이전 상태를 저장해야 한다.

## 11. OCR_REQUIRED PDF 계약

```text
FAILED(OCR_REQUIRED)
  --명시적 선택/claim--> PROCESSING
  --페이지별 render/OCR + 모두 성공--> COMPLETED
  --하나라도 실패--> FAILED(구체적 failureCode)
```

- 초기 최대 50쪽, 200 DPI, 페이지별 render 30초/OCR 60초, 동시성 1.
- 페이지 순서와 `[Page N]` 경계를 유지한다.
- 전부 성공 시만 최종 본문을 저장한다. 부분 본문과 임시 page text는 저장하지 않는다.
- 실패 시 기존 `OCR_REQUIRED` 대신 실제 실패 원인을 저장하되 명시 재처리로 다시 선택 가능해야 한다.
- 현재 실제 대상은 0건이므로 fixture로 상태 전이, 순서, 실패 원자성, cleanup을 검증한다.

## 12. CLI 확장안

```text
--type IMAGE | PDF_OCR
--attachment-id <uuid>
--limit <1..20>
--retry-failed
--mixed-only
--ocr-required-only
--dry-run
```

- 기존 PDF.js CLI 호환을 깨지 않도록 새 OCR CLI에서는 type을 필수로 요구한다. 이미지 156건을 묵시 선택하지 않는다.
- `IMAGE`: 활성 `PENDING` JPEG/PNG, `--retry-failed`가 있으면 이미지 `FAILED`도 포함.
- `PDF_OCR --mixed-only`: `COMPLETED + PDFJS_TEXT_PARTIAL`만 선택.
- `PDF_OCR --ocr-required-only`: `FAILED + OCR_REQUIRED`만 선택.
- 두 PDF mode option은 상호 배타적이며 PDF_OCR에서만 허용한다. `attachment-id`도 type/status 조건을 우회하지 않는다.
- 기본 limit 5, 최대 20을 유지하되 동시성 기본/최대는 1이다.
- dry-run은 DB 선택, 다운로드/signature/metadata와 수행 계획까지만 한다. Tesseract/renderer와 DB 상태/attempt/본문 변경은 실행하지 않는다.
- 알 수 없는 option, 중복 단일값, 값 누락, 범위 밖 정수는 실행 전에 실패한다.

## 13. 표본과 단계별 검증 계획

원본을 이번 단계에서 받지 않았으므로 아래는 선정 기준이며 확정 attachment 목록이 아니다.

### Phase A — 저장소 fixture

- 작은 JPEG/투명 PNG, 한글·영문·숫자 이미지, 무텍스트 사진형 이미지
- EXIF 회전, 픽셀 제한 초과, 손상 JPEG/PNG
- 2~3쪽 스캔 PDF와 텍스트+스캔 MIXED PDF
- 합성 fixture만 관리하고 실제 첨부 원본은 커밋하지 않는다.

### Phase B — 실제 DB dry-run

- JPEG 2건, PNG 1건을 파일명/생성 시점이 겹치지 않게 선택한다.
- DB 변경 없이 dimensions, bytes, signature, 예상 decode memory만 출력하고 텍스트 밀도/사진형을 수동 분류한다.
- checksum 계산 후 중복 그룹에서는 1건만 품질 표본으로 사용한다.
- MIXED PDF 1건은 ID를 문서에 쓰지 않고 `--mixed-only --limit 1 --dry-run`으로 확인한다.

### Phase C — 실제 DB 제한 적용

- 이미지 1~2건만 처리해 상태, 본문 비노출 로그, 재실행 skip, 실패 재처리를 확인한다.
- MIXED PDF는 기존 텍스트의 hash/length/page boundary를 전후 비교해 비후보 페이지 보존을 검증한다.

### Phase D — 제한 배치

- `limit 1`, 이어서 `limit 5`, 동시성 1.
- wall time, child/Node/PM2 RSS, disk, cleanup 잔여, `PROCESSING` 잔류를 기록한다.

### Phase E — 전체 처리

- 이미지 156건과 MIXED PDF 1건을 별도 제한 배치로 처리한다.
- 강제 종료 fixture와 stale recovery를 검증한 뒤 전체 실행한다.

## 14. 구현 순서

1. fixture와 순수 병합 단위 테스트.
2. 설정과 제한형 subprocess runner; timeout/output limit/process-tree kill 테스트.
3. Sharp metadata/전처리와 입력 제한.
4. Tesseract adapter와 binary/language/version 사전 점검.
5. 이미지 service와 조건부 claim/상태 테스트.
6. `pdftocairo` 지정 페이지 renderer.
7. MIXED merge 순수 함수와 순서/중복/멱등성 테스트.
8. OCR_REQUIRED 전부 성공/폐기 orchestration.
9. CLI 조합 검증과 dry-run.
10. Phase A부터 E까지 단계별 검증.

## 15. migration 판단

현 필드만으로 이미지 OCR 성공/무텍스트/실패, OCR_REQUIRED 전체 성공/실패, MIXED 전부 성공 합본과 실패 복원이 가능하다. 따라서 MVP에 migration은 필수가 아니다.

운영 안정화에는 다음을 후보로 둔다.

- `ProgramCaseAttachmentExtractionPage`: attachment, page number, source, status, char count, failure code, extractor version. 페이지 본문은 개인정보·용량 정책 확정 후 선택.
- execution/lease: execution ID, previous status/type, lease expiry, heartbeat.
- cleanup warning과 본 처리 failure를 분리하는 운영 오류 필드 또는 실행 로그 모델.

JSON 필드는 빠르지만 검색·제약·부분 갱신이 약해 장기적으로 page model이 낫다.

## 16. 위험과 보류 결정

- 실제 이미지 dimensions·텍스트 밀도·중복과 EC2 도구 설치/peak RSS는 미확인이다.
- PSM, DPI, threshold/deskew는 fixture와 실제 표본 비교 전 확정하지 않는다.
- cleanup 실패와 성공 결과를 동시에 표현할 정책, crash recovery/lease가 미완이다.
- OCR 본문 개인정보에 대한 로그 금지, 보존 기간, 접근 통제 정책이 필요하다.
- 시스템 패키지는 구현과 Phase A fixture가 준비된 뒤 개발 환경에 설치하고, 운영 설치는 Phase A/B 통과 뒤 배포 절차와 함께 수행한다.

## 17. 참고 자료

- Tesseract 설치/언어 데이터: https://tesseract-ocr.github.io/tessdoc/Installation.html
- Tesseract CLI: https://tesseract-ocr.github.io/tessdoc/Command-Line-Usage.html
- Tesseract.js와 PDF 비지원 범위: https://github.com/naptha/tesseract.js
- Sharp: https://sharp.pixelplumbing.com/
- Poppler: https://poppler.freedesktop.org/

## 18. 2단계 구현 결과 (2026-07-21)

이번 단계에서는 실제 DB 상태나 schema를 변경하지 않고 OCR 실행 기반만 구현했다.

### 추가된 구조

```text
apps/backend/src/config/attachmentOcr.ts
apps/backend/src/services/attachment/
  subprocessRunner.ts
  imageMetadata.ts
  imagePreprocessor.ts
  tesseractOcr.ts
  imageOcrProcessor.ts
apps/backend/scripts/
  fake-subprocess.js
  test-attachment-ocr.js
```

백엔드에 `sharp` 의존성과 `test:attachment-ocr` npm script를 추가했다. 기존 PDF CLI, PDF.js 추출 service와 Prisma schema/migration은 변경하지 않았다.

### 설정과 제한

- Tesseract 기본 executable `tesseract`, 언어 `kor+eng`, PSM 6, timeout 60초, text output 5 MiB.
- stdout/stderr는 각각 64 KiB로 제한한다.
- 이미지 최대 12,000×12,000, 40 MP, 예상 RGBA decode 160 MB, OCR 입력 긴 변 4,000 px.
- PDF renderer 설정은 executable `pdftocairo`, timeout 30초, 200 DPI, 최대 50쪽으로 정의만 했으며 이번 단계에서 renderer를 구현하거나 호출하지 않았다.
- 숫자는 유한한 안전 정수 범위로 검증하며 0, 음수, `NaN`, 과대값을 거부한다. 언어는 소문자·숫자·underscore의 `+` 구분 목록만 허용한다. executable은 환경 설정에서만 읽고 CLI 입력으로 받지 않는다.

### subprocess와 Tesseract adapter

- `spawn`과 argument array, `shell:false`, 숨김 창, stdin 미사용으로 실행한다.
- timeout, AbortSignal, stdout/stderr 상한, exit code/signal, executable 없음과 취소를 구분한다.
- 외부 오류에는 executable, 전체 command line, 작업 경로, 환경값, OCR 본문을 포함하지 않는다.
- Tesseract는 기능 호출 시에만 실행한다. `--version`과 `--list-langs`를 검사하여 version 및 `kor`, `eng` 존재를 확인한다.
- OCR 본문은 stdout이 아닌 고정된 `ocr-output.txt`에서 읽는다. 크기와 strict UTF-8을 검사하고 기존 PDF 정규화 함수로 NUL/control/whitespace를 정리한다.
- 성공·실패 모두 OCR text output을 삭제한다. Tesseract가 로컬에 없어도 import와 backend build는 성공한다.

### 이미지 검사와 전처리

- Sharp metadata로 JPEG/PNG, dimensions, pages, orientation, alpha, pixels, 예상 RGBA memory를 확인한다.
- 손상 파일, 미지원 형식, multi-page/animation, dimension/pixel/decode memory/aspect ratio 초과를 안전한 오류 코드로 거부한다.
- `limitInputPixels`를 decode 경로에 적용한다.
- 전처리는 EXIF rotate, 흰색 flatten, 확대 없는 4,000 px 이내 resize, grayscale, normalize, 결정적 PNG 설정만 사용한다.
- 원본을 덮지 않고 작업 디렉터리의 `ocr-input.png`만 만들며 결과 크기를 검사하고 cleanup callback을 제공한다.

### 순수 image processor

`processImageForOcr`는 signature 판별 → metadata → preprocess → OCR 순서를 수행하고 모든 의존성을 주입할 수 있다. 반환값은 원본/전처리 dimensions, pixels, engine/version/languages, raw/cleaned text, empty 여부와 duration을 포함한다. `imageOcrLogSummary`는 OCR 본문을 의도적으로 제외한다. DB claim이나 저장은 하지 않는다.

### `--plan`과 `--dry-run`

- `--plan`: DB 대상과 도구 준비 여부 및 예상 계획만 확인한다. 다운로드/OCR/DB 변경 없음.
- 향후 OCR `--dry-run`: 다운로드, signature, metadata, 전처리와 실제 OCR까지 수행하고 임시 파일을 정리하되 DB는 변경하지 않는다.
- 이번 단계에서는 둘을 운영 CLI에 노출하지 않았다. 기존 PDF 추출 CLI의 `--dry-run` 의미도 변경하지 않았다.

### 자동화 테스트 범위

테스트 중 Sharp로 작은 JPEG, 투명 PNG, 가로/세로, EXIF orientation, multi-page TIFF, 손상 JPEG/PNG를 임시 디렉터리에 만든다. 실제 원본과 생성 fixture는 커밋하지 않는다. 작은 설정값을 주입해 dimension/pixel/decode 제한을 검증하므로 거대 파일도 만들지 않는다.

테스트 전용 Node 실행 파일은 정상/echo/non-zero/delay/과대 stdout/과대 stderr를 제공한다. Tesseract adapter에는 가짜 runner를 주입해 안전한 arguments, version/languages, 결과 파일, 빈 text, timeout, exit failure, output size, NUL 정규화와 cleanup을 검증한다. processor 테스트는 단계 순서, 실패 시 OCR 미호출/cleanup과 본문 없는 로그를 확인한다.

### 현재 미검증 범위와 다음 사용자 작업

- 로컬에는 Tesseract와 시스템 Poppler가 설치되지 않아 실제 `kor+eng` OCR 정확도, binary/version/language 사전 점검과 PDF rendering은 미검증이다.
- 실제 DB 이미지 다운로드/상태 변경/본문 저장과 156건 batch는 수행하지 않았다.
- 다음 단계에서 사용자가 개발 환경에 Tesseract 5, `kor`/`eng` traineddata를 설치한 뒤 사전 점검과 합성 fixture 실제 OCR을 실행해야 한다.
- 이후 대표 DB 이미지 dry-run → 1~2건 제한 저장 → Poppler 설치 → MIXED PDF 순서로 진행한다.
