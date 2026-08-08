# feat(ai-data): 프로그램 사례 저장 API 및 PostgreSQL Upsert 구현

## 관련 이슈

- 상위 이슈: #56
- 선행 이슈: #57, #67, #71

> PR 생성 시 현재 작업 이슈 번호에 맞춰 `Closes #이슈번호`를 추가해주세요.

## 작업 배경

#67에서 생성한 금정구 프로그램 크롤링 JSON을 #71에서 추가한 Prisma 모델에 저장할 수 있도록 내부 Express API와 PostgreSQL Upsert 로직을 구현했습니다.

```text
크롤링 JSON
→ 내부 Express API
→ 요청 검증
→ 프로그램 단위 Prisma 트랜잭션
→ ProgramCase Upsert
→ 회차 및 첨부파일 동기화
→ PostgreSQL 저장
```

이번 PR은 저장 API와 DB 동기화까지 포함합니다. n8n HTTP Request 노드 연결과 첨부파일 본문 추출은 포함하지 않습니다.

## 주요 변경 사항

### 1. 프로그램 사례 요청 타입 및 검증

실제 크롤링 DTO 349건을 기준으로 타입과 검증 로직을 추가했습니다.

- 최상위 배열과 `{ "programs": [...] }` 형식 모두 지원
- 필수 문자열, 숫자, boolean, URL 검증
- `YYYY-MM-DD` 날짜의 형식과 실제 달력 날짜 검증
- ISO 크롤링 시각 검증
- nullable 문자열 처리
- `parseWarnings`, `sessions`, `attachments` 배열 검증
- 동일 요청의 프로그램 복합키 중복 검증
- 프로그램 내부 회차 번호 중복 검증
- 프로그램 내부 첨부파일 URL 중복 검증
- 검증 오류에 `programs[0].title` 형태의 필드 위치 포함

잘못된 날짜를 현재 날짜로 대체하거나 숫자로 변환할 수 없는 값을 0으로 저장하지 않습니다.

### 2. 프로그램 Upsert 및 자식 데이터 동기화

프로그램은 다음 복합 unique를 기준으로 Upsert합니다.

```text
sourceType + sourcePostId
```

- 신규 프로그램과 기존 프로그램 갱신 건수 구분
- `createdAt` 최초 값 유지
- `updatedAt`은 Prisma `@updatedAt` 사용
- `crawledAt`은 최신 DTO 값 반영
- 최신 DTO가 `null`이면 DB도 `null`로 갱신

회차와 첨부파일은 초기 적재 단계에 맞춰 다음 방식으로 동기화합니다.

```text
기존 자식 데이터 전체 삭제
→ 최신 배열 전체 생성
```

- 빈 배열 요청 시 기존 자식 데이터 제거
- 회차 배열 순서를 `sortOrder`로 저장
- 첨부파일 `extractionStatus` 생략 시 `PENDING` 사용

### 3. 프로그램 단위 트랜잭션과 일부 실패 처리

각 프로그램은 독립된 Prisma 트랜잭션으로 순차 처리합니다.

```text
ProgramCase Upsert
→ 기존 회차 삭제 및 최신 회차 저장
→ 기존 첨부파일 삭제 및 최신 첨부파일 저장
```

중간 단계가 실패하면 해당 프로그램 변경만 전체 롤백됩니다. 한 프로그램이 실패해도 다음 프로그램 처리는 계속되며 349건 전체를 하나의 트랜잭션이나 제한 없는 `Promise.all`로 처리하지 않습니다.

### 4. 내부 API 인증 및 Route 연결

실제 API 경로는 다음과 같습니다.

```http
POST /api/internal/program-cases/sync
X-Internal-Api-Key: <INTERNAL_API_KEY>
Content-Type: application/json
```

- 환경변수 `INTERNAL_API_KEY` 사용
- 실제 키 하드코딩 및 로그 출력 금지
- 키 누락 또는 불일치 시 DB 작업 전 `401`
- 서버에 키가 설정되지 않았으면 `503`
- 전체 크롤링 JSON 수신을 위해 JSON 요청 한도 10MB 적용

### 5. 처리 결과 응답 및 로깅

모두 성공하면 HTTP `200`, 일부만 실패하면 `207 Multi-Status`를 반환합니다.

```json
{
  "total": 349,
  "succeeded": 349,
  "failed": 0,
  "created": 349,
  "updated": 0,
  "sessions": 20,
  "attachments": 237,
  "failures": [],
  "durationMs": 32739
}
```

로그에는 전체·성공·실패·생성·갱신·회차·첨부 건수, 실패 게시글 ID 및 처리 시간만 기록합니다. API 키, DB 연결 문자열, 요청 원문과 오류 스택은 응답에 노출하지 않습니다.

## 실제 DB 검증 결과

검증 파일:

```text
automation/n8n/data/geumjeong-programs-349.json
```

### 샘플 및 오류 검증

