# 프로그램 사례 검색 문서 청킹

GitHub 이슈 #89에서 `SEARCH` 유형 `ProgramCaseDocument`를 검색·RAG 후속 작업에 사용할 수 있는 결정적 청크로 변환했다. 임베딩, tokenizer, pgvector, 벡터 검색, RAG는 포함하지 않는다.

## 입력과 저장 구조

- 입력 문서: `ProgramCaseDocument.documentType = SEARCH`
- 입력 원본: 연결된 `ProgramCase`, 정렬된 sessions, 활성·추출 완료 attachment
- Builder는 Prisma와 독립적이며 DB나 외부 API를 호출하지 않는다.
- 청크 모델: `ProgramCaseDocumentChunk`
- Builder version: `program-case-chunk-v1`
- 최종 content의 SHA-256을 `contentHash`에 저장한다.

청크 유형:

- `CORE`: 기본 정보, 안내, 원본 게시글, 출처. 프로그램당 최대 1개
- `SESSIONS`: 전체 회차. 회차가 있을 때 최대 1개
- `ATTACHMENT`: 첨부파일별 최소 1개. 긴 파일만 여러 part

## 문맥과 순서

모든 청크에는 프로그램명, 대상, 청크 유형 헤더를 포함한다. 대상이 비면 `정보 없음`을 사용한다. ATTACHMENT에는 파일명, 1-based 첨부 순서, 현재 part/전체 part를 추가한다. attachment ID는 검색 본문에 표시하지 않는다.

`chunkKey`:

```text
core
sessions
attachment:<attachmentId>:part:<zero-based-index>
```

`chunkOrder`는 CORE, SESSIONS, 정렬된 attachment part 순으로 0부터 연속된다. attachment 정렬은 `createdAt ASC, id ASC`, session 정렬은 `sortOrder ASC, sessionNumber ASC, id ASC`이다.

## 길이와 overlap

```text
목표 길이: 1,500자
ATTACHMENT 최종 최대: 2,000자
overlap 최대: 150자
CORE/SESSIONS 경고: 4,000자 초과
```

ATTACHMENT의 2,000자 제한은 헤더를 포함한 최종 content에 적용한다. 분할 경계는 목표 지점의 60% 이후에서 문단, 줄바꿈, 문장 종결, hard cut 순으로 선택한다. overlap은 같은 attachment의 인접 part에만 적용한다. 원문 offset을 Builder 결과에 유지해 overlap을 제외한 신규 구간을 결합하면 정규화된 입력 원문과 동일한지 테스트한다.

CORE와 SESSIONS는 자동 분할하지 않고 4,000자 초과 시 경고만 기록한다.

## 동기화

동일성은 `programCaseDocumentId + chunkKey`이다.

- `CREATED`: 새 key
- `UPDATED`: 비교 필드가 변경된 기존 key
- `UNCHANGED`: order, type, attachment ID, label, hash, version, character count가 모두 동일
- `DELETED`: 기존 DB에만 남은 key

Builder와 validation은 transaction 전에 수행하고, 저장은 문서 한 건당 하나의 Prisma transaction에서 delete, update, create 순으로 수행한다. UNCHANGED는 update하지 않는다. 전체 실행은 문서별 실패를 격리하고 계속 진행한다.

문서 또는 attachment 삭제 시 연결 청크는 cascade 삭제된다.

## CLI

단일 문서:

```bash
npm run program-case-document-chunks:build -- --program-case-document-id=<uuid>
```

전체 SEARCH 문서:

```bash
npm run program-case-document-chunks:build -- --all
```

두 옵션 중 정확히 하나가 필요하다. 실패 문서가 하나 이상이면 처리가 끝난 뒤 non-zero exit code를 설정한다.

## 테스트

```bash
npm run test:program-case-document-chunk-builder
npm run test:program-case-document-chunk-service
npm run test:program-case-document-chunk-cli
npm run test:program-case-document-chunk-database
npm run verify:program-case-document-chunks-limited
```

Builder, Service, CLI 단위 테스트와 테스트 전용 fixture DB 통합 테스트를 통과했다. DB 테스트는 고유 source 식별자를 사용하고 finally에서 fixture를 삭제하며, 테스트 전후 원본 모델 행 수가 동일함을 확인한다.

## 대표 검증

DB 조건으로 특정 ID 하드코딩 없이 7개 유형을 선택했다.

| 유형 | 전체 청크 | CORE | SESSIONS | ATTACHMENT | 최대 길이 |
|---|---:|---:|---:|---:|---:|
| 회차 | 2 | 1 | 1 | 0 | 1,722 |
| JPEG OCR | 2 | 1 | 0 | 1 | 947 |
| 일반 PDF | 2 | 1 | 0 | 1 | 1,102 |
| HWP | 2 | 1 | 0 | 1 | 1,178 |
| OCR 병합 PDF | 3 | 1 | 0 | 2 | 1,719 |
| 가장 긴 PDF | 10 | 1 | 0 | 9 | 1,889 |
| 첨부 없음 | 1 | 1 | 0 | 0 | 927 |

모든 대표 문서에서 중복 key 0, 연속 order, ATTACHMENT 2,000자 초과 0, warning 0을 확인했다. 긴 PDF는 내용을 자동 분석하거나 프로그램별로 재분류하지 않고 단일 attachment의 9개 part로만 분할했다.

## 전체 실행

전체 실행 전:

```text
ProgramCase: 349
ProgramCaseSession: 20
ProgramCaseAttachment: 237
ProgramCaseDocument SEARCH: 349
기존 대표 청크: 22
누락 SEARCH: 0
중복 문서: 0
```

전체 실행:

```text
documentsProcessed: 349
documentsSucceeded: 349
documentsFailed: 0
chunksCreated: 866
chunksUpdated: 0
chunksUnchanged: 22
chunksDeleted: 0
totalChunks: 888
warningCount: 0
```

즉시 재실행:

```text
chunksCreated: 0
chunksUpdated: 0
chunksUnchanged: 888
chunksDeleted: 0
documentsFailed: 0
```

## 최종 DB 검증

명시적 read-only transaction에서 확인했다.

```text
CORE: 349
SESSIONS: 5
ATTACHMENT: 534
청크 없는 SEARCH 문서: 0
중복 key/order: 0
불연속 order 문서: 0
빈 content/누락 hash/version 불일치/characterCount 불일치: 0
잘못된 attachment relation: 0
ATTACHMENT 2,000자 초과: 0
CORE/SESSIONS 4,000자 초과: 0
orphan/cross-program attachment: 0
```

실행 전후 동일한 Prisma 조회 및 JSON 직렬화로 `ProgramCase`, `ProgramCaseSession`, `ProgramCaseAttachment`, `ProgramCaseDocument`의 행 수와 SHA-256 snapshot을 비교했으며 모두 동일했다.

## 알려진 제한과 후속 작업

- 종합 PDF 내부의 프로그램 경계를 추론하거나 자동 분리하지 않는다.
- 원문 요약, 재작성, OCR 교정, 관련성 판별을 하지 않는다.
- 동시 CLI 실행을 위한 lock, Serializable transaction, retry는 포함하지 않는다.
- tokenCount, embedding, vector, embedding 상태는 후속 이슈에서 추가한다.
- 후속 단계는 임베딩, pgvector, 조건 필터·유사도 검색, RAG, MOIRA Studio 연동이다.
