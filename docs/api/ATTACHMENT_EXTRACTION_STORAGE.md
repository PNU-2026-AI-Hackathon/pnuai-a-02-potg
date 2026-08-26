# 첨부파일 추출 결과 저장 구조와 동기화 정책

> **현재 운영 정책:** 첨부파일 동기화와 추출 결과 보존 규칙을 설명합니다. 전체 DB 관계는 [데이터베이스 현재 구조](../database/CURRENT_SCHEMA.md)를 함께 확인하세요.

## 목적

이 기반 작업은 첨부파일 텍스트 추출기를 구현하기 전에 최신 추출 결과를 저장할 구조를 만들고, 프로그램 재동기화가 첨부파일 ID와 추출 결과를 삭제하지 않도록 한다. 실제 다운로드·PDF/HWP 추출·OCR 실행은 포함하지 않는다.

## Prisma 저장 구조

`ProgramCaseAttachment`는 원본 메타데이터와 최신 추출 결과를 함께 저장한다.

| 필드 | 타입 | 의미 |
|---|---|---|
| `fileName` | `String` | 원본이 제공한 최신 파일명 |
| `fileUrl` | `String` | 프로그램 안에서 첨부파일을 식별하는 URL |
| `fileType` | `String?` | 원본이 제공한 형식 |
| `detectedFileType` | `String?` | 파일 시그니처와 파서로 판별한 실제 형식 |
| `detectedMimeType` | `String?` | 응답과 검사로 판별한 실제 MIME |
| `fileSizeBytes` | `Int?` | 다운로드한 파일 크기 |
| `checksumSha256` | `String?` | SHA-256 checksum의 64자리 16진수 문자열 |
| `rawText` | `String? @db.Text` | 추출기가 반환한 원문 |
| `cleanedText` | `String? @db.Text` | 후처리한 텍스트 |
| `extractorType` | `String?` | 사용한 추출기 종류 |
| `extractorVersion` | `String?` | 추출기 버전 |
| `failureCode` | `String?` | 기계 판독용 실패 코드 |
| `failureMessage` | `String? @db.Text` | 실패 상세 메시지 |
| `attemptCount` | `Int` | 추출 시도 횟수, 기본값 `0` |
| `lastAttemptedAt` | `DateTime?` | 마지막 추출 시도 시각 |
| `extractedAt` | `DateTime?` | 마지막 성공 완료 시각 |
| `isActive` | `Boolean` | 최신 원본 배열에 포함되는지 여부, 기본값 `true` |

별도 이력 테이블은 만들지 않았으므로 이 모델은 최신 결과만 보관한다. `(programCaseId, fileUrl)` 복합 unique와 `ProgramCase` cascade 관계는 유지한다.

## 추출 상태

`extractionStatus`는 문자열에서 `AttachmentExtractionStatus` enum으로 변경했다.

| 상태 | 의미 |
|---|---|
| `PENDING` | 아직 시도하지 않았거나 재처리 대기 중 |
| `PROCESSING` | worker가 현재 처리 중 |
| `COMPLETED` | 최신 추출 결과 저장 완료 |
| `FAILED` | 마지막 추출 시도 실패 |

신규 첨부파일은 Prisma 기본값으로 `PENDING`이 된다. 원천 저장 API가 전달하는 상태는 기존 첨부파일의 추출 상태를 덮어쓰지 않는다.

## `isActive` 정책

`isActive`는 DB 행 삭제 여부가 아니라 최신 크롤링 원본에 첨부파일이 존재하는지를 나타낸다.

- 최신 배열에 URL이 있으면 `true`
- 최신 배열에서 URL이 사라지면 `false`
- 같은 URL이 다시 나타나면 기존 행을 `true`로 복원
- 빈 첨부파일 배열은 해당 프로그램의 모든 첨부파일을 `false`로 변경

비활성 행도 ID, checksum, 추출 텍스트, 상태, 실패 정보와 처리 시각을 유지한다.

## URL 기준 보존형 동기화

프로그램별 기존 Prisma 트랜잭션 안에서 다음 순서로 처리한다.

```text
ProgramCase upsert
→ 회차 전체 동기화
→ 입력에 없는 첨부 URL을 isActive=false로 변경
→ 입력 첨부를 (programCaseId, fileUrl) 기준 upsert
```

### 신규 URL

새 행을 생성하고 `fileName`, `fileUrl`, `fileType`을 저장한다. 추출 필드는 기본값 또는 `null`, 상태는 `PENDING`, 시도 횟수는 `0`, 활성 상태는 `true`다.

### 동일 URL

