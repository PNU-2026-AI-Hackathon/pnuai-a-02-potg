# ProgramCase SearchProfile 분포 분석

## 대상과 안전성

2026-08-04 `moira` 데이터베이스에서 `current_database()`를 먼저 확인하고 `SET TRANSACTION READ ONLY`가 적용된 연결의 `SELECT`만 사용했다. 분석 시점 row 수는 ProgramCase 349, Session 20, Attachment 237, Document 349, Chunk 888, 완료 embedding 888이며 embedding 차원은 모두 1024다. schema, migration, 기존 row와 embedding은 변경하지 않았다.

분류 입력은 제목·대상, Session 활동, 추출 완료된 활성 Attachment의 정제 텍스트다. 원문은 메모리 밖으로 복사하지 않았고 산출물에는 공개 프로그램명, UUID, 집계, taxonomy와 근거 코드만 포함한다.

## 핵심 분포

- 제목: schema상 필수이며 349/349 존재한다.
- Session 관계: 5개 ProgramCase가 다회차, 나머지 344개는 관계 정보상 단회차로 취급된다. Session row는 20개다.
- Attachment: 237개가 존재한다. 규칙 분류 의존성은 제목·대상 218건(62.46%), Attachment 보완 128건(36.68%), Session 보완 3건(0.86%)이다.
- 주제: 독서·쓰기 170(48.71%), 미술·공예 117(33.52%), 문화 43(12.32%), 디지털 36(10.32%), 공동체 29(8.31%), 언어 23(6.59%), 환경·과학 21(6.02%), 건강 9(2.58%), UNKNOWN 36(10.32%). 복수 분류이므로 합계는 349를 넘을 수 있다.
- 대상: 아동 276(79.08%), 유아 114(32.66%), 성인 71(20.34%), 가족 4, 노년 4, 청소년 1이다. 복수 대상 허용이다.
- 활동: 읽기 135, 공예 97, 미술 77, 디지털 34, 글쓰기 32, 공동체 26, 실험 21, 공연 14, 토론 9, 운동 1, UNKNOWN 68이다.

정확한 수치와 percentage는 `docs/analysis/data/program-case-*-distribution.json` 6개 파일이 기준이다. percentage 분모는 ProgramCase 349이며 소수 둘째 자리 반올림이다. category는 key 오름차순으로 결정적 정렬한다.

## 결측과 파일럿 선정 영향

Session 관계가 있는 사례가 5건뿐이라 회차 추정은 가장 큰 결측이다. Attachment 보완은 검색 가능한 정보를 늘리지만 편향 가능성이 있다. 30건은 UUID 하드코딩 없이 taxonomy·대상·회차·정보 의존성·UNKNOWN 포함 여부의 희소 범주를 우선 덮는 deterministic greedy 방식으로 선정한다. 제목만 명확한 사례, Session 의존 사례, Attachment 의존 사례를 모두 포함한다.
