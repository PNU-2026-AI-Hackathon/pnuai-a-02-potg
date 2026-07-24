# 이미지 및 스캔 PDF OCR 실행 환경과 구현 설계

- 분석일: 2026-07-21
- 기준 브랜치: `feat/image-pdf-ocr`
- 기준 커밋: `bc90e55` (`main`, `origin/main`)
- 범위: #78 구현 전 환경·DB·코드 분석과 설계
- 제외: 패키지/시스템 도구 설치, OCR 실행, 원본 다운로드, DB 및 schema 변경

> 현재 정책(2026-07-24): 운영 이미지 OCR 엔진은 **NAVER Cloud CLOVA OCR General API V2**다. EXIF 방향 반영, 투명 배경 흰색 합성과 제한 초과 시 축소만 수행하며 Tesseract용 grayscale/normalize는 사용하지 않는다. IMAGE `--dry-run`은 실제 CLOVA 호출 후 DB를 변경하지 않고, 옵션 없는 IMAGE 실행은 원자적 claim 후 결과를 저장한다. 1건 검증 실행은 중복 과금을 막기 위해 재시도 0을 사용한다. 1~18절은 초기 Tesseract 분석·구현 이력이며 현재 운영 정책은 19절 이후를 기준으로 한다.

## 1. 결론

권장 조합은 **Tesseract 5 CLI(`kor+eng`) + Sharp 전처리 + Poppler `pdftocairo` PNG 렌더링**이다. Node.js는 파이프라인과 상태를 제어하고 OCR·렌더링은 자식 프로세스로 격리한다. 911 MiB, swap 없음인 운영 EC2에서는 동시성 1, 페이지 단위 직렬 처리, 픽셀/DPI 제한과 timeout이 전제다.

> 기술 결정 변경: 위 내용은 초기 분석 결론이다. 실제 복합 한국어 홍보 포스터 표본에서 영역 탐지, 읽기 순서와 한글 인식 품질이 충분하지 않아 2026-07-23 운영 OCR 엔진을 NAVER Cloud CLOVA OCR General API V2로 변경했다. 아래 19절에 변경 구현과 정책을 기록한다.

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

## 18. 초기 Tesseract 2단계 구현 기록 (2026-07-21, 현재 비활성)

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

## 19. CLOVA OCR 전환 구현 결과 (2026-07-23)

### 기술 결정 변경

```text
초기 Tesseract 5 CLI 결정
→ 실제 복합 한국어 포스터 표본 검증
→ 영역 탐지·읽기 순서·한글 품질 한계 확인
→ NAVER Cloud CLOVA OCR General API V2로 변경
```

Sharp metadata/입력 제한/전처리, downloader, signature 판별, 기존 text 정규화, cleanup과 `subprocessRunner`는 유지했다. subprocess는 이미지 OCR에는 쓰지 않지만 향후 Poppler `pdftocairo`에 필요하다. Tesseract binary·traineddata 검사, CLI arguments, Tesseract 전용 설정·오류·adapter 테스트와 `tesseractOcr.ts`는 제거했다. 과거 분석과 커밋은 기술 결정 이력으로 유지한다.

### 모듈 구조

```text
src/config/clovaOcr.ts
src/services/attachment/
  ocrEngine.ts
  clovaOcrClient.ts
  clovaOcrResponseParser.ts
  imageOcrProcessor.ts
```

`imageOcrProcessor`는 URL, Secret, HTTP 세부사항을 모르며 주입된 `OcrEngine`만 호출한다. signature → metadata → 최소 전처리 → engine → cleanup 순서는 유지하고, 실패 시에도 전처리 파일을 정리한다. 로그 요약에는 raw/cleaned OCR 본문을 포함하지 않는다.

### 환경변수와 Secret 보호

```text
CLOVA_OCR_ENABLED=false
CLOVA_OCR_INVOKE_URL=
CLOVA_OCR_SECRET=
CLOVA_OCR_TIMEOUT_MS=30000
CLOVA_OCR_RESPONSE_MAX_BYTES=5242880
CLOVA_OCR_MAX_RETRIES=1
```

- 실제 실행은 enabled, HTTPS URL, credentials/fragment 없음, 비어 있지 않은 Secret을 요구한다.
- timeout과 response 제한은 유한한 안전 정수, retries는 0~2만 허용한다.
- 안전한 설정 요약은 enabled와 URL/Secret 설정 여부 boolean, timeout, retries만 제공한다. host도 출력하지 않는다.
- 실제 `.env`, Invoke URL과 Secret은 읽어서 문서·로그·오류·snapshot에 복사하지 않는다.

### 외부 전송 정책과 요청

- 공식 General OCR V2 multipart 형식의 `message`와 `file`을 사용한다.
- message는 V2, UUID requestId, millisecond timestamp, `lang=ko`, 단일 image format/name, `enableTableDetection=false`로 구성한다.
- 원본 URL, attachment ID, 원본 파일명과 Base64 data는 전송하지 않는다.
- 내부 검증·전처리를 통과한 파일을 Node `openAsBlob`으로 열고 `ocr-input.jpg` 또는 `ocr-input.png`라는 고정 이름으로 전송한다.
- `X-OCR-SECRET`만 명시하고 multipart `Content-Type`과 boundary는 Node FormData가 생성한다.
- 파일 하나당 API 요청 하나를 기본으로 한다.

### timeout, 응답 제한과 오류

- 기본 timeout은 요청 및 response stream 읽기를 포함한 30초다.
- response는 stream으로 읽으며 기본 5 MiB를 넘으면 즉시 취소한다. 제한 없는 `response.text()`를 사용하지 않는다.
- strict UTF-8과 JSON parsing을 적용하며 body나 OCR 원문은 오류에 포함하지 않는다.
- 400/401/403/429/5xx/기타 HTTP를 request invalid/auth/forbidden/rate limited/server/request failed로 구분한다.
- 2xx도 images, inferResult, fields, inferText, confidence, boundingPoly와 lineBreak schema를 검증한다.
- inferResult가 SUCCESS가 아니면 image failure, 빈 fields는 정상적인 empty 결과다.

### 텍스트 구성

- 모든 field에 유효한 lineBreak가 있으면 API 배열 순서를 유지하고 lineBreak에 따라 공백/개행을 넣는다.
- lineBreak가 없으면 boundingPoly의 위쪽 좌표, 왼쪽 좌표, 원래 index 순으로 안정 정렬한다.
- 낮은 confidence를 버리거나 문장부호를 추가하지 않는다.
- NUL과 control 문자를 제거하고 기존 정규화 함수를 재사용한다.
- field count, average confidence, empty 여부와 읽기 순서 전략을 반환하지만 field별 box/confidence는 DB에 저장하지 않는다.

