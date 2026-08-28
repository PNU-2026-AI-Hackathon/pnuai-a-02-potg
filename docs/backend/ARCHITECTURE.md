# 백엔드 구조

## 실행 구성

```text
Next.js BFF
  └─ HTTPS/REST
      └─ Express + TypeScript (AWS EC2, PM2)
          ├─ Prisma ORM ── PostgreSQL
          └─ child process ── Python/KURE-v1 ── pgvector
```

- Express는 서비스 REST API와 내부 운영 API를 제공합니다.
- PM2가 EC2의 Node.js 프로세스를 관리합니다.
- Prisma가 일반 서비스 데이터의 조회·변경을 담당합니다.
- 의미 검색은 Node.js가 저장소의 Python 가상환경 인터프리터를 실행하여 KURE-v1 임베딩과 pgvector 검색을 수행합니다.

## 코드 계층

| 위치 | 책임 |
| --- | --- |
| `src/routes` | URL과 HTTP method 연결 |
| `src/controllers` | 요청 검증, 인증 Context, 응답 변환 |
| `src/services` | 도메인 로직, Prisma 및 검색 모듈 호출 |
| `src/middleware` | JWT 인증과 공통 오류 처리 |
| `src/lib` | Prisma·환경 설정 등 공통 기반 |
| `python/program_case_semantic_search` | KURE-v1 로딩, DB 연결, 검색 공통 모듈 |
| `python/program_board_pgvector_search.py` | Studio용 후보 조회·재정렬·Context 생성 |
| `prisma` | 현재 스키마, migration, seed |

## MOIRA Studio 생성 흐름

1. Next.js가 사서 입력 조건과 주민 아이디어로 검색어를 구성합니다.
2. Express의 `/api/program-case/studio-context`가 Python 검색 모듈을 실행합니다.
3. pgvector 후보를 대상 조건과 상대 유사도 기준으로 재정렬하고 상위 5개를 선택합니다.
4. 검색 결과를 Markdown Context로 반환합니다.
5. Next.js 서버가 입력 조건·주민 의견·유사 사례 Context를 Gemini에 전달합니다.
6. 생성된 기획안을 `StudioDocument`로 저장하고 이후 항목별 수정과 수요조사를 지원합니다.

검색 실패 시 참고 사례 없는 기획안을 조용히 생성하지 않고 요청을 실패시켜, 기획안이 사례 기반이라는 제품 계약을 지킵니다.

## 운영 시 필수 조건

- Node.js 의존성과 Python `.venv` 의존성을 모두 설치해야 합니다.
- `DATABASE_URL`은 PostgreSQL/pgvector에 연결되어야 하며 RDS에서는 지원되는 `sslmode`를 사용합니다.
- KURE-v1 모델 캐시를 위한 저장 공간과 최초 로딩 시간을 고려합니다.
- 배포 시 Prisma migration을 먼저 적용하고 PM2 환경변수를 갱신합니다.
- Gemini, JWT, 내부 동기화 키와 DB 접속 정보는 `.env` 또는 배포 환경에만 저장합니다.

