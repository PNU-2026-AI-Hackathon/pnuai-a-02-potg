/**
 * 스튜디오 기획 조건.
 *
 * 선택지는 금정구 작은도서관 프로그램 351건의 실제 분포에서 뽑았다.
 * 사서가 고른 값으로 지난 사례를 찾아 기획안의 참고 자료로 쓰므로,
 * 실제로 사례가 없는 값을 선택지에 두면 참고할 것이 없는 결과가 나온다.
 *
 * 세 조건은 쓰이는 곳이 서로 다르다.
 * - `audience`  대상을 좁히는 1차 필터. 대상이 어긋난 사례는 참고가 되지 않는다.
 * - `category`  분야. 사례에 분야 항목이 없어 자연어 질의문으로 엮어 벡터 검색에 쓴다.
 * - `period`    운영 기간. 만들 프로그램의 조건이지 찾을 사례의 조건이 아니라
 *               검색에 쓰지 않고 기획안을 생성할 때만 넘긴다.
 */

export type StudioOption = {
  value: string;
  label: string;
  description?: string;
};

export type StudioConditionKey = 'category' | 'audience' | 'period';

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
    // 괄호 안은 351건에서 그 분야에 해당하는 사례 수다.
    options: [
      { value: 'art', label: '미술·공예', description: '그리기, 만들기, 클레이, 캘리그라피' },
      { value: 'reading', label: '독서·글쓰기', description: '그림책, 독서 논술, 글쓰기' },
      { value: 'music', label: '음악·공연', description: '악기, 인형극, 노래와 율동' },
      { value: 'english', label: '영어·외국어', description: '원어민 수업, 파닉스, 생활 영어' },
      { value: 'humanities', label: '역사·인문', description: '한국사, 인문학 강좌, 미술관' },
      { value: 'career', label: '진로·디지털', description: '진로 탐색, 경제, 미디어, AI' },
      { value: 'science', label: '과학·실험', description: '과학 실험, 코딩, 메이커' },
      { value: 'cooking', label: '요리', description: '요리 활동, 베이킹' },
    ],
  },
  {
    key: 'audience',
    label: '대상',
    required: true,
    placeholder: '대상 선택',
    /**
     * 사례를 좁히는 유일한 조건이라 실제 대상 표기와 맞아야 한다.
     * 청소년과 가족은 351건에 각각 1건과 0건뿐이어서 선택지에서 뺐다.
     */
    options: [
      { value: 'preschool', label: '유아', description: '만 4세 ~ 미취학' },
      { value: 'elementary-lower', label: '초등 저학년', description: '1~3학년' },
      { value: 'elementary-upper', label: '초등 고학년', description: '4~6학년' },
      { value: 'adult', label: '성인·어르신', description: '성인, 시니어' },
      { value: 'everyone', label: '누구나', description: '연령 제한 없음, 지역 주민' },
    ],
  },
  {
    key: 'period',
    label: '운영 기간',
    required: true,
    placeholder: '기간 선택',
    /**
     * 2주 과정은 351건에 여덟 건뿐이라 1개월 이내에 합쳤다.
     */
    options: [
      { value: 'one-day', label: '1일 특강' },
      { value: 'within-month', label: '1개월 이내' },
      { value: 'within-quarter', label: '3개월 이내' },
      { value: 'over-quarter', label: '3개월 이상' },
    ],
  },
];

export const requiredStudioFields = studioFields.filter((field) => field.required);
