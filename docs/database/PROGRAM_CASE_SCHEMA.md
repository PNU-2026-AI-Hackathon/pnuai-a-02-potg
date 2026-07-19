# 프로그램 사례 데이터베이스 스키마

## 목적과 범위

이 문서는 #67에서 생성한 금정구 프로그램 크롤링 결과를 #71에서 PostgreSQL에 저장하기 위한 Prisma 스키마 결정을 기록한다. 이번 작업은 `ProgramCase`, `ProgramCaseSession`, `ProgramCaseAttachment` 모델과 마이그레이션까지만 포함한다. JSON 적재, Upsert 서비스, Express API, n8n 연동 및 첨부파일 본문 추출은 후속 작업 범위다.

## 분석 자료

- `automation/n8n/data/geumjeong-programs-349.json`: 최종 공통 DTO 349건. DB 모델의 직접 근거다.
- `automation/n8n/data/geumjeong-crawl-summary-349.json`: 수집·검증 요약. 349건 전부 상세 요청에 성공했고 ID/URL 중복은 없으며, 237건에 첨부파일 관련 경고가 있다. 실행 통계이므로 `ProgramCase`에는 저장하지 않는다.

최종 DTO는 프로그램 349건, 회차 20건, 첨부파일 237건이다. 모든 프로그램에 `sourceType`, `sourcePostId`, `sourceUrl`, `title`, 날짜 문자열, `sessions`, `attachments`, `parseWarnings`가 존재한다. 프로그램 344건은 회차가 비어 있고 112건은 첨부파일이 비어 있다. 프로그램 내부 회차 번호 중복과 `(sourceType, sourcePostId)` 중복은 발견되지 않았다.

## 모델 관계

- `ProgramCase` 1:N `ProgramCaseSession`
- `ProgramCase` 1:N `ProgramCaseAttachment`
- 부모 삭제 시 회차와 첨부 메타데이터도 `Cascade`로 삭제한다.

## DTO와 Prisma 필드 대응

| JSON 필드 | Prisma 필드 | 타입 | nullable | 근거 |
| --- | --- | --- | --- | --- |
| sourceType | sourceType | String | 아니요 | 원천별 게시물 ID 충돌 방지 |
| sourcePostId | sourcePostId | String | 아니요 | 숫자 연산 대상이 아닌 외부 식별자 |
| sourceUrl | sourceUrl | String | 아니요 | 349건 모두 존재 |
| title | title | String | 아니요 | 349건 모두 존재 |
| targetAudience | targetAudience | String | 아니요 | 349건 모두 존재 |
| instructor | instructor | String | 아니요 | 349건 모두 존재 |
| capacity | capacity | Int | 아니요 | 전 건 정수 |
| currentApplicants | currentApplicants | Int | 아니요 | 전 건 정수 |
| applicationStatus | applicationStatus | String | 아니요 | 값이 `접수중`, `대기중`, `접수마감`이나 외부 값 확장을 허용 |
| educationStartDate | educationStartDate | DateTime | 아니요 | 전 건 ISO 날짜로 파싱 가능 |
| educationEndDate | educationEndDate | DateTime | 아니요 | 전 건 ISO 날짜로 파싱 가능 |
| - | educationStartDateText | String | 아니요 | 원문 날짜를 손실 없이 보존 |
| - | educationEndDateText | String | 아니요 | 원문 날짜를 손실 없이 보존 |
| location | location | String | 예 | 273건 null |
| feeText | feeText | String | 예 | 275건 null |
| preparationText | preparationText | String | 예 | 271건 null |
| contactText | contactText | String | 예 | 241건 null |
| notices | notices | String (`@db.Text`) | 아니요 | 긴 안내 원문 |
| rawText | rawText | String (`@db.Text`) | 아니요 | 긴 크롤링 원문 |
| hasUnparsedAttachments | hasUnparsedAttachments | Boolean | 아니요 | 전 건 boolean |
| crawledAt | crawledAt | DateTime | 아니요 | 전 건 ISO 시각 |
| requestSucceeded | requestSucceeded | Boolean | 아니요 | 후속 재수집 판단에 필요한 DTO 값 |
| parseWarnings | parseWarnings | Json | 아니요 | 문자열 배열을 원형 보존 |
| sessions[] | sessions | relation | 아니요 | 빈 배열 허용 |
| attachments[] | attachments | relation | 아니요 | 빈 배열 허용 |