- 인증 헤더 누락: `401`
- 잘못된 API 키: `401`
- 잘못된 요청 DTO: `400`
- 대표 샘플 5건 신규 저장 성공
- 동일 샘플 재실행 시 갱신 처리 성공
- 일부 실패 후 다음 프로그램 처리 계속 및 `207` 응답 확인
- 자식 저장 실패 시 해당 프로그램 전체 롤백 확인

### 첫 번째 전체 저장

```text
전체: 349
성공: 349
실패: 0
신규 생성: 349
기존 갱신: 0
회차: 20
첨부파일: 237
```

### 두 번째 전체 저장

```text
전체: 349
성공: 349
실패: 0
신규 생성: 0
기존 갱신: 349
회차: 20
첨부파일: 237
```

### 수정 및 원복 검증

- 대표 프로그램의 접수 상태 변경 확인
- 신청 인원 변경 확인
- 안내 사항 변경 확인
- 회차를 빈 배열로 변경했을 때 기존 회차 제거 확인
- 첨부파일을 빈 배열로 변경했을 때 기존 첨부 제거 확인
- 원본 DTO 349건 재실행으로 정상 상태 복원

### 최종 DB 상태

```text
ProgramCase: 349
ProgramCaseSession: 20
ProgramCaseAttachment: 237
프로그램 복합키 중복: 0
회차 복합키 중복: 0
첨부파일 복합키 중복: 0
```

## 자동화 및 빌드 검증

다음 명령을 모두 통과했습니다.

```bash
npx prisma validate
npx prisma migrate status
npx prisma generate
npm run test:program-case-sync
npm run build
```

- Prisma 스키마 검증 성공
- DB migration 최신 상태 확인
- Prisma Client 7.8.0 생성 성공
- 요청 검증 및 내부 인증 자동 테스트 성공
- TypeScript 빌드 성공

## 변경 파일

- `apps/backend/.env.example`
- `apps/backend/package.json`
- `apps/backend/scripts/test-program-case-sync.js`
- `apps/backend/src/controllers/programCaseSyncController.ts`
- `apps/backend/src/index.ts`
- `apps/backend/src/middleware/internalApiKey.ts`
- `apps/backend/src/routes/internalProgramCases.ts`
- `apps/backend/src/services/programCaseSyncService.ts`
- `apps/backend/src/types/programCase.ts`
- `apps/backend/src/validators/programCaseSync.ts`
- `docs/api/PROGRAM_CASE_SYNC_API.md`

## 리뷰 참고 사항

- 최신 DTO의 nullable 값은 기존 DB 값을 유지하지 않고 그대로 `null`로 갱신합니다.
- 순차 처리는 349건 동기화 시 약 33초가 소요됐지만 DB 부하와 안정성을 우선한 결정입니다.
- 일부 실패 응답은 요청 자체가 유효하고 개별 저장 결과가 혼합된 경우이므로 `207`을 사용합니다.
- 자식 전체 교체는 첨부파일 본문 추출 전 초기 적재 단계용입니다. 추출 결과를 저장하기 시작하면 URL 기반 갱신 전략으로 변경해야 합니다.
- 전체 크롤링 JSON과 실제 내부 API 키는 커밋하지 않았습니다.
- 기존 Prisma 모델과 migration은 변경하거나 새로 생성하지 않았습니다.

## 제외 범위

- n8n HTTP Request 노드 및 Credential 설정
- n8n 워크플로우 수정
- 첨부파일 다운로드
- HWP·PDF 본문 추출 및 이미지 OCR
- 검색용 통합 텍스트와 임베딩 생성
- pgvector·RAG 연동
- 프론트엔드 및 관리자 화면
- 기존 인증·게시판·관심분야 기능 변경

## 후속 n8n 연동

n8n에서는 다음 설정이 필요합니다.

- Method: `POST`
- URL: `/api/internal/program-cases/sync`
- Header: `Content-Type: application/json`
- Header: `X-Internal-Api-Key: <Credential 또는 환경변수 참조>`
- Body: 최종 프로그램 배열 또는 `{ "programs": 프로그램 배열 }`

실행 요약 JSON은 프로그램 데이터로 전송하지 않으며, 내부 API 키를 워크플로우 JSON에 평문으로 저장하지 않습니다.

## 체크리스트

- [x] 실제 DTO 349건 구조 분석
- [x] 요청 타입 및 검증 구현
- [x] 프로그램 Upsert 구현
- [x] 회차·첨부파일 동기화 구현
- [x] 프로그램 단위 트랜잭션 적용
- [x] 일부 실패 계속 처리
- [x] 내부 API 키 인증 적용
- [x] Route 및 Controller 연결
- [x] 자동 검증 코드 추가
- [x] 샘플 저장 및 재실행 검증
- [x] 전체 349건 저장 및 재실행 검증
- [x] 수정 후 원본 복원 검증
- [x] 최종 중복 0건 확인
- [x] API 문서 작성
- [ ] n8n HTTP Request 노드 연결 — 후속 작업