### 재시도와 호출량

- 네트워크 연결 실패, HTTP 429와 5xx만 제한적으로 재시도한다.
- 400/401/403, 설정·입력·schema/image 결과 오류는 재시도하지 않는다.
- timeout은 서버 처리 완료 여부를 알 수 없어 중복 과금 가능성이 있으므로 자동 재시도하지 않는다.
- 기본 retries 1, 최대 2이며 100ms부터 제한된 exponential backoff를 사용한다.
- 최초 호출을 포함한 `apiCallCount`와 추가 시도 수인 `retryCount`를 결과에 명시한다.

### CLOVA 기본 전처리

EXIF 방향 반영, 투명 PNG의 흰색 배경 합성, 애플리케이션 긴 변 제한을 넘을 때의 축소와 PNG 출력만 적용한다. Tesseract 실험용 grayscale과 normalize는 제거했다. threshold, deskew, sharpening, 영역 분할도 자동 적용하지 않는다.

### Mock 검증과 남은 범위

자동화 테스트는 명시적으로 주입한 fake HTTPS URL, fake Secret과 mock fetch만 사용한다. multipart message/file, 안전한 내부 파일명, lineBreak와 coordinate parsing, 빈 text, 모든 HTTP mapping, network/429/5xx retry, auth/schema no-retry, timeout no-retry, response size/JSON/schema/infer failure, 호출량과 processor cleanup을 검증한다. 공통 가짜 subprocess와 Sharp 합성 fixture 테스트도 유지한다.

이번 단계의 실제 CLOVA API 호출은 0건이며 실제 DB 다운로드·claim·저장, schema/migration 변경도 없다. 다음 단계의 대표 공개 포스터 1건 dry-run은 최소 1회 API 비용을 발생시킬 수 있으므로 사용자의 명시적 승인을 받은 후 실행한다.

### 공식 명세

- CLOVA OCR 개요: https://api.ncloud-docs.com/docs/ai-application-service-ocr
- General OCR V2: https://api.ncloud-docs.com/docs/ai-application-service-ocr-ocr
- multipart 요청 예제: https://api.ncloud-docs.com/docs/ai-application-service-ocr-example01

## 20. IMAGE CLI와 실제 표본 dry-run 결과 (2026-07-24)

### CLI 구조와 계약

기존 `extract:program-attachments` 명령에서 `--type PDF`는 기존 PDF 서비스로, `--type IMAGE`는 별도의 read-only OCR orchestration으로 분기한다. IMAGE는 기본 limit 1, 최대 5이며 plan/dry-run 동시 지정, 중복·미지원 옵션과 잘못된 UUID를 거부한다.

- `--plan`: 활성 PENDING 이미지(JPG/JPEG/PNG)를 `createdAt`, `id` 오름차순으로 선택하고 preflight와 예상 호출량만 계산한다. 다운로드, 임시 파일 생성, OCR, DB 변경은 수행하지 않는다.
- `--dry-run`: 동일 기준의 이미지 1건을 다운로드하고 signature, Sharp metadata, 최소 전처리와 CLOVA OCR을 수행하지만 DB update를 호출하지 않는다.
- 첫 실제 표본은 timeout이나 429/5xx에서도 중복 전송·과금하지 않도록 실행 범위에서 `maxRetries=0`으로 강제했다.
- 다운로드 URL은 금정구청 공식 출처 allowlist와 public-address 검증을 그대로 통과해야 한다.

### 안전 검증

실제 값은 출력하지 않고 enabled, Invoke URL/Secret 설정 여부, timeout, 응답 제한과 retries만 preflight에 포함했다. `.env`는 Git ignore 상태이며 수정하지 않았다. Invoke URL, host, Secret, attachment ID, 전체 URL, 원본 파일명, checksum, OCR 본문과 전체 응답은 로그나 문서에 저장하지 않았다.

dry-run 전후 대상 fingerprint에는 상태, attempt/시각, 본문 길이, 탐지 metadata, checksum, extractor, 실패 정보와 `updatedAt`을 포함했다. ProgramCase, Session, Attachment 전체/활성 및 이미지·PDF 상태별 집계도 전후 비교했다.

### 실제 공개 이미지 1건 결과

```text
plan selected: 1
estimated API calls: 1
actual API calls: 1
retry count: 0
database mutation: false
target fingerprint unchanged: true
aggregate counts unchanged: true
detected format: JPEG
original dimensions: 794 x 1123
preprocessed dimensions: 794 x 1123
file bytes: 237079
field count: 31
raw text characters: 157
cleaned text characters: 157
average confidence: 0.9196083019354843
reading order: LINE_BREAK
empty: false
OCR duration: 3605 ms
remaining temporary files: 0
remaining OCR job directories: 0
```

본문이 비어 있지 않고 평균 confidence가 약 0.920이므로 첫 표본에서 CLOVA 연결, 한국어 텍스트 탐지와 응답 parsing은 정상으로 판단한다. 전체 OCR 본문과 500자 미리보기는 개인정보 가능성을 재검토하지 않은 상태에서 불필요하게 노출하지 않기 위해 제공하거나 저장하지 않았다.

이번 결과는 read-only 표본 검증이며 실제 DB 저장은 수행하지 않았다. 다음 단계는 별도 승인 아래 동일한 안전 장치로 이미지 1건 저장 전환을 구현하고 검증하는 것이다. 스캔 PDF, MIXED PDF, 배치 처리는 계속 범위 밖이다.

## 21. IMAGE 1건 실제 DB 저장 결과 (2026-07-24)

### write orchestration

IMAGE 서비스는 `PENDING` 후보를 `createdAt`, `id` 오름차순으로 선택한 뒤 `id`, 활성 상태, PENDING 상태와 JPG/JPEG/PNG 형식을 조건으로 `updateMany` claim한다. 성공한 단일 claim만 `PROCESSING`으로 전환하면서 attempt를 증가시키고 시각을 기록한다. claim 경쟁에서 패한 실행은 다운로드와 API 호출 없이 skip한다.

성공 시 raw/cleaned text, 탐지 형식/MIME, 파일 크기, checksum, `CLOVA_OCR_GENERAL`/`V2`, 추출 시각을 저장하고 `COMPLETED`로 전환한다. 빈 fields도 빈 문자열의 정상 완료다. claim 이후 실패는 안전한 code/message만 저장하고 `FAILED`로 전환한다. 기존 IMAGE dry-run의 DB 불변 계약은 유지한다.

### 실제 단건 결과

