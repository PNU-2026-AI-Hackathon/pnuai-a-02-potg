# MOIRA 프로젝트 문서

이 디렉터리는 MOIRA의 최종 제출 문서, 시스템 설계, API·DB 계약, AI 데이터 파이프라인과 개발 과정의 검증 기록을 모아 둔 문서 허브입니다.

## 제출 문서

| 문서 | 내용 |
| --- | --- |
| **[ai-usage.md](./ai-usage.md)** | **활용한 AI 도구, 활용 범위, AI 생성 코드의 검증·수정 방식** |
| [개발계획서 최종본 PDF](./개발계획서_최종_융합트랙_POTG.pdf) | 최종 개발계획서 열람용 |
| [개발계획서 최종본 HWP](./개발계획서_최종_융합트랙_POTG.hwp) | 최종 개발계획서 원본 |

> `ai-usage.md`는 해커톤 평가 제출 항목입니다. AI 도구를 어디에 사용했는지뿐 아니라 팀원이 결과를 어떻게 검증하고 수정했는지까지 기록합니다.

## 기술 문서

| 디렉터리 | 설명 |
| --- | --- |
| [api/](./api/README.md) | 서비스 API 경로, 인증과 내부 동기화 계약 |
| [backend/](./backend/README.md) | Express·Prisma·Python 검색 모듈의 실행 구조 |
| [database/](./database/README.md) | PostgreSQL 모델과 pgvector 저장 구조 |
| [ai-data/](./ai-data/README.md) | 프로그램 사례 수집·가공·검색과 Gemini 기획 과정 |
| [specs/](./specs/README.md) | 데이터 산출물과 검색이 따라야 하는 기술 명세 |
| [analysis/](./analysis/README.md) | 도구 비교, 실험, migration과 검색 품질 검증 기록 |

## 프로젝트 참고 자료

| 디렉터리 | 설명 |
| --- | --- |
| [design/](./design/DESIGN.md) | 프론트엔드 디자인 시스템과 주요 화면 구성 |
| [diagrams/](./diagrams/moira-system-architecture.png) | 루트 README에서 사용하는 전체 시스템 구성도 |
| [features/](./features/README.md) | 기능별 이슈·PR 구현 흐름 |
| `fixtures/` | 프로그램 수집·동기화 회귀 테스트에 사용하는 고정 데이터 |

## 문서 관리 원칙

- 현재 기능 계약은 `api/`, `backend/`, `database/`, `ai-data/`, `specs/`를 기준으로 확인합니다.
- 특정 시점의 수치와 실험 결과는 `analysis/`에 보존하며 현재 운영 상태와 구분합니다.
- 실제 스키마와 API 동작의 최종 기준은 각각 Prisma schema·migration과 실행 코드입니다.
- 인증 키, DB 접속 정보, 개인정보와 원문 비공개 데이터는 문서에 기록하지 않습니다.

