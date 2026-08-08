# feat(ai-search): ProgramCase 검색 Retrieval 및 사람 평가 기반 구축

## 관련 이슈

- 현재 이슈: `Closes #<현재 이슈 번호>` — GitHub CLI 인증이 없어 번호 확인 후 교체 필요
- 상위 선행 작업: #114 Source Snapshot
- 상위 선행 작업: #117 Structure-preserving Attachment Representation
- 상위 선행 작업: #121 ProgramCase Grouping / Search Corpus
- 후속 작업: 아래 `평가 보류와 후속 작업` 참조

## 작업 개요

#121에서 만든 Core / Safe corpus 280건 위에 BM25, KURE Dense, Hybrid(RRF) retrieval과
사람 relevance 평가 기반을 구축했습니다. 운영 DB는 수정하지 않으며 모든 산출물은
`.local/program-case-search-v2/` 아래 파일로만 생성합니다.

```text
Core / Safe search corpus (280 × 2)
  → BM25 index (unicode-light-ko-v1)
  → KURE-v1 embedding (1024, L2)
  → BM25 / Dense / Hybrid(RRF) retrieval
  → Chunk P0 baseline과 함께 pooling
  → 30개 고정 query 평가 pool
  → 사람 relevance 평가 API / UI
  → qrels / metrics
```

## 구현 내용

### Retrieval

- BM25: `k1=1.2`, `b=0.75`. 토크나이저는 NFKC 정규화 후 비문자 분리 방식(`unicode-light-ko-v1`).
- Dense: KURE-v1 `nlpai-lab/KURE-v1`, revision `d14c8a9423946e268a0c9952fecf3a7aabd73bd9`,
  1024차원 L2 정규화. 오프라인 캐시만 사용합니다.
- Hybrid: RRF `k=60`. BM25와 Dense 각각 상위 50건을 rank 기반으로 결합합니다.
- `HYBRID_TARGETED`는 `targetAgeGroup` 일치 시 `+0.002` boost, `grade` 범위 밖은 제외합니다.
- 결과는 ProgramGroup 단위로 dedupe합니다.

### 평가 기반

- 30개 고정 seed query (`program-case-search-queries-v1`). 마지막 1건은 `NO_EXPECTED_MATCH`.
- Chunk P0(기존 888 chunk embedding)를 read-only로 조회해 비교 대상에 포함합니다.
- 7개 방식(`BM25/DENSE/HYBRID × CORE/SAFE` + `CHUNK_P0`) 각 상위 10건을 pooling합니다.
- 0~3 relevance와 reviewer note를 저장하고 qrels / metrics를 산출합니다.
- metrics는 pool 전건이 라벨링된 query만 집계합니다(`PROVISIONAL` / `AWAITING_HUMAN_LABELS`).

### API / UI

- `GET /api/program-case-search/{summary,methods,search,chunk-search,queries,pool,metrics}`
- `GET|POST /api/program-case-search/evaluations`
- `/ai-search-evaluation`: 자유 검색 비교, Blind mode, 0~3 평가, 진행률, partial metrics
- production에서는 `ENABLE_PROGRAM_CASE_SEARCH_EVALUATION=true`가 없으면 404를 반환합니다.

## 산출물

```text
.local/program-case-search-v2/retrieval/
  bm25-core-index.json / bm25-safe-index.json
  bm25-tokenizer-manifest.json
  core-embeddings.json / safe-embeddings.json
  embedding-validation-report.json
.local/program-case-search-v2/evaluation/
  queries.json / pool-inputs.json / pooled-results.json
  pooling-report.json / qrels.json / metrics.json
```

## 검증 결과

- Core / Safe embedding 각 280/280 `COMPLETED`, dimension 1024, NaN 0, Infinity 0, 빈 벡터 0
- `contentHashMismatch` 0, `normalizationMismatch` 0
- pooled evaluation unit 781건, 동일 `queryId + resultKey` 중복 0건
- query별 pool 크기 최소 14 / 평균 26.03 / 최대 36
- 운영 DB write 0, 외부 API 호출 0

## 평가 보류와 후속 작업

**이 PR은 평가 기반을 제공하지만, 현 pool로 사람 relevance 평가를 시작하지 않습니다.**
2026-08-05 시스템 검토에서 아래가 확인되었습니다. 코드와 harness는 유효하며,
문제는 corpus에 들어간 입력 데이터와 평가 화면이 노출하는 근거입니다.

1. **corpus builder의 notices 필드 오참조**
   `programCaseSearchCorpus/builder.ts`가 `core.notices`를 읽지만 source snapshot 계약은
   해당 값을 `core.flattenedRepresentations[PROGRAM_CASE_NOTICES]`에 둡니다.
   349건 전부 `undefined`가 되어 본문 설명 텍스트가 corpus에 반영되지 않았습니다.
   결과적으로 Core `denseText` 중앙값이 51자입니다.

2. **본문 inline image 미수집**
   크롤러의 첨부 selector가 `a[href*="upload_data"]`뿐이라, 본문에 `<img>`로 삽입된
   프로그램 내용이 수집되지 않습니다. 표본 23건 중 19건(83%)이 본문에 이미지를 포함하고
   5건은 본문 텍스트가 0자입니다.

3. **평가 UI 근거 부족**
   `/pool`이 내려주는 `description`이 검색에 사용되는 Core `denseText`와 동일하여,
   평가자가 검색기와 같은 정보만 보고 판단하게 됩니다.

4. **한국어 BM25 토크나이저 한계**
   공백 분리 방식이라 조사가 붙은 질의어(`유아를`, `초등학생과`, `부모가`)가 corpus의
   `유아`, `초등학생`과 매칭되지 않습니다.

현 781개 pool과 embedding은 **baseline 보존용**으로 유지하고, 위 항목 해소 후 재생성합니다.
`docs/analysis/PROGRAM_CASE_SEARCH_HUMAN_EVALUATION_GUIDE.md` 상단에 동일한 보류 사유를
명시했습니다.

후속 이슈로 분리합니다.

- `fix(ai-search)`: Search Corpus notices 원본 필드 연결 복구
- `fix(ai-search)`: 한국어 BM25 tokenizer 조사 분리 대응
- `feat(ai-search)`: 작은도서관 크롤러 v2 본문 자산 수집 계약
- 이후 inline image representation 편입, safety 축 분리, Inspector / 평가 UI 보강, pool 재생성

## 확인 방법

```powershell
cd apps/backend
npm.cmd run program-case-search-retrieval -- --build-bm25
npm.cmd run program-case-search-retrieval -- --embed
npm.cmd run program-case-search-retrieval -- --validate
npm.cmd run program-case-search-retrieval -- --build-query-set
npm.cmd run program-case-search-retrieval -- --pool
npm.cmd run test:program-case-search-retrieval
```

`--embed`와 `--pool`은 오프라인 KURE 캐시를 사용하며 `--pool`은 Chunk P0 DB를 read-only로 조회합니다.
