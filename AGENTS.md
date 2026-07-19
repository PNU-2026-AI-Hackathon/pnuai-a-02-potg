# 모이라 AI 에이전트 작업 지침

이 문서는 웹 ChatGPT와 VS Code Codex를 포함한 AI 에이전트가 모이라 저장소에서 같은 프로젝트 기준을 사용하도록 안내한다.

## 문서 참조 순서

일반적인 개발 작업을 시작하기 전에 다음 순서로 문서를 확인한다.

1. `AGENTS.md`: 저장소 공통 작업 규칙
2. `.ai/PROJECT.md`: 프로젝트 목적과 핵심 사용자 흐름
3. `.ai/CURRENT_SCOPE.md`: 현재 MVP 범위와 개발 우선순위
4. `.ai/DECISIONS.md`: 확정된 결정과 그 이유·영향
5. `.ai/IMPLEMENTATION_STATUS.md`: 기능별 실제 구현 근거와 검증 상태
6. `.ai/ARCHITECTURE.md`: 현재 코드 및 운영 구조
7. `.ai/ROADMAP.md`: 프로젝트 일정, 진행 상황과 향후 개발 계획

README는 프로젝트 진입 문서다. 상세 범위가 충돌하면 위 문서와 실제 코드를 함께 확인한다.

프로젝트 문서의 전체 역할, 계층, 참조 순서 및 관리 원칙은 [`docs/DOCUMENTATION_GUIDE.md`](docs/DOCUMENTATION_GUIDE.md)를 참고한다. 다음 경우에 문서 가이드를 확인한다.

- 문서별 역할을 확인할 때
- 어떤 문서를 수정해야 하는지 판단할 때
- 문서 간 우선순위를 확인할 때
- 문서 유지보수 규칙을 확인할 때
- 원본 계획과 현재 프로젝트 기준의 차이를 이해할 때

`DEVELOPMENT_PLAN.md`는 원본 개발계획을 보존하는 문서다. 현재 구현 내용과 범위는 `.ai/CURRENT_SCOPE.md`와 `.ai/IMPLEMENTATION_STATUS.md`를 우선한다.

`docs/DEVELOPMENT_PLAN.md`는 모든 작업에서 의무적으로 읽지 않으며 다음 경우에 추가로 확인한다.

- 새로운 기능의 원래 기획 의도를 확인할 때
- AI 기능을 설계할 때
- 데이터 수집 및 전처리 파이프라인을 설계할 때
- 현재 문서에 충분한 기획 근거가 없을 때
- 원본 요구사항과 현재 결정의 차이를 확인할 때
- 발표 또는 심사 자료의 근거를 확인할 때

## 사실 우선순위

1. 현재 저장소의 실제 코드와 설정
2. 최근 팀 결정 및 `.ai/DECISIONS.md`
3. 현재 범위인 `.ai/CURRENT_SCOPE.md`
4. `.ai/IMPLEMENTATION_STATUS.md`
5. `.ai/ARCHITECTURE.md`
6. `.ai/ROADMAP.md`
7. `.ai/PROJECT.md`
8. README
9. `docs/DEVELOPMENT_PLAN.md`
10. `docs/`의 원본 PDF/HWP 개발계획서

코드와 문서가 충돌하면 추측으로 정리하지 말고 충돌을 보고한다. 확인하지 않은 기능을 구현 완료 또는 동작 검증 완료로 표현하지 않는다.

## 작업 범위 원칙

- 명시된 GitHub Issue 또는 사용자 요청 범위 안에서만 수정한다.
- 요청 범위에 포함되지 않은 파일을 임의로 수정하지 않는다.
- 새 의존성, 실행 스크립트, package.json 또는 workflow 변경이 필요하면 이유와 영향을 먼저 확인한다.
- 기존 기능 코드, 데이터, 배포 설정을 삭제하거나 통합할 때는 별도 승인과 이슈 범위를 확인한다.
- mock, UI 골격, 부분 구현, 실행 검증 완료를 서로 구분한다.
- 작업 후 변경 파일과 수행한 검증을 정확히 보고한다.

## 현재 핵심 기준

- Frontend: Next.js App Router, React, TypeScript
- Backend: Express, TypeScript
- Database: PostgreSQL, Prisma ORM
- 게시판 최종 기준: `/community/*`
- `/board`와 `/api/posts`: 초기 연동 실험 또는 레거시 구현
- AI 프로그램 기획 기능명: 모이라 스튜디오
- 대학생 봉사자 모집 및 매칭: 현재 MVP 제외
- pgvector, LangChain.js, RAG, AI API: 현재 구현으로 간주하지 않음

## 보안 및 개인정보

- 환경변수 값, 실제 서버 주소, 비밀번호, 토큰, 인증서 내용을 출력하거나 문서화하지 않는다.
- 전화번호, 생년월일, 학번, 개인 이메일 등 개인정보를 프로젝트 명세로 옮기지 않는다.
- 원본 PDF/HWP의 개인정보도 `.ai` 문서나 README에 복사하지 않는다.
- README의 공개된 팀원 이름과 프로젝트 역할은 유지할 수 있다.

## 문서 동기화

- MVP 범위나 우선순위가 바뀌면 `CURRENT_SCOPE.md`를 수정한다.
- 개발 단계와 향후 순서가 바뀌면 `ROADMAP.md`를 수정한다.
- 기능 상태가 바뀌면 `IMPLEMENTATION_STATUS.md`와 관련 Issue/PR을 갱신한다.
- 구조가 바뀌면 `ARCHITECTURE.md`를 수정한다.
- 장기적으로 영향을 주는 결정은 `DECISIONS.md`에 결정·이유·영향 형식으로 추가한다.
- 원본 기획 의도와 상세 요구사항을 확인하거나 보존할 때 `DEVELOPMENT_PLAN.md`를 참조한다.
- README에는 진입에 필요한 요약만 유지하고 상세 내용은 `.ai` 문서로 연결한다.
