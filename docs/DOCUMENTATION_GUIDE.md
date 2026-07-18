# 프로젝트 문서 체계 및 참조 규칙

## 1. 목적

이 저장소의 문서는 다음 사용자가 동일한 프로젝트 기준을 참고할 수 있도록 구성한다.

- 프로젝트 개발자
- 기획자와 팀원
- GitHub 기여자
- VS Code Codex
- 웹 ChatGPT
- 기타 AI 코딩 에이전트

문서는 크게 다음 세 가지 정보를 구분하여 관리한다.

1. 현재 프로젝트의 목표와 개발 범위
2. 실제 구현 구조와 진행 상태
3. 제출 당시 작성된 원본 개발계획

원본 개발계획과 현재 구현 내용이 다를 수 있으므로, 각 문서의 역할과 사실 우선순위를 명확하게 구분한다.

---

## 2. 전체 문서 구조

```text
프로젝트 루트
├─ README.md
├─ AGENTS.md
├─ CONTRIBUTING.md
│
├─ .ai/
│  ├─ PROJECT.md
│  ├─ CURRENT_SCOPE.md
│  ├─ ROADMAP.md
│  ├─ ARCHITECTURE.md
│  ├─ IMPLEMENTATION_STATUS.md
│  └─ DECISIONS.md
│
├─ docs/
│  ├─ DEVELOPMENT_PLAN.md
│  ├─ 수정개발계획서_융합트랙_POTG.pdf
│  └─ 수정개발계획서_융합트랙_POTG.hwp
│
└─ .github/
   ├─ ISSUE_TEMPLATE/
   │  ├─ 기능 개발용 템플릿
   │  └─ 버그 수정용 템플릿
   └─ PULL_REQUEST_TEMPLATE.md
```

---

## 3. 문서별 역할

| 문서 | 주요 대상 | 핵심 질문 |
|---|---|---|
| `README.md` | 외부 방문자·팀원 | 모이라는 어떤 프로젝트인가? |
| `AGENTS.md` | ChatGPT·Codex·AI 에이전트 | AI는 이 저장소에서 어떤 문서를 읽고 어떻게 작업해야 하는가? |
| `.ai/PROJECT.md` | AI·개발자 | 모이라는 어떤 사용자 문제를 해결하려는가? |
| `.ai/CURRENT_SCOPE.md` | AI·개발자 | 현재 MVP에서 무엇을 개발하고 무엇을 제외하는가? |
| `.ai/ROADMAP.md` | 팀·AI | 지금까지 무엇을 완료했고 다음에는 무엇을 진행하는가? |
| `.ai/ARCHITECTURE.md` | 개발자·AI | 현재 시스템과 배포 구조는 어떻게 구성되어 있는가? |
| `.ai/IMPLEMENTATION_STATUS.md` | 개발자·AI | 실제 코드는 어디까지 구현되어 있는가? |
| `.ai/DECISIONS.md` | 팀·AI | 어떤 결정을 왜 내렸으며 프로젝트에 어떤 영향을 주는가? |
| `docs/DEVELOPMENT_PLAN.md` | 팀·AI·심사자 | 프로젝트는 원래 어떤 목표와 설계로 계획되었는가? |
| `CONTRIBUTING.md` | 기여자 | 브랜치·커밋·Issue·PR을 어떻게 관리하는가? |
| `.github/*` | GitHub 기여자 | Issue와 PR을 어떤 형식으로 작성하는가? |
| 원본 PDF/HWP | 팀·심사자 | 제출 당시의 원본 개발계획 자료는 무엇인가? |

---

## 4. 문서 계층

### 4.1 외부 프로젝트 소개

```text
README.md
```

프로젝트를 처음 접하는 사용자를 위한 소개 문서다.

다음 내용을 간단하게 제공한다.

- 프로젝트 배경
- 핵심 기능
- 현재 기술 스택
- 실행 방법
- 주요 프로젝트 문서 링크

README는 상세한 구현 상태나 의사결정 기록을 모두 포함하지 않는다.

---

### 4.2 AI 작업 규칙

```text
AGENTS.md
```

AI 코딩 에이전트가 저장소에서 작업할 때 따라야 하는 규칙을 정의한다.

다음 내용을 포함한다.

- 작업 전 읽어야 할 문서
- 문서 참조 순서
- 사실 우선순위
- 코드와 문서 수정 원칙
- 보안 및 민감정보 처리 원칙
- Issue와 PR 작성 기준