```text
plan selected / estimated / actual calls: 1 / 1 / 0
write selected / claimed / completed / failed / skipped: 1 / 1 / 1 / 0 / 0
actual API calls / retries: 1 / 0
image status before: PENDING 156, COMPLETED 0
image status after: PENDING 155, COMPLETED 1
attempt count: 1
raw / cleaned text length: 157 / 157
extractor: CLOVA_OCR_GENERAL V2
checksum stored / length: true / 64
field count: 31
average confidence: 0.9196083019354843
reading order: LINE_BREAK
completed target re-selection: 0
ProgramCase / Session / Attachment / active: 349 / 20 / 237 / 237
PDF / HWP: 55 / 26
duplicate logical keys / orphan attachments: 0 / 0
remaining temporary files / job directories: 0 / 0
```

실제 Invoke URL, host, Secret, attachment ID, URL, 원본 파일명, checksum 값, OCR 본문과 전체 응답은 출력하거나 기록하지 않았다. OCR 결과의 null 여부와 길이만 자동 검증했다. 본문 품질은 Prisma Studio에서 `ProgramCaseAttachment.cleanedText`를 로컬로 직접 확인해야 한다.

Mock 테스트는 성공·빈 text·실패 저장, claim 경쟁, 완료 대상 skip, dry-run 불변과 성공/실패 cleanup을 검증하며 실제 endpoint 호출은 0회다. 재동기화 보존 테스트는 CLOVA 이미지 결과 형태에 대해 ID, 본문, extractor, checksum, attempt와 추출 시각이 동일 file URL 동기화 후 유지됨을 확인했다.

다음 단계의 limit 5는 비용과 다건 DB 변경을 수반하므로 별도 승인 후 진행한다. MIXED/스캔 PDF와 실패 대상 재시도는 계속 범위 밖이다.

## 22. IMAGE limit 5 제한 배치 결과 (2026-07-24)

단건 orchestration을 동시성 1로 순차 호출하는 배치 계층을 추가했다. 각 파일은 독립적으로 조건부 claim, 다운로드, signature/metadata/전처리, 최대 1회 OCR, 성공·실패 저장과 cleanup을 수행한다. 파일 하나의 실패는 안전하게 `FAILED`로 저장된 뒤 다음 파일 처리를 계속하며, claim 실패는 다운로드와 API 호출 없이 skip한다. 실행 전체에서 `maxRetries=0`을 유지한다.

Mock 다건 테스트는 5개 후보에 성공, API 실패, 빈 텍스트 성공, claim 경쟁과 후속 성공을 섞어 실패 격리, 순차 실행, 호출 상한, retry 0과 파일별 cleanup을 검증했다. 테스트의 실제 외부 호출은 0회다.

```text
limit 5 plan selected / estimated / actual calls: 5 / 5 / 0
batch selected / claimed / completed / failed / skipped: 5 / 5 / 5 / 0 / 0
actual API calls / retries: 5 / 0
empty text: 0
failure codes: none
average OCR duration: 1508 ms
raw / cleaned character range: 224..844 / 224..844
field count range: 40..173
per-file average confidence range: 0.9391391541618506..0.9734636960000002
reading order: LINE_BREAK
image status before: PENDING 155, PROCESSING 0, COMPLETED 1, FAILED 0
image status after: PENDING 150, PROCESSING 0, COMPLETED 6, FAILED 0
completed target re-selection: 0
ProgramCase / Session / Attachment / active: 349 / 20 / 237 / 237
PDF / HWP: 55 / 26
duplicate logical keys / orphan attachments: 0 / 0
remaining temporary files / job directories: 0 / 0
```

기존 완료 이미지의 attempt 1, 본문 길이 157/157, extractor/checksum/추출 시각은 그대로 유지됐다. 새 완료 5건도 attempt 1, 본문 non-null, checksum 길이 64, `CLOVA_OCR_GENERAL`/`V2`, 실패 정보 null과 추출 시각 존재를 확인했다.

Invoke URL, host, Secret, attachment ID, URL, 원본 파일명, checksum 값, OCR 본문과 전체 응답은 출력·문서화하지 않았다. 사용자는 Prisma Studio에서 새 `COMPLETED` 이미지의 `cleanedText`를 원본 프로그램 문맥과 비교해 날짜·시간·대상·장소·문의 내용 및 줄바꿈 순서를 수동 검토해야 한다.

기술적으로 다음 제한 배치로 진행할 수 있지만 실제 외부 호출과 다건 DB 변경은 매번 별도 범위 승인이 필요하다. 전체 150건 자동 처리는 비용, 중복 콘텐츠와 품질 표본을 먼저 검토한 뒤 결정한다.

## 23. IMAGE 20건 확대 제한 배치 결과 (2026-07-24)

기존 limit 5 순차 배치를 네 번만 실행했다. 각 배치 앞에서 plan을 수행하고, 배치 직후 DB 집계·기존 완료 결과·완료 대상 skip·중복/고아 관계와 cleanup을 검증했다. 모든 검증이 통과한 경우에만 다음 배치로 진행했으며 네 번째 실행 후 승인 상한 20회에 도달하여 추가 배치를 실행하지 않았다.

| 배치 | plan 선택/예상 호출 | selected/claimed/completed/failed/skipped | 실제 호출/retry | 빈 text | 평균 OCR 시간 |
|---|---:|---:|---:|---:|---:|
| Batch 1 | 5 / 5 | 5 / 5 / 5 / 0 / 0 | 5 / 0 | 0 | 1,994 ms |
| Batch 2 | 5 / 5 | 5 / 5 / 5 / 0 / 0 | 5 / 0 | 0 | 1,801 ms |
| Batch 3 | 5 / 5 | 5 / 5 / 5 / 0 / 0 | 5 / 0 | 0 | 1,947 ms |
| Batch 4 | 5 / 5 | 5 / 5 / 5 / 0 / 0 | 5 / 0 | 0 | 1,608 ms |

```text
executed batches: 4
total selected / claimed / completed / failed / skipped: 20 / 20 / 20 / 0 / 0
total actual API calls / retries: 20 / 0
empty text / failure codes: 0 / none
overall average OCR duration: 1838 ms
raw / cleaned character range: 224..1072 / 224..1072
field count range: 40..266
per-file average confidence range: 0.9231596054545456..0.9903633228991592
reading order strategies: LINE_BREAK
image status before: PENDING 150, PROCESSING 0, COMPLETED 6, FAILED 0
image status after: PENDING 130, PROCESSING 0, COMPLETED 26, FAILED 0
completed target re-selection: 0
ProgramCase / Session / Attachment / active: 349 / 20 / 237 / 237
PDF / HWP: 55 / 26
duplicate logical keys / orphan attachments: 0 / 0
remaining temporary files / job directories: 0 / 0
```

