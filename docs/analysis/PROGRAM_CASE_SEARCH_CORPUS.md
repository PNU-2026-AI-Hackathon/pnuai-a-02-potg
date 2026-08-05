# ProgramCase Search Corpus 분석

## 생성 결과

- Core-only corpus: 280
- Core + Safe Attachment corpus: 280
- `SAFE_FOR_CORPUS` section: 61
- Pipeline dataset hash: `335173fc6de4ccdd5736230a2843592a152490ce2e6d60e47f7d0745e485d8d5`
- DB write: 0

Source snapshot 및 Representation은 읽기 전용이며 `.local/program-case-search-v2/corpus/` 아래에 결과를 생성한다. 입력과 builder version이 같으면 group, safety, core, safe hash가 같다. 생성 시각은 hash 입력에서 제외한다.

연락처·전화번호·이메일·URL·강사/담당자 label 영역을 제거하며 테스트에서 corpus 개인정보 패턴 match는 0건이다. Core-only에는 검증 가능한 core 필드만, Safe corpus에는 61개 안전 section만 추가했다. `AMBIGUOUS`와 `NO_RELIABLE_MATCH` section은 포함되지 않는다.

## 후속 검색 계약

BM25는 `lexicalText`, Dense/KURE-v1은 `denseText`를 입력으로 사용한다. 필터에는 `metadata`, identity/provenance에는 `corpusId`, `groupId`, `representativeProgramCaseId`, `memberProgramCaseIds`, `contentHash`를 사용한다. 후속 검색기는 원문 artifact를 다시 읽거나 corpus 내용을 수정하지 않는다.
