# feat(ai-search): ProgramCase 그룹화 및 MOIRA Studio 검색 Corpus 구축

## 관련 이슈

- 현재 이슈: `Closes #<현재 이슈 번호>` — GitHub CLI 인증이 없어 번호 확인 후 교체 필요
- 상위 선행 작업: #114 Source Snapshot
- 상위 선행 작업: #117 Structure-preserving Attachment Representation
- 후속 작업: BM25 / KURE Dense / Hybrid(RRF) / Retrieval Evaluation

## 작업 개요

#114의 고정된 ProgramCase 원천 349건과 #117의 구조 보존 Attachment Representation을 읽어, 운영 DB를 수정하지 않는 결정적 파일 기반 검색 데이터 파이프라인을 구축했습니다.

```text
ProgramCase source snapshot
  + Attachment structural representation
  + Section / ProgramCase candidates
  → ProgramCase grouping
  → Section safety decision
  → Core-only / Core + Safe Attachment corpus
  → Read-only Inspector API / UI
```

검색 엔진이나 embedding을 구현하는 PR이 아닙니다. 후속 검색 계층이 직접 사용할 수 있는 검증된 corpus 계약과 inspection surface를 제공합니다.

## ProgramCase Grouping 정책

- 공식 게시·접수 단위인 기존 `ProgramCase`는 유지하며 병합하거나 수정하지 않습니다.
- 검색 비교용 제목에서 기관 접두어, 날짜, 시간, 차수 표현만 분리하고 원본 제목은 보존합니다.
- 같은 source type에서 정규화된 base title이 정확히 일치하고 차이가 날짜·시간·차수로 설명되는 사례만 그룹 후보로 취급합니다.
- 대상 표현이 다르면 같은 family의 `variantCandidates`로 기록하되 현재 MVP corpus는 그룹 대표 문서 한 건을 생성합니다.
- Group ID와 content hash는 안정 정렬된 입력의 SHA-256으로 생성합니다.

### 위험 관계 자동 병합 금지

다음 관계는 같은 Attachment를 공유하더라도 자동 병합하지 않습니다.

- `MULTI_PROGRAM_SHARED_DOCUMENT`
- `EVENT_OVERVIEW_WITH_ACTIVITY_SLOTS`
- `SAME_PROGRAM_DIFFERENT_TARGET`
- `POSSIBLE_FALSE_ATTACHMENT_LINK`
- `UNRESOLVED`

후보는 기존 그룹의 모든 member와 금지 관계가 없는 경우에만 그룹에 들어갑니다. 근거가 약하거나 충돌하면 단독 그룹을 유지합니다.

### 대표 ProgramCase 선택

대표 사례는 다음 순서로 결정적으로 선택합니다.

1. 제목·대상·장소·운영일·공개 설명 등 core 필드 완전성
2. 실제 Session 정보의 존재와 수
3. `SAFE_FOR_CORPUS` Attachment section 보유 여부
4. 동점이면 ProgramCase ID 오름차순

선택 이유는 그룹 artifact의 `representativeReasons`에 기록합니다.

## Section 안전 판정

| 상태 | 정책 |
|---|---|
| `SAFE_FOR_CORPUS` | `CANDIDATE`, 연결 ProgramCase와 title evidence 존재, evidence conflict 및 치명적 exception 없음 |
| `CORE_ONLY` | reliable match 또는 title evidence가 부족하여 ProgramCase core만 사용 |
| `MANUAL_REVIEW` | ambiguous, evidence conflict, reading-order/under-segmentation/false-link 위험. Attachment 제외 |
| `EXCLUDED` | ProgramCase core 자체가 검색에 부적합할 때만 사용 |

`AMBIGUOUS`와 `NO_RELIABLE_MATCH`는 safe로 승격하지 않습니다. Attachment 전체 OCR, 다른 프로그램 section, peripheral block, 연락처·강사·담당자·URL은 corpus에서 제외합니다.

## Core-only / Safe Attachment Corpus

Core-only는 대표/원본 제목, 대상, 공개 설명 중 검색 관련 내용, 장소, 운영 기간, 실제 Session, 최소 metadata와 provenance만 포함합니다. Session row가 없으면 1회로 추론하지 않고 `sessionCount: null`, `sessionCountConfidence: UNKNOWN`을 유지합니다.

Core + Safe Attachment는 Core-only 내용에 `SAFE_FOR_CORPUS` section만 추가합니다. 각 section은 구조 unit reference와 source SHA-256으로 추적할 수 있으며 Attachment 전체 텍스트는 사용하지 않습니다.

## `lexicalText` / `denseText` 계약

- `lexicalText`: BM25 등 keyword 검색을 위한 결정적 label 템플릿
- `denseText`: KURE-v1 입력을 위한 자연스러운 한국어 템플릿
- LLM 호출 없이 동일 입력에서 동일하게 생성
- 근거 없는 주제·활동·효과와 영문 enum 생성 금지
- 최대 길이: lexical 6,000자, dense 4,000자, 개별 Attachment section 3,000자
- 잘림 여부는 `truncation` metadata에 기록

## 전체 결과 통계

| 항목 | 결과 |
|---|---:|
| 입력 ProgramCase | 349 |
| ProgramGroup | 280 |
| 단독 그룹 | 273 |
| 복수 member 그룹 | 7 |
| Variant candidate | 27 |
| `UNRESOLVED` 그룹 | 0 |
| Core-only corpus | 280 |
| Safe Attachment corpus | 280 |
| `SAFE_FOR_CORPUS` | 61 |
| `CORE_ONLY` | 125 |
| `MANUAL_REVIEW` | 83 |

