# ProgramCase Search Evaluation

30개 고정 seed query를 `.local/program-case-search-v2/evaluation/queries.json`에 생성한다. 개인정보를 포함하지 않으며 검색 결과를 본 뒤 query를 자동 수정하지 않는다. Pool은 Chunk P0, BM25/Dense/Hybrid Core와 Safe의 top 5~10 결과를 평가 단위에 맞게 중복 제거해야 한다.

사람이 0(무관), 1(일부 관련), 2(참고 가능), 3(바로 추천 가능)으로 판정한다. Codex는 label을 만들지 않는다. `reviewedAt`은 내용 hash에서 제외한다. relevance >= 2를 relevant로 하여 Precision@5, MRR, Success@3을 계산하고, 0~3 graded gain으로 nDCG@5를 계산한다. 미평가 query는 집계에서 제외하며 상태를 provisional로 표시한다.

API는 `/api/internal/program-case-search/{summary,search,methods,queries,pool,evaluations,metrics}`이며 평가 저장 POST만 `.local`에 기록한다. `Cache-Control: no-store`, query 500자, method/corpus allowlist, limit 1~20, production gate를 적용한다. 운영 DB write는 없다.
