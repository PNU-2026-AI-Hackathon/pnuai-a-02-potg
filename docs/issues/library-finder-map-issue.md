# feat: 홈 하단 '우리 동네 작은도서관 찾기' 지도 및 최근 프로그램 연동

## 배경

현재 첫 페이지 하단의 `우리 동네 작은도서관 찾기` 섹션은 더미 데이터 기반 UI만 존재합니다.

- 위치: `apps/frontend/src/components/home/LibraryFinderSection.tsx`
- 더미 데이터: `apps/frontend/src/components/home/home-data.ts`
- 백엔드 mock 라우트: `apps/backend/src/routes/libraries.ts`, `apps/backend/src/data/mockData.ts`

사용자가 지역명 또는 도서관명을 검색하면 실제 지도 위에서 도서관 위치를 확인하고, 해당 도서관의 최근 프로그램 정보도 함께 볼 수 있도록 개선합니다.

## 목표

검색어 입력 시 다음 정보를 보여줍니다.

- 검색 결과에 해당하는 작은도서관 목록
- 지도 API 기반 도서관 위치 마커
- 선택한 도서관의 주소/지역/운영 정보
- 최근 프로그램 목록 또는 안내 문구

## 작업 범위

### 1. 지도 API 연동

- Kakao Maps 또는 Naver Maps 중 하나를 선택해 연동합니다.
- 프론트엔드에서 지도 SDK를 client-side로 로드합니다.
- 환경변수로 지도 API 키를 관리합니다.
  - 예: `NEXT_PUBLIC_KAKAO_MAP_API_KEY`
- 검색 결과에 따라 지도 중심 좌표와 마커를 갱신합니다.
- 마커 클릭 시 해당 도서관 카드 또는 상세 정보가 선택되도록 연결합니다.
- 지도 로딩 실패 시 카드 목록만 볼 수 있는 fallback UI를 제공합니다.

### 2. 도서관 데이터 구조 확장

현재 mock 수준의 도서관 데이터를 실제 검색/지도 표시에 필요한 구조로 확장합니다.

필요 필드 예시:

```ts
type Library = {
  id: string;
  name: string;
  region: string;
  district?: string;
  address: string;
  latitude: number;
  longitude: number;
  openHours?: string;
  phone?: string;
  recentPrograms: LibraryProgram[];
};

type LibraryProgram = {
  id: string;
  title: string;
  period?: string;
  target?: string;
  status?: string;
  sourceUrl?: string;
};
```

### 3. 백엔드 API 개선

- `GET /libraries`가 검색어를 받을 수 있도록 확장합니다.
  - 예: `GET /libraries?q=부곡`
- 응답에 좌표와 최근 프로그램 정보를 포함합니다.
- 최근 프로그램은 기존 프로그램 게시판/크롤링 데이터가 있으면 연결하고, 없으면 빈 배열을 반환합니다.
- 데이터가 없는 경우 프론트에서 `최근 등록된 프로그램이 없습니다.` 문구를 보여줄 수 있게 합니다.

### 4. 프론트엔드 UI 개선

`LibraryFinderSection.tsx`를 더미 필터링 UI에서 실제 API 기반 UI로 변경합니다.

필요 상태:

- 초기 상태
- 검색 중 loading
- 검색 결과 있음
- 검색 결과 없음
- API 오류
- 지도 로딩 실패

UI 요구사항:

- 검색 결과 목록과 지도 영역을 함께 표시합니다.
- 도서관 카드를 선택하면 지도 마커/중심 위치가 함께 변경됩니다.
- 각 도서관 카드에 최근 프로그램 1~3개를 노출합니다.
- 최근 프로그램이 없으면 안내 문구를 보여줍니다.
- 모바일에서도 지도와 결과 목록이 겹치지 않도록 반응형 레이아웃을 정리합니다.

## 완료 조건

- [ ] 홈 하단 `우리 동네 작은도서관 찾기` 섹션에서 더미 데이터 의존을 제거한다.
- [ ] 검색어 입력 후 실제 API를 호출해 도서관 목록을 조회한다.
- [ ] 검색 결과 도서관의 위치가 지도 마커로 표시된다.
- [ ] 도서관 선택 시 지도 중심과 선택 카드가 동기화된다.
- [ ] 도서관별 최근 프로그램 목록 또는 안내 문구가 표시된다.
- [ ] loading / empty / error / map fallback 상태가 구현되어 있다.
- [ ] 지도 API 키는 환경변수로 관리된다.
- [ ] 데스크톱/모바일 화면에서 레이아웃이 깨지지 않는다.

## 참고 파일

- `apps/frontend/src/components/home/LibraryFinderSection.tsx`
- `apps/frontend/src/components/home/home-data.ts`
- `apps/backend/src/routes/libraries.ts`
- `apps/backend/src/data/mockData.ts`
- 프로그램 데이터 연계 후보:
  - `apps/backend/src/routes/programBoardEntries.ts`
  - `docs/fixtures/geumjeong-programs-349.json`

## 비고

지도 API는 국내 주소/좌표 검색 정확도를 고려해 Kakao Maps 또는 Naver Maps를 우선 검토합니다.