confidence 0.70 미만, 빈 text, field 0, 다른 reading-order 전략, 입력 제한 근접 표본은 없었다. 문자 수 최솟값도 224자여서 이번 기준에서 별도 이상 품질 표본은 0건이다. 기존 완료 이미지 6건은 attempt, 본문 길이, extractor, checksum과 추출 시각이 유지됐다. 중단 조건은 발생하지 않았다.

Invoke URL, host, Secret, attachment ID, URL, 원본 파일명, checksum 값, OCR 본문과 전체 응답은 출력·문서화하지 않았다. 사용자는 Prisma Studio에서 새 완료 결과의 `cleanedText`를 원본 프로그램 문맥과 비교하여 날짜·시간, 모집 대상·인원, 장소, 문의처, 본문과 줄바꿈 순서를 수동 검토해야 한다.

파이프라인은 20건 확대 검증에서 안정적이었지만 PENDING 130건 전체 처리는 최대 130회의 외부 호출과 DB 변경을 수반한다. 동일 콘텐츠가 여러 attachment에 반복되는 사례가 이미 관찰됐으므로, 전체 처리 전에 checksum 기반 결과 재사용 또는 중복 비용 절감 설계를 우선 검토한다.

## 24. IMAGE checksum 중복 분석 및 결과 재사용 설계 (2026-07-24)

중복은 SHA-256 checksum 완전 일치, 즉 파일 byte가 동일한 경우만 인정한다. 리사이즈·재압축·crop 등 시각적으로 비슷한 이미지는 재사용 대상이 아니다.

donor는 활성 `COMPLETED`, 동일 checksum, raw/cleaned text non-null, failure 없음, `CLOVA_OCR_GENERAL`, extractor version 존재 조건을 모두 만족해야 한다. 현재 attachment는 제외하고 `extractedAt`, `id` 오름차순으로 선택한다. 같은 checksum donor가 여러 개이면 raw/cleaned text와 extractor 정보가 모두 같은 경우에만 첫 donor를 사용하며, 하나라도 다르면 충돌로 분류하고 재사용하지 않는다. 빈 문자열의 정상 완료 결과도 유효 donor다.

write orchestration은 claim과 안전한 다운로드 후 signature를 확인하고, downloader가 계산한 checksum으로 donor를 조회한다. 일관된 donor가 있으면 전처리와 CLOVA 호출을 생략하고 donor 본문·extractor를 현재 파일 metadata/checksum과 함께 저장한다. 별도 migration이나 extractor 문자열 변경 없이 실행 요약에 `reusedCount`, `ocrProcessedCount`, `apiCallsSaved`, `checksumConflictCount`를 제공한다. donor가 없거나 충돌하면 기존 OCR 경로를 유지한다. 순차 배치에서는 먼저 완료된 같은-checksum PENDING 파일도 다음 파일의 donor가 된다.

Mock 테스트는 donor 없음/재사용, 빈 text donor, 서로 다른 donor 본문의 충돌, OCR 미호출, 저장 값과 재사용 집계를 검증했다. 실제 endpoint와 실제 Secret은 사용하지 않았다.

### PENDING 전체 read-only 분석

분석 도구는 활성 PENDING JPG/JPEG/PNG를 `createdAt`, `id` 순으로 한 건씩 다운로드하고 signature/checksum 확인 직후 cleanup했다. CLOVA client 생성, 이미지 전처리, claim, attempt 증가와 DB update는 수행하지 않았다.

```text
pending candidates: 130
downloaded / analyzed / failed: 124 / 124 / 6
completed donor matches: 1
pending-only duplicate groups / files: 9 / 51
unique pending checksums without donor: 81
checksum conflicts: 0
estimated calls without reuse: 124
estimated calls with reuse: 81
estimated calls saved: 43
estimated reduction: 34.68%
largest duplicate group: 19
duplicate group size distribution: 2 files x 3 groups, 3 x 1, 5 x 3, 8 x 1, 19 x 1
actual OCR API calls: 0
database mutation: false
remaining temporary files / job directories: 0 / 0
```

분석 실패 6건은 예상 호출 계산에서 제외했으며 상태나 오류를 DB에 기록하지 않았다. 분석 전후 ProgramCase, Session, Attachment 전체/활성, 이미지/PDF 상태, attempt 합계, 본문/checksum 존재 건수와 PENDING 개별 `updatedAt` fingerprint가 동일했다.

Invoke URL, host, Secret, attachment ID, URL, 원본 파일명, checksum 값, OCR 본문과 원본 이미지는 출력·문서화하지 않았다.

checksum 재사용 경로는 Mock과 실제 read-only 분석 기준으로 제한 배치에 적용 가능하다. 분석 성공 124건 기준 예상 유료 호출은 81회이며, 분석 실패 6건은 별도 원인 확인 전 자동 처리하지 않는다. 다음 단계는 재사용을 활성화한 limit 5 배치로 donor 복사와 신규 OCR이 함께 동작하는지 검증하는 것이 적절하다.

## 25. IMAGE checksum 재사용 실제 5건 혼합 검증 (2026-07-24)

read-only runner가 PENDING 전체 checksum을 다시 분석하여 기존 COMPLETED donor 일치 1건, 같은 PENDING-only 중복 그룹의 seed/reuse 각 1건, donor 없는 고유 이미지 2건을 내부적으로 선정했다. 분석 실패 6건은 선택·claim·재다운로드 조사·OCR 대상에서 제외했다. 식별정보와 checksum은 메모리에서만 사용하고 출력·manifest 저장하지 않았다.

```text
plan selected total: 5
completed donor reuse / pending duplicate seed / pending duplicate reuse / unique: 1 / 1 / 1 / 2
estimated reused / OCR processed / API calls: 2 / 3 / 3

actual selected / claimed / completed / failed / skipped: 5 / 5 / 5 / 0 / 0
reused / OCR processed / API calls saved: 2 / 3 / 2
checksum conflicts: 0
actual API calls / retries: 3 / 0
empty text / failure codes: 0 / none
processing order: REUSED, OCR, REUSED, OCR, OCR
raw / cleaned lengths by sequence: 405, 439, 439, 486, 482
image status before: PENDING 130, PROCESSING 0, COMPLETED 26, FAILED 0
image status after: PENDING 125, PROCESSING 0, COMPLETED 31, FAILED 0
ProgramCase / Session / Attachment / active: 349 / 20 / 237 / 237
PDF / HWP: 55 / 26
duplicate logical keys / orphan attachments: 0 / 0
remaining temporary files / job directories / manifest: 0 / 0 / 0
```

재사용 결과는 같은 checksum donor의 raw/cleaned text 및 extractor type/version과 동일함을 본문 출력 없이 비교했다. 신규 OCR과 재사용 결과 모두 attempt 1, 본문 non-null, checksum 길이 64, `CLOVA_OCR_GENERAL`/`V2`, failure null과 extractedAt 존재를 확인했다. 기존 COMPLETED 26건은 변경되지 않았고 완료 대상 selection은 0건이었다.

