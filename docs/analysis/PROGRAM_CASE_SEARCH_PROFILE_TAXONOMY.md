# ProgramCase SearchProfile taxonomy v1

## 목적과 범위

Issue #107의 30건 파일럿 검색에 필요한 최소 축만 정의한다. 운영 schema나 Prisma enum이 아니라 파일 기반 규칙 계약이며, `program-case-search-taxonomy-v1`과 `program-case-search-profile-rule-v1`로 버전을 고정한다.

## 축과 값

- `topics`: `READING_WRITING`, `ART_CRAFT`, `DIGITAL`, `HEALTH`, `LANGUAGE`, `ENVIRONMENT_SCIENCE`, `CULTURE`, `COMMUNITY`, `OTHER`, `UNKNOWN`
- `targetAgeGroups`: `INFANT`, `CHILD`, `TEEN`, `ADULT`, `SENIOR`, `FAMILY`, `UNKNOWN`
- `activityTypes`: `READING`, `WRITING`, `ART`, `CRAFT`, `DIGITAL_PRACTICE`, `EXERCISE`, `EXPERIMENT`, `PERFORMANCE`, `DISCUSSION`, `COMMUNITY_ACTIVITY`, `UNKNOWN`
- `operationTypes`: `ONE_OFF`, `MULTI_SESSION`, `FAMILY_PARTICIPATION`, `GROUP`, `UNKNOWN`
- `sessionCount`: `COUNT(DISTINCT Session.id)`로 확인한 실제 Session row 수. 관계가 없으면 관찰값이 아닌 파일럿 fallback으로 1회 취급한다.

## 규칙

제목·대상을 먼저 분류하고, 분류되지 않은 축만 Session, Attachment 순으로 보완한다. 주제는 최대 3개, 대상은 최대 2개, 활동은 최대 3개다. 하나의 프로그램은 복수 값이 가능하다. 키워드 사전 순서가 충돌 우선순위이며 결과는 enum 순서로 고정한다. 근거가 없으면 `UNKNOWN` 하나만 기록한다.

예를 들어 `그림책`, `독서`, `글쓰기`는 `READING_WRITING`, `공예`, `만들기`는 `ART_CRAFT`, `환경`, `과학`, `실험`은 `ENVIRONMENT_SCIENCE` 근거다. 원문에 없는 목적·활동은 만들지 않는다. 근거에는 원문 대신 `RULE_<AXIS>_<VALUE>` 코드와 source field만 저장한다.

## 포함·제외와 한계

공개 프로그램명과 대상, 정제된 Session/Attachment 텍스트만 메모리에서 판정한다. 연락처·이메일·담당자·강사 정보와 신청·홍보 문구는 대표 문서에 넣지 않는다. 동형어와 복합 프로그램, 연령이 수치 범위로만 표현된 사례는 규칙의 한계다. 특히 Attachment로 보완한 128건은 문서 내 복수 프로그램 또는 안내 문구의 영향을 추가 검토해야 한다. 향후 LLM 보조는 UNKNOWN과 규칙 충돌 사례에만 구조화 출력·근거 코드 방식으로 제한하는 것이 적절하다.
