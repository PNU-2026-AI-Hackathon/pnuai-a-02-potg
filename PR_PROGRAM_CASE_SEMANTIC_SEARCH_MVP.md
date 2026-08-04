# ProgramCase KURE-v1 임베딩 및 의미 검색 MVP

## 관련 이슈

- Closes #94

## 작업 목적

크롤링된 작은도서관 ProgramCase를 개인정보가 제거된 검색 문서와 Chunk로 구성하고, 로컬 KURE-v1 임베딩과 pgvector를 이용해 자연어 의미 검색이 실제 운영 데이터에서 동작하는지 검증합니다.

이번 PR은 최종 기획서 생성 알고리즘을 확정하는 작업이 아니라 검색 기반, 운영 안전성, 데이터 무결성, 검색 품질의 현재 기준선을 확립하는 MVP입니다.

## 주요 구현

- KURE-v1 1024차원 임베딩 생성 CLI 및 로컬 모델 캐시 지원
- pgvector cosine similarity 검색
- stale, orphan, duplicate 및 embedding metadata 무결성 검사
- 운영 DB 확인과 write confirmation을 포함한 CLI 안전장치
- ProgramCase 단위 중복 제거
- `target` 및 `chunk-type` 선택 필터
- 원본 cosine 최고 청크를 대표 결과로 보존
- 결정적 metadata 추론 및 P0-P4 재정렬 실험
- 읽기 전용 15개 한국어 질의 평가 도구
- `GET /api/program-case/semantic-search?q=&limit=5` MVP API
- `/semantic-search-test` 수동 검색 테스트 페이지
- Windows Python subprocess UTF-8 출력 보장

## 현재 운영 검색 정책

운영 기본 정책은 P0를 유지합니다.

```text
자연어 검색어
→ KURE-v1 query embedding
→ pgvector cosine similarity 후보 검색
→ 동일 ProgramCase 중복 제거
→ Top 5 반환
```

metadata filter, reranker, RAG, LLM은 운영 검색에 적용하지 않았습니다. `target` 또는 `chunk-type`을 명시했을 때만 해당 SQL 필터가 적용됩니다.

## 운영 데이터 결과

```text
ProgramCase: 349
ProgramCaseDocument: 349
ProgramCaseDocumentChunk: 888
ProgramCaseDocumentChunkEmbedding: 888
COMPLETED: 888
PROCESSING: 0
FAILED: 0
NULL vector: 0
stale: 0
orphan: 0
duplicate relation: 0
dimension/metadata mismatch: 0
```

ProgramCase, Session, Attachment, Document, Chunk fingerprint는 임베딩 전후 동일합니다.

## 검색 품질 평가

15개 질의, 질의당 Top 5 결과를 P0-P4로 비교했습니다.

| 정책 | 반환 결과 | ATTACHMENT 대표 | ATTACHMENT 비율 | ProgramCase 중복 |
|---|---:|---:|---:|---:|
| P0 baseline | 75 | 46 | 61.3% | 0 |
| P1 metadata | 75 | 40 | 53.3% | 0 |
| P2 chunk weight | 75 | 27 | 36.0% | 0 |
| P3 score aggregate | 75 | 54 | 72.0% | 0 |
| P4 combined | 67 | 34 | 50.7% | 0 |

P2는 ATTACHMENT 비율을 줄였지만 일부 질의에서 주제 적합성이 불분명한 CORE가 진입했습니다. P3는 ATTACHMENT 편향을 악화시켰고, P4는 75개 중 8개 결과를 잃었습니다. 수동 relevance label이 없어 MRR이나 평균 적합도를 임의로 산출하지 않았습니다.

따라서 새 정책을 운영 기본값으로 채택하지 않고 P0와 기존 threshold 정책을 유지합니다.

## 확인된 한계

- 현재 검색 단위는 ProgramCase의 정규화된 대표 프로필이 아니라 CORE, SESSIONS, ATTACHMENT Chunk입니다.
- 작은도서관 프로그램에 공통적인 홍보·교육 표현이 반복되어 벡터 점수가 밀집됩니다.
- ATTACHMENT가 ProgramCase 대표 결과를 과도하게 차지할 수 있습니다.
- 짧은 단어 질의는 의미 범위가 넓고 threshold가 없으면 낮은 관련도의 결과도 Top 5에 포함됩니다.
- 현재 P0는 기획서 생성용 최종 검색 정책이 아니라 기준선입니다.

## 테스트 UI

프런트엔드와 백엔드를 실행한 뒤 다음 주소에서 확인할 수 있습니다.

```text
http://localhost:3000/semantic-search-test
```

응답과 화면에는 다음 필드만 노출합니다.

- rank
- programTitle
- similarity
- chunkType
- programCaseId

Chunk 원문, 첨부 본문, vector, 전체 metadata, 개인정보는 노출하지 않습니다.

## 검증

- Python unit test 70개 통과
- Python compileall 통과
- synthetic TEST DB integration 통과
- backend TypeScript build 통과
- frontend TypeScript 검사 통과
- 신규 페이지 ESLint 통과
- 실제 로컬 API Top 5 응답 확인
- 한글 제목 깨짐 0건 확인
- git diff --check 통과

프런트엔드 production build는 기존 `next/font`가 Google Fonts에 접속하는 과정에서 실행 환경의 네트워크 제한으로 실패했습니다. 신규 페이지 TypeScript와 ESLint 검사는 별도로 통과했습니다.

## 다음 단계

이 PR에서 검색 MVP의 기능과 품질 한계를 확인했습니다. 후속 작업은 별도 이슈와 브랜치에서 ProgramCase 데이터 분포 분석, 프로그램 단위 정규화, 대표 검색 프로필 및 대표 임베딩 파일럿으로 진행합니다.

구체적인 합의 내용은 `docs/ai-data/PROGRAM_CASE_SEARCH_NORMALIZATION_DIRECTION.md`를 참고합니다.

