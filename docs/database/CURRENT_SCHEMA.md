# 현재 데이터베이스 구조

MOIRA는 AWS RDS PostgreSQL을 사용하며, KURE-v1의 1024차원 벡터는 pgvector에 저장합니다.

## 도메인별 모델

| 도메인 | 모델 | 역할 |
| --- | --- | --- |
| 사용자 | `User`, `Interest`, `UserInterest` | 계정, 권한, 프로필, 관심 분야 |
| 커뮤니티 | `CommunityPost`, `CommunityComment`, `CommunityPostLike`, `CommunityPostSave` | 게시글·댓글·반응 |
| 수집 사례 | `ProgramCase`, `ProgramCaseSession`, `ProgramCaseAttachment` | 원문, 회차, 첨부파일 및 추출 결과 |
| 검색 문서 | `ProgramCaseDocument`, `ProgramCaseDocumentChunk`, `ProgramCaseDocumentChunkEmbedding` | 문서·청크·청크 임베딩 |
| Studio 검색 | `StudioProgramSearchProfile` | 프로그램 단위 검색 프로필과 1024차원 임베딩 |
| Studio | `StudioDocument`, `StudioDocumentVote` | 기획서, 구조화 결과, 수요조사 |
| 서비스 프로그램 | `ProgramBoardEntry`, `UserFavoriteProgram` | 게시판용 정제 결과와 관심 프로그램 |

## 사례 데이터의 두 표현

- `ProgramCase*`는 크롤링 원문과 첨부파일 처리 이력을 보존하는 정규화된 수집 계층입니다.
- `ProgramBoardEntry`는 화면에 빠르게 제공할 정제 결과를 JSON payload 중심으로 저장합니다.
- `StudioProgramSearchProfile`은 MOIRA Studio 유사 사례 검색을 위한 프로그램 단위 검색 계층입니다. 원본 수집 생명주기와 분리하여 검색 프로필을 안정적으로 유지합니다.

## pgvector 저장

| 모델 | 벡터 단위 | 용도 |
| --- | --- | --- |
| `ProgramCaseDocumentChunkEmbedding` | 문서 청크, `vector(1024)` | 문서·첨부파일 단위 검색 실험 및 분석 |
| `StudioProgramSearchProfile` | 프로그램 1건, `vector(1024)` | 현재 Studio 유사 사례 검색 |

두 벡터에는 provider, 모델 ID, 모델 revision, embedding version과 dimension을 함께 저장하여 서로 다른 임베딩을 섞지 않습니다.

## 삭제 및 무결성 원칙

- 사용자 종속 데이터와 프로그램 하위 데이터는 관계에 따라 cascade 또는 set-null 정책을 사용합니다.
- 외부 프로그램은 source 식별자와 URL을 기준으로 중복을 방지합니다.
- 첨부파일은 URL 기준으로 동기화하며, 원본에서 사라지면 즉시 삭제하는 대신 `isActive`로 상태를 보존합니다.
- Studio 투표는 문서와 voter key 조합을 유일하게 유지합니다.

## 프로그램 사례 동기화

- `ProgramCase`는 `(sourceType, sourcePostId)`로 Upsert하여 같은 공고를 중복 생성하지 않습니다.
- 회차는 `(programCaseId, sessionNumber)`, 첨부파일은 `(programCaseId, fileUrl)`을 고유 키로 사용합니다.
- 동일 URL의 첨부파일을 다시 수집하면 추출 결과와 ID는 유지하고 원본 메타데이터만 갱신합니다.
- 원본에서 사라진 첨부파일은 삭제하지 않고 `isActive=false`로 전환하며, 다시 나타나면 같은 행을 활성화합니다.
- 프로그램 한 건과 하위 회차·첨부파일 동기화는 하나의 transaction으로 처리합니다.

첨부파일의 `extractionStatus`는 `PENDING → PROCESSING → COMPLETED` 또는 `FAILED`로 관리하며, checksum, 추출기 종류·버전, 실패 정보와 시도 횟수를 함께 보존합니다.

## 스키마 적용

`apps/backend/prisma/migrations/`가 migration 적용 순서의 기준입니다. 기존 migration 파일은 이미 적용된 환경의 checksum을 보호하기 위해 수정하지 않고, 스키마 변경은 새 migration으로 추가합니다.
