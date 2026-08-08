# ProgramCase 검색 그룹 계약

## 목적과 입력

`ProgramCase`는 공식 게시·접수 단위로 유지하고 DB를 수정하지 않는다. 검색 계층에는 `ProgramGroup`을 추가한다. 입력은 source snapshot `program-cases.jsonl`과 structure-preserving representation의 candidate 및 shared-binary relationship이다.

입력 hash:

- Source snapshot: `16c7135e1620dd07c9be3b57bcbb60865a34dec2ef19c55438f839f0e73a2e9c`
- Representation: `c5337769c4d2a498ee54045752552fb9a10bf5750d9d11322bbd20b508e86b6d`

## 그룹화 규칙

원본 제목은 보존한다. 비교용 제목에서 기관 접두어, 날짜, 시간, 차수 표현만 분리한 `baseTitle`을 생성한다. 같은 source type이고 정규화된 base title이 정확히 같을 때만 그룹 후보가 된다. `MULTI_PROGRAM_SHARED_DOCUMENT`, `EVENT_OVERVIEW_WITH_ACTIVITY_SLOTS`, `SAME_PROGRAM_DIFFERENT_TARGET`, `POSSIBLE_FALSE_ATTACHMENT_LINK`, `UNRESOLVED` 관계는 자동 병합하지 않는다.

대상 표현이 다르면 같은 family 안의 `variantCandidates`로 기록한다. 근거가 약하거나 충돌하면 단독 그룹과 `UNRESOLVED`를 유지한다.

대표 사례는 core 필드 완전성, Session 수, 안전 section 존재 여부 순으로 점수화하고 동점이면 ProgramCase ID 오름차순으로 선택한다. Group ID와 content hash는 정렬된 입력에 대한 SHA-256으로 결정된다.

Builder version은 `program-case-grouping-v1`이다.
