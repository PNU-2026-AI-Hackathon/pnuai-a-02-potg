# 아키텍처

## 저장소 구조

저장소는 루트 workspace 설정 없이 `apps/frontend`와 `apps/backend`가 각각 package.json과 lockfile을 갖는 디렉터리 기반 모노레포 형태다.

```text
.
├─ apps/
│  ├─ frontend/   # Next.js App Router
│  └─ backend/    # Express, Prisma
├─ packages/types # 현재 .gitkeep만 존재
├─ docs/          # 원본 개발계획 자료
├─ .github/       # Issue/PR 템플릿
├─ .ai/           # 프로젝트 기준 문서
└─ AGENTS.md
```

## 애플리케이션 구조

### Frontend

- Next.js 16 App Router, React 19, TypeScript
- `apps/frontend/src/app`: 페이지, 레이아웃, Route Handler
- `apps/frontend/src/components`: 인증 및 커뮤니티 UI
- `apps/frontend/src/lib`: 인증 설정, 서버 인증 조회, 정적 커뮤니티 데이터
- 스타일은 현재 `globals.css` 중심

### Next.js 서버 계층

브라우저 요청을 Express로 전달할 때 다음 API Route를 사용한다.

| Next.js 경로 | Express 경로 | 역할 |
|---|---|---|
| `/api/auth/register` | `/api/auth/register` | 회원가입 프록시 |
| `/api/auth/login` | `/api/auth/login` | 로그인 및 JWT의 HTTP-only 쿠키 저장 |
| `/api/auth/me` | `/api/auth/me` | 쿠키의 JWT를 Bearer 토큰으로 전달 |
| `/api/auth/logout` | - | 쿠키 삭제 |
| `/api/interests` | `/api/interests` | 관심분야 목록 프록시 |
| `/api/user-interests` | `/api/interests/me` | 로그인 사용자 관심분야 조회·저장 |
| `/api/posts` | `/api/posts` | 레거시 게시글 조회·작성 프록시 |

메인 페이지의 서버 컴포넌트는 `/api/summary`와 `/api/announcements`를 `BACKEND_URL`로 직접 호출한다. 이는 Next.js 서버에서 발생하는 요청이며 브라우저가 Express를 직접 호출하는 것이 아니다.

### Backend

- Express 4, TypeScript
- `src/index.ts`에서 라우터 등록과 서버 시작
- Prisma를 사용하는 라우트: 인증, 관심분야
- 메모리 또는 mock 데이터를 사용하는 라우트: 공지, 도서관, 프로그램, 게시글, 봉사, 지역 의제, 검색, summary

### Database

- PostgreSQL, Prisma ORM 7
- Prisma PostgreSQL adapter와 `pg.Pool` 사용
- 현재 모델: `User`, `Interest`, `UserInterest`
- `DATABASE_URL`은 `prisma.config.ts`와 런타임 연결 코드에서 사용
- 실행 디렉터리의 `global-bundle.pem`이 있으면 조건부 SSL CA 설정 적용
- 게시판, 프로그램, 댓글, 의제, 벡터 저장 모델은 현재 없음

## 인증 흐름

```text
브라우저 로그인 폼
  → Next.js /api/auth/login
  → Express /api/auth/login
  → Prisma 사용자 조회 및 bcrypt 검증
  → Express가 JWT 반환
  → Next.js가 HTTP-only 쿠키 저장
  → 이후 Next.js가 쿠키 토큰을 Bearer 토큰으로 Express에 전달
```

JWT 유효기간은 코드상 1시간이다. 운영 환경에서 쿠키는 `secure`가 설정되며 SameSite는 `lax`다.

## 운영 구조

다음은 팀이 확인한 현재 운영 구조다.

```text
사용자 브라우저
  → Vercel Next.js 서버 계층/API Route
  → BACKEND_URL
  → AWS EC2 Express Backend
  → DATABASE_URL
  → AWS RDS PostgreSQL
```

저장소에는 Vercel 설정, EC2 프로세스 관리, 리버스 프록시, RDS 프로비저닝, IaC 또는 배포 workflow가 없다. 따라서 저장소 파일만으로 운영 배포를 재현하거나 검증할 수 없다. GitHub Actions 기반 배포 자동화도 현재 없다.

## 환경변수 경계

문서에는 값이나 실제 운영 주소를 기록하지 않는다.

| 변수 | 소비 계층 |
|---|---|
| `BACKEND_URL` | Next.js 서버 컴포넌트, 서버 인증 유틸리티, API Route |
| `DATABASE_URL` | Prisma 설정, Backend 런타임, seed/검증 스크립트 |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | Backend 런타임, seed/검증 스크립트 |
| `JWT_SECRET` | Express 인증 및 관심분야 라우트 |
| `PORT` | Express 서버 |
| `NODE_ENV` | Next.js 로그인 Route의 쿠키 보안 옵션 |

## 현재 구조상 주의점

- 최종 게시판 기준 `/community/*`는 프론트 정적 데이터 기반이고 DB와 연결되지 않았다.
- 레거시 `/board`와 `/api/posts`는 별도 데이터 구조이며 서버 재시작 시 작성 데이터가 소실된다.
- `/api/interests/users/:userId` 경로에는 인증 및 권한 검사가 없다. 의도된 관리 API인지 별도 확인이 필요하다.
- Express CORS origin은 로컬 주소만 명시되어 있다. 현재 운영 통신은 Next.js 서버 계층을 기준으로 문서화한다.
- pgvector, LangChain.js, RAG, AI API 연동 구조는 현재 없다.
