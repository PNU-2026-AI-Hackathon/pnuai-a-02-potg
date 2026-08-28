# API 문서

이 폴더는 MOIRA의 HTTP API 계약과 내부 데이터 동기화 API를 설명합니다.

## 문서 안내

| 문서 | 상태 | 내용 |
| --- | --- | --- |
| [API_REFERENCE.md](./API_REFERENCE.md) | 현재 기준 | 프론트엔드 BFF와 Express API의 전체 경로 및 인증 방식 |
| [PROGRAM_CASE_SYNC_API.md](./PROGRAM_CASE_SYNC_API.md) | 현재 기준 | 크롤링 결과를 `ProgramCase` 계열 테이블에 동기화하는 내부 API |
| [ATTACHMENT_EXTRACTION_STORAGE.md](./ATTACHMENT_EXTRACTION_STORAGE.md) | 현재 기준 | 첨부파일 추출 결과 저장 및 재동기화 정책 |

API가 변경되면 코드와 함께 이 폴더의 현재 기준 문서를 갱신합니다. 요청·응답의 최종 기준은 `apps/backend/src/routes`, `apps/backend/src/controllers`와 `apps/frontend/src/app/api`입니다.
