# 프로그램 사례 임베딩 migration 준비 보고

## 조사 범위

2026-07-31 기준 운영 DB에는 쓰지 않고 다음 읽기 전용 확인만 수행했다.

- `prisma migrate status`
- `_prisma_migrations` 조회
- `current_database()` 및 현재 schema 조회
- `pg_available_extensions`, `pg_extension`, `pg_type`, `to_regclass` 조회
- reconcile 대상 index와 중복 데이터 조회
- 대상 테이블 row 수 및 크기 조회
- `prisma migrate diff` 읽기 전용 비교

실행하지 않은 작업:

- `prisma migrate deploy`, `migrate dev`, `db push`, `migrate reset`
- `prisma migrate resolve`
- 직접 SQL 실행
- extension, type, table 또는 index 생성
- KURE-v1 다운로드와 모델 로드
- 운영 embedding 생성

## 운영 DB 상태

```text
database: moira
schema: public
ProgramCase: 349
ProgramCaseDocument: 349
ProgramCaseDocumentChunk: 888
vector available version: 0.8.2
vector installed: false
embedding status enum: false
ProgramCaseDocumentChunkEmbedding table: false
```

연결 계정은 현재 database와 `public` schema에서 `CREATE` 권한을 갖고 있다.
이는 pgvector extension 생성 성공을 보장하지는 않지만, RDS에서 vector 0.8.2가
사용 가능한 extension으로 노출되는 것은 확인했다.

## migration history

운영 `_prisma_migrations`에는 다음 legacy migration 8개가 성공 상태로 기록되어
있다.

1. `20260704110000_baseline`
2. `20260704120000_expand_user_registration`
3. `20260719090000_create_board_post`
4. `20260719090000_create_community_post`
5. `20260719233000_add_program_case_models`
6. `20260720070000_add_attachment_extraction_fields`
7. `20260729120000_add_program_case_document`
8. `20260729170000_add_program_case_document_chunks`

실패 또는 rollback 상태로 기록된 migration은 없다.

현재 활성 `prisma/migrations`에는 다음 3개만 있다.

1. `0_canonical_pre_issue92`
2. `20260729180000_reconcile_pre_issue92_schema`
3. `20260729190000_add_program_case_chunk_embeddings`

따라서 Prisma의 판정은 다음과 같다.

```text
last common migration: null
database-only migrations: legacy 8개
local-only pending migrations: active 3개
```

운영 migration history와 현재 Git의 활성 migration history는 일치하지 않는다.
`prisma migrate deploy`를 지금 실행해서는 안 된다.

## pending SQL 영향

### `0_canonical_pre_issue92`

빈 DB용 canonical baseline이다. 기존 테이블, enum, index, FK를 생성한다. 운영
DB에는 이 객체들이 이미 있으므로 실제 SQL을 실행하면 초기 `CREATE TYPE` 또는
`CREATE TABLE`부터 중복 객체 오류가 발생한다.

이 migration은 운영 DB에서 실행 대상이 아니라, schema가 canonical과
동등하다는 별도 검증 후 migration history에 적용 완료로 표시할 후보이다.
`prisma migrate resolve --applied` 역시 `_prisma_migrations`를 변경하는 쓰기
작업이므로 별도 승인이 필요하다.

### `20260729180000_reconcile_pre_issue92_schema`

다음 두 index만 생성한다.

```sql
CREATE UNIQUE INDEX "Interest_name_key" ON "Interest"("name");
CREATE INDEX "UserInterest_interestId_idx" ON "UserInterest"("interestId");
```

운영 확인 결과:

```text
Interest rows: 14
duplicate Interest.name groups: 0
UserInterest rows: 27
both indexes currently absent
```

데이터 조건상 unique index 생성은 가능하다. 일반 `CREATE INDEX`이므로 작업
중 해당 소형 테이블의 쓰기를 잠시 차단할 수 있다. `CONCURRENTLY`가 아니지만
현재 규모에서는 index 생성 자체는 짧을 것으로 예상된다.

### `20260729190000_add_program_case_chunk_embeddings`

명시적 `BEGIN`/`COMMIT` 안에서 다음 작업을 수행한다.

- `CREATE EXTENSION IF NOT EXISTS vector`
- embedding 상태 enum 생성
- `ProgramCaseDocumentChunkEmbedding` 생성
- `VECTOR(1024)`와 dimension check 추가
- Chunk당 한 행을 보장하는 unique index 추가
- status 및 모델 metadata index 추가
- `ProgramCaseDocumentChunk` cascade FK 추가

