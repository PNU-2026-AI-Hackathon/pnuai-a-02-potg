# PDF 첨부파일 텍스트 추출

## 범위

이 단계는 활성 상태의 PDF 첨부파일을 안전하게 다운로드하고, 실제 파일 형식을 확인한 뒤 PDF.js로 텍스트 레이어를 추출하는 수동 배치 기능을 제공한다. 이미지 OCR, PDF OCR, HWP/HWPX 텍스트 추출, 운영 배포는 포함하지 않는다.

현재 구현은 기존 `ProgramCaseAttachment` 추출 필드를 사용하며 새 migration을 만들지 않는다. 기본 선택 대상은 `isActive = true`, `fileType = pdf`, `extractionStatus = PENDING`인 첨부파일이다. `FAILED`는 `--retry-failed`를 명시했을 때만 다시 선택하고, `COMPLETED`, `PROCESSING`, 비활성 첨부파일과 PDF 이외 형식은 선택하지 않는다.

## 다운로드 보안 정책

요청 전과 모든 리다이렉트 단계에서 URL을 다시 검증한다.

- `https:`만 허용한다.
- 사용자 정보가 포함된 URL과 사용자 지정 포트를 거부한다.
- hostname은 allowlist 항목과 대소문자 무관한 완전 일치만 허용한다. 부분 문자열이나 하위 도메인은 자동 허용하지 않는다.
- `localhost`, `.localhost` 및 DNS 조회 결과가 내부·예약 주소인 호스트를 차단한다.
- IPv4는 loopback, private, link-local, shared address space, benchmark, multicast/reserved 범위를 차단한다.
- IPv6는 loopback, unspecified, unique-local, link-local, multicast, 문서용 범위와 차단된 IPv4-mapped 주소를 거부한다.
- 리다이렉트는 자동 추적하지 않고 `Location`을 해석한 후 HTTPS, allowlist, DNS/IP 검증을 반복한다. 최대 3회까지 허용한다.
- 전체 URL, 쿼리 문자열, 응답 본문과 임시 파일 경로는 CLI 결과나 오류에 출력하지 않는다.

초기 allowlist는 `www.geumjeong.go.kr` 하나다. 환경변수가 없거나 유효한 항목이 없으면 이 안전한 기본값을 사용한다. `*`는 허용하지 않는다.

## 제한과 환경변수

| 환경변수 | 기본값 | 동작 |
| --- | ---: | --- |
| `ATTACHMENT_ALLOWED_HOSTS` | `www.geumjeong.go.kr` | 쉼표로 구분한 정확한 hostname allowlist |
| `ATTACHMENT_DOWNLOAD_TIMEOUT_MS` | `20000` | GET 요청 제한 시간 |
| `ATTACHMENT_HEAD_TIMEOUT_MS` | `10000` | 보조 HEAD 요청 제한 시간 |
| `ATTACHMENT_MAX_FILE_SIZE_BYTES` | `31457280` | 30 MiB 다운로드 상한 |
| `ATTACHMENT_MAX_REDIRECTS` | `3` | 리다이렉트 상한 |
| `ATTACHMENT_EXTRACTION_CONCURRENCY` | `1` | 동시성 설정값; 현재 CLI는 표본을 순차 처리 |
| `ATTACHMENT_TEMP_DIR` | OS 임시 디렉터리 아래 `moira-attachment-extraction` | 작업별 임시 디렉터리의 상위 경로 |

HEAD는 크기를 미리 확인하는 보조 요청이다. 서버가 HEAD를 지원하지 않거나 일반 네트워크 오류가 나더라도 GET으로 계속할 수 있지만, URL 보안 위반·리다이렉트 초과·크기 초과는 즉시 중단한다. GET은 네트워크 오류와 5xx에 한해 1회 재시도하며 4xx, 형식 오류, 크기 초과는 재시도하지 않는다.

`Content-Length`가 상한을 넘으면 본문을 받지 않는다. 헤더가 없거나 잘못된 경우에도 실제 스트림 누적 바이트를 확인해 30 MiB를 넘는 즉시 중단한다. 파일 전체를 메모리 버퍼로 읽지 않는다.

## 임시 파일과 checksum

다운로드는 OS 임시 경로 아래 작업별 `job-*` 디렉터리를 만들고 `attachment.bin`으로 스트리밍한다. 디렉터리와 파일에는 각각 가능한 범위에서 `0700`, `0600` 모드를 사용한다. 스트림을 기록하면서 SHA-256과 실제 바이트 수를 동시에 계산한다.

