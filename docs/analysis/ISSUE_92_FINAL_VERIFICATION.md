# Issue #92 최종 구현 및 검증 보고서

## 1. 문서 목적

이 문서는 GitHub Issue #92
`feat(ai-data): 프로그램 사례 청크 임베딩 및 pgvector 유사도 검색 구축`의
구현, migration 재구성, 전용 테스트 데이터베이스 검증, 검색 SQL 수정,
통합 테스트 결과와 커밋 전 남은 리뷰 사항을 정리한다.

작성 기준 상태:

| 항목 | 값 |
|---|---|
| 작성일 | 2026-07-30 |
| branch | `feat/program-case-semantic-search` |
| HEAD | `bdb3c2b` |
| 전용 테스트 DB | `moira_pgvector_integration_test` |
| 운영 DB 변경 | 없음 |
| commit / push | 없음 |

현재 판정은 **핵심 구현과 실행 검증 완료, 사소한 리뷰 2건 정리 후 커밋 가능**이다.

## 2. 구현 범위

Issue #92에서는 다음 구조를 구현했다.

- `ProgramCaseDocumentChunk` 단위의 embedding 저장 구조
- PostgreSQL `pgvector` extension
- `VECTOR(1024)` embedding column
- embedding 상태와 모델 metadata 관리
- deterministic vector를 이용한 로컬 통합 테스트
- cosine distance 기반 similarity 검색
- provider, model, model revision, embedding version, dimension 필터
- stale content hash 제외
- optional chunk type 필터
- CLI 및 Python package 구조
- TEST DB 전용 안전 가드와 fixture cleanup

이번 검증에서는 KURE-v1 모델을 다운로드하거나 실제 embedding을 생성하지 않았다.
외부 embedding API도 호출하지 않았다.

## 3. Migration 재구성

### 3.1 문제 배경

기존 첫 baseline migration인 `20260704110000_baseline`에는 PostgreSQL 17.10에서
존재하지 않는 `DEFAULT uuid()`가 포함되어 있었다. 빈 데이터베이스에서 migration을
적용하면 SQLSTATE `42883`로 실패했다.

운영 DB에는 기존 migration 8개가 이미 성공 적용되어 있었고, baseline checksum도
Git canonical LF 파일과 일치했다. 따라서 기존 migration을 수정하면 운영 migration
history와 checksum을 훼손할 수 있어 legacy SQL은 변경하지 않았다.

### 3.2 최종 migration 구조

```text
apps/backend/prisma/
├─ migrations-legacy/
│  └─ 운영 적용 legacy migration 8개
├─ migrations/
│  ├─ 0_canonical_pre_issue92/
│  │  └─ migration.sql
│  ├─ 20260729180000_reconcile_pre_issue92_schema/
│  │  └─ migration.sql
│  └─ 20260729190000_add_program_case_chunk_embeddings/
│     └─ migration.sql
├─ schema.pre-issue92.prisma
└─ schema.prisma
```

적용 순서는 다음과 같다.

```text
canonical pre-Issue-92 baseline
→ pre-Issue-92 schema reconcile
→ Issue #92 pgvector embedding migration
```

### 3.3 Canonical baseline

`0_canonical_pre_issue92`는 자동 생성 schema에 운영 물리 구조를 반영해 다음을
보존한다.

- 운영의 pre-Issue-92 테이블과 enum
- legacy 보존 테이블 `BoardPost`
- `CommunityPost.tags`
  - `TEXT[]`
  - `NOT NULL`
  - `DEFAULT ARRAY[]::TEXT[]`
- 확인된 TEXT ID 7개의 `gen_random_uuid()::text` DB default
- 기존 PK, FK, unique constraint 및 index

다음 객체는 운영 DB에 없었기 때문에 canonical에서 제외했다.

- `Interest_name_key`
- `UserInterest_interestId_idx`

canonical에는 vector extension, vector column, embedding 구조 또는 운영 데이터
literal/DML이 포함되지 않는다.

