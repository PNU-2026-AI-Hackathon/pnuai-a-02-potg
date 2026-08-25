# PR: 우리 동네 도서관 지도 검색 기능 추가

## 요약

- 첫 페이지의 `우리 동네 도서관 찾기` 더미 UI를 실제 금정구 도서관 지도 검색 UI로 교체했습니다.
- 금정구 공공도서관 2곳, 공립 작은도서관 20곳, 사립 작은도서관 18곳을 백엔드 데이터로 추가했습니다.
- 검색 결과에서 도서관 위치, 운영 정보, 문의처, 최근 프로그램을 함께 확인할 수 있게 했습니다.
- 카카오 지도에서 도서관 마커를 표시하고, 선택된 도서관 마커는 빨간색으로 강조되도록 했습니다.

## 주요 변경사항

- `GET /api/libraries` 백엔드 API 추가
  - 도서관명, 주소, 유형, 별칭 기반 검색 지원
  - 프로그램 게시판 DB와 연결해 도서관별 최근 프로그램 최대 3건 반환
  - 프로그램 DB 조회 실패 시에도 도서관 목록은 표시되도록 fallback 처리
- 프론트엔드 `/api/libraries` 프록시 추가
  - 브라우저가 백엔드 URL을 직접 알 필요 없이 Next API 경로를 통해 조회
- 홈 화면 도서관 찾기 UI 개편
  - 왼쪽: 제목, 검색창, 지도
  - 오른쪽: 40곳 목록 스크롤
  - 도서관 선택 시 지도 중심 이동 및 카드 선택 상태 표시
- 카카오 지도 인터랙션 개선
  - 기본 지도 확대 level을 `5`로 설정
  - 지도 내부 휠은 페이지 스크롤 대신 지도 확대/축소로 동작
  - 마커 hover 시 도서관 이름 표시
  - 선택된 도서관 마커만 빨간색, 나머지는 파란색으로 표시

## 배포 전 확인

- 프론트 환경변수에 카카오 JavaScript 키가 필요합니다.
  - `NEXT_PUBLIC_KAKAO_MAP_API_KEY`
- 카카오 Developers의 JavaScript SDK 도메인에 배포 도메인이 등록되어 있어야 합니다.
  - 예: `https://pnuai-a-02-potg.vercel.app`
  - 로컬 확인 시: `http://localhost:3000`
- 프론트의 `BACKEND_URL`이 배포 백엔드 주소를 가리켜야 `/api/libraries` 프록시가 정상 동작합니다.

## 테스트

- `apps/backend`: `npm run build`
- `apps/frontend`: `npx eslint src/components/home/LibraryFinderSection.tsx src/app/api/libraries/route.ts`
- `apps/frontend`: `npx tsc --noEmit`
- `apps/frontend`: `npm run build`

## 참고

- 이번 PR 문서는 작업 공유용이며 커밋에는 포함하지 않았습니다.
