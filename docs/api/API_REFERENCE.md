# MOIRA API 구성

## 요청 경로

```text
브라우저
  └─ /api/* (Next.js Route Handler, 인증 쿠키·BFF)
       ├─ Express REST API (AWS EC2, 기본 포트 4000)
       └─ Google Gemini API (MOIRA Studio 생성·수정)

브라우저 ── Kakao Maps JavaScript SDK (지도·주소 검색)
```

프론트엔드는 HTTP-only 인증 쿠키를 처리하고 Express로 필요한 요청을 전달합니다. Gemini 키는 브라우저에 노출하지 않고 Next.js 서버 경로에서만 사용합니다.

## 주요 서비스 API

| 영역 | 대표 경로 | 기능 |
| --- | --- | --- |
| 상태 확인 | `GET /api/health`, `GET /api/health/db` | 서버 및 DB 연결 확인 |
| 인증 | `/api/auth/*` | 회원가입, 로그인, 현재 사용자 조회 |
| 관심 분야 | `/api/interests/*` | 관심 분야 목록 및 사용자 선택 저장 |
| 마이페이지 | `/api/me/*` | 프로필, 활동 내역 조회·수정 |
| 도서관 | `/api/libraries/*` | 도서관 목록 및 상세 조회 |
| 커뮤니티 | `/api/posts/*` | 게시글, 댓글, 좋아요, 저장 |
| 프로그램 | `/api/program-board/*` | 프로그램 목록, 상세, 검색 Context |
| 관심 프로그램 | `/api/program-favorites/*` | 관심 프로그램 등록·해제·조회 |
| MOIRA Studio | `/api/studio/documents/*`, `/api/studio/votes/*` | 기획서 저장·수정·삭제 및 수요조사 |
| 사례 검색 | `/api/program-case/studio-context` | pgvector 유사 사례 Top 5 및 Markdown Context 생성 |

## 내부·운영 API

| 경로 | 용도 |
| --- | --- |
| `POST /api/internal/program-cases/sync` | 수집한 프로그램 사례 동기화 |
| `/api/internal/program-case-search/*` | 검색 파이프라인 운영·검증 |
| `/api/internal/program-case-search-inspector/*` | 검색 결과 검사 도구 |

내부 경로는 일반 사용자용 API가 아니며 설정된 내부 인증 키와 운영 환경 제한을 전제로 합니다.

## 인증과 오류

- 로그인 상태는 JWT 기반 HTTP-only 쿠키로 전달합니다.
- 브라우저 요청은 가능한 한 Next.js BFF를 거칩니다.
- Studio 문서는 로그인 사용자와 익명 소유자를 모두 지원합니다.
- API 오류는 적절한 HTTP 상태 코드와 JSON 오류 메시지로 반환합니다.
- CORS는 설정된 배포 주소와 로컬 개발 주소만 허용하며 credential 요청을 사용합니다.

구체적인 필드 계약은 해당 route/controller 코드와 [백엔드 구조 문서](../backend/ARCHITECTURE.md)를 함께 확인합니다.