Invoke URL, host, Secret, attachment ID, URL, 원본 파일명, checksum 값, OCR 본문과 전체 응답은 출력·문서화하지 않았다.

실제 혼합 배치에서 예상과 동일하게 5건 중 2건을 재사용하고 유료 호출을 3회로 제한했으므로 checksum 재사용을 후속 제한 배치에 활성화할 수 있다. 다음에는 분석 실패 6건을 API와 DB 변경 없이 오류 단계별로 분류한 뒤, 정상 분석 대상에 대해 limit 5~20 범위의 재사용 배치를 진행한다.

## 26. IMAGE checksum 분석 실패 6건 read-only 원인 조사 (2026-07-24)

진단 도구는 현재 활성 PENDING 이미지 전체를 동시성 1, 파일당 요청 1회, 자동 재시도 0으로 순회했다. 기존 downloader와 allowlist/DNS/public-IP 검증, redirect 정책, signature detector와 Sharp metadata 검사만 사용했으며 CLOVA client, 전처리, claim과 DB update는 연결하지 않았다.

Mock 분류 테스트는 timeout, 일반 network failure, HTTP 403/404/5xx, 출처 차단, HTML 응답, signature/metadata 불일치, 이미지 decode 실패와 unknown 오류가 안전한 코드·범주로 변환되고 원본 오류 메시지가 노출되지 않음을 확인했다.

```text
pending candidates: 125
previously failed expected: 6
current analysis failures: 0
currently recovered: 6
newly failed: 0
download / signature / metadata success: 125 / 125 / 125
temporary network / permanent input / code-policy / unknown failures: 0 / 0 / 0 / 0
failure codes / stages: none
actual OCR API calls: 0
database mutation: false
image status: PENDING 125, PROCESSING 0, COMPLETED 31, FAILED 0
ProgramCase / Session / Attachment / active: 349 / 20 / 237 / 237
PDF / HWP: 55 / 26
remaining temporary files / job directories / manifest: 0 / 0 / 0
```

이전 실패 6건 모두 이번 단일 요청에서 정상 회복되어 특정 오류 코드가 재현되지 않았다. 현재 증거로는 영구 URL·형식 오류나 detector/allowlist 결함이 아니며, 이전 실행 당시의 일시적인 네트워크 또는 원격 서버 상태였을 가능성이 높다. 원인을 단정하거나 DB에 실패 상태를 기록하지 않는다.

125건 모두 현재 자동 IMAGE 처리 대상으로 복귀 가능하다. checksum 재사용을 활성화한 제한 배치를 계속할 수 있으며, 같은 대상에서 다시 네트워크 오류가 발생하면 재시도 없이 안전 코드로 저장하거나 다음 배치 진입을 중단하는 기존 정책을 유지한다.

Invoke URL, host, Secret, attachment ID, URL, 파일명, checksum, 응답 본문, OCR 본문과 임시 경로는 출력·문서화하지 않았다.

## 27. IMAGE checksum 재사용 활성화 20건 제한 배치 (2026-07-24)

checksum 재사용이 활성화된 기존 IMAGE `--limit 5` 배치를 네 번 순차 실행했다. 각 배치 전에 비용 0 plan을 확인하고, 실행 직후 최근 완료 저장 필드, attempt, donor 결과 동일성, DB 집계, 논리키·고아 관계를 검증한 뒤에만 다음 배치로 진행했다.

| 배치 | selected/claimed/completed/failed/skipped | reused/OCR/saved | 실제 호출/retry | 평균 OCR 시간 |
|---|---:|---:|---:|---:|
| Batch 1 | 5 / 5 / 5 / 0 / 0 | 2 / 3 / 2 | 3 / 0 | 1,256 ms |
| Batch 2 | 5 / 5 / 5 / 0 / 0 | 1 / 4 / 1 | 4 / 0 | 1,545 ms |
| Batch 3 | 5 / 5 / 5 / 0 / 0 | 0 / 5 / 0 | 5 / 0 | 2,069 ms |
| Batch 4 | 5 / 5 / 5 / 0 / 0 | 0 / 5 / 0 | 5 / 0 | 2,559 ms |

```text
executed batches: 4
total selected / claimed / completed / failed / skipped: 20 / 20 / 20 / 0 / 0
total reused / OCR processed / API calls saved: 3 / 17 / 3
total actual API calls / retries: 17 / 0
checksum conflicts / empty text / failure codes: 0 / 0 / none
new OCR raw / cleaned character range: 448..1231 / 448..1231
new OCR field count range: 102..297
new OCR average confidence range: 0.9174156582242989..0.9910538654966883
reading order strategies: LINE_BREAK
image status before: PENDING 125, PROCESSING 0, COMPLETED 31, FAILED 0
image status after: PENDING 105, PROCESSING 0, COMPLETED 51, FAILED 0
ProgramCase / Session / Attachment / active: 349 / 20 / 237 / 237
PDF / HWP: 55 / 26
duplicate logical keys / orphan attachments: 0 / 0
remaining temporary files / job directories / manifest: 0 / 0 / 0
```

재사용 결과 3건은 API 호출 0으로 donor 본문·extractor가 동일하게 저장됐고, 신규 OCR 17건은 API 호출 1, attempt 1, 본문 non-null, checksum 길이 64, `CLOVA_OCR_GENERAL`/`V2`, failure null 상태를 확인했다. 기존 COMPLETED 31건은 변경되지 않았고 완료 대상은 다시 선택되지 않았다.

confidence 0.70 미만, field 0, 빈 text, 다른 reading-order 전략은 없었다. 원본 장축 3,933px 표본 4건은 OCR 입력 긴 변 4,000px 기준에 가깝지만 제한 이내에서 정상 처리됐다. 품질 주의 표본으로 표시하되 오류로 분류하지 않는다.

Invoke URL, host, Secret, attachment ID, URL, 파일명, checksum 값, OCR 본문, 전체 응답과 원본 이미지는 출력·문서화하지 않았다.

checksum 재사용 배치는 실제 20건에서 오류 없이 호출 3회를 절감했으므로 계속 활성화할 수 있다. 남은 PENDING 105건 전체 처리는 최대 105건 DB 변경과 상당한 외부 호출을 수반하므로 별도 승인과 제한 배치 단위 검증을 유지한다.

## 28. IMAGE 남은 105건 최종 checksum 재사용 배치 (2026-07-24)

시작 전 donor 충돌 정책을 보완했다. 같은 checksum의 유효 donor들이 서로 다른 OCR 결과를 가지면 `CHECKSUM_DONOR_CONFLICT`로 실패 처리하고 신규 CLOVA OCR로 우회하지 않는다. Mock 테스트에서 충돌 시 실제 API 호출이 0회이고 안전 오류 코드가 반환되는 것을 확인했다.