공유 binary 관계는 날짜 차이 7, 시간 차이 5, 차수 차이 1, 대상 차이 2, 통합 문서 5, 행사 개요/활동 슬롯 1건입니다.

| 문서 | 평균 길이 | 최대 길이 |
|---|---:|---:|
| Core lexical | 107 | 1,890 |
| Core dense | 65 | 246 |
| Safe lexical | 268 | 3,113 |
| Safe dense | 227 | 3,077 |

## 개인정보·연락처 검증

전화번호, 휴대전화, 이메일, URL, 문의·연락처·담당자·강사 label 영역을 제거합니다. Core/Safe corpus 전체 privacy pattern scan 결과는 **0건**입니다.

`.local` 원천, OCR response, binary, 전체 Attachment 본문은 Git에 포함하지 않습니다. `apps/backend/.gitignore`의 `.local/` 규칙도 재확인했습니다.

## 결정성 및 hash

- Source dataset: `16c7135e1620dd07c9be3b57bcbb60865a34dec2ef19c55438f839f0e73a2e9c`
- Representation dataset: `c5337769c4d2a498ee54045752552fb9a10bf5750d9d11322bbd20b508e86b6d`
- Group: `10c10a3bd4ce62b632e00355fef4669c440f8f12f5a7017c3e013b742bff62ca`
- Section safety: `1ff1c93c7b0c131da445cae5dafac0eb9635b5e79175b789a26b370a616bf3ac`
- Core corpus: `56fef77c23c1fd18927ecc17bb16a480d03fa1d49bc52669974eb4448b728a80`
- Safe corpus: `6b3df1143d3d917db25a37e05c198e70cec3c9409a682221239e82d21ac783c9`
- 최종 dataset: `335173fc6de4ccdd5736230a2843592a152490ce2e6d60e47f7d0745e485d8d5`

생성 시각은 hash 입력에서 제외하며 동일 입력을 두 번 생성해 결과 hash가 동일한지 테스트합니다.

## Inspector API / UI

- URL: `http://localhost:3000/ai-search-data-inspector`
- 제목·ProgramCase ID·Group ID 검색 및 안전 상태/파일 유형/공유 binary 필터
- 원천 공개 필드, Attachment 구조, Section/Candidate/Safety 상세
- Grouping evidence와 Core-only/Safe corpus 비교
- PNG/JPEG preview와 OCR block geometry overlay
- GET-only read-only API와 `Cache-Control: no-store`
- frontend에서 `.local` 직접 접근 없음
- SHA-256 allowlist와 고정 asset root 검증
- production에서는 `ENABLE_PROGRAM_CASE_SEARCH_INSPECTOR=true`가 없으면 404
- 수정·삭제·DB write endpoint 없음

## 실행 방법

```powershell
cd apps/backend
npm.cmd run program-case-search-corpus -- --all
npm.cmd run dev

cd ../frontend
npm.cmd run dev
```

브라우저에서 `http://localhost:3000/ai-search-data-inspector`를 엽니다.

## 최종 테스트 결과

다음 검증이 모두 통과했습니다.

```text
npm.cmd run test:program-case-search-corpus
npm.cmd run test:program-case-attachment-representation
npm.cmd run test:program-case-source-snapshot
npm.cmd run build  # backend
npm.cmd run lint   # frontend
npm.cmd run build  # frontend production build
git diff --check
```

## 포함 범위

- 결정적 ProgramCase grouping과 대표 사례 선택
- Section safety decision
- Core-only / Core + Safe Attachment corpus
- metadata, provenance, content hash, validation/analysis report
- read-only Inspector backend API, frontend proxy, UI
- grouping/corpus/inspector 계약 및 분석 문서

## 제외 범위

- 운영 DB write, Prisma schema, migration
- 기존 ProgramCase, Document, Chunk, Embedding 변경
- 외부 URL download, OCR/HWP/PDF 재파싱, LLM 호출
- embedding, BM25, Dense, Hybrid/RRF, Retrieval API 및 검색 성능 평가
- `.local` 원문·OCR·binary Git 추적

## 알려진 한계

- 실제 검색 성능은 아직 검증하지 않았습니다.
- Embedding, BM25, Dense, Hybrid Search는 후속 이슈입니다.
- Variant별 corpus 분리는 후속 검토 사항입니다.
- PDF/HWP 전용 Inspector viewer는 포함하지 않았습니다.
- 실제 geometry overlay는 OCR block만 지원합니다.
- `MANUAL_REVIEW`와 `CORE_ONLY`는 안전하게 Attachment를 제외한 상태입니다.

## 후속 검색·평가 입력 계약

- BM25 입력: `lexicalText`
- KURE Dense 입력: `denseText`
- filter/facet: `metadata`
- identity: `corpusId`, `groupId`, `variantKey`
- provenance: `representativeProgramCaseId`, `memberProgramCaseIds`, `sourceRefs`
- invalidation: `contentHash`, builder version, source/representation dataset hash
- Hybrid: BM25와 Dense의 독립 rank를 RRF로 결합
- Evaluation: Core-only와 Safe Attachment corpus를 분리해 relevance와 안전성 차이 측정

후속 검색 계층은 `.local` 원천이나 OCR artifact를 다시 읽지 않고 생성된 corpus contract만 소비해야 합니다.