---

### 4.3 현재 프로젝트 기준

```text
.ai/
├─ PROJECT.md
├─ CURRENT_SCOPE.md
├─ ROADMAP.md
├─ ARCHITECTURE.md
├─ IMPLEMENTATION_STATUS.md
└─ DECISIONS.md
```

`.ai` 디렉터리의 문서는 현재 프로젝트 상태를 설명하는 핵심 기준 문서다.

원본 개발계획과 현재 구현이 다를 경우 `.ai` 문서를 우선한다.

---

### 4.4 원본 기획 자료

```text
docs/
├─ DEVELOPMENT_PLAN.md
├─ 수정개발계획서_융합트랙_POTG.pdf
└─ 수정개발계획서_융합트랙_POTG.hwp
```

`DEVELOPMENT_PLAN.md`는 제출 당시 개발계획을 Markdown으로 재구성한 문서다.

다음 내용을 보존한다.

- 프로젝트 배경
- 초기 기능 요구사항
- AI 기술 개발 계획
- RAG 설계
- pgvector 활용 계획
- LangChain.js 활용 계획
- 데이터 수집과 전처리 계획
- 개발 일정
- 기대효과
- 팀 구성

이 문서는 현재 구현 상태를 나타내는 문서가 아니다.

현재 구현 여부는 다음 문서를 우선하여 확인한다.

- `.ai/CURRENT_SCOPE.md`
- `.ai/IMPLEMENTATION_STATUS.md`
- `.ai/ARCHITECTURE.md`
- `.ai/DECISIONS.md`

---

### 4.5 협업 규칙

```text
CONTRIBUTING.md
.github/
```

GitHub에서 작업할 때 사용하는 협업 규칙과 템플릿을 관리한다.

다음 내용을 포함한다.

- 브랜치 이름 규칙
- 커밋 메시지 규칙
- Issue 작성 방법
- Pull Request 작성 방법
- 코드 리뷰와 테스트 기준

---

## 5. AI 권장 참조 순서

AI 코딩 에이전트는 일반적인 개발 작업을 시작하기 전에 다음 순서로 문서를 확인한다.

```text
AGENTS.md
→ .ai/PROJECT.md
→ .ai/CURRENT_SCOPE.md
→ .ai/DECISIONS.md
→ .ai/ARCHITECTURE.md
→ .ai/IMPLEMENTATION_STATUS.md
→ .ai/ROADMAP.md
```

`docs/DEVELOPMENT_PLAN.md`는 모든 작업에서 의무적으로 읽지 않는다.

다음과 같은 경우에 추가로 참조한다.

- 새로운 기능의 원래 기획 의도를 확인할 때
- 현재 문서만으로 기능의 배경을 이해하기 어려울 때
- AI 기능을 설계할 때
- 데이터 수집 및 전처리 파이프라인을 설계할 때
- RAG, 벡터 검색, 프로그램 추천 구조를 검토할 때
- 원본 계획과 현재 결정의 차이를 확인할 때
- 심사 또는 발표 자료의 근거를 확인할 때

원본 PDF와 HWP는 `DEVELOPMENT_PLAN.md`에서 누락되거나 불명확한 내용을 확인해야 할 때만 참조한다.

---

## 6. 사실 우선순위

문서와 실제 구현 내용이 서로 충돌하면 다음 순서를 따른다.

```text
실제 코드와 설정
→ 최근 팀 결정과 .ai/DECISIONS.md
→ .ai/CURRENT_SCOPE.md
→ .ai/IMPLEMENTATION_STATUS.md
→ .ai/ARCHITECTURE.md
→ .ai/ROADMAP.md
→ .ai/PROJECT.md
→ README.md
→ docs/DEVELOPMENT_PLAN.md
→ 원본 PDF/HWP
```

### 우선순위 적용 예시

`DEVELOPMENT_PLAN.md`에 백엔드가 NestJS로 작성되어 있더라도 실제 코드가 Express로 구현되어 있다면 Express를 현재 기술 스택으로 판단한다.

`DEVELOPMENT_PLAN.md`에 대학생 봉사자 매칭 기능이 포함되어 있더라도 `CURRENT_SCOPE.md`에서 제외되었다면 현재 MVP 범위에 포함하지 않는다.