남은 PENDING IMAGE 105건을 동시성 1, 파일당 재시도 0, 배치당 최대 5건으로 처리했다. 각 배치는 비용 없는 plan, write, 최근 저장 결과와 전체 DB 무결성 검증 순으로 진행했으며 검증을 통과한 경우에만 다음 배치를 시작했다.

| 배치 | selected/claimed/completed/failed/skipped | reused/OCR/saved | 실제 호출/retry | 빈 text/conflict | 처리 후 PENDING |
|---|---:|---:|---:|---:|---:|
| Batch 01 | 5 / 5 / 5 / 0 / 0 | 4 / 1 / 4 | 1 / 0 | 0 / 0 | 100 |
| Batch 02 | 5 / 5 / 5 / 0 / 0 | 0 / 5 / 0 | 5 / 0 | 0 / 0 | 95 |
| Batch 03 | 5 / 5 / 5 / 0 / 0 | 1 / 4 / 1 | 4 / 0 | 0 / 0 | 90 |
| Batch 04 | 5 / 5 / 5 / 0 / 0 | 3 / 2 / 3 | 2 / 0 | 0 / 0 | 85 |
| Batch 05 | 5 / 5 / 5 / 0 / 0 | 0 / 5 / 0 | 5 / 0 | 0 / 0 | 80 |
| Batch 06 | 5 / 5 / 5 / 0 / 0 | 1 / 4 / 1 | 4 / 0 | 0 / 0 | 75 |
| Batch 07 | 5 / 5 / 5 / 0 / 0 | 3 / 2 / 3 | 2 / 0 | 0 / 0 | 70 |
| Batch 08 | 5 / 5 / 5 / 0 / 0 | 0 / 5 / 0 | 5 / 0 | 0 / 0 | 65 |
| Batch 09 | 5 / 5 / 5 / 0 / 0 | 0 / 5 / 0 | 5 / 0 | 0 / 0 | 60 |
| Batch 10 | 5 / 5 / 5 / 0 / 0 | 0 / 5 / 0 | 5 / 0 | 0 / 0 | 55 |
| Batch 11 | 5 / 5 / 5 / 0 / 0 | 0 / 5 / 0 | 5 / 0 | 0 / 0 | 50 |
| Batch 12 | 5 / 5 / 5 / 0 / 0 | 0 / 5 / 0 | 5 / 0 | 0 / 0 | 45 |
| Batch 13 | 5 / 5 / 5 / 0 / 0 | 4 / 1 / 4 | 1 / 0 | 0 / 0 | 40 |
| Batch 14 | 5 / 5 / 5 / 0 / 0 | 2 / 3 / 2 | 3 / 0 | 0 / 0 | 35 |
| Batch 15 | 5 / 5 / 5 / 0 / 0 | 2 / 3 / 2 | 3 / 0 | 0 / 0 | 30 |
| Batch 16 | 5 / 5 / 5 / 0 / 0 | 0 / 5 / 0 | 5 / 0 | 0 / 0 | 25 |
| Batch 17 | 5 / 5 / 5 / 0 / 0 | 1 / 4 / 1 | 4 / 0 | 0 / 0 | 20 |
| Batch 18 | 5 / 5 / 5 / 0 / 0 | 5 / 0 / 5 | 0 / 0 | 0 / 0 | 15 |
| Batch 19 | 5 / 5 / 5 / 0 / 0 | 5 / 0 / 5 | 0 / 0 | 0 / 0 | 10 |
| Batch 20 | 5 / 5 / 5 / 0 / 0 | 5 / 0 / 5 | 0 / 0 | 0 / 0 | 5 |
| Batch 21 | 5 / 5 / 5 / 0 / 0 | 5 / 0 / 5 | 0 / 0 | 0 / 0 | 0 |

```text
executed batches: 21
total selected / claimed / completed / failed / skipped: 105 / 105 / 105 / 0 / 0
total reused / OCR processed / API calls saved: 41 / 64 / 41
total actual API calls / retries: 64 / 0
checksum conflicts / empty text / failure codes: 0 / 0 / none
new OCR cleaned character range: 262..5085
new OCR field count range: 61..894
new OCR average confidence range: 0.8982841283692306..0.9918452849629628
reading order strategies: LINE_BREAK
quality warnings: 0
image status before: PENDING 105, PROCESSING 0, COMPLETED 51, FAILED 0
image status after: PENDING 0, PROCESSING 0, COMPLETED 156, FAILED 0
ProgramCase / Session / Attachment / active: 349 / 20 / 237 / 237
PDF / HWP: 55 / 26
duplicate logical keys / orphan attachments: 0 / 0
remaining temporary files / job directories / manifest: 0 / 0 / 0
```

신규 OCR 결과에는 confidence 0.70 미만, field 0, 빈 text, `LINE_BREAK` 이외 reading-order 결과가 없었다. 기존 COMPLETED 51건은 처리 대상으로 재선택하지 않았고, PDF 55건과 HWP 26건 및 상위 관계 데이터도 변경하지 않았다.

완료 후 read-only plan 결과는 selected 0, estimated API calls 0, actual API calls 0, database mutation false, download false, OCR call false였다. 최종 진단에서도 PENDING 대상과 분석 실패가 0이며 cleanup 잔여가 없었다.

Invoke URL, host, Secret, attachment ID, URL, 파일명, checksum 값, OCR 본문, 전체 응답과 원본 이미지는 출력하거나 문서화하지 않았다. 사용자는 Prisma Studio에서 IMAGE 상태가 `COMPLETED`인지 확인한 뒤 필요한 일부 행의 `cleanedText`만 원본과 수동 비교할 수 있다.

이로써 현재 등록된 IMAGE OCR 단계는 완료됐다. 다음 권장 작업은 별도 승인 범위에서 PDF OCR 대상과 Poppler 실행 환경을 다시 검토하는 것이다.

## 29. MIXED PDF 렌더링·병합 기반 및 실제 1건 plan (2026-07-24)

`PDFJS_TEXT_PARTIAL`인 MIXED PDF 1건의 후보 페이지만 보강하기 위한 기반을 구현했다. 이번 단계는 read-only plan으로 제한해 실제 페이지 렌더링, CLOVA OCR 호출, PROCESSING claim, attempt 증가와 PDF 본문 저장을 수행하지 않았다.

### renderer와 subprocess 계약

