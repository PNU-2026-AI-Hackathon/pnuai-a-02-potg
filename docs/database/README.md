# 데이터베이스 문서

이 폴더는 PostgreSQL·pgvector에 저장되는 현재 데이터 구조와 주요 스키마 설계 기록을 설명합니다.

| 문서 | 상태 | 내용 |
| --- | --- | --- |
| [CURRENT_SCHEMA.md](./CURRENT_SCHEMA.md) | 현재 기준 | 서비스 전체 모델, 관계, 벡터 저장 구조 |

실제 스키마의 최종 기준은 `apps/backend/prisma/schema.prisma`와 `apps/backend/prisma/migrations`입니다. 운영 DB 변경은 Prisma migration으로 관리하며 README의 예시 값을 운영 비밀정보로 사용하지 않습니다.
