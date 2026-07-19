export const popularAgendas = [
  {
    id: 1,
    category: '돌봄·교육',
    title: '학교가 끝난 뒤, 아이들이 함께 책 읽을 곳이 필요해요',
    description:
      '맞벌이 가정의 아이들이 안전하게 머물며 책과 놀이를 만나는 방과 후 프로그램을 제안합니다.',
    location: '금정구 · 금샘마을 작은도서관',
    likes: 128,
    comments: 24,
  },
  {
    id: 2,
    category: '디지털 생활',
    title: '어르신을 위한 천천히 배우는 스마트폰 교실',
    description:
      '키오스크와 공공 앱 사용이 어려운 이웃을 위해 반복해서 배울 수 있는 수업이 있으면 좋겠어요.',
    location: '동래구 · 온천누리 작은도서관',
    likes: 96,
    comments: 18,
  },
  {
    id: 3,
    category: '환경',
    title: '우리 동네 어린이 자원순환 탐험대',
    description:
      '버려지는 물건의 새로운 쓰임을 찾고 동네 환경을 직접 기록하는 가족 프로그램을 제안합니다.',
    location: '북구 · 화명숲 작은도서관',
    likes: 84,
    comments: 13,
  },
];

export const programSurveys = [
  {
    id: 1,
    title: '책으로 여는 방과 후 창작소',
    audience: '초등 3~6학년',
    agenda: '아이들의 안전한 방과 후 돌봄',
    description: '그림책을 읽고 연극과 만들기로 이야기를 다시 표현하는 6주 프로그램입니다.',
    participants: 72,
    deadline: '2026. 07. 28.',
  },
  {
    id: 2,
    title: '천천히 배우는 디지털 생활',
    audience: '성인·시니어',
    agenda: '생활 밀착형 디지털 교육',
    description: '스마트폰 기본 설정부터 키오스크 실습까지 이웃과 함께 반복해서 배웁니다.',
    participants: 54,
    deadline: '2026. 08. 02.',
  },
  {
    id: 3,
    title: '동네 기록자 워크숍',
    audience: '청소년·성인',
    agenda: '사라지는 동네 이야기를 기록해요',
    description: '사진과 짧은 글로 우리 동네 사람과 장소를 기록하고 작은 전시를 만듭니다.',
    participants: 41,
    deadline: '2026. 08. 08.',
  },
];

export const recruitingPrograms = [
  {
    id: 1,
    status: '모집 중',
    title: '여름밤 가족 그림책 극장',
    library: '금샘마을 작은도서관',
    audience: '7~10세 어린이와 보호자',
    schedule: '8. 8. (토) 18:30',
  },
  {
    id: 2,
    status: '잔여 4석',
    title: '처음 만나는 스마트폰 사진',
    library: '온천누리 작은도서관',
    audience: '성인·시니어',
    schedule: '8. 12. ~ 9. 2. 매주 수요일',
  },
  {
    id: 3,
    status: '접수 예정',
    title: '어린이 자원순환 탐험대',
    library: '화명숲 작은도서관',
    audience: '초등 2~5학년',
    schedule: '8. 22. (토) 10:00',
  },
];

export const libraries = [
  {
    id: 1,
    name: '금샘마을 작은도서관',
    district: '금정구',
    address: '부산광역시 금정구 장전동',
    feature: '어린이·가족 프로그램',
  },
  {
    id: 2,
    name: '온천누리 작은도서관',
    district: '동래구',
    address: '부산광역시 동래구 온천동',
    feature: '디지털 생활 교육',
  },
  {
    id: 3,
    name: '화명숲 작은도서관',
    district: '북구',
    address: '부산광역시 북구 화명동',
    feature: '생태·환경 프로그램',
  },
];
