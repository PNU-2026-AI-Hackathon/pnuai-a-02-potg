export type StudioOption = {
  value: string;
  label: string;
  description?: string;
};

export type StudioConditionKey =
  | 'category'
  | 'topic'
  | 'audience'
  | 'age'
  | 'operation'
  | 'period'
  | 'sessions'
  | 'capacity'
  | 'budget'
  | 'location'
  | 'agenda'
  | 'example';

export type StudioField = {
  key: StudioConditionKey;
  label: string;
  required?: boolean;
  multiple?: boolean;
  placeholder: string;
  options: StudioOption[];
};

export const studioFields: StudioField[] = [
  {
    key: 'category',
    label: '프로그램 분야',
    required: true,
    placeholder: '분야 선택',
    options: [
      { value: 'reading', label: '독서 문화', description: '책 읽기, 서평, 작가와의 만남' },
      { value: 'digital', label: '디지털 리터러시', description: 'AI, 데이터, 미디어 이해' },
      { value: 'local', label: '지역 기록', description: '마을 이야기와 생활 의제 아카이빙' },
      { value: 'care', label: '돌봄과 관계', description: '세대 교류, 정서 지원, 공동체 회복' },
    ],
  },
  {
    key: 'topic',
    label: '프로그램 주제',
    required: true,
    placeholder: '주제 선택',
    options: [
      { value: 'climate', label: '기후와 생활 실천' },
      { value: 'career', label: '청소년 진로 탐색' },
      { value: 'safety', label: '어린이 안전과 방과 후' },
      { value: 'archive', label: '우리 동네 기억 수집' },
      { value: 'media', label: '가짜뉴스와 미디어 읽기' },
    ],
  },
  {
    key: 'audience',
    label: '대상',
    required: true,
    multiple: true,
    placeholder: '대상 선택',
    options: [
      { value: 'children', label: '어린이' },
      { value: 'youth', label: '청소년' },
      { value: 'adult', label: '성인' },
      { value: 'senior', label: '시니어' },
      { value: 'family', label: '가족' },
    ],
  },
  {
    key: 'age',
    label: '대상 연령',
    placeholder: '연령 선택',
    options: [
      { value: 'lower-elementary', label: '초등 1-3학년' },
      { value: 'upper-elementary', label: '초등 4-6학년' },
      { value: 'middle-high', label: '중고등학생' },
      { value: 'twenties', label: '청년' },
      { value: 'all', label: '전 연령' },
    ],
  },
  {
    key: 'operation',
    label: '운영 방식',
    required: true,
    placeholder: '운영 방식 선택',
    options: [
      { value: 'lecture', label: '강연형' },
      { value: 'workshop', label: '워크숍형' },
      { value: 'club', label: '동아리형' },
      { value: 'field', label: '탐방형' },
      { value: 'hybrid', label: '온오프라인 병행' },
    ],
  },
  {
    key: 'period',
    label: '운영 기간',
    required: true,
    placeholder: '기간 선택',
    options: [
      { value: 'one-day', label: '1일 특강' },
      { value: 'two-weeks', label: '2주 과정' },
      { value: 'one-month', label: '1개월 과정' },
      { value: 'quarter', label: '분기 과정' },
    ],
  },
  {
    key: 'sessions',
    label: '운영 회차',
    placeholder: '회차 선택',
    options: [
      { value: '1', label: '1회' },
      { value: '3', label: '3회' },
      { value: '4', label: '4회' },
      { value: '6', label: '6회' },
      { value: '8', label: '8회 이상' },
    ],
  },
  {
    key: 'capacity',
    label: '모집 인원',
    required: true,
    placeholder: '인원 선택',
    options: [
      { value: '10', label: '10명 내외' },
      { value: '20', label: '20명 내외' },
      { value: '30', label: '30명 내외' },
      { value: '50', label: '50명 이상' },
    ],
  },
  {
    key: 'budget',
    label: '예산 범위',
    placeholder: '예산 선택',
    options: [
      { value: 'low', label: '50만 원 이하' },
      { value: 'mid', label: '50만-150만 원' },
      { value: 'high', label: '150만-300만 원' },
      { value: 'sponsor', label: '외부 협력 필요' },
    ],
  },
  {
    key: 'location',
    label: '운영 장소',
    placeholder: '장소 선택',
    options: [
      { value: 'library-room', label: '도서관 프로그램실' },
      { value: 'children-room', label: '어린이 자료실' },
      { value: 'local-center', label: '주민센터 연계 공간' },
      { value: 'online', label: '온라인' },
      { value: 'outdoor', label: '야외 또는 탐방지' },
    ],
  },
  {
    key: 'agenda',
    label: '참고할 지역 의제',
    multiple: true,
    placeholder: '의제 선택',
    options: [
      { value: 'after-school', label: '방과 후 돌봄 공백' },
      { value: 'digital-gap', label: '시니어 디지털 격차' },
      { value: 'local-memory', label: '사라지는 동네 기억' },
      { value: 'youth-space', label: '청소년이 머물 공간 부족' },
    ],
  },
  {
    key: 'example',
    label: '참고 프로그램',
    multiple: true,
    placeholder: '사례 선택',
    options: [
      { value: 'book-lab', label: '책으로 여는 생활 실험실' },
      { value: 'ai-basic', label: 'AI 첫걸음 시민 교실' },
      { value: 'memory-map', label: '마을 기억 지도 만들기' },
      { value: 'family-reading', label: '가족 독서 주말 캠프' },
    ],
  },
];

export const requiredStudioFields = studioFields.filter((field) => field.required);
