# 모이라: 모두가 이어지는 라이브러리

> 지역 주민과 작은도서관을 연결하고, 주민 제안을 지역 프로그램 기획으로 이어가는 AI 기반 지역 프로그램 기획 플랫폼입니다.

## 프로젝트 소개

모이라는 금정구 작은도서관을 중심으로 지역 주민이 생활 속 문제와 프로그램 아이디어를 제안하고, 사서와 관리자가 이를 바탕으로 지역 프로그램을 기획할 수 있도록 돕는 서비스입니다.

AI 프로그램 기획 기능의 공식 명칭은 **모이라 스튜디오**입니다. 현재 저장소에는 모이라 스튜디오, AI 의제 분석, pgvector, LangChain.js, RAG가 구현되어 있지 않으며 향후 개발 대상입니다.

대학생 봉사자 모집 및 매칭 기능은 현재 MVP 범위에서 제외되었습니다. 관련 API와 mock 데이터 일부는 과거 계획의 잔여 코드로 남아 있습니다.

## 현재 기술 스택

### Frontend

- Next.js 16 App Router
- React 19
- TypeScript
- 전역 CSS
- 배포: Vercel

### Backend

- Express 4
- TypeScript
- Prisma ORM 7
- PostgreSQL
- `bcryptjs`, JSON Web Token
- 배포: AWS EC2

### Database

- AWS RDS PostgreSQL
- 현재 Prisma 모델: `User`, `Interest`, `UserInterest`

## 운영 구조

팀이 확인한 현재 운영 통신 구조는 다음과 같습니다.

```text
사용자 브라우저
  → Vercel의 Next.js 서버 계층 및 API Route
  → BACKEND_URL
  → AWS EC2의 Express Backend
  → DATABASE_URL
  → AWS RDS PostgreSQL
```

메인 페이지의 서버 컴포넌트도 `BACKEND_URL`을 통해 Express를 호출합니다. 브라우저가 Express 백엔드를 직접 호출하는 구조로 표현하지 않습니다.

저장소에는 Vercel, EC2, RDS 배포를 재현하는 설정 파일이나 배포 자동화가 포함되어 있지 않습니다. GitHub Actions 기반 배포 자동화도 현재 없습니다.

## 현재 구현 개요

| 영역 | 현재 상태 |
|---|---|
| 회원가입 | Prisma 저장, 비밀번호 해싱, 관심분야 저장까지 코드 경로 구현됨 |
| 로그인 | Express JWT 발급 및 Next.js HTTP-only 쿠키 연동 코드 경로 구현됨 |
| 관심분야 | 목록·사용자 관심분야 조회 및 저장 코드 경로 구현됨 |
| `/community/*` | 최종 게시판 기준 구조이며 현재 정적 데이터 기반 UI 골격 |
| `/board`, `/api/posts` | 초기 연동 실험 또는 레거시 구현, 메모리 데이터 사용 |
| 도서관·공지·프로그램·검색 | Express mock 데이터 기반 조회 |
| 모이라 스튜디오 | 미구현 |
| AI 의제 분석 | 미구현 |
| 대학생 봉사자 모집·매칭 | MVP 제외, 잔여 mock 코드 존재 |

빌드, lint, 실제 DB 연결 및 API 동작 검증 여부를 포함한 상세 상태는 [구현 상태 문서](.ai/IMPLEMENTATION_STATUS.md)에서 관리합니다.

## 게시판 기준

향후 게시판 개발과 통합의 기준은 다음 `/community/*` 구조입니다.

- `/community/library-news`: 작은도서관 행사 및 소식
- `/community/free`: 자유게시판
- `/community/proposals`: 지역 제안 게시판

기존 `/board`와 `/api/posts`는 삭제하지 않고 레거시 구현으로 유지합니다. 통합 또는 제거는 별도 이슈에서 결정합니다.

## 디렉터리 구조

```text
.
├─ .github/                 # Issue 및 PR 템플릿
├─ .ai/                     # 프로젝트 기준 및 AI 개발 문서
├─ apps/
│  ├─ frontend/             # Next.js App Router
│  └─ backend/              # Express Backend 및 Prisma
├─ docs/                    # 원본 개발계획 자료
├─ packages/types/          # 현재 비어 있는 공유 타입 경로
├─ AGENTS.md
└─ README.md
```

## 로컬 실행

### Backend

```bash
cd apps/backend
npm install
npm run dev
```

기본 포트는 `4000`입니다.

### Frontend

```bash
cd apps/frontend
npm install
npm run dev
```

기본 접속 주소는 `http://localhost:3000`입니다.

## 환경변수

민감한 값과 실제 운영 주소는 저장소 문서나 Git에 기록하지 않습니다.

| 영역 | 변수 | 설명 |
|---|---|---|
| Frontend | `BACKEND_URL` | Next.js 서버 계층이 호출할 Express 백엔드 주소 |
| Backend | `DATABASE_URL` | PostgreSQL 연결 문자열 |
| Backend | `JWT_SECRET` | JWT 서명 및 검증 비밀값 |
| Backend | `PORT` | Express 서버 포트, 미설정 시 `4000` |
| Backend | `DATABASE_SSL_REJECT_UNAUTHORIZED` | 인증서 검증 정책 제어 |

백엔드 실행 디렉터리에 `global-bundle.pem`이 존재하면 Prisma 런타임과 seed 스크립트가 해당 CA 인증서를 사용합니다. 인증서 파일은 Git에 포함하지 않습니다.

## 프로젝트 문서

프로젝트의 상세 기획과 AI 개발 기준은 다음 문서를 참고합니다.

- [AGENTS.md](AGENTS.md)
- [.ai/PROJECT.md](.ai/PROJECT.md)
- [.ai/CURRENT_SCOPE.md](.ai/CURRENT_SCOPE.md)
- [.ai/ARCHITECTURE.md](.ai/ARCHITECTURE.md)
- [.ai/IMPLEMENTATION_STATUS.md](.ai/IMPLEMENTATION_STATUS.md)
- [.ai/DECISIONS.md](.ai/DECISIONS.md)

README는 프로젝트의 진입 문서 역할을 하며, 상세 범위와 개발 규칙은 위 문서에서 관리합니다.

## 협업

- 기능 작업은 명시된 GitHub Issue 범위 내에서 진행합니다.
- Pull Request에는 작업 범위와 검증 결과를 기록합니다.
- Issue 및 PR 템플릿 개선, `npm run check`, GitHub Actions, AI 자동화는 별도 PR에서 다룹니다.

## 팀 소개

### Team POTG

**POTG**는 **Programmers Of The Geumjeong**의 약자로, 금정구 작은도서관 문제 해결을 목표로 모인 팀입니다.

| 이름 | 역할 | 담당 업무 |
|---|---|---|
| 박현아 | 팀장 / 프론트엔드 / 백엔드 | 프로젝트 관리, 프론트엔드 및 백엔드 개발 |
| 권아영 | 기획 / 디자인 | 서비스 기획, 작은도서관 요구사항 분석, UI 기획 |
| 윤상현 | 프론트엔드 / 백엔드 | 프론트엔드 및 백엔드 개발, 기능 구현 |
| 양현서 | 기획 / UX/UI | 사용자 경험 설계, 화면 구성, 기획 보조 |