### 3.4 Reconcile migration

`20260729180000_reconcile_pre_issue92_schema`는 다음 두 statement만 포함한다.

```sql
CREATE UNIQUE INDEX "Interest_name_key" ON "Interest"("name");

CREATE INDEX "UserInterest_interestId_idx" ON "UserInterest"("interestId");
```

운영 read-only 조사 당시:

- Interest: 14건
- `name` NULL: 0건
- case-sensitive 중복: 0그룹
- `lower(name)` 기준 중복: 0그룹
- UserInterest: 27건

따라서 향후 forward migration으로 두 index를 추가할 수 있는 데이터 조건임을
확인했다. 해당 aggregate 값은 migration SQL에 포함하지 않았다.

### 3.5 Issue #92 migration

Issue #92 migration은 다음을 생성한다.

- `vector` extension
- `ProgramCaseDocumentChunkEmbeddingStatus` enum
- `ProgramCaseDocumentChunkEmbedding` table
- nullable `VECTOR(1024)` embedding column
- dimension 1024 check constraint
- chunk relation FK와 cascade action
- chunk ID unique index
- status index
- provider/model/modelRevision index

PostgreSQL의 63바이트 identifier 제한으로 긴 FK/index 이름이 자동 절단되는 문제가
발견되어, 운영 미배포 상태에서 Prisma schema와 migration SQL을 다음 이름으로
정렬했다.

| 객체 | 최종 이름 | UTF-8 길이 |
|---|---|---:|
| chunk FK | `ProgramCaseChunkEmbedding_chunkId_fkey` | 38 |
| chunk unique index | `ProgramCaseChunkEmbedding_chunkId_key` | 37 |
| model metadata index | `ProgramCaseChunkEmbedding_modelRevision_idx` | 43 |

Prisma에는 각각 `@relation(map:)`, `@unique(map:)`, `@@index(map:)`를 사용했다.
실제 PostgreSQL catalog 이름과 Prisma 기대 이름이 일치하며 자동 절단은 발생하지
않는다.

## 4. Migration 무결성

### 4.1 Legacy checksum

legacy migration 8개는 archive 이동 전후 내용이 보존되었다.

| Migration | SHA-256 |
|---|---|
| `20260704110000_baseline` | `9EEB98D1634BBC007DF7CED6775EC7E60B962E3EE07C22E938CE4C9ADECCDD9A` |
| `20260704120000_expand_user_registration` | `13F41029530C838A88C2B6401727D2A3CAE5F9744CF3E0354EC5AC1C7E234E36` |
| `20260719090000_create_board_post` | `775B8755C1A8BEE833E7979CD562EA07873E8CFDFC67E814F6FD0A33830E458F` |
| `20260719090000_create_community_post` | `3C7DC9CDACCCFAD5DC880AA60196D8B996801A00B1A5F7B5A8C4C141D713AC3F` |
| `20260719233000_add_program_case_models` | `9CA23E09ABC4502A3B55B082F7FC9CAE367BE89C830255FB638726ACEE71225A` |
| `20260720070000_add_attachment_extraction_fields` | `98DAAB756F559A6CD2D655D66C9AC890AA6850D3A8BB12188F94A190A598DB1B` |
| `20260729120000_add_program_case_document` | `56B624D1E5AC43A1200DA7D1A451FB34F4F8B7DBFA0F82F7915AD32D5167B75C` |
| `20260729170000_add_program_case_document_chunks` | `F93C79589D0EADCAB577B46B29059045290BFD03DC9B19E91A98CCA2064869C8` |

`20260704120000_expand_user_registration`은 운영 적용 후 repository에서 수정된
이력이 있으므로, 현재 archive checksum과 운영 `_prisma_migrations` checksum이
다르다는 사실을 별도로 관리해야 한다. 이번 작업에서는 과거 파일로 되돌리거나
운영 checksum에 맞추지 않았다.

