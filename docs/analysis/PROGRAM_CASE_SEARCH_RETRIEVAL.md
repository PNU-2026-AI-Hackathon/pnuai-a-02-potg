# ProgramCase Search Retrieval 구현 분석

Core/Safe corpus를 별도 BM25 index와 KURE artifact로 만들고 exact cosine search를 수행한다. 280건 규모에서는 pgvector로 복제하는 것보다 검증 가능한 `.local` exact scan이 단순하고 충분하다. RRF 결과에는 양쪽 rank와 raw score, corpus/content hash를 남긴다.

실행: `npm.cmd run program-case-search-retrieval -- --audit`, `--embed`, `--build-bm25`, `--validate`, `--build-query-set`, `--metrics`, `--all`. 모델 생성은 local Hugging Face cache를 offline 모드로만 사용한다.

한계: corpus 원문 일부가 현재 artifact에서 mojibake로 보이며 입력 hash가 승인값과 같아 이 작업에서는 수정하지 않았다. 이는 한국어 retrieval 품질 평가 시 명시적으로 고려해야 한다.