`educationStartDateText`와 `educationEndDateText`는 DTO에 별도 키가 없지만 날짜 파싱 실패나 향후 형식 변화를 추적하기 위해 DTO의 날짜 문자열을 함께 보존한다. 현재 349건은 모두 ISO 날짜라 `DateTime`도 필수로 둔다. `parseWarnings`는 구조 변경 가능성을 고려해 `Json`으로 저장하며 실행 요약 전체는 저장하지 않는다.

### 회차

| JSON 필드 | Prisma 필드 | 타입 | nullable | 근거 |
| --- | --- | --- | --- | --- |
| sessionNumber | sessionNumber | Int | 아니요 | 20건 모두 정수이며 프로그램 내부에서 유일 |
| dateText | sessionDate | DateTime | 예 | 현재 값은 날짜지만 후속 원천에서 파싱 실패 가능 |
| dateText | dateText | String | 아니요 | 날짜 원문 보존 |
| activity | activity | String (`@db.Text`) | 아니요 | 긴 활동 설명 |
| 배열 순서 | sortOrder | Int | 아니요 | Upsert 시 안정적인 표시 순서 |

현재 데이터에서 회차 번호가 모두 존재하고 프로그램 내부 중복이 없으므로 `(programCaseId, sessionNumber)`를 unique로 둔다. 후속 원천에서 이 조건이 깨지면 부모 Upsert 뒤 회차 전체 교체 방식을 사용해야 한다.

### 첨부파일

`fileName`, `fileUrl`, `fileType`, `extractionStatus`는 237건 모두 문자열이다. 동일 프로그램의 같은 URL을 중복 저장하지 않도록 `(programCaseId, fileUrl)`을 unique로 둔다. URL은 현재 모두 절대 URL이다. 추출 상태는 외부 처리 단계가 확장될 수 있어 enum 대신 String으로 둔다.

## 키와 인덱스

- 모든 내부 ID는 기존 `User`, `CommunityPost`와 동일하게 `uuid()` 문자열을 사용한다.
- `(sourceType, sourcePostId)` unique가 프로그램 Upsert의 자연키다. 별도 `sourceType` 단일 인덱스는 이 복합 인덱스의 선두 열과 중복되므로 만들지 않는다.
- 조회 필터를 위해 `applicationStatus`, `educationStartDate`, `educationEndDate`에 인덱스를 둔다.
- 자식 테이블 unique의 선두 열이 `programCaseId`이므로 별도 중복 인덱스를 만들지 않는다.

## 후속 Upsert 주의사항

프로그램은 `(sourceType, sourcePostId)`로 Upsert한다. 날짜 원문을 먼저 보존한 뒤 날짜 변환에 성공한 값만 `DateTime`에 넣는 정책을 유지해야 한다. 회차는 현재 `(programCaseId, sessionNumber)`, 첨부는 `(programCaseId, fileUrl)`로 식별할 수 있다. 원천에서 사라진 자식 레코드까지 동기화하려면 트랜잭션 안에서 기존 자식 목록과 비교하거나 자식을 전체 교체해야 한다. 크롤링 실행 통계와 검증 경고를 프로그램 필드로 혼합하지 않는다.

## 적용 및 확인 상태

- 생성 마이그레이션: `20260719233000_add_program_case_models`
- DB 적용 확인일: 2026-07-20
- 적용 대상: `mo***` PostgreSQL의 `public` 스키마. `User`, `Interest`, `UserInterest`, `CommunityPost`가 존재해 현재 프로젝트 DB로 판단했다.
- 개발 DB 적용: 미적용. DB에는 로컬에 없는 `20260719090000_create_board_post` 마이그레이션 이력과 `BoardPost` 테이블이 있어 로컬 migration history와 일치하지 않는다. 이력 충돌 상태에서 `prisma migrate deploy`를 실행하지 않았다.
- 신규 테이블 검증: `ProgramCase`, `ProgramCaseSession`, `ProgramCaseAttachment`가 아직 존재하지 않으므로 외래키, Cascade, unique, index 및 PostgreSQL 타입의 실제 DB 검증도 수행하지 않았다.
- Prisma Studio 확인: 미실행. 마이그레이션이 적용된 안전한 DB를 확인한 뒤 수행해야 한다.
- 대체 검증: `prisma migrate status`와 PostgreSQL `information_schema`, `_prisma_migrations`를 읽기 전용으로 조회했다.
- 정적 확인: `prisma validate`, `prisma generate`, TypeScript 빌드 성공
- 데이터 적재: 실제 크롤링 JSON은 DB에 삽입하지 않았다.
