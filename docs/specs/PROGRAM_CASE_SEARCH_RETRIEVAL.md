# ProgramCase Search Retrieval

## 입력과 불변 조건

- source snapshot: `16c7135e1620dd07c9be3b57bcbb60865a34dec2ef19c55438f839f0e73a2e9c`
- attachment representation: `c5337769c4d2a498ee54045752552fb9a10bf5750d9d11322bbd20b508e86b6d`
- search corpus: `335173fc6de4ccdd5736230a2843592a152490ce2e6d60e47f7d0745e485d8d5`
- 검색 결과 단위는 `ProgramGroup`이며 core/safe 각각 280건이다.

KURE-v1은 `nlpai-lab/KURE-v1` revision `d14c8a9423946e268a0c9952fecf3a7aabd73bd9`, 1024차원, CPU, L2 normalization을 사용한다. `contentHash + model + revision + providerVersion + normalization`이 같으면 artifact를 재사용한다. 운영 DB와 기존 888개 Chunk embedding은 변경하지 않는다.

BM25 tokenizer `unicode-light-ko-v1`은 NFKC, 한국어 locale 소문자화, 문자·숫자 보존, 나머지 구분자 공백화만 수행한다. 형태소 분석기는 설치·배포 재현 비용 때문에 MVP에 포함하지 않았다. BM25는 k1=1.2, b=0.75이다.

Hybrid는 RRF v1, constant 60, 각 후보 50건을 사용한다. Metadata target boost는 명시된 `targetAgeGroups` 일치에 +0.002만 적용하며 불확실한 필드는 hard filter하지 않는다. grade filter도 명시된 범위가 있을 때만 적용한다. similarity/score threshold는 사람 평가 전에는 운영 정책으로 정하지 않는다.

기존 Chunk P0는 `/api/program-case/semantic-search` read-only API를 adapter 경계로 유지한다. Chunk 원본·embedding·DB를 변경하지 않는다.