다운로드 또는 파싱 실패 시 작업 디렉터리를 즉시 삭제한다. 성공 시에도 추출기가 끝난 뒤 `cleanup()`을 호출하며, 같은 cleanup을 여러 번 호출해도 안전하다. cleanup 실패는 `TEMP_FILE_CLEANUP_FAILED`로 처리한다. dry-run도 같은 정리 경로를 사용한다.

## 실제 파일 형식 판별

DB의 `fileType`, 파일명 확장자, HTTP `Content-Type`은 기대 형식을 정하는 보조 정보로 사용하고, 실제 형식은 파일 앞부분의 signature로 판별한다.

| 형식 | 판별 기준 | 이번 단계의 추출 여부 |
| --- | --- | --- |
| PDF | `%PDF-` | PDF.js 텍스트 추출 |
| OLE HWP | `D0 CF 11 E0 A1 B1 1A E1` | 형식 판별만 수행 |
| HWPX | ZIP signature와 HWPX 내부 표식 | 형식 판별만 수행 |
| JPEG | `FF D8 FF` | 형식 판별만 수행 |
| PNG | `89 50 4E 47 0D 0A 1A 0A` | 형식 판별만 수행 |

`Content-Type: text/html` 또는 파일 시작부가 HTML인 오류 페이지는 `HTML_RESPONSE`로 거부한다. 빈 파일과 알 수 없는 형식도 거부한다. PDF로 기대한 파일의 signature가 다른 지원 형식이면 `FILE_TYPE_MISMATCH`로 처리한다. 판별 결과와 다운로드 메타데이터는 정상 실행 시 `detectedFileType`, `detectedMimeType`, `fileSizeBytes`, `checksumSha256`에 저장할 수 있다.

## PDF.js 통합과 텍스트 추출

서버의 CommonJS/TypeScript 구성에서 `pdfjs-dist/legacy/build/pdf.mjs`를 native dynamic import로 불러온다. 페이지를 한 번에 병렬로 열지 않고 1페이지부터 순서대로 `getPage()`와 `getTextContent()`를 호출하며, 페이지 사용 후 cleanup한다. 이 방식은 911 MiB 메모리와 swap이 없는 운영 EC2에서 피크 메모리를 낮추기 위한 선택이다.

현재 의존성은 `pdfjs-dist` 6.1.200이다. 공식 PDF.js 문서는 Node.js에서 legacy build를 사용하는 예제를 제공하며, FAQ는 최신 Node.js 지원 범위를 안내한다.

- [pdfjs-dist on npm](https://www.npmjs.com/package/pdfjs-dist)
- [PDF.js FAQ](https://github.com/mozilla/pdf.js/wiki/frequently-asked-questions)
- [PDF.js official Node example](https://raw.githubusercontent.com/mozilla/pdf.js/master/examples/node/getinfo.mjs)

원문은 페이지 순서를 유지하고 `[Page N]` 경계를 포함한다. 정제문은 NUL 및 불필요한 제어문자 제거, 줄바꿈 통일, 연속 공백과 과도한 빈 줄 정리만 수행한다. 요약, 문장 재작성이나 구조 추론은 하지 않는다.

## 페이지와 문서 분류

각 페이지에서 전체 문자 수, 공백 제외 문자 수, 한글·영문·숫자·Unicode replacement character 수를 계산한다.

| 페이지 분류 | 공백 제외 문자 수 |
| --- | ---: |
| `TEXT` | 100자 이상 |
| `LOW_DENSITY` | 30자 이상 100자 미만 |
| `OCR_CANDIDATE` | 30자 미만 |

문서에 `TEXT` 페이지가 있고 `OCR_CANDIDATE` 페이지가 없으면 `TEXT`, 둘이 함께 있으면 `MIXED`, `TEXT` 페이지가 하나도 없으면 `OCR_REQUIRED`로 분류한다. 현재 단계에서는 페이지를 이미지로 렌더링하지 않으므로 이는 텍스트 레이어 기반의 1차 판단이다.

## 저장 상태 전이

실제 실행은 선택한 레코드를 원자적으로 claim한 후 다음 순서로 처리한다.

```text
PENDING (또는 명시적으로 선택한 FAILED)
  -> PROCESSING: attemptCount + 1, lastAttemptedAt 갱신, 이전 실패 정보 초기화
  -> COMPLETED 또는 FAILED
```

- `TEXT`: `COMPLETED`, 원문·정제문 저장, `extractorType = PDFJS_TEXT`, 실제 PDF.js 버전과 `extractedAt` 저장.
- `MIXED`: 추출 가능한 텍스트를 보존하고 `COMPLETED`, `extractorType = PDFJS_TEXT_PARTIAL`로 저장. OCR 후보 페이지는 실행 결과에 포함한다.
- `OCR_REQUIRED`: `FAILED`, `extractorType = PDFJS_TEXT`, `failureCode = OCR_REQUIRED`, `extractedAt = null`. 자동 네트워크 재시도 대상으로 취급하지 않는다.
- 파싱 불가 PDF: `FAILED`, `failureCode = PDF_PARSE_FAILED`, 민감 정보와 stack을 제외한 메시지만 저장한다.

실패 시 기존에 성공적으로 저장된 원문·정제문과 `extractedAt`은 덮어쓰지 않는다. 한 파일의 실패는 다음 선택 파일 처리를 막지 않는다.

## 오류 코드

```text
INVALID_URL
HOST_NOT_ALLOWED
PRIVATE_ADDRESS_BLOCKED
REDIRECT_LIMIT_EXCEEDED
DOWNLOAD_TIMEOUT
DOWNLOAD_FAILED
FILE_TOO_LARGE
EMPTY_FILE
HTML_RESPONSE
UNSUPPORTED_FILE_TYPE
FILE_TYPE_MISMATCH
PDF_PARSE_FAILED
OCR_REQUIRED
TEMP_FILE_CLEANUP_FAILED
UNKNOWN_ERROR
```

오류 메시지에는 전체 URL, 쿼리 값, DB 연결 문자열, 외부 API 키, 임시 경로와 전체 stack을 포함하지 않는다.

## CLI 사용법

백엔드 디렉터리에서 실행한다.

```bash
npm run extract:program-attachments -- --type PDF --limit 5
```

옵션:

```text
--type PDF             현재 지원하는 유일한 추출 형식
--limit <1..20>        기본 5, 최대 20
--attachment-id <UUID> 특정 첨부파일만 선택
--retry-failed         PENDING과 FAILED를 선택
--dry-run              실제 다운로드·판별·추출·정리는 수행하되 DB는 변경하지 않음
```

CLI 출력은 선택·완료·실패 수, 문서 분류, 페이지 수, 문자 수, 파일 크기와 checksum 등 요약만 포함하고 URL과 추출 본문은 출력하지 않는다.

## 실제 PDF 표본 dry-run

2026-07-20에 DB에서 attachment ID로 조회한 6개 표본을 각각 `--dry-run`으로 검증했다. 요청 목록의 두 번째 ID는 DB에 존재하지 않아 분석 문서와 실제 DB에서 확인되는 `6c0f8395-8a53-4a60-9043-a422e7ad12a8`을 사용했다. 임의의 URL이나 레코드를 대신 사용하지 않았다.

모든 표본은 allowlist 검증, 다운로드, `%PDF-` signature 확인, SHA-256 계산과 PDF.js 파싱에 성공했다. 문자 수는 공백 제외 기준이며 checksum은 문서 노출을 줄이기 위해 앞 12자리만 기록한다.

| attachment ID | 크기(byte) | SHA-256 앞 12자리 | 페이지 | 문자 수 | 분류 | OCR 후보 페이지 |
| --- | ---: | --- | ---: | ---: | --- | --- |
| `5d305e9c-2529-48c6-9ff0-f9c324bf83d7` | 1,157,777 | `062f1a06a928` | 4 | 1,635 | `MIXED` | 4 |
| `6c0f8395-8a53-4a60-9043-a422e7ad12a8` | 65,067 | `0aa35e432d7d` | 3 | 4,830 | `TEXT` | 없음 |
| `03783b62-3b6f-4983-b8e7-45755ebb47de` | 313,941 | `0990b49d577b` | 15 | 7,803 | `TEXT` | 없음 |
| `4b7c7340-85aa-4b4c-87e4-c69ca64adabe` | 651,487 | `3adfba07f02d` | 17 | 8,459 | `TEXT` | 없음 |
| `46d4b572-1303-45fb-a469-91984cff44ca` | 651,487 | `3adfba07f02d` | 17 | 8,459 | `TEXT` | 없음 |
| `2e2ae31c-3bb1-47b6-b9b2-80c5392cbe26` | 52,436 | `c79abd6e05d4` | 1 | 102 | `TEXT` | 없음 |

dry-run 전후 전체 스냅샷을 비교한 결과 다음 값과 6개 표본의 모든 추출 관련 필드가 동일했다.

| 항목 | dry-run 전후 값 |
| --- | ---: |
| `ProgramCase` | 349 |
| `ProgramCaseSession` | 20 |
| 활성 `ProgramCaseAttachment` | 237 |
| 표본 6개의 `extractionStatus` | 모두 `PENDING` |
| 표본 6개의 `attemptCount` | 모두 0 |
| 표본 6개의 `rawText` / `cleanedText` | 모두 `null` |

각 실행 뒤 작업용 `job-*` 임시 디렉터리가 남지 않은 것도 확인한다.

## 실제 DB 저장 검증

2026-07-20에 대표 표본 2건만 `--dry-run` 없이 각각 실행하여 PostgreSQL 저장 결과를 검증했다. 실행 직전 두 레코드는 모두 활성 PDF, `PENDING`, `attemptCount = 0`이었고 추출 텍스트·파일 메타데이터·실패 정보·시각 필드는 모두 `null`이었다. 당시 전체 237개 첨부파일도 모두 `PENDING`이었다.

| 구분 | TEXT PDF | MIXED PDF |
| --- | ---: | ---: |
| attachment ID | `6c0f8395-8a53-4a60-9043-a422e7ad12a8` | `5d305e9c-2529-48c6-9ff0-f9c324bf83d7` |
| 상태 전이 | `PENDING → PROCESSING → COMPLETED` | `PENDING → PROCESSING → COMPLETED` |
| `attemptCount` | 1 | 1 |
| 페이지 | 3 | 4 |
| 공백 제외 추출 문자 | 4,830 | 1,635 |
| `rawText` 문자 수 | 5,927 | 2,518 |
| `cleanedText` 문자 수 | 5,871 | 2,378 |
| 파일 크기(byte) | 65,067 | 1,157,777 |
| SHA-256 저장 | 64자, 앞 12자리 `0aa35e432d7d` | 64자, 앞 12자리 `062f1a06a928` |
| 판별 형식·MIME | `PDF`, `application/pdf` | `PDF`, `application/pdf` |
| 추출기 | `PDFJS_TEXT`, `6.1.200` | `PDFJS_TEXT_PARTIAL`, `6.1.200` |
| OCR 후보 페이지 | 없음 | 4 |
| 실패 정보 | `failureCode = null`, 메시지 없음 | `failureCode = null`, 메시지 없음 |
| 시각 필드 | `lastAttemptedAt`, `extractedAt` 저장 | `lastAttemptedAt`, `extractedAt` 저장 |

`PROCESSING` claim과 시도 횟수 증가는 상태 전이 테스트로 검증했으며, 실제 실행도 최종 `COMPLETED`와 시각 저장을 확인했다. 빠르게 끝나는 실제 작업을 관찰하기 위해 프로덕션 코드에 인위적인 지연을 추가하지 않았다.

저장 완료 후 동일한 두 CLI 명령을 강제 재처리 옵션 없이 각각 한 번 더 실행했다. 두 실행 모두 `selected = 0`이었고 `attemptCount = 1`, 텍스트 길이, checksum, `lastAttemptedAt`, `extractedAt`이 그대로 유지됐다.

실행 후 DB 불변성 검증 결과는 다음과 같다.

| 항목 | 결과 |
| --- | ---: |
| `ProgramCase` | 349 |
| `ProgramCaseSession` | 20 |
| 전체·활성 `ProgramCaseAttachment` | 237 / 237 |
| `COMPLETED` / `PENDING` / `PROCESSING` / `FAILED` | 2 / 235 / 0 / 0 |
| 대상 외 235건의 상태와 시도 횟수 | 모두 `PENDING`, 0 |
| 대상 외 235건의 추출 필드 | 모두 기존 빈 상태 |
| `(programCaseId, fileUrl)` 중복 | 0 |
| 세션 논리 관계 중복·고아 관계 | 0 / 0 |

필수 회귀 테스트는 349개 프로그램을 보존형으로 다시 동기화하므로 세션 행의 내부 ID는 재생성될 수 있다. 검증에서는 내부 ID가 아니라 `(programCaseId, sessionNumber)` 논리 관계, 20건의 전체 건수, 중복·고아 관계 부재를 확인했다. 프로그램 ID와 첨부파일 ID·소속·URL·활성 상태는 유지됐고, 실제 추출 실행이 변경한 레코드는 지정한 두 첨부파일뿐이다.

각 다운로드가 끝난 뒤 `job-*`와 `attachment.bin`이 남지 않았고 저장소에도 원본 PDF나 파싱 중간 파일이 생성되지 않았다. 전체 URL, 쿼리 값, 추출 원문, DB 연결 정보와 임시 디렉터리 전체 경로는 기록하지 않았다.

## 전체 PDF 배치 처리

2026-07-20에 기존 완료 2건을 제외한 활성 `PENDING` PDF 53건을 `--limit 5`로 순차 처리했다. 시작 상태는 활성 PDF 55건 중 `COMPLETED = 2`, `PENDING = 53`, `PROCESSING = 0`, `FAILED = 0`이었다. 총 11개 배치에서 53건을 선택했고 마지막 배치는 잔여 3건만 선택했다.

| 배치 | selected | completed | failed | skipped | TEXT | MIXED | OCR_REQUIRED | 처리 시간(초) | 페이지 | 추출 문자 | 남은 PENDING |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 5 | 3 | 2 | 0 | 3 | 0 | 0 | 12.896 | 39 | 7,931 | 48 |
| 2 | 5 | 5 | 0 | 0 | 5 | 0 | 0 | 24.100 | 75 | 39,015 | 43 |
| 3 | 5 | 5 | 0 | 0 | 5 | 0 | 0 | 23.387 | 75 | 39,015 | 38 |
| 4 | 5 | 5 | 0 | 0 | 5 | 0 | 0 | 26.738 | 47 | 23,847 | 33 |
| 5 | 5 | 5 | 0 | 0 | 5 | 0 | 0 | 22.128 | 30 | 12,120 | 28 |
| 6 | 5 | 5 | 0 | 0 | 5 | 0 | 0 | 19.344 | 10 | 2,832 | 23 |
| 7 | 5 | 5 | 0 | 0 | 5 | 0 | 0 | 20.066 | 5 | 510 | 18 |
| 8 | 5 | 5 | 0 | 0 | 5 | 0 | 0 | 26.779 | 37 | 17,224 | 13 |
| 9 | 5 | 5 | 0 | 0 | 5 | 0 | 0 | 38.646 | 85 | 42,295 | 8 |
| 10 | 5 | 5 | 0 | 0 | 5 | 0 | 0 | 27.992 | 85 | 42,295 | 3 |
| 11 | 3 | 3 | 0 | 0 | 3 | 0 | 0 | 23.732 | 51 | 25,377 | 0 |
| 합계 | 53 | 51 | 2 | 0 | 51 | 0 | 0 | 265.808 | 539 | 252,461 | 0 |

1차 배치의 실패 2건은 동일한 15페이지 PDF 사본이었다. 다운로드와 PDF.js 파싱은 성공했지만 추출 원문에 PostgreSQL `text`가 저장할 수 없는 NUL 문자가 1개 포함되어 최종 update가 `UNKNOWN_ERROR`로 종료됐다. 원문에서 NUL만 제거하는 저장 안전화 처리를 추가하고 생성 PDF fixture와 실제 DB 상태 전이 테스트를 보강했다. 수정 후 같은 checksum의 다른 PDF 사본들이 정상 완료되어 결함 수정 효과를 실제 배치에서도 확인했다.

실패한 2건은 `attemptCount = 1`, `failureCode = UNKNOWN_ERROR`, 실패 메시지 저장 상태로 유지했다. 이번 작업의 `FAILED` 재시도 금지 원칙에 따라 `--retry-failed`를 사용하거나 상태를 강제로 변경하지 않았다. 1차 배치의 임시 검증 로그는 사후 assertion 오류로 저장되지 않아 DB 시각과 결과에서 복원했으며, 해당 배치의 CLI 내부 처리 시간은 별도로 집계하지 않았다.

전체 활성 PDF의 최종 결과는 다음과 같다.

| 항목 | 결과 |
| --- | ---: |
| 전체 활성 PDF | 55 |
| `COMPLETED` / `FAILED` / `PENDING` / `PROCESSING` | 53 / 2 / 0 / 0 |
| `PDFJS_TEXT` / `PDFJS_TEXT_PARTIAL` | 52 / 1 |
| `OCR_REQUIRED` / `PDF_PARSE_FAILED` | 0 / 0 |
| 다운로드·보안 관련 실패 | 0 |
| 기타 실패 | `UNKNOWN_ERROR` 2 |
| `rawText` / `cleanedText` 저장 PDF | 53 / 53 |
| 전체 `rawText` / `cleanedText` 문자 수 | 361,374 / 341,509 |
| 평균 / 최대 페이지 수 | 9.93 / 17 |
| 기록된 배치 처리 시간 합계 | 265.808초 |

페이지 통계는 실패 2건의 진단 파싱 결과를 포함한 55건 전체 기준이다. 추출 문자 수에는 실제 DB에 텍스트가 저장된 완료 파일만 포함한다.

checksum이 저장된 53건에서 중복 그룹은 6개, 중복 그룹에 속한 PDF는 47건, 가장 큰 그룹은 15건이었다. 6개 중복 그룹 모두 서로 다른 프로그램에 걸쳐 있었으며 삭제나 통합은 수행하지 않았다. 완료 PDF 중 checksum 누락은 없고, 실패 2건만 checksum이 저장되지 않았다.

배치 및 최종 검증 결과 모든 작업 뒤 `PROCESSING = 0`, 임시 작업 파일 0건을 확인했다. `ProgramCase = 349`, `ProgramCaseSession = 20`, 전체·활성 `ProgramCaseAttachment = 237 / 237`이 유지됐고 프로그램·회차·첨부파일 논리키 중복과 고아 관계는 모두 0건이었다. 이미지 156건(JPEG 125, PNG 31)과 HWP 26건은 `PENDING`, `attemptCount = 0`과 빈 추출 필드를 유지했으며 PDF.js 추출기 정보가 저장되지 않았다.

전체 처리 뒤 보존형 프로그램 재동기화 회귀 테스트를 실행하고, 55개 PDF의 상태·텍스트·checksum·추출기·실패 정보·시도 횟수·추출 시각을 전후 해시로 비교했다. 모든 추출 결과와 첨부파일 ID가 유지됐으며 대표 TEXT/MIXED PDF 2건도 `attemptCount = 1`로 보존됐다.

현재 후속 OCR 대상은 `PDFJS_TEXT_PARTIAL`인 MIXED PDF 1건의 OCR 후보 페이지다. `OCR_REQUIRED` PDF는 없다. 별도로 NUL 결함으로 실패한 동일 PDF 2건은 수정된 코드로 명시적 재처리 여부를 결정해야 한다.

## 테스트

`npm run test:attachment-extraction`은 로컬 HTTP 응답과 직접 생성한 작은 PDF fixture를 사용한다. 실제 금정구청 원본 파일을 저장소에 넣지 않는다.

검증 범위는 URL/SSRF 차단, 리다이렉트 재검증, 스트리밍 크기 제한, timeout·HTTP 오류·재시도, SHA-256, cleanup, PDF/HWP/HWPX/JPEG/PNG/HTML 판별, PDF 문서 분류와 정제, 상태 전이, 실패 후 다음 파일 계속 처리, 명시적 재시도와 dry-run DB 불변성이다.

## 운영 EC2 제약과 후속 작업

운영 EC2는 Ubuntu 24.04 x86_64, Node.js 22.23.1, 2 vCPU, 메모리 911 MiB, swap 없음이며 검사 당시 가용 메모리는 약 412 MiB였다. 따라서 현재 CLI는 순차 처리하고 파일을 스트리밍하며, 한 번에 처리하는 기본 limit을 5로 제한한다. 이 작업에서는 EC2 접속·패키지 설치·PM2 재시작·배포를 하지 않는다.

후속 단계에는 다음 작업이 필요하다.

- 이미지 및 스캔 PDF용 OCR 엔진 선정, 메모리·시간 제한과 페이지 렌더링 정책
- `PDFJS_TEXT_PARTIAL` 문서의 OCR 후보 페이지만 재처리하고 텍스트를 병합하는 정책
- OLE HWP와 HWPX 전용 추출기, 손상·암호화 문서 처리와 보안 검토
- 장기 배치의 lease/recovery, 관측 지표, 운영 스케줄링과 배포 절차
