# ProgramCase SearchProfile 파일럿 결과

## 목적과 구조

Issue #107은 운영 검색 교체가 아니라 ProgramCase별 결정적 대표 문서 하나가 Chunk P0보다 주제·대상·활동을 안정적으로 검색하는지 확인하는 파일럿이다. 운영 DB는 read-only, 벡터 30개는 Git ignored `.local` 파일, 공개 프로필·집계·평가는 `docs/analysis/data`에 분리했다. Prisma와 migration은 변경하지 않았다.

프로필 필드는 ID, 공개 프로그램명, 4개 taxonomy 축, 회차, 검색어, 대표 문서, source/document hash, profile/rule/template version, 근거 코드, validation, 선정 태그다. 대표 문서는 프로그램명→대상→주제→활동→운영→회차→검색어 순이며 최대 1,200자다.

## 30건 선정과 검증

30개 ID는 중복이 없고 모두 공개 프로그램명과 유효한 대표 문서를 가진다. 주제 분포는 독서·쓰기 13, 미술·공예 11, 문화 7, 디지털 7, 공동체 6, 건강 4, 환경·과학 4, 언어 3, UNKNOWN 4다. 대상은 아동 21, 유아 9, 성인 7, 가족 4, 노년 2, 청소년 1이며 복수 값이다. 정보 의존성은 제목·대상 14, Attachment 13, Session 3이고 단회차 26, 다회차 4다.

대표 문서 길이는 129~302자, document hash 고유값은 30/30이다. 연락처·이메일 패턴 검출은 0, 빈 문서 0, validation 실패 0이다.

## 임베딩과 검색 MVP

기존 `nlpai-lab/KURE-v1` 고정 revision과 L2 정규화, 1024차원 provider를 재사용했다. 30/30 생성, 빈 vector·NaN·Infinity·차원 불일치 0건이다. 파일은 `apps/backend/.local/program-case-search-profile-pilot.embeddings.json`이며 Git ignored다. 기존 888개 DB embedding은 변경하지 않았다.

CLI는 다음과 같다.

```powershell
cd apps/backend
npm.cmd run program-case-search-profile -- generate
$env:HF_HUB_OFFLINE='1'; $env:TRANSFORMERS_OFFLINE='1'
npm.cmd run program-case-search-profile -- embed
npm.cmd run program-case-search-profile -- search --query="초등학생 환경 실험 프로그램" --limit=5
npm.cmd run program-case-search-profile -- evaluate
```

비교 UI는 frontend `/semantic-search-test`, API는 backend `/api/program-case/search-profile-pilot?q=...`다. 화면과 응답은 Chunk P0 후보군 349개/888 chunks와 SearchProfile 후보군 30개를 명시한다.

## 규칙 일치 기반 진단

10개 질의에 대해 SearchProfile 생성과 유사한 taxonomy 규칙을 사용한 `weak rule-consistency diagnostic`을 수행했다. 이는 사람이 판정한 검색 관련성 평가가 아니며 실제 검색 품질을 측정하지 않는다. 생성과 진단에 유사한 규칙이 사용되어 순환성이 있고, Chunk 후보군은 349 ProgramCase/888 chunks인 반면 SearchProfile 후보군은 대표 30 ProgramCase로 서로 다르다.

다회차 조건은 Chunk 결과의 실제 Session 정보를 조회하지 않으므로 비교 기준에서 제외한다. `operationTypes` 또는 `sessionCount` 조건이 포함된 질의는 `INDETERMINATE`로 처리한다. 진단 결과의 `PROFILE_SIGNAL_AHEAD`, `SAME_SIGNAL_RANK`, `CHUNK_SIGNAL_AHEAD`는 taxonomy 신호의 위치만 나타내며 우수·동등·악화 판정이 아니다.

Chunk Top 5 총 50개 중 ATTACHMENT chunk가 30개였다는 값은 관찰된 chunk type 분포일 뿐 Attachment 편향 감소 또는 검색 품질 개선의 증거가 아니다. cosine similarity 절댓값만으로 결과의 적합성을 판단하지 않는다. 정확한 Top 5와 진단 결과는 `program-case-search-profile-evaluation.json`에 있으며 본문·연락처는 없다.

## 관찰된 실패 사례

- `성인 대상 디지털 교육`: 관련성이 높은 모바일·블로그 운영 교육과 함께 한자 프로그램이 거의 같은 점수로 높은 순위에 나타났다.
- `여러 회차로 진행되는 글쓰기 수업`: 영어 프로그램이 상위에 나타났다. 이 질의는 회차 조건을 공정하게 비교할 수 없어 자동 진단에서 판단 불가로 처리한다.
- `지역 주민이 참여하는 공동체 활동`: 수학·과학 보드게임 프로그램이 상위에 나타났다.
- `과학 체험과 만들기`: 그림책·미술·연극 계열 프로그램이 상위에 포함됐다.

이 사례들은 파이프라인 동작과 별개로 실제 의미적 적합성이 검증되지 않았음을 보여준다. 사람 relevance label 없이 자동 규칙만으로 우열을 결론 내릴 수 없다.

## 결론

이번 파일럿에서는 ProgramCase 349건의 read-only 분포 분석, 결정적 SearchProfile 생성, 대표 30건의 KURE-v1 임베딩, 파일 기반 검색 및 기존 Chunk 검색과의 비교 UI까지 기술적으로 구현 가능한 것을 확인했다.

다만 SearchProfile 후보군은 대표 30건이고 기존 Chunk 검색 후보군은 전체 349건이므로 검색 품질을 직접 비교하기 어렵다. 또한 현재 자동 진단은 독립적인 사람 relevance 판정이 아닌 taxonomy 규칙 일치 기반 진단이다.

따라서 이번 이슈의 결론은 **SearchProfile 검색 파이프라인의 기술적 실행 가능성 확인**으로 제한한다. 실제 검색 품질은 후속 이슈에서 349건의 동일한 후보군, lexical·dense·hybrid 기준선, pooling 및 사람 relevance 판정을 통해 별도로 검증한다.