기존 행의 `fileName`, `fileType`, `isActive=true`만 갱신한다. ID와 다음 추출 필드는 변경하지 않는다.

```text
detectedFileType, detectedMimeType, fileSizeBytes, checksumSha256,
extractionStatus, rawText, cleanedText, extractorType, extractorVersion,
failureCode, failureMessage, attemptCount, lastAttemptedAt, extractedAt
```

### 원본에서 사라진 URL

행을 삭제하지 않고 `isActive=false`만 설정한다. 추출 결과는 그대로 남는다.

### 다시 나타난 URL

복합 unique로 기존 행을 찾아 최신 파일명과 원본 형식을 반영하고 `isActive=true`로 복원한다. 새 행을 만들거나 추출 결과를 초기화하지 않는다.

## 추출 결과가 보존되는 이유

기존 구현은 매 동기화 때 첨부파일을 `deleteMany` 후 `createMany`하여 행 ID와 결과를 함께 잃었다. 현재 구현은 URL 복합키 upsert와 soft deactivation만 사용한다. upsert의 update 데이터에 추출 필드를 포함하지 않기 때문에 원천 메타데이터 변경과 추출 결과 수명이 분리된다. 첨부 동기화 오류가 발생하면 프로그램 단위 트랜잭션 전체가 롤백된다.

## Migration

migration 이름은 `20260720070000_add_attachment_extraction_fields`다. 다음 방식으로 기존 데이터를 보존한다.

1. `AttachmentExtractionStatus` PostgreSQL enum 생성
2. 기존 문자열 상태를 `USING ("extractionStatus"::"AttachmentExtractionStatus")`로 제자리 변환
3. 신규 nullable 추출 필드 추가
4. `attemptCount`에 `0`, `isActive`에 `true` 기본값 추가

테이블이나 행을 재생성하지 않으므로 기존 첨부파일 ID와 관계가 유지된다. 적용 전에 기존 상태 값이 enum의 네 값 안에 있는지 반드시 확인한다.

```bash
cd apps/backend
npx prisma format
npx prisma validate
npx prisma migrate status
npx prisma migrate deploy
npx prisma generate
```

현재 개발 DB에는 migration을 적용했다. 적용 전후 모두 프로그램 349건, 회차 20건, 첨부파일 237건이었고 첨부파일 ID digest도 같았다. 기존 첨부파일은 모두 `PENDING`, `isActive=true`, `attemptCount=0`이며 다른 신규 추출 필드는 `null`이었다.

## 테스트

```bash
cd apps/backend
npm run test:program-case-sync
npm run test:attachment-preservation
npm run test:attachment-regression
```

`test:attachment-preservation`은 자동 정리되는 테스트 프로그램으로 다음을 검증한다.

- 신규 첨부 기본값
- 동일 URL의 ID와 모든 추출 결과 보존
- 파일명/원본 형식만 갱신
- 빈 배열의 비활성화
- 같은 URL 재등장과 ID 재사용
- 신규 URL의 `PENDING` 생성과 기존 URL 비활성화
- 중복 회차 오류 발생 시 프로그램·첨부 변경 전체 롤백
- `(programCaseId, fileUrl)` 중복 0건

`test:attachment-regression`은 `docs/fixtures/geumjeong-programs-349.json`을 검증해 349건 전체를 재동기화한다. 별도 테스트 프로그램의 추출 결과를 설정해 대량 동기화 중 보존을 확인한 후 삭제한다. 최종 결과는 프로그램 349건, 회차 20건, 활성 첨부파일 237건이며 프로그램·회차·첨부파일 복합키 중복은 모두 0건이다. 실제 237개 첨부파일 ID digest도 동기화 전후 동일했다.

## 현재 추출 기능

- 다운로드 URL과 응답 크기를 제한하고 실제 파일 시그니처를 판별한다.
- 텍스트 PDF는 PDF.js로 추출하고, 이미지·스캔 PDF는 CLOVA OCR 경로로 처리한다.
- HWP/HWPX는 검증된 추출기를 subprocess 제한 안에서 실행한다.
- checksum이 같은 완료 결과는 재사용하여 외부 OCR 호출과 중복 처리를 줄인다.
- 처리 상태, 실패 코드, 시도 횟수와 추출기 버전을 DB에 기록한다.
- 오래된 `PROCESSING` 상태를 복구하고 제한 배치와 검증 명령으로 재처리할 수 있다.

구체적인 실행 방식은 [AI 데이터 가공 문서](../ai-data/README.md)를 확인한다. 별도 분산 작업 큐는 사용하지 않으며 현재 처리는 CLI·배치 중심이다.
