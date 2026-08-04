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

## 10개 질의 결과

평가 질의 10개에서 규칙 기반 taxonomy 관련 순위 기준으로 개선 5, 동등 3, 판단 불가 2, 악화 0이었다. Chunk Top 5 총 50개 중 ATTACHMENT chunk가 30개였다. 정확한 Top 5와 유사도는 `program-case-search-profile-evaluation.json`에 있으며 본문·연락처는 없다.

이 평가는 후보군 크기가 다르고 정답 label이 아닌 결정적 taxonomy 규칙을 사용한 약한 평가다. 따라서 개선 신호는 있지만 통계적 우월성으로 해석하면 안 된다. 판단 불가 사례와 Attachment 보완 128건은 수동 relevance 판정이 필요하다.

## 결론

**규칙 보완 후 확대 권장**으로 판단한다. 대표 문서 방식은 파일럿 내 관련 taxonomy 순위를 개선했고 Attachment 편향을 직접 노출하지 않는 장점이 있다. 반면 전체 데이터의 Session 결측, Attachment 기반 과분류 위험, 30건 후보군 차이, 수동 정답 부재가 남는다. 다음 이슈는 30건 relevance label 수동 검토, 연령 수치 규칙, Attachment section 제한, 349건 offline embedding 비용 측정 순으로 진행하고 그 전에는 정식 DB schema를 도입하지 않는 것이 안전하다.
