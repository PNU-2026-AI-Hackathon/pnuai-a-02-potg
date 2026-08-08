# MOIRA Studio Search Corpus 계약

## Section 안전 판정

- `SAFE_FOR_CORPUS`: `CANDIDATE`, ProgramCase 연결, title evidence, 충돌 없음, 치명적 representation exception 없음
- `CORE_ONLY`: reliable match 또는 title evidence가 부족함
- `MANUAL_REVIEW`: ambiguous, evidence conflict, reading order/under-segmentation/false-link 위험
- `EXCLUDED`: ProgramCase core 자체가 검색에 부적합할 때만 사용

`AMBIGUOUS`와 `NO_RELIABLE_MATCH`는 safe로 승격하지 않는다. Attachment 전체 OCR, peripheral block, 연락처, 강사·담당자, URL은 corpus에 포함하지 않는다.

## 문서 계약

그룹마다 Core-only 문서와 Core + Safe Attachment 문서를 하나씩 생성한다. 대상, 기관, 장소, 운영일, 실제 공개 설명과 안전 section만 사용한다. Session row가 없으면 `sessionCount: null`, `sessionCountConfidence: UNKNOWN`이다.

Lexical text는 결정적 label 템플릿이며 최대 6,000자다. Dense text는 enum 대신 자연스러운 한국어 템플릿이며 최대 4,000자다. 개별 Attachment section은 최대 3,000자이며 잘림 여부를 `truncation`에 기록한다. 근거 없는 주제·효과는 생성하지 않는다.

Builder version은 `program-case-search-corpus-v1`이다. corpus ID, content hash, 전체 dataset hash는 생성 시각을 제외한 안정 정렬 데이터로 계산된다. 운영 DB, Document, Chunk, Embedding에는 쓰지 않는다.
