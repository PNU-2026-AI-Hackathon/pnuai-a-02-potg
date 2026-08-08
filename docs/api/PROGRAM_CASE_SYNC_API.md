# 프로그램 사례 저장 API

## 목적과 범위

#67의 금정구 프로그램 크롤링 DTO를 #71의 `ProgramCase`, `ProgramCaseSession`, `ProgramCaseAttachment` 테이블에 저장한다. 이 API는 내부 서버 간 동기화용이며 n8n HTTP Request 노드 연결과 첨부파일 본문 추출은 별도 작업이다.

## 엔드포인트와 인증

```http
POST /api/internal/program-cases/sync
Content-Type: application/json
X-Internal-Api-Key: <INTERNAL_API_KEY>
```

서버 환경변수 `INTERNAL_API_KEY`와 헤더 값이 일치해야 한다. 키가 없거나 다르면 DB 작업 전에 `401`, 서버에 키가 설정되지 않았으면 `503`을 반환한다. 실제 키는 `.env` 등 배포 환경에서 관리하며 코드·문서·로그에 기록하지 않는다.

## 요청 형식

n8n 연결 편의를 위해 다음 두 형식을 모두 허용한다.

```json
{ "programs": [{ "sourceType": "GEUMJEONG_SMALL_LIBRARY", "sourcePostId": "4354" }] }
```

```json
[{ "sourceType": "GEUMJEONG_SMALL_LIBRARY", "sourcePostId": "4354" }]
```

프로그램 배열은 비어 있을 수 없다. 검증 오류는 DB 작업 전에 `400`으로 반환하며 `issues[].path`에 `programs[0].title`과 같은 위치를 포함한다.

### 프로그램 필드

필수 필드는 `sourceType`, `sourcePostId`, `sourceUrl`, `title`, `targetAudience`, `instructor`, `capacity`, `currentApplicants`, `applicationStatus`, `educationStartDate`, `educationEndDate`, `notices`, `rawText`, `hasUnparsedAttachments`, `crawledAt`, `requestSucceeded`, `parseWarnings`, `sessions`, `attachments`다.

- `capacity`, `currentApplicants`: 0 이상의 정수
- `educationStartDate`, `educationEndDate`: `YYYY-MM-DD` 형식의 실제 달력 날짜
- `crawledAt`: 유효한 ISO 날짜·시각
- `sourceUrl`: 절대 HTTP(S) URL
- `parseWarnings`: 문자열 배열이며 빈 배열 허용
- `sessions`, `attachments`: 배열이며 빈 배열 허용
- `location`, `feeText`, `preparationText`, `contactText`: 문자열 또는 `null`

nullable 필드는 최신 DTO가 `null`이면 DB도 `null`로 갱신한다. 기존 값을 유지하지 않는다. 날짜 파싱 실패를 현재 날짜로 대체하거나 잘못된 숫자를 0으로 변환하지 않는다.

### 회차 필드

```json
{
  "sessionNumber": 1,
  "dateText": "2026-07-31",
  "activity": "교육 내용"
}
```

회차 번호는 0 이상의 정수이고 프로그램 내부에서 유일해야 한다. 배열 순서를 `sortOrder`로 저장하며 `dateText`는 원문과 파싱된 `sessionDate`로 함께 저장한다.

### 첨부파일 필드

```json
{
  "fileName": "강의계획서.pdf",
  "fileUrl": "https://example.com/files/plan.pdf",
  "fileType": "pdf",
  "extractionStatus": "PENDING"
}
```

`fileUrl`은 프로그램 내부에서 유일해야 한다. `extractionStatus`가 생략되면 `PENDING`을 사용한다.

## 저장 및 동기화 정책

프로그램은 `(sourceType, sourcePostId)` 복합 unique를 기준으로 Upsert한다. 신규 여부를 같은 프로그램 트랜잭션 안에서 확인하므로 응답의 `created`, `updated`를 구분할 수 있다. `createdAt`은 최초 값을 유지하고 `updatedAt`은 Prisma `@updatedAt`, `crawledAt`은 최신 DTO 값을 사용한다.

각 프로그램은 독립된 Prisma 트랜잭션으로 순차 처리한다.

```text
프로그램 Upsert
→ 기존 회차 전체 삭제
→ 최신 회차 전체 생성
→ 기존 첨부파일 메타데이터 전체 삭제
→ 최신 첨부파일 메타데이터 전체 생성
```

자식 배열이 비어 있으면 기존 자식만 삭제한다. 중간 단계가 실패하면 해당 프로그램 전체가 롤백되며 다음 프로그램 처리는 계속된다. 349건 전체를 하나의 트랜잭션 또는 제한 없는 동시 요청으로 처리하지 않는다.

첨부파일 전체 교체는 본문 추출 전 초기 적재 단계용이다. 향후 추출 결과를 같은 레코드에 저장하면 전체 삭제 대신 `fileUrl` 기반 갱신과 제거 대상 비교 방식으로 바꿔야 한다.

## 응답

모두 성공하면 `200`, 일부만 실패하면 `207 Multi-Status`를 반환한다.

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

실패 항목에는 `sourceType`, `sourcePostId`, 안전하게 요약한 `message`만 포함한다. SQL, 연결 문자열, API 키와 오류 스택은 응답하지 않는다.

## 로컬 실행과 테스트

```powershell
cd apps/backend
npm.cmd run test:program-case-sync
npm.cmd run build
npm.cmd run dev
```

별도 PowerShell에서 실제 값으로 설정한 내부 키를 헤더에 넣어 호출한다. 저장소의 전체 JSON은 이미 최상위 배열이므로 그대로 요청 본문으로 사용할 수 있다. JSON 원본과 실제 키는 커밋하지 않는다.

## 2026-07-20 검증 결과

- 검증 파일: `automation/n8n/data/geumjeong-programs-349.json`
- 프로그램 DTO 349건, 회차 20건, 첨부파일 237건
- 인증 누락·잘못된 키: `401`
- 잘못된 요청: `400`, 필드 위치 포함
- 대표 샘플 5건 신규 저장 및 재실행 성공
- 자식 저장 실패 시 프로그램 트랜잭션 전체 롤백 확인
- 한 프로그램 실패 후 다음 프로그램 계속 처리 및 `207` 응답 확인
- 첫 전체 실행: 생성 349, 갱신 0, 실패 0
- 두 번째 전체 실행: 생성 0, 갱신 349, 실패 0
- 상태·신청 인원·안내·회차·첨부 배열 임시 변경 후 원본 전체 DTO로 복원 성공
- 최종 DB: 프로그램 349, 회차 20, 첨부파일 237
- 프로그램·회차·첨부파일 중복 각각 0건
- 실제 크롤링 원본 JSON은 커밋하지 않음

## 후속 n8n 연동

n8n HTTP Request 노드는 위 URL에 `POST`하고 `Content-Type: application/json`, `X-Internal-Api-Key` 헤더를 설정해야 한다. 키는 n8n Credential이나 환경변수에서 참조하고 워크플로우 JSON에 평문으로 넣지 않는다. 요청 본문은 최종 프로그램 배열 또는 `{ "programs": 배열 }`을 사용하며 수집 실행 요약 JSON은 전송하지 않는다.
