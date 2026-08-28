# 마이페이지 계정·프로필 데이터 계약

이 문서는 현재 구현된 마이페이지 프로필과 활동 내역 API의 데이터 계약을 설명합니다.

## 데이터 모델

프로필은 별도의 `UserProfile` 테이블 없이 `User`에 저장합니다. 관심 분야는 `Interest`와 `UserInterest`의 다대다 관계로 관리합니다.

| 구분 | 필드 |
| --- | --- |
| 계정 식별 | `id`, `userId`, `email`, `accountType` |
| 수정 가능 프로필 | `name`, `gender`, `birthDate`, `region`, `phone` |
| 관심 분야 | `UserInterest`를 통한 `Interest[]` |
| 시스템 필드 | `createdAt`, `updatedAt` |

비밀번호는 응답에 포함하지 않습니다. 프로필 조회는 명시적인 Prisma `select`를 사용합니다.

## API

모든 경로는 JWT 인증이 필요하며 응답에 `Cache-Control: no-store`를 설정합니다.

| Method | 경로 | 기능 |
| --- | --- | --- |
| `GET` | `/api/me/profile` | 프로필과 관심 분야 조회 |
| `PATCH` | `/api/me/profile` | 허용된 프로필 필드 수정 |
| `GET` | `/api/me/activity` | 게시글·댓글·좋아요·저장 활동 및 개수 조회 |
| `GET` | `/api/interests/me` | 내 관심 분야 조회 |
| `PUT`·`POST` | `/api/interests/me` | 내 관심 분야 교체 저장 |

브라우저에서는 Next.js `/api/me/[resource]` BFF가 인증 쿠키를 포함해 Express로 전달합니다.

## 프로필 응답

```json
{
  "profile": {
    "id": "uuid",
    "userId": "login-id",
    "name": "사용자",
    "email": "user@example.com",
    "accountType": "RESIDENT",
    "gender": null,
    "birthDate": "2000-01-01",
    "region": "부산광역시 금정구",
    "phone": "01012345678",
    "interests": [{ "id": "science", "name": "과학" }],
    "createdAt": "ISO-8601 timestamp",
    "updatedAt": "ISO-8601 timestamp"
  }
}
```

`birthDate`는 `YYYY-MM-DD`, 생성·수정 시각은 ISO-8601 문자열로 직렬화합니다.

## 수정 규칙

- 요청 본문에는 `name`, `gender`, `birthDate`, `region`, `phone`만 허용합니다.
- 빈 객체나 읽기 전용·알 수 없는 필드는 `400`으로 거부합니다.
- `name`: trim 후 1~50자
- `gender`: `FEMALE`, `MALE`, `OTHER` 또는 `null`
- `birthDate`: 미래가 아닌 유효한 `YYYY-MM-DD` 또는 `null`
- `region`: 100자 이하, 제어문자 금지; 빈 문자열은 `null`
- `phone`: 하이픈·공백 제거 후 숫자 8~15자리; 빈 문자열은 `null`

## 오류 계약

| 상태 | 대표 코드 | 의미 |
| --- | --- | --- |
| `400` | `INVALID_BODY`, `INVALID_PROFILE_FIELD` | 요청 형식 또는 수정 필드 오류 |
| `401` | `AUTHENTICATION_REQUIRED` | 로그인 필요 |
| `404` | `USER_NOT_FOUND` | 사용자 없음 |
| `500` | `PROFILE_LOOKUP_FAILED`, `PROFILE_UPDATE_FAILED`, `ACTIVITY_LOOKUP_FAILED` | 서버 처리 실패 |

## 범위

현재 프로필 API는 비밀번호·이메일 변경, 회원 탈퇴, 프로필 이미지와 공개 프로필을 제공하지 않습니다. 해당 기능은 별도 인증·보안 계약이 필요합니다.
