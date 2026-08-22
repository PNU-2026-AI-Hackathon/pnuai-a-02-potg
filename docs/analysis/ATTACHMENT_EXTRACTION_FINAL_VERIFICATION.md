# 첨부파일 텍스트 추출 최종 검증 보고서

## 1. 검증 목적

이 검증은 PDF 텍스트 추출, 이미지 및 스캔 PDF OCR, HWP 텍스트 추출 결과를 최종 점검하기 위해 수행했다. 전체 활성 첨부파일 237건의 처리 상태와 추출 결과 저장 필드 무결성, 프로그램·회차·첨부파일 관계, 중복 데이터 정책을 확인하고 상위 이슈 #76의 종료 가능 여부를 판단했다.

## 2. 검증 환경

| 항목 | 값 |
|---|---|
| OS | Windows NT 10.0.26200.0 |
| Node.js | 22.17.0 |
| npm | 10.9.2 |
| 브랜치 | `test/attachment-extraction-final-verification` |
| 대상 환경 | production |
| 기준 시각 | `2026-07-27T09:00:00+09:00` |
| DB 접근 방식 | PostgreSQL 읽기 전용 트랜잭션 |

`DATABASE_URL`, DB 주소·사용자명·비밀번호, OCR 인증정보, API Secret과 환경변수 값은 조회 결과와 이 문서에 기록하지 않았다.

## 3. 읽기 전용 보장 방식

검증 CLI는 단일 `pg.Client` 연결에서 다음 순서로 조회한다.

```sql
BEGIN TRANSACTION READ ONLY;
SHOW transaction_read_only;
-- SELECT 쿼리
ROLLBACK;
```

`transaction_read_only=on`을 확인한 뒤에만 집계를 계속한다. Prisma 쓰기 API와 프로그램 저장 API, 추출 서비스, OCR API를 호출하지 않았으며 파일 다운로드, PDF 렌더링, HWP subprocess도 실행하지 않았다. 성공·실패와 관계없이 `finally`에서 `ROLLBACK`하고 연결 종료를 보장한다.

## 4. 데이터 무결성

| 항목 | 결과 |
|---|---:|
| ProgramCase | 349 |
| ProgramCaseSession | 20 |
| 전체 Attachment | 237 |
| 활성 Attachment | 237 |
| 비활성 Attachment | 0 |
| 활성 첨부파일이 있는 ProgramCase | 237 |
| 활성 첨부파일이 없는 ProgramCase | 112 |
| orphan Attachment | 0 |
| orphan Session | 0 |

## 5. 형식별 처리 결과

원본 `fileType` 기준 결과는 다음과 같다.

| 형식 | 전체 | COMPLETED | PENDING | PROCESSING | FAILED |
|---|---:|---:|---:|---:|---:|
| JPG | 125 | 125 | 0 | 0 | 0 |
| PNG | 31 | 31 | 0 | 0 | 0 |
| PDF | 55 | 55 | 0 | 0 | 0 |
| HWP | 26 | 26 | 0 | 0 | 0 |
| 합계 | 237 | 237 | 0 | 0 | 0 |

감지 형식 기준 결과는 다음과 같다.

| 감지 형식 | 수 | 상태 |
|---|---:|---|
| JPEG | 125 | 전체 COMPLETED |
| PNG | 31 | 전체 COMPLETED |
| PDF | 55 | 전체 COMPLETED |
| HWP | 26 | 전체 COMPLETED |

원본 형식과 감지 형식의 불일치는 없었다.

## 6. 완료 데이터 품질

활성 첨부파일 237건에서 다음 이상 항목은 모두 0건이었다.

- `rawText` null 또는 빈 문자열
- `cleanedText` null 또는 빈 문자열
- `rawText` 50자 미만 또는 100자 미만
- `cleanedText` 50자 미만 또는 100자 미만
- `extractorType` 또는 `extractorVersion` 누락
- `extractedAt` 또는 `lastAttemptedAt` 누락
- `attemptCount` 1 미만
- 남아 있는 `failureCode` 또는 `failureMessage`
- U+FFFD replacement character
- NUL 문자
- 과도한 제어문자

## 7. 텍스트 길이 통계

| 감지 형식 | raw 최소 | raw 평균 | raw 중앙값 | raw 최대 | cleaned 최소 | cleaned 평균 | cleaned 중앙값 | cleaned 최대 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| JPEG | 157 | 662.99 | 544 | 5,085 | 157 | 662.99 | 544 | 5,085 |
| PNG | 415 | 1,075.19 | 711 | 3,691 | 415 | 1,075.19 | 711 | 3,691 |
| PDF | 160 | 6,970 | 10,959 | 11,856 | 142 | 6,589.82 | 10,436 | 11,161 |
| HWP | 654 | 3,853.15 | 2,042.5 | 8,997 | 395 | 2,020.5 | 926 | 6,332 |

## 8. 미완료·실패 상태

| 항목 | 결과 |
|---|---:|
| PENDING | 0 |
| PROCESSING | 0 |
| FAILED | 0 |
| stale PROCESSING 후보 | 0 |
| 예상하지 못한 상태 | 0 |
| 시각 필드 이상 | 0 |

`attemptCount` 통계는 다음과 같다.

| 항목 | 결과 |
|---|---:|
| 최소 | 1 |
| 평균 | 1.01 |
| 최대 | 2 |
| 2 이상 | 3건 |
| 비정상 값 | 0 |