`pdfPageRenderer.ts`는 환경 설정에서만 읽은 `pdftocairo` executable과 argument 배열을 기존 `subprocessRunner.ts`에 전달한다. 명령은 `-png -singlefile -r 200 -f N -l N input output-prefix` 구조이며 shell을 사용하지 않는다. 입력 PDF와 출력 prefix가 작업 디렉터리 안에 있는지 확인하고 한 번에 한 페이지만 처리한다.

기본 제한은 timeout 30초, DPI 200, PDF 최대 50페이지, PNG 최대 20 MiB이다. 1 미만 또는 전체 페이지를 넘는 번호, 페이지 제한 초과, subprocess 미탐지·timeout·비정상 종료, 출력 누락·0 byte·크기 초과·PNG signature 불일치를 안전 오류로 변환한다. 성공 결과는 호출자가 페이지 OCR 직후 삭제할 수 있는 cleanup 함수를 제공하고 실패 시 생성된 출력도 제거한다. 전체 명령과 경로는 오류에 포함하지 않는다.

현재 로컬 탐지 결과는 다음과 같다.

```text
renderer configured: true
renderer available: false
renderer version configured: false
```

Poppler를 자동 설치하거나 시스템 설정을 변경하지 않았다. 따라서 다음 실제 렌더 dry-run 전에 사용자 승인 아래 로컬 Poppler 설치가 필요하다.

### 페이지 병합 계약

`pdfOcrMerger.ts`는 PDF.js 페이지 결과와 OCR 후보/결과를 받아 1페이지부터 끝까지 순서대로 각 페이지를 정확히 한 번 선택한다. 후보 페이지는 CLOVA 결과로 교체하고 비후보 페이지는 PDF.js 결과를 유지하며, 기존 전체 본문 뒤에 OCR 결과를 추가하지 않는다. raw text에는 `[Page N]` 경계를 한 번씩 유지하고 cleaned text는 선택된 페이지 결과를 같은 순서로 정규화한다.

페이지 수 오류, 후보·결과 범위 초과, 중복 번호, 필요한 OCR 결과 또는 비후보 PDF.js 결과 누락을 병합 전에 거부한다. 입력 순서가 섞여도 페이지 번호로 결정되며 같은 입력의 반복 결과는 동일하다. 빈 OCR 결과는 유효한 빈 페이지 결과로 유지하지만 결과 객체 자체가 없으면 실패한다.

### Mock·fixture 검증

합성 입력과 주입한 subprocess runner로 다음을 검증했다.

```text
3페이지 PDF.js/OCR 교체와 페이지 경계
첫·마지막 및 복수 후보
후보 없는 PDF와 빈 OCR 결과
후보 결과 누락, 중복, 범위 밖 번호
섞인 입력 순서와 반복 실행 멱등성
고정 executable/argument, 동일한 -f/-l, 200 DPI
정상 PNG와 cleanup
출력 누락·0 byte·signature 오류·크기 초과
timeout·non-zero exit·page 0·페이지 제한·경로 containment
PDF_OCR CLI 허용/금지 조합
read-only plan의 renderer/OCR 미호출과 fingerprint 불변
```

Prisma validate/generate, TypeScript build, 기존 attachment extraction, CLOVA/image OCR 회귀 테스트와 새 `test:pdf-ocr-foundation`이 모두 통과했다. 상태 전이 회귀 테스트는 테스트용 DB 레코드를 사용한 뒤 cleanup까지 완료했다.

### 실제 MIXED PDF 1건 read-only plan

CLI는 현재 `--type PDF_OCR --mixed-only --limit 1 --plan`만 허용한다. `--mixed-only` 누락, limit 1 초과, write, dry-run, retry-failed, ocr-required-only, 알 수 없거나 중복된 옵션과 잘못된 UUID를 거부한다. 대상 조회 조건은 활성 PDF, COMPLETED, `PDFJS_TEXT_PARTIAL`이며 생성 시각과 ID 오름차순이다.

```text
selected: 1
total pages: 4
PDF.js TEXT pages: 3
LOW_DENSITY pages: 0
OCR candidate pages: 1
candidate range / uniqueness / ascending: valid / valid / valid
all pages candidates: false
MIXED classification confirmed: true
estimated render count: 1
estimated CLOVA API calls: 1
actual render count: 0
actual CLOVA API calls: 0
file bytes: 1,157,777
PDF.js analysis duration: 626 ms
database mutation: false
target fingerprint unchanged: true
aggregate counts unchanged: true
```

plan 전후 집계는 IMAGE COMPLETED 156, PDF COMPLETED 55, `PDFJS_TEXT` 54, `PDFJS_TEXT_PARTIAL` 1, HWP 26으로 동일했다. ProgramCase 349, ProgramCaseSession 20, Attachment 전체/활성 237/237도 유지됐고 logical key 중복과 고아 attachment는 0이었다. 임시 파일, job 디렉터리와 manifest 잔여도 모두 0이었다.

Invoke URL, Secret, attachment ID, PDF URL, 원본 파일명, checksum 값, PDF/OCR 본문, 원본 PDF, 렌더 이미지와 임시 파일 전체 경로는 출력하거나 문서화하지 않았다.

다음 단계는 Poppler 설치 승인 후 동일 MIXED PDF 후보 1페이지만 로컬 렌더하는 dry-run이다. 렌더 결과의 PNG signature·크기·dimensions와 cleanup을 먼저 확인한 뒤 별도 승인을 받아 최대 CLOVA API 1회로 OCR·병합 결과를 DB 저장 없이 검증한다.

## 30. MIXED PDF 렌더링 dry-run 전 Poppler 환경 재확인 (2026-07-24)

Windows PowerShell 환경에서 MIXED PDF 후보 1페이지 렌더링 dry-run 전 renderer preflight를 다시 실행했다.

```text
renderer configured: true
renderer available: false
renderer version detected: false
renderer version: unavailable
winget available: false
Chocolatey available: false
Scoop available: false
```

preflight가 실패했으므로 안전 계약에 따라 MIXED PDF를 선택하거나 다운로드하지 않았고 `pdftocairo` 렌더링도 시도하지 않았다. 실제 렌더/CLOVA API 호출/DB 변경은 모두 0회이며 PDF PROCESSING claim과 attempt 증가도 없었다. 코드와 테스트는 직전 단계 구현을 그대로 유지했다.

현재 환경에는 사용 가능한 패키지 관리자가 없으므로 권장 수동 설치 방법은 `oschwartz10612/poppler-windows` GitHub Releases에서 최신 Windows ZIP을 직접 내려받아 원하는 로컬 디렉터리에 압축을 풀고, 압축본의 `Library\bin` 디렉터리를 사용자 PATH에 추가하는 것이다. 자동 다운로드, 자동 설치와 PATH 변경은 수행하지 않았다.

설치 후 새 PowerShell을 열어 다음을 확인한다.

```powershell
where.exe pdftocairo
pdftocairo -v
```