### 4.2 Active migration checksum

| Migration | SHA-256 |
|---|---|
| `0_canonical_pre_issue92` | `2A2A3C6275D04F41644A185775C64B872318B6F6C9578BC80089E8FA04BDA97C` |
| `20260729180000_reconcile_pre_issue92_schema` | `680DF349FE03DCA73400CEFFE2F01DC0E3792389EC185565AD5C7220FF690438` |
| `20260729190000_add_program_case_chunk_embeddings` | `FDC43D1BB274E8F19A6115A5DB8786450CABFF19FE84492B749BBE5B035744C1` |

`schema.pre-issue92.prisma`는 Git HEAD의 pre-Issue-92 `schema.prisma` canonical LF
snapshot과 일치한다.

## 5. TEST DB migration 검증

모든 DB write는 `moira_pgvector_integration_test`에서만 수행했다. 각 write 단계
전에 실제 `current_database()`를 검사했다.

검증 결과:

| 항목 | 결과 |
|---|---|
| 초기 사용자 테이블 | 0개 |
| 초기 `_prisma_migrations` | 없음 |
| 초기 vector extension | 미설치 |
| 첫 `migrate deploy` | exit 0 |
| 적용 migration | 3개 |
| 실패 migration | 0개 |
| 두 번째 `migrate deploy` | exit 0 |
| 두 번째 추가 적용 | 0개 |
| vector extension | `0.8.2` |
| embedding type | `vector(1024)` |
| identifier 절단 | 0건 |

안정적인 catalog query에서 volatile metadata와 OID를 제외하고 계산한 schema
fingerprint는 두 번째 deploy 전후 동일했다.

```text
e89742ce06b789d5562ea531ce85b727abc8d2ce6f881715ef5a66181eee1c09
```

## 6. Prisma drift 검증

TEST DB와 working-tree `schema.prisma`의 Prisma diff 결과는 A로 분류되었다.

승인된 custom drift:

1. Prisma 모델에 없는 legacy `BoardPost`에 대한 DROP 제안
2. Prisma가 관리하지 않는 7개 ID DB default 제거 제안
3. `CommunityPost.tags` 빈 배열 DB default 제거 제안

다음 예상하지 못한 drift는 모두 0건이다.

- Issue #92 FK rename
- Issue #92 index rename
- vector dimension 변경
- Issue #92 table/column 변경
- FK action 변경
- unique/index target 변경
- `Interest_name_key` 변경
- `UserInterest_interestId_idx` 변경

## 7. 검색 SQL 오류와 수정

### 7.1 오류

첫 integration 실행에서 다음 오류가 발생했다.

```text
SQLSTATE 42P18
IndeterminateDatatype
could not determine data type of parameter $7
```

`SearchRepository.search()`는 `chunk_type`을 두 positional parameter로 전달했다.

```text
$7 → IS NULL 검사
$8 → enum equality 검사
```

두 값이 Python에서 같은 `None`이어도 PostgreSQL에서는 서로 다른 parameter이므로
`$8`의 enum cast가 `$7`의 타입 추론에 영향을 주지 않는다.

### 7.2 수정

두 placeholder에 모두 정확한 enum cast를 적용했다.

```sql
AND (
  %s::"ProgramCaseDocumentChunkType" IS NULL
  OR c."chunkType" = %s::"ProgramCaseDocumentChunkType"
)
```

확인 결과:

- placeholder 9개
- execute parameter 9개
- parameter 순서 변화 없음
- `chunk_type=None`이면 필터 비활성화
- 값이 있으면 enum equality filter 적용
- vector cast, similarity, metadata, stale, ordering, limit 구조 변화 없음

## 8. Integration test 안전성 및 검증

### 8.1 내부 DB hard guard

integration 스크립트는 URL 문자열 검사에만 의존하지 않는다. 연결 직후 첫 검증으로
다음을 실행한다.

```sql
SELECT current_database()
```