## 9. extractor 종류 및 버전

| 감지 형식 | extractorType | extractorVersion | 수 |
|---|---|---|---:|
| JPEG | `CLOVA_OCR_GENERAL` | `V2` | 125 |
| PNG | `CLOVA_OCR_GENERAL` | `V2` | 31 |
| PDF | `PDFJS_TEXT` | `6.1.200` | 54 |
| PDF | `PDFJS_TEXT_OCR_MERGED` | `PDFJS_6.1.200+CLOVA_V2+POPPLER_26.02.0` | 1 |
| HWP | `KORDOC_HWP` | `4.2.7` | 26 |

## 10. 중복 및 관계 검증

| 항목 | 결과 |
|---|---:|
| `(programCaseId, fileUrl)` 중복 | 0그룹 |
| 전체 `fileUrl` 중복 | 0그룹 |
| active/inactive 동일 URL | 0그룹 |
| checksum 중복 | 21그룹, 총 122행 |
| 동일 프로그램 내부 checksum 중복 | 0그룹 |
| 여러 프로그램 사이 동일 파일 재사용 | 21그룹 |
| orphan attachment | 0 |
| orphan session | 0 |

모든 checksum 중복은 서로 다른 프로그램 사이에서 동일 파일이 재사용된 사례다. 동일 프로그램 내부 중복은 없으며 `(programCaseId, fileUrl)` 복합 유일성 정책과 충돌하지 않는다. URL 중복이나 orphan 관계도 발견되지 않았다. checksum 원문과 파일 URL은 출력하거나 문서화하지 않았다.

## 11. 대표 표본 검증

JPEG, PNG, 일반 PDF, OCR 병합 PDF, HWP에서 각 형식의 최소·최대 길이 표본과 extractor별 비식별 표본을 확인했다.

- `rawText`와 `cleanedText` 존재
- U+FFFD와 NUL 없음
- 과도한 제어문자 없음
- `cleanedText`가 `rawText`보다 비정상적으로 길어지는 경우 없음
- 형식과 extractor 조합 정상

본문 원문, URL과 checksum은 보고서에 포함하지 않았다.

## 12. 재동기화 보존 정책

실제 코드와 기존 테스트를 검토한 결과 첨부파일은 `(programCaseId, fileUrl)` 기준으로 upsert한다. 동일 URL이면 기존 attachment ID와 `rawText`, `cleanedText`, `extractionStatus`, `extractorType`, `extractorVersion`을 보존한다. 원본에서 사라진 첨부파일은 `isActive=false`, 다시 나타난 첨부파일은 `isActive=true`로 처리한다.

첨부파일 동기화에는 `deleteMany + createMany`를 사용하지 않는다. 회차 데이터에는 별도 정책으로 `deleteMany + createMany`를 사용한다.

## 13. 실행하지 않은 테스트

다음 테스트는 create, update, delete, 동기화 또는 상태 전이 등 실제 DB 쓰기를 포함하므로 실행하지 않았다.

```text
test:attachment-preservation
test:attachment-regression
test:attachment-extraction
```

대신 새 검증 CLI의 단위 테스트와 `test:attachment-extraction` 중 DB를 사용하지 않는 attachment 모듈 테스트를 실행했다.

## 14. 실행 방법

`package.json`에 다음 npm script가 등록되어 있다.

```powershell
npm.cmd run verify:attachment-extractions -- `
  --environment production `
  --as-of 2026-07-27T09:00:00+09:00
```

빌드 후 직접 실행할 수도 있다.

```powershell
node dist/cli/verifyAttachmentExtractions.js `
  --environment production `
  --as-of 2026-07-27T09:00:00+09:00
```

- `--environment`: `production`, `staging`, `development` 중 대상 환경 레이블
- `--as-of`: stale 판정과 결정적 출력을 위한 ISO-8601 기준 시각
- 출력: 사람이 검토할 수 있는 구조화된 JSON
- 종료 코드: 성공 0, 인자·연결·읽기 전용 확인·조회 실패 시 non-zero
- DB 접근: 단일 연결의 명시적 READ ONLY 트랜잭션
- 외부 API와 추출 서비스: 호출하지 않음
- URL 전체, checksum 원문, `rawText`·`cleanedText` 본문: 출력하지 않음

## 15. 제한 사항

- 이번 검증은 DB에 저장된 결과를 대상으로 수행했다.
- 원본 파일을 다시 다운로드하거나 추출기를 다시 실행하지 않았다.
- 원본 파일 화면과 저장 텍스트 전체를 육안 대조하지 않았다.
- Linux 운영 환경 runtime 검증은 별도 과제로 남아 있다.
- 현재 DB에 HWPX 파일은 존재하지 않으며 HWPX 추출은 이번 파이프라인 범위에서 제외되었다.

## 16. 최종 판단

**A. 종료 가능**

판단 근거는 다음과 같다.

- 활성 첨부파일 237건 전체 COMPLETED
- PENDING, PROCESSING, FAILED 각 0건
- 텍스트 저장 필드와 extractor 정보 누락 0건
- 관계 무결성, URL 및 복합키 중복 이상 0건
- checksum 중복은 교차 프로그램 파일 재사용으로 설명 가능
- ProgramCase 349건과 ProgramCaseSession 20건 유지
- 검증 CLI와 실행 방법 문서화 완료

문서 반영까지 완료되었으므로 상위 이슈 #76을 종료할 수 있다.
