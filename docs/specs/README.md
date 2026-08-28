# 기술 명세

이 폴더는 프로그램 사례 수집·정제·검색 산출물이 반드시 지켜야 하는 형식과 판정 규칙을 모읍니다. `analysis`가 실행 결과를 기록한다면, 이 폴더는 구현이 따라야 할 계약을 정의합니다.

| 문서 | 계약 대상 |
| --- | --- |
| [PROGRAM_CASE_CANONICAL_SOURCE.md](./PROGRAM_CASE_CANONICAL_SOURCE.md) | 대표 원문과 source snapshot |
| [PROGRAM_CASE_ATTACHMENT_REPRESENTATION.md](./PROGRAM_CASE_ATTACHMENT_REPRESENTATION.md) | PDF·이미지·HWP 첨부 표현 |
| [PROGRAM_CASE_GROUPING.md](./PROGRAM_CASE_GROUPING.md) | 동일 프로그램 그룹화 |
| [PROGRAM_CASE_SEARCH_CORPUS.md](./PROGRAM_CASE_SEARCH_CORPUS.md) | 검색 corpus 문서 구성 |
| [PROGRAM_CASE_SEARCH_RETRIEVAL.md](./PROGRAM_CASE_SEARCH_RETRIEVAL.md) | 검색 후보와 결과 계약 |
| [PROGRAM_CASE_SEARCH_EVALUATION.md](./PROGRAM_CASE_SEARCH_EVALUATION.md) | 검색 품질 평가 계약 |
| [MOIRA_STUDIO_RETRIEVAL.md](./MOIRA_STUDIO_RETRIEVAL.md) | 현재 Studio pgvector 검색과 Gemini Context 계약 |

명세와 코드가 충돌하면 현재 Prisma schema, migration 및 실행 코드를 먼저 확인하고 명세를 함께 갱신합니다. 기존 `PROGRAM_CASE_SEARCH_*` 문서는 문서·청크 기반 파이프라인의 계약이며, 운영 Studio의 프로그램 단위 검색은 `MOIRA_STUDIO_RETRIEVAL.md`가 기준입니다.