기존 ProgramCase, Document 또는 Chunk row를 수정하는 DML은 없다. 신규 extension,
enum, table, index 및 FK만 추가한다.

`ProgramCaseDocumentChunk`는 888행, 전체 relation 크기는 약 3MB다. FK 추가 시
참조 테이블에 잠금이 필요하므로 짧은 시간이라도 Chunk 관련 쓰기와 경합할 수
있다. extension 설치는 system catalog 잠금과 권한 문제로 실패할 수 있다.

## deploy 동작과 rollback

canonical baseline을 history에서 먼저 안전하게 reconcile하지 않은 현재 상태에서
`prisma migrate deploy`는 허용할 수 없다.

canonical을 적용 완료로 표시한 뒤 Prisma가 예상대로 두 migration만 pending으로
판정한다면, 일반 `prisma migrate deploy`는 다음 두 migration을 순서대로 함께
적용한다.

1. `20260729180000_reconcile_pre_issue92_schema`
2. `20260729190000_add_program_case_chunk_embeddings`

Prisma deploy에는 특정 migration 하나만 선택하는 공식 target 옵션이 없다.
두 migration은 각각 별도로 완료 기록된다. 따라서 reconcile이 성공하고 embedding
migration이 실패하면 reconcile index는 적용된 상태로 남을 수 있다. embedding
migration 내부의 enum/table/index/FK는 명시적 transaction 덕분에 해당 migration
단위로 rollback되어야 한다.

down migration은 없다. 적용 후 논리적 문제가 생기면 다음 중 하나가 필요하다.

- 적용 직전 RDS snapshot으로 복구
- 별도로 검토하고 승인한 forward corrective migration
- 소유권과 데이터 영향을 확인한 운영 절차

즉흥적인 `DROP EXTENSION`, `DROP TABLE`, migration row 삭제는 rollback 방법으로
사용하지 않는다.

## 권장 승인 절차

1. 운영 RDS 수동 snapshot 또는 동등한 복구 지점을 생성한다.
2. `_prisma_migrations`, schema fingerprint, 핵심 테이블 count를 보관한다.
3. canonical baseline과 운영 물리 schema의 동등성 검증 결과를 리뷰한다.
4. 별도 승인 후 canonical 하나만 `migrate resolve --applied`로 기록한다.
5. 즉시 `prisma migrate status`를 다시 실행한다.
6. pending이 reconcile과 embedding 두 개뿐인지 확인한다.
7. 별도 승인 후 `prisma migrate deploy`를 실행한다.
8. extension 0.8.2, enum, table, index, FK와 migration 성공 기록을 읽기 전용으로
   검증한다.
9. 원본 349/349/888 count와 snapshot이 유지되는지 확인한다.

3~5단계가 검증되기 전에는 deploy 승인을 요청하지 않는다.

## 구현된 CLI

`apps/backend`에서 실행한다.

```powershell
npm.cmd run program-case-embedding-model:diagnose -- --json
npm.cmd run program-case-embeddings:build -- --all --dry-run
npm.cmd run program-case-embeddings:build -- --chunk-id="<UUID>" --dry-run
```

실제 쓰기는 현재 DB 이름과 정확히 일치하는 확인 옵션이 필요하다.

```powershell
npm.cmd run program-case-embeddings:build -- --all --confirm-database=moira
npm.cmd run program-case-embeddings:build -- --chunk-id="<UUID>" --confirm-database=moira
```

검색은 read-only transaction을 사용한다.

```powershell
npm.cmd run program-case-semantic-search -- --query="<한국어 질의>" --limit=5
npm.cmd run program-case-semantic-search -- --query="<한국어 질의>" --limit=5 --threshold=0.4 --chunk-type=CORE
```

진단 명령은 모델 객체를 생성하지 않으며 다운로드를 시작하지 않는다.

## 이번 단계 검증 결과

```text
TypeScript build: 성공
Python unit tests: 50 passed
synthetic pgvector integration test: 성공
synthetic fixture cleanup: 성공
운영 DB confirmation 누락 차단: 성공
CLI 필수/상호 배타 옵션 검사: 성공
검색 JSON 원문 및 target 비출력 검사: 성공
모델 진단 실행: 성공
모델 cache 생성/다운로드: 0건
운영 DB migration/embedding 쓰기: 0건
```

synthetic integration은 `moira_pgvector_integration_test` 전용 DB에서만 실행했다.
테스트는 무작위 fixture를 생성하고 cosine 정렬, chunk type filter, stale 제외,
metadata 불일치 제외를 확인한 뒤 cascade cleanup 및 잔존 row 0건을 검증한다.