`DEVELOPMENT_PLAN.md`에 pgvector, LangChain.js, RAG가 작성되어 있더라도 실제 코드와 `IMPLEMENTATION_STATUS.md`에 구현 기록이 없다면 현재 구현 완료 기술로 간주하지 않는다.

---

## 7. 현재 프로젝트에서 적용되는 주요 기준

현재 프로젝트는 다음 내용을 기준으로 한다.

- 프론트엔드는 Next.js App Router, React, TypeScript를 사용한다.
- 백엔드는 현재 Express와 TypeScript를 사용한다.
- 데이터베이스는 AWS RDS PostgreSQL을 사용한다.
- ORM은 Prisma를 사용한다.
- 프론트엔드는 Vercel에 배포한다.
- 백엔드는 AWS EC2에 배포한다.
- 브라우저는 EC2 백엔드를 직접 호출하지 않는다.
- 프론트엔드의 Next.js API Route를 통해 백엔드 API를 호출한다.
- 대학생 봉사자 매칭 기능은 현재 MVP 범위에서 제외한다.
- 지역 커뮤니티는 작은도서관 행사 및 소식, 자유게시판, 지역 제안 게시판으로 구성한다.
- AI 프로그램 기획 지원 기능의 명칭은 `모이라 스튜디오`를 사용한다.
- pgvector, LangChain.js, RAG는 원본 계획 또는 향후 구현 후보이며 현재 구현 완료 기술로 간주하지 않는다.

기준이 변경되면 관련 내용을 `.ai/DECISIONS.md`에 기록하고 다른 문서를 함께 갱신한다.

---

## 8. 문서 유지보수 원칙

### 8.1 중복 최소화

동일한 내용을 여러 문서에 상세하게 반복하지 않는다.

각 문서는 자신이 담당하는 질문에 집중한다.

예를 들어 현재 구현 상태는 `IMPLEMENTATION_STATUS.md`에서 관리하고, README에는 간단한 상태와 링크만 제공한다.

---

### 8.2 변경 시 함께 확인할 문서

기능 범위가 변경된 경우 다음 문서를 확인한다.

- `CURRENT_SCOPE.md`
- `ROADMAP.md`
- `DECISIONS.md`

기술 스택 또는 시스템 구조가 변경된 경우 다음 문서를 확인한다.

- `ARCHITECTURE.md`
- `IMPLEMENTATION_STATUS.md`
- `DECISIONS.md`
- `README.md`

새로운 기능 구현이 완료된 경우 다음 문서를 확인한다.

- `IMPLEMENTATION_STATUS.md`
- `ROADMAP.md`

원본 기획 자체를 정정하는 것이 아니라면 `DEVELOPMENT_PLAN.md`의 원래 내용을 현재 구현에 맞춰 덮어쓰지 않는다.

---

### 8.3 원본 계획과 현재 상태의 분리

`DEVELOPMENT_PLAN.md`는 원래 개발계획을 보존한다.

현재와 다른 내용은 삭제하거나 현재 구현에 맞게 바꾸지 않고 다음과 같은 주석으로 차이를 표시한다.

> **현재 구현 참고**
>
> 본 내용은 원본 개발계획 기준이다. 현재 구현 상태는 `.ai/CURRENT_SCOPE.md`, `.ai/IMPLEMENTATION_STATUS.md`, `.ai/ARCHITECTURE.md`를 우선한다.

---

### 8.4 민감정보 금지

프로젝트 문서에는 다음 정보를 기록하지 않는다.

- 실제 환경변수 값
- 데이터베이스 비밀번호
- JWT 비밀키
- AWS 액세스 키
- 개인 인증서
- 내부 IP 또는 접근 토큰
- 개인정보
- 외부에 공개하면 안 되는 계정 정보

환경변수 이름은 작성할 수 있지만 실제 값은 작성하지 않는다.

예시:

```env
DATABASE_URL=<configured-in-environment>
JWT_SECRET=<configured-in-environment>
BACKEND_URL=<configured-in-environment>
```

---

## 9. 핵심 원칙

이 저장소에서 현재 구현을 판단할 때 `DEVELOPMENT_PLAN.md`와 원본 PDF/HWP만을 근거로 사용하지 않는다.

원본 개발계획은 기획 의도와 장기적인 방향을 이해하기 위한 자료이며, 현재 개발 범위와 구현 상태는 `.ai` 문서와 실제 코드를 기준으로 판단한다.