# 마이페이지 계정·프로필 데이터 계약

## 1. 문서 목적

이 문서는 GitHub 이슈 #108의 결과물로, 현재 MOIRA 저장소의 사용자·관심 분야 데이터 모델과 인증 흐름을 검증하고 후속 `feat(mypage): 계정·프로필 조회·수정 API 및 마이페이지 연동` 이슈가 따라야 할 데이터 계약을 정의한다.

이번 이슈에서는 API, Next.js 프록시, 마이페이지 UI를 구현하지 않는다. 현재 모델로 후속 기능을 구현할 수 있으므로 Prisma schema와 migration도 변경하지 않는다.

## 2. 현재 데이터 모델

### 2.1 `User`

현재 `apps/backend/prisma/schema.prisma`의 모델은 다음과 같다.

| 필드 | Prisma 타입과 제약 | PostgreSQL 표현 | 현재 의미 |
| --- | --- | --- | --- |
| `id` | `String @id @default(uuid())` | `TEXT` PK | 내부 사용자 ID이자 JWT `sub`. UUID 값은 Prisma가 생성한다. |
| `userId` | `String? @unique` | nullable `TEXT`, unique index | 로그인 ID 성격의 회원 아이디. 회원가입 API에서는 필수다. |
| `name` | `String` | non-null `TEXT` | 현재 헤더와 마이페이지에서 사용하는 화면 표시 이름이다. |
| `email` | `String @unique` | non-null `TEXT`, unique index | 현재 로그인 식별자다. |
| `password` | `String` | non-null `TEXT` | bcrypt 해시다. |
| `accountType` | `AccountType @default(RESIDENT)` | enum, 기본값 `RESIDENT` | `RESIDENT`, `LIBRARIAN`, `ADMIN` 권한 구분이다. |
| `gender` | `Gender?` | nullable enum | `FEMALE`, `MALE`, `OTHER` 또는 `null`이다. |
| `birthDate` | `DateTime?` | nullable `TIMESTAMP(3)` | 달력 날짜를 UTC 자정 시각으로 저장한다. |
| `region` | `String?` | nullable `TEXT` | 현재 정규화되지 않은 지역 문자열이다. |
| `phone` | `String?` | nullable `TEXT` | 현재 정규화되지 않은 전화번호 문자열이다. |
| `interests` | `UserInterest[]` | relation | 사용자가 선택한 관심 분야다. |
| `createdAt` | `DateTime @default(now())` | non-null timestamp | 생성 시각이다. |
| `updatedAt` | `DateTime @updatedAt` | non-null timestamp | Prisma 갱신 시 업데이트되는 수정 시각이다. |

`@default(uuid())`는 PostgreSQL native UUID 컬럼이나 DB-side default를 의미하지 않는다. canonical baseline의 `User.id`는 `TEXT NOT NULL`이며 Prisma Client가 UUID 문자열을 생성한다.

회원가입은 `userId`를 필수로 검증하지만 DB는 기존 데이터 호환을 위해 nullable이다. 기존 행을 확인하지 않은 상태에서 `NOT NULL`로 변경하지 않는다.

### 2.2 `Interest`와 `UserInterest`

```text
User 1 ── N UserInterest N ── 1 Interest
```

- `Interest.id`: 애플리케이션이 관리하는 문자열 PK
- `Interest.name`: unique
- `UserInterest`: `(userId, interestId)` 복합 PK
- `UserInterest.userId` → `User.id`: `onDelete: Cascade`
- `UserInterest.interestId` → `Interest.id`: `onDelete: Cascade`
- `UserInterest.interestId`: 별도 index 존재
- `(userId, interestId)` 복합 PK는 사용자별 조회에서 선두 컬럼 `userId`를 사용할 수 있으므로 `userId` 단독 index를 추가하지 않는다.

## 3. 현재 인증 및 관심 분야 API

### 3.1 로그인과 현재 사용자

- `POST /api/auth/login`은 이메일과 비밀번호를 확인하고 1시간 JWT를 발급한다.
- JWT payload는 `sub`, `email`, `name`, `accountType`을 담는다.
- `sub`는 `User.userId`가 아니라 내부 PK인 `User.id`다.
- `authenticateJwt`는 서명을 검증한 뒤 `sub`로 DB 사용자를 다시 조회한다.
- `req.user`와 `GET /api/auth/me` 응답에는 `id`, `userId`, `name`, `email`, `accountType`만 포함된다.
- `password`, `gender`, `birthDate`, `region`, `phone`, 관심 분야는 `/api/auth/me`에 포함되지 않는다.

프론트의 `AuthUser` 타입에는 실제 `/api/auth/me` 응답에 있는 `userId`가 없다. 후속 이슈에서는 최소 인증 사용자 타입과 상세 프로필 타입을 분리하고 실제 응답과 일치시켜야 한다.

### 3.2 HTTP-only cookie와 Next.js 프록시

- Next.js `POST /api/auth/login`이 Express에서 받은 JWT를 `moira_session` HTTP-only cookie에 저장한다.
- 서버 컴포넌트의 `getCurrentUser()`는 cookie를 읽어 Express `/api/auth/me`를 직접 호출한다.
- 브라우저가 호출하는 Next.js `/api/auth/me`는 cookie를 Bearer token으로 변환해 Express에 전달한다.
- 백엔드가 `401`을 반환하면 인증 프록시는 cookie를 삭제한다.

상세 프로필도 브라우저가 JWT를 직접 읽지 않도록 같은 BFF 구조를 사용한다.

### 3.3 기존 관심 분야 API

| Express endpoint | 인증 | 역할 |
| --- | --- | --- |
| `GET /api/interests` | 불필요 | 전체 관심 분야 목록 |
| `GET /api/interests/me` | JWT 필수 | 본인이 선택한 관심 분야 조회 |
| `PUT /api/interests/me` | JWT 필수 | 본인의 관심 분야 전체 교체 |
| `POST /api/interests/me` | JWT 필수 | 현재 PUT과 동일한 호환 동작 |

`PUT /api/interests/me`는 body의 사용자 ID를 받지 않고 `req.user.id`를 사용한다. 입력 ID의 존재 여부를 검증하고 transaction에서 기존 join row를 삭제한 뒤 새 선택을 생성한다.

Next.js에는 전체 목록용 `/api/interests`와 본인 선택용 `/api/user-interests` 프록시가 이미 있다.

## 4. 마이페이지 MVP 데이터 범위

현재 `/mypage`에서 실제 API 데이터는 `getCurrentUser()`로 얻는 `name`뿐이다. 다음은 파일 내부 정적 목업이다.

- `부산광역시 금정구 주민` 지역 문구
- 교육, AI·디지털, 환경 관심 분야 태그
- 작성글, 댓글, 관심글, 좋아요 통계와 목록
- 주변 행사와 관심 분야 맞춤 행사

후속 계정·프로필 이슈에서 실제 데이터로 연결할 범위는 다음과 같다.

- 이름
- 지역
- 계정 유형을 표시하기로 한 경우 그 읽기 전용 라벨
- 선택한 관심 분야
- 프로필 조회·수정 폼

작성글, 댓글, 좋아요, 북마크, 활동 통계, 주변 행사, 맞춤 행사는 이번 이슈와 후속 계정·프로필 이슈의 범위가 아니다. 후속 UI에서는 이 목업을 실데이터로 오해하지 않도록 숨기거나 명확한 준비 중 상태로 처리한다.

## 5. `UserProfile`을 분리하지 않는 결정

별도 `UserProfile` 모델을 추가하지 않는다.

- MVP 조회·수정 대상 필드가 이미 `User`에 있다.
- 계정과 프로필의 생명주기 및 소유자가 같다.
- 공개 프로필, 닉네임, 자기소개, 프로필 이미지가 이번 범위에 없다.
- 1:1 relation을 추가하면 join, 프로필 생성 정합성, 누락 row 처리만 늘어난다.

향후 공개 프로필이 도입되고 공개 정보와 인증·개인정보의 접근 정책 및 생명주기가 달라질 때 분리를 다시 검토한다.

## 6. 프로필 조회 필드

후속 `GET /api/me/profile`은 명시적 Prisma `select`로 다음 필드만 조회한다.

```ts
type AccountType = 'RESIDENT' | 'LIBRARIAN' | 'ADMIN';
type Gender = 'FEMALE' | 'MALE' | 'OTHER';

type UserProfileResponse = {
  id: string;
  userId: string | null;
  name: string;
  email: string;
  accountType: AccountType;
  gender: Gender | null;
  birthDate: string | null; // YYYY-MM-DD
  region: string | null;
  phone: string | null;
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp
};
```

`password`와 관심 분야는 포함하지 않는다. 관심 분야는 기존 전용 API로 조회한다.

## 7. 프로필 수정 가능·읽기 전용 필드

### 수정 가능

- `name`
- `gender`
- `birthDate`
- `region`
- `phone`

### 읽기 전용

- `id`
- `userId`
- `email`
- `accountType`
- `createdAt`
- `updatedAt`

비밀번호와 관심 분야는 프로필 PATCH의 필드가 아니다. 읽기 전용 필드나 정의되지 않은 필드가 요청에 있으면 조용히 무시하지 않고 `400 INVALID_PROFILE_FIELD`를 반환한다.

## 8. 필드별 validation 및 null 정책

### 공통 PATCH 규칙

- 필드 누락: 기존 값 유지
- `undefined`: JSON 표현이 아니므로 별도 의미를 두지 않음
- 정의되지 않은 필드 또는 읽기 전용 필드 포함: `400`
- 변경 가능한 필드가 하나도 없음: `400 EMPTY_PROFILE_UPDATE`
- 모든 문자열은 validation 전에 앞뒤 공백을 제거

### `userId`

- 회원가입에서는 `/^[a-zA-Z0-9_-]{4,30}$/`와 필수 조건을 적용한다.
- DB는 nullable이므로 조회 응답도 `string | null`이다.
- 프로필에서는 읽기 전용이다.
- 기존 데이터 확인 없이 `NOT NULL`로 바꾸지 않는다.

### `name`

- 현재 코드에서는 실명 입력을 받지만 실제 화면에서는 표시 이름으로 사용한다.
- 이번 MVP에서는 별도 닉네임을 추가하지 않고 `name`을 본인 화면의 표시 이름으로 사용한다.
- trim 후 1~50자를 권장한다.
- 빈 문자열과 `null`은 허용하지 않고 `400 INVALID_NAME`을 반환한다.

### `birthDate`

- 입력 형식: 정확한 `YYYY-MM-DD`
- 달력상 존재하는 날짜여야 하며 미래 날짜는 허용하지 않는다.
- `null`: 값 제거
- 빈 문자열: 모호한 변환을 피하기 위해 `400 INVALID_BIRTH_DATE`
- 저장: 현재 회원가입과 동일하게 `${value}T00:00:00.000Z`를 사용해 UTC 자정 `Date`로 변환
- 응답: UTC 기준 `toISOString().slice(0, 10)`으로 `YYYY-MM-DD` 반환

### `phone`

- 선택 필드이며 `null`로 제거할 수 있다.
- 빈 문자열 또는 공백뿐인 문자열은 `null`로 정규화한다.
- 입력에서 하이픈과 공백을 제거한 뒤 숫자 8~15자리만 허용하는 것을 권장한다.
- 정규화된 숫자 문자열을 저장한다.
- 입력 원문을 로그나 오류 응답에 포함하지 않는다.

### `region`

- 현재처럼 자유 문자열로 유지하고 행정구역 코드화는 후속 범위로 둔다.
- trim 후 1~100자를 권장한다.
- `null` 또는 빈 문자열은 `null`로 정규화하여 값 제거로 처리한다.
- 제어 문자를 허용하지 않는다.

### `gender`

- 허용값: `FEMALE`, `MALE`, `OTHER`, `null`
- `null`: 선택 제거
- 빈 문자열과 소문자 별칭은 프로필 계약에서 허용하지 않고 `400 INVALID_GENDER`
- DB nullable 상태를 유지한다.

### `accountType`

- 읽기 전용이며 프로필 API로 변경할 수 없다.
- 공개 회원가입에서 `ADMIN`을 받을 수 있는 현재 문제는 별도 보안 이슈로 다루며 이번 이슈에서 수정하지 않는다.

## 9. 생년월일 직렬화 및 시간대 정책

`birthDate`는 시간이나 시간대가 없는 달력 날짜다. DB 모델은 `DateTime`이므로 다음 규칙으로 날짜 이동을 방지한다.

1. API 입력은 `YYYY-MM-DD`만 받는다.
2. 정규식 검사 후 UTC 자정 `YYYY-MM-DDT00:00:00.000Z`로 파싱한다.
3. 파싱한 값의 UTC ISO 날짜 부분이 입력과 같은지 확인한다.
4. DB에는 해당 UTC 자정 `Date`를 저장한다.
5. 응답은 서버 로컬 시간대가 아니라 UTC ISO 문자열의 앞 10자리로 직렬화한다.

`Intl.DateTimeFormat`이나 서버 로컬 시간대를 생년월일 API 직렬화에 사용하지 않는다.

## 10. 개인정보 및 캐시 정책

- 상세 프로필은 로그인한 본인에게만 제공한다.
- 사용자는 JWT `sub`로만 식별하고 URL, query, body의 사용자 ID를 신뢰하지 않는다.
- `password`와 password hash는 select 및 응답에 절대 포함하지 않는다.
- `email`, `birthDate`, `gender`, `phone`은 공개 프로필 정보로 사용하지 않는다.
- Express 및 Next.js 상세 프로필 응답에 `Cache-Control: no-store`를 설정한다.
- 요청 body, 전화번호 원문, 전체 `User` 객체를 로그에 남기지 않는다.
- Prisma 오류 전문, constraint 이름, 입력 개인정보를 클라이언트에 반환하지 않는다.
- Prisma 조회와 갱신은 허용 필드를 나열하는 명시적 `select` 및 `data` 객체를 사용한다.

## 11. 관심 분야 API 재사용 결정

관심 분야는 프로필 PATCH에 포함하지 않고 기존 API를 재사용한다.

```text
GET /api/interests
GET /api/interests/me
PUT /api/interests/me
```

`GET /api/me/interests`와 `PUT /api/me/interests`는 같은 책임의 중복 endpoint이므로 추가하지 않는다. 후속 프론트는 기존 Next.js `/api/interests`와 `/api/user-interests` 프록시를 사용한다.

기존 API는 본인 식별, 관심 분야 ID 검증, transaction 기반 전체 교체라는 MVP 요구를 충족한다. 빈 배열도 허용해 모든 관심 분야를 해제할 수 있는데, 마이페이지에서도 최소 1개를 강제할지는 제품 정책으로 확정해야 한다. 회원가입은 현재 최소 1개를 요구한다.

## 12. 후속 API 요청·응답 계약

### Endpoint

```text
GET /api/me/profile
PATCH /api/me/profile
```

두 endpoint 모두 `authenticateJwt`가 필요하다. Express에 `/api/me` router를 mount하고, Next.js에도 동일 경로의 BFF 프록시를 추가하는 방식을 권장한다. 기존 `/api/auth/me`는 헤더 및 세션 확인용 최소 identity 응답으로 유지한다.

### 수정 요청

```ts
type UpdateUserProfileRequest = {
  name?: string;
  gender?: Gender | null;
  birthDate?: string | null; // YYYY-MM-DD 또는 null
  region?: string | null;
  phone?: string | null;
};
```

PATCH 성공 응답은 갱신 후 전체 `UserProfileResponse`를 반환한다. 관심 분야 변경은 별도 `PUT /api/interests/me` 요청으로 수행한다.

Next.js 프록시는 HTTP-only cookie에서 JWT를 읽어 Bearer token으로 전달하고, `401`이면 기존 인증 프록시와 동일하게 cookie를 삭제한다.

## 13. 오류 계약

기존 프로젝트 형식에 맞춰 모든 오류는 최소한 다음 구조를 사용한다.

```ts
type ApiError = {
  code: string;
  error: string;
};
```

| 상태 | 조건 | 권장 code |
| --- | --- | --- |
| `400 Bad Request` | body 형식 오류 | `INVALID_BODY` |
| `400 Bad Request` | 읽기 전용/알 수 없는 필드 | `INVALID_PROFILE_FIELD` |
| `400 Bad Request` | 변경 필드 없음 | `EMPTY_PROFILE_UPDATE` |
| `400 Bad Request` | 필드 validation 실패 | `INVALID_NAME`, `INVALID_GENDER`, `INVALID_BIRTH_DATE`, `INVALID_REGION`, `INVALID_PHONE` |
| `401 Unauthorized` | token 없음, 만료, 유효하지 않음 | `AUTHENTICATION_REQUIRED` |
| `404 Not Found` | JWT 사용자가 DB에서 사라짐 | `USER_NOT_FOUND` 또는 인증 미들웨어의 현재 `401 User not found` 정책 중 하나로 통일 필요 |
| `409 Conflict` | 현재 수정 가능 필드에는 통상 발생하지 않음. 향후 unique 필드를 수정할 때 사용 | `PROFILE_CONFLICT` |
| `500 Internal Server Error` | 예상하지 못한 서버/DB 오류 | `PROFILE_LOOKUP_FAILED`, `PROFILE_UPDATE_FAILED` |

유효성 오류 메시지는 안전한 일반 문구만 반환하고 원본 개인정보나 Prisma 오류를 포함하지 않는다.

현재 `authenticateJwt`는 삭제된 사용자도 `401 User not found`로 처리한다. 따라서 라우트의 `404`는 정상 인증 후 별도 조회 시 사용자 row가 사라지는 경쟁 조건에서만 발생할 수 있다. 후속 구현은 이 차이를 테스트하고 일관된 정책을 선택한다.

## 14. Prisma relation 및 index 검토 결과

- 프로필 조회/수정은 `User.id` PK 조회이므로 새 index가 필요 없다.
- `email`과 `userId`에는 이미 unique index가 있다.
- 사용자별 관심 분야는 `UserInterest` 복합 PK의 `userId` 선두 컬럼으로 조회 가능하다.
- 관심 분야 역방향 조회를 위한 `UserInterest.interestId` index도 reconcile migration에 존재한다.
- `Interest.name` unique 제약도 reconcile migration에 존재한다.
- relation과 cascade 정책은 현재 관심 분야 MVP에 충분하다.
- 게시판 relation을 `User`에 추가하지 않는다.

## 15. Migration 필요 여부와 근거

**결론: 현재 `User`, `Interest`, `UserInterest` 모델로 충분하며 migration은 필요하지 않다.**

- 조회·수정 대상 필드가 모두 `User`에 존재한다.
- 관심 분야 relation과 제약이 이미 존재한다.
- 프로필 PK 조회와 관심 분야 조회를 위한 index가 충분하다.
- 별도 `UserProfile`은 현재 요구에 불필요한 1:1 relation과 정합성 문제를 만든다.
- `userId`는 회원가입에서 필수지만 DB에는 기존 nullable 데이터가 있을 수 있다. 실제 DB 데이터를 확인하지 않은 이번 이슈에서 `NOT NULL` 전환은 안전하지 않으며 후속 API 구현에도 필수가 아니다.
- 프로필 validation과 직렬화는 API 계층의 계약이며 DB 변경 없이 구현할 수 있다.

현재 canonical migration 경로는 `apps/backend/prisma/migrations/`다. 적용 순서는 다음과 같다.

1. `0_canonical_pre_issue92`
2. `20260721170000_add_community_post_password`
3. `20260729180000_reconcile_pre_issue92_schema`
4. `20260729190000_add_program_case_chunk_embeddings`

`User`, `Interest`, `UserInterest`는 canonical baseline에 포함되며 reconcile migration은 `Interest.name` unique index와 `UserInterest.interestId` index를 추가한다. `migrations-legacy/`는 과거 이력을 보존하는 참고 경로이며 새 migration 대상이 아니다.

기존 migration 파일을 수정하면 이미 적용된 환경의 checksum과 repository history가 달라질 수 있으므로 수정하지 않는다. 이번 이슈는 migration을 생성하지 않으므로 disposable DB migration 검증도 필요하지 않다. 후속 API는 DB migration 병합을 기다리지 않고 이 계약을 기반으로 시작할 수 있다.

## 16. 후속 이슈 구현 체크리스트

- [ ] Express `/api/me` router 추가
- [ ] `GET /api/me/profile`에 `authenticateJwt` 적용
- [ ] `PATCH /api/me/profile`에 strict body validation 적용
- [ ] 조회·갱신 모두 명시적 Prisma `select` 사용
- [ ] 생년월일 UTC 날짜 parse/serialize helper 구현 및 테스트
- [ ] 이름, 지역, 전화번호, 성별의 validation/null 정책 테스트
- [ ] 읽기 전용 및 알 수 없는 필드가 포함된 요청을 `400`으로 거부
- [ ] 개인정보 응답에 `Cache-Control: no-store` 적용
- [ ] Next.js `/api/me/profile` GET/PATCH 프록시 추가
- [ ] `401` 시 `moira_session` cookie 삭제
- [ ] `AuthUser`와 `UserProfileResponse` 타입 분리 및 실제 응답과 정합화
- [ ] 기존 `/api/interests`와 `/api/user-interests` 프록시 재사용
- [ ] 마이페이지 이름, 지역, 관심 분야를 실제 데이터로 교체
- [ ] 활동·행사 목업을 숨기거나 명확한 준비 중 상태로 처리
- [ ] 공개 회원가입의 `ADMIN` 허용 문제를 별도 보안 이슈로 등록

## 17. 범위 제외

- Express 프로필 API와 Next.js 프록시 구현
- 마이페이지 UI 수정
- Prisma schema 및 migration 변경
- 비밀번호 변경
- 이메일 변경 및 인증
- `userId` 변경
- 회원 탈퇴
- 프로필 이미지, 공개 프로필, 닉네임
- 관리자 사용자 관리
- 공개 회원가입의 `ADMIN` 허용 정책 수정
- 게시글, 댓글, 좋아요, 북마크 및 관련 `User` relation
- 마이페이지 활동 통계
- 주변 행사와 맞춤 행사