결과가 정확히 `moira_pgvector_integration_test`가 아니면 fixture write 전에
`RuntimeError`로 종료한다.

`TEST_DATABASE_URL`은 필수이며 `DATABASE_URL`을 연결 fallback으로 사용하지 않는다.
연결 문자열이나 credential은 출력하지 않는다.

### 8.2 Synthetic fixture

한 ProgramCase와 한 ProgramCaseDocument 아래에 다음 chunk/embedding을 생성했다.

| Chunk | Type | Metadata | 목적 |
|---|---|---|---|
| first | `CORE` | 정상 | nearest ordering |
| second | `SESSIONS` | 정상 | optional filter와 stale 이후 정상 결과 |
| mismatch | `ATTACHMENT` | 다른 `modelRevision` | metadata filter 제외 |

사용한 vector는 KURE 모델이 아닌 deterministic fake 1024차원 vector다.

생성 범위:

- ProgramCase: 1건
- ProgramCaseDocument: 1건
- ProgramCaseDocumentChunk: 3건
- ProgramCaseDocumentChunkEmbedding: 3건
- 총 synthetic row: 8건

ProgramCaseSession과 ProgramCaseAttachment fixture는 생성하지 않았다.

### 8.3 검증 항목

최종 integration test는 다음을 검증한다.

- similarity query가 예외 없이 결과를 반환
- 결과가 비어 있지 않음
- 가장 가까운 first chunk가 첫 결과
- 결과 수가 요청 limit 이하
- `modelRevision` mismatch embedding 제외
- stale content hash embedding 제외
- `chunk_type=None` 검색 성공
- `chunk_type="CORE"` 검색 성공
- CORE filter 결과가 모두 CORE
- program/document/chunk relation 일치
- ProgramCase 삭제에 따른 cascade cleanup
- synthetic ID 기반 6개 테이블 잔존 count

threshold는 현재 `SearchRepository` API와 SQL 범위에 없으므로 추가하지 않았다.

### 8.4 Cleanup

cleanup은 무작위 synthetic ProgramCase UUID 한 건만 삭제한다. 전체 테이블 row가
0건이라고 가정하거나 운영성 데이터를 일괄 삭제하지 않는다.

검증 대상:

- ProgramCase
- ProgramCaseSession
- ProgramCaseAttachment
- ProgramCaseDocument
- ProgramCaseDocumentChunk
- ProgramCaseDocumentChunkEmbedding

테스트 오류와 cleanup 오류는 별도로 수집한다. 둘 다 발생하면 `ExceptionGroup`으로
함께 보존하며 cleanup 오류를 숨기지 않는다.

## 9. 최종 검증 결과

| 검증 | 결과 |
|---|---|
| Python syntax | 성공 |
| Python import | 성공 |
| 대상 operational test | `1 passed` |
| 전체 unit test | `43 passed` |
| integration test | exit 0 |
| SQLSTATE 42P18 재발 | 없음 |
| similarity 결과 | 성공 |
| nearest ordering | 성공 |
| limit | 성공 |
| metadata mismatch 제외 | 성공 |
| stale hash 제외 | 성공 |
| `chunk_type=None` | 성공 |
| `chunk_type=CORE` | 성공 |
| relation | 성공 |
| cleanup | 성공 |
| 최종 synthetic fixture | 전부 0건 |
| schema fingerprint 변화 | 없음 |

## 10. 운영 및 외부 시스템 안전성

- 이번 최종 TEST 검증에서 운영 DB 연결·조회·변경 0건
- 운영 데이터 복사 0건
- 운영 migration 실행 0회
- KURE-v1 다운로드 0회
- 실제 embedding 생성 0회
- 외부 embedding API 호출 0회
- EC2 변경 0건
- credential/connection string 출력 0건
- commit/push 없음

## 11. 커밋 전 남은 사소한 리뷰

핵심 기능이나 안전성을 막는 문제는 아니다. 커밋 전 정리하면 코드 설명과 회귀
테스트의 정확도가 좋아진다.