두 명령이 정상인 경우에만 `--type PDF_OCR --mixed-only --limit 1 --render-dry-run`을 한 번 실행한다. 다음 단계도 렌더 대상은 최대 1페이지, CLOVA API 호출과 DB 변경은 0회로 제한한다.

## 31. MIXED PDF 후보 1페이지 실제 렌더링 dry-run (2026-07-24)

사용자가 설치한 Poppler가 새 셸 PATH에 반영된 것을 확인한 뒤 `--type PDF_OCR --mixed-only --limit 1 --render-dry-run` 실행 경로를 구현했다. Codex 프로세스에는 이전 PATH가 남아 있어 실행할 자식 프로세스에서 시스템·사용자 PATH를 읽어 일시적으로 반영했으며 영구 PATH나 시스템 설정은 변경하지 않았다.

CLI는 `PDF_OCR`, `mixed-only`, limit 1과 `render-dry-run` 조합만 허용한다. attachment UUID는 선택적으로 받을 수 있지만 활성 PDF, COMPLETED, `PDFJS_TEXT_PARTIAL` 조건을 우회하지 못한다. plan/dry-run/retry-failed/ocr-required-only와의 조합, IMAGE·일반 PDF 타입, limit 초과, 중복·알 수 없는 옵션과 잘못된 UUID는 거부한다.

renderer preflight는 대상 DB 조회와 PDF 다운로드보다 먼저 실행한다. executable 실행 여부와 version 문자열이 모두 확인되어야 다음 단계로 진행하며, 실패하면 선택·다운로드·렌더를 모두 0회로 유지한다.

```text
renderer configured: true
renderer available: true
renderer version detected: true
renderer version: 26.02.0
DPI / timeout: 200 / 30000 ms
max pages / max output bytes: 50 / 20971520
```

orchestration은 PDF signature 확인과 PDF.js 재분석 후 기존 `ocrCandidatePages`를 범위·중복·오름차순으로 검증한다. MIXED 분류와 후보 1페이지를 확인한 경우에만 기존 `pdfPageRenderer.ts`를 한 번 호출하고, Sharp metadata 검사로 PNG format, 단일 페이지, dimensions, pixel 수, 예상 RGBA decode memory와 aspect ratio 제한을 확인한다. CLOVA client와 병합기는 생성하거나 호출하지 않는다.

Mock·fixture 테스트는 정상 parser와 금지 조합, preflight 성공·실패/version 누락, preflight 실패 시 선택·다운로드 미호출, 4페이지 중 후보 1페이지 renderer 호출, PNG metadata 결과, fingerprint·집계 불변, metadata 실패 시 PNG·PDF cleanup을 검증했다. 기존 renderer 테스트의 출력 누락·0 byte·signature·크기·timeout·non-zero·페이지·containment 검증도 유지했다.

Prisma validate/generate, TypeScript build, 기존 attachment extraction 상태 전이, CLOVA/IMAGE OCR 회귀와 PDF OCR foundation 테스트가 모두 통과한 뒤 실제 명령을 정확히 한 번 실행했다.

```text
mode: render-dry-run
selected / download count: 1 / 1
total pages: 4
PDF.js TEXT / LOW_DENSITY pages: 3 / 0
OCR candidate pages: 1
candidate in-range / unique / ascending: true / true / true
render attempted / succeeded: 1 / 1
rendered format: PNG
rendered dimensions: 1653 x 2339
rendered bytes: 169179
render duration: 1283 ms
actual CLOVA API calls: 0
database mutation: false
PROCESSING claim / attempt increment: false / false
target fingerprint unchanged: true
aggregate counts unchanged: true
```

실행 전후 집계는 ProgramCase 349, ProgramCaseSession 20, Attachment 전체/활성 237/237, IMAGE COMPLETED 156, PDF COMPLETED 55, `PDFJS_TEXT` 54, `PDFJS_TEXT_PARTIAL` 1, HWP 26이었다. logical key 중복과 고아 attachment는 0이었다.

독립 cleanup 검사에서도 임시 PDF·렌더 PNG·OCR 입력, job 디렉터리와 manifest 잔여가 모두 0이었다. Invoke URL, Secret, attachment ID, PDF URL, 원본 파일명, checksum 값, PDF/페이지/OCR 본문, 원본 PDF, 렌더 PNG와 전체 로컬 경로는 출력하거나 문서화하지 않았다.

실제 렌더링과 입력 안전 검증이 성공했으므로 다음 단계는 동일 후보 1페이지를 CLOVA OCR로 보내고 PDF.js 본문과 병합하되 DB에는 저장하지 않는 OCR dry-run이다. 다음 단계의 최대 CLOVA API 호출 승인 수는 1회이다.

## 32. MIXED PDF 후보 1페이지 CLOVA OCR·병합 dry-run (2026-07-24)

`--type PDF_OCR --mixed-only --limit 1 --ocr-dry-run`을 구현하고 실제로 한 번 실행했다. renderer와 CLOVA 설정을 대상 조회 전에 검증하고 실행 범위에서 retry를 0으로 강제했다. 후보 PNG는 기존 이미지 OCR 안전 파이프라인으로 처리하고 `pdfOcrMerger`에서 PDF.js 페이지와 메모리 병합했으며 DB에는 저장하지 않았다.

```text
selected / total pages / PDF.js TEXT / candidate: 1 / 4 / 3 / 1
render attempted / succeeded: 1 / 1
render dimensions / bytes / duration: 1653x2339 / 169179 / 1223 ms
CLOVA calls / retries / OCR duration: 1 / 0 / 9647 ms
field count / confidence / reading order: 10 / 0.7798277339999998 / LINE_BREAK
candidate raw / cleaned length / empty: 57 / 57 / false
merged raw / cleaned length: 2576 / 2437
merged pages / markers / duplicate / missing: 4 / 4 / 0 / 0
PDF.js / OCR source pages: 3 / 1
noncandidate raw / cleaned unchanged: true / true
candidate replaced: true
quality warnings: none
database mutation / claim / attempt increment: false / false / false
target fingerprint / aggregate counts unchanged: true / true
cleanup remaining: 0
```

IMAGE COMPLETED 156, PDF COMPLETED 55(`PDFJS_TEXT` 54, `PDFJS_TEXT_PARTIAL` 1), HWP 26과 ProgramCase/Session/Attachment 349/20/237 집계가 유지됐다. logical key 중복과 고아 attachment는 0이었다. Secret, URL, ID, checksum, PDF·OCR·병합 본문과 전체 경로는 출력하거나 문서화하지 않았다. 품질 경고가 없으므로 다음 단계는 별도 승인 아래 동일 1건을 실제 DB 저장하는 제한 write 검증이다.
