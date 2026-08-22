# ProgramCase Search Evaluation UI

개발 URL은 `http://localhost:3000/ai-search-evaluation`이다. 자유 검색, blind relevance 평가, partial metrics 세 영역을 제공한다. 결과에서 기존 `/ai-search-data-inspector`로 이동할 수 있다. 운영에서는 `ENABLE_PROGRAM_CASE_SEARCH_EVALUATION=true`일 때만 backend가 노출된다.

검색 카드는 BM25 score, dense similarity, RRF score와 적용 boost를 구분해서 보여준다. threshold가 정해지지 않았으므로 결과가 모두 적합하다고 표현하지 않는다.