### 11.1 검색 SQL 주석 불일치

위치:

```text
apps/backend/python/program_case_semantic_search/search_repository.py
```

현재 주석은 optional filtering이 boolean parameter를 사용한다고 설명하지만 실제
구현은 같은 enum parameter를 두 번 전달하고 양쪽에 명시적 enum cast를 적용한다.

권장 수정 방향:

```text
optional enum filtering이 dynamic SQL 대신 두 개의 bound enum parameter와
명시적 cast를 사용한다는 의미로 주석 갱신
```

SQL이나 parameter 구조는 변경할 필요가 없다.

### 11.2 Operational source assertion 결합력 부족

위치:

```text
apps/backend/python/tests/test_operational_scripts.py
```

현재 테스트는 다음을 별도로 검사한다.

```python
self.assertIn("cursor.fetchone()", source)
self.assertIn("any(", source)
```

integration `main()`에는 cleanup 외에도 여러 `fetchone()`과 `any()` 호출이 있다.
따라서 cleanup의 `any(cursor.fetchone())`가 제거되어도 다른 호출 때문에 테스트가
통과할 수 있다.

권장 최소 수정:

```python
self.assertIn("if any(cursor.fetchone()):", source)
```

기존 cleanup 메시지 계약은 유지한다.

```python
self.assertIn("embedding cascade deletion failed", source)
```

복잡한 AST 도구를 추가하거나 integration script를 과거 단일-count 방식으로
되돌릴 필요는 없다.

## 12. 커밋 범위 분류

### A. Runtime SQL 수정과 integration 보완

- `apps/backend/python/program_case_semantic_search/search_repository.py`
- `apps/backend/python/scripts/test_program_case_vector_integration.py`
- `apps/backend/python/tests/test_operational_scripts.py`

### B. 앞선 Issue #92 구현

- `apps/backend/.env.example`
- `apps/backend/.gitignore`
- `apps/backend/prisma/schema.prisma`
- `apps/backend/prisma/schema.pre-issue92.prisma`
- `apps/backend/prisma/migrations-legacy/**`
- `apps/backend/prisma/migrations/0_canonical_pre_issue92/**`
- `apps/backend/prisma/migrations/20260729180000_reconcile_pre_issue92_schema/**`
- `apps/backend/prisma/migrations/20260729190000_add_program_case_chunk_embeddings/**`
- `apps/backend/python/**` 중 위 A를 제외한 Issue #92 package, scripts, tests, requirements
- `docs/analysis/PROGRAM_CASE_SEMANTIC_SEARCH.md`
- 이 최종 검증 문서

### C. 관련 없는 기존 변경으로 제외

- `apps/frontend/next-env.d.ts`
- `PR_89.md`
- `PR_ATTACHMENT_EXTRACTION_FINAL_VERIFICATION.md`
- HWP 관련 문서

## 13. 권장 마무리 순서

1. 위 사소한 리뷰 2건 수정
2. 변경된 두 파일 범위 syntax/import 검사
3. 대상 operational test 실행
4. 전체 unit test 43건 재실행
5. DB schema 변경이 없으므로 migration과 integration은 원칙적으로 재실행 불필요
6. 최종 Git diff에서 Issue #92와 관련 없는 파일 제외
7. Issue #92 관련 변경을 커밋
8. push는 별도 사용자 승인 후 수행

권장 커밋 메시지:

```text
feat(ai-data): 프로그램 사례 청크 임베딩 및 유사도 검색 구축
```

## 14. 최종 판정

```text
핵심 구현: 완료
Migration 검증: 완료
Prisma drift 검증: 완료
검색 SQL 오류 수정: 완료
Unit test: 43 passed
Integration test: 성공
Fixture cleanup: 성공
운영 영향: 없음
남은 작업: 사소한 리뷰 2건과 커밋 범위 최종 확인
현재 상태: 사소한 정리 후 커밋 가능
```
