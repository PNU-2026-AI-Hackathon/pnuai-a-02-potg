/**
 * 사람이 원본을 보고 직접 채운 회차.
 *
 * 계획서 형태가 제각각이라 규칙으로 읽지 못하는 표가 남는다.
 * 그런 몇 건 때문에 규칙을 계속 늘리면 다른 문서가 깨지므로,
 * 읽지 못한 건만 여기에 손으로 적어 둔다.
 *
 * 자동 추출보다 이 값이 우선한다. 사람이 원본을 보고 넣은 것이므로
 * 추출 결과와 다르면 이쪽이 맞다.
 *
 * 채울 때 지키는 것
 * - `session`은 원본 표의 회차 번호를 그대로 쓴다.
 * - `date`는 원본에 적힌 형태를 그대로 옮긴다. 없으면 `null`로 둔다.
 * - `activity`는 줄바꿈을 살려 원본 칸의 줄 구조를 유지한다.
 * - 원본에 없는 내용을 지어내지 않는다.
 */

export type ManualCurriculumRow = {
  session: number;
  date?: string | null;
  activity: string;
  /** 원본 표에 교재·단원처럼 회차를 묶는 칸이 있으면 그대로 옮긴다. */
  category?: string | null;
  /** 원본 표에 교수방법·준비물·비고 칸이 따로 있으면 그대로 옮긴다. */
  teachingMethod?: string | null;
  materials?: string | null;
  notes?: string | null;
};

export type ManualCurriculumEntry = {
  /** 어느 원본을 보고 넣었는지. 나중에 다시 대조할 때 쓴다. */
  source: string;
  rows: ManualCurriculumRow[];
  /**
   * 자동 추출이 엉뚱한 값을 넣은 기본정보를 바로잡는다.
   * 표가 통째로 장소 칸에 들어가는 것처럼 값이 명백히 틀렸을 때만 쓴다.
   */
  basicInfo?: Array<{ label: string; value: string }>;
  /** 프로그램 내용에 넣을 항목. 목표처럼 자동으로 읽지 못한 것을 채운다. */
  content?: Array<{ label: string; value: string }>;
};

/**
 * 3703 강의계획서는 `Period | Book | Introduction | Activity | Phonics` 다섯 칸짜리
 * 32회차 표다. 칸이 원본과 같은 순서로 보이도록 줄당 하나씩 적고 아래에서 옮긴다.
 * 빈 칸은 빈 문자열로 둔다.
 */
const ROWS_3703: Array<[number, string, string, string, string, string]> = [
  // 회차, 일자, Book, Introduction, Activity, Phonics
  [1, '9월 7일', 'Funny Shapes',
    '- Story Telling',
    '- Student Book: Learning shape names\n- Craft: My Name Tag', ''],
  [2, '9월 8일', 'Funny Shapes',
    '- Presentation: My name tag\n- Story Telling: review',
    '- Chant: Fun Shapes\n- Phonics game\n- ABC Worksheets',
    'Aa: ant, apple\nBb: banana, bus\nCc: cat, cow\nDd: doll, dog'],
  [3, '9월 14일', 'Funny Shapes',
    '- Phonics review\n- Story Telling',
    '- Student Book: Finding shapes in the objects around us\n- Craft: My round fish', ''],
  [4, '9월 15일', 'Funny Shapes',
    '- Presentation: describe the fish and the different shapes used to make it\n- Story Telling: review',
    '- Song: Shape song\n- Phonics game\n- ABC Worksheets',
    'Ee: egg, elephant\nFf: fan, fox\nGg: goat, gorilla\nHh: hat, hand'],
  [5, '9월 21일', 'Funny Shapes',
    '- Story telling: Overall review',
    'Review expression and words learned in book', 'Aa ~ Hh review'],

  [6, '9월 22일', 'Thomas the magic car',
    '- Story Telling',
    '- Student Book: learning the names of the different means of transportation\n- Craft: My fast car', ''],
  [7, '9월 28일', 'Thomas the magic car',
    '- Presentation: describe your dream car.\n- Story Telling: review',
    '- Chant: Cars Cars\n- Phonics game\n- ABC Worksheets',
    'Ii: igloo, ink\nJj: jam, jelly\nKk: key, kite\nLl: lion, lemon'],
  [8, '9월 29일', 'Thomas the magic car',
    '- Phonics review\n- Story Telling',
    '- Student Book: Learning when each type of car is needed\n- Craft: My fire truck', ''],
  [9, '10월 5일', 'Thomas the magic car',
    '- Presentation: what do you need when there is a fire, and why\n- Story Telling: review',
    '- Song: Help Help\n- Phonics game\n- ABC Worksheets',
    'Mm: mask, moon\nNn: nose, nail\nOo: orange, oreo\nPp: pear, penguin'],
  [10, '10월 6일', 'Thomas the magic car',
    '- Story Telling: Overall review',
    'Review expressions and words learned in book', 'Aa ~ Pp Review\nAlphabet Dance'],

  [11, '10월 12일', 'I am a big boy',
    '- Story Telling',
    "- Student Book: learn the different verb expressing action related to one's night routine\n- Craft: My daily Routine", ''],
  [12, '10월 13일', 'I am a big boy',
    '- Presentation:\n- Story Telling: Review',
    '- Chant: I can\n- Phonics game\n- ABC Worksheets',
    'Qq: queen, quilt\nRr: ring, robot\nSs: socks, saw\nTt: tomato, turtle'],
  [13, '10월 19일', 'I am a big boy',
    '- Phonics review\n- Story Telling',
    '- Student Book: use the expression i need to express need.\n- Craft: My daily routine', ''],
  [14, '10월 20일', 'I am a big boy',
    '- Presentation: Describe your daily routine.\n- Story telling: review',
    '- Song: Big girl and big boy\n- Phonics game\n- ABC Worksheets',
    'Uu: umbrella\nVv: vase, van\nWw: watch, whale'],
  [15, '10월 26일', 'I am a big boy',
    'Story telling: Overall review',
    'Review expression and words learned in book', 'Qq ~ Ww Review'],

  [16, '10월 27일', 'You Can Do It',
    '- Phonics review\n- Story Telling',
    "- Student book: learn the different winter sports.\n- Craft: Let's ski!", ''],
  [17, '11월 2일', 'You Can Do It',
    '- Presentation:\n- Story Telling: review',
    '- Phonics game\n- ABC Worksheets',
    'Xx: box, fox\nYy: yo-yo, yellow\nZz: zero, zipper'],
  [18, '11월 3일', 'You Can Do It',
    '- Phonics review\n- Story Telling',
    '- Student book: learn the different job names\n- Craft: My medal', ''],
  [19, '11월 9일', 'You Can Do It',
    '- Presentation:\n- Story Telling: review',
    '- Phonics game\n- ABC Worksheets',
    'Aa: ant, apple\nBb: banana, bus\nCc: cat, cow\nDd: doll, dog\nEe: egg, elephant'],
  [20, '11월 10일', 'You Can Do It',
    '- Story telling: Overall review',
    '- Review expression and words learned in book', 'Aa ~ Zz Review\nAlphabet Dance'],

  [21, '11월 16일', 'Winter Sleep',
    '- Phonics review\n- Story Telling',
    '- Student book: Learn the animals the hibernate during winter\n- Craft: Sleepy Bear', ''],
  [22, '11월 17일', 'Winter Sleep',
    '- Presentation: Describe the bear. explain why you think he sleeps during winter.\n- Story Telling: review',
    "- Chant: i'm sleepy\n- Phonics game\n- ABC Worksheets",
    'Ff: fan, fox\nGg: goat, gorilla\nHh: hat, hand\nIi: igloo, ink\nJj: jam, jelly'],
  // 원본에 [23] 11월 23일 줄이 두 번, 서로 다른 내용으로 인쇄돼 있다.
  // 이 표는 Presentation 회차가 늘 직전 회차의 Craft를 가리킨다(3→4 물고기, 8→9 소방차,
  // 21→22 곰, 26→27 크리스마스 모자, 28→29 루돌프). 24회차가 악기를 묻고 있으므로
  // 23회차는 `My guitar` 줄이 맞다. 다른 줄(`My snowman`)은 원본의 군더더기로 본다.
  [23, '11월 23일', 'Winter Sleep',
    '- Phonics review\n- Story Telling',
    '- Student book: Use the expression "i can" to express ability to do something\n- Craft: My guitar', ''],
  [24, '11월 24일', 'Winter Sleep',
    '- Presentation: What is your favourite instrument and do you want to play another one.\n- Story Telling: review',
    '- Phonics game\n- ABC Worksheets',
    'Kk: key, kite\nLl: lion, lemon\nMm: mask, moon\nNn: nose, nail\nOo: orange, oreo'],
  [25, '11월 30일', 'Winter Sleep',
    'Story telling: Overall review',
    '- Review expressions and words learned in book', 'Aa ~ Oo Review\nAlphabet Dance'],

  [26, '12월 1일', 'Hurry Up, Rudolph',
    '- Phonics review\n- Story Telling',
    '- Student book: learn different feelings and use the expression "are you", " yes i am "\n- Craft: My Christmas hat', ''],
  [27, '12월 7일', 'Hurry Up, Rudolph',
    '- Presentation: Describe your Christmas hat and tell us who you want to give it to as a Christmas present.\n- Story Telling: review',
    '- Chant: Happy Happy\n- Phonics game\n- ABC Worksheets',
    'Pp: pear, penguin\nQq: queen, quilt\nRr: ring, robot\nSs: socks, saw\nTt: tomato, turtle\nXx: box, fox'],
  [28, '12월 8일', 'Hurry Up, Rudolph',
    '- Phonics review\n- Story Telling',
    '- Student book: match the feeling with the face expression\n- Craft: Standing Rudolph', ''],
  [29, '12월 14일', 'Hurry Up, Rudolph',
    '- Presentation: Describe Rudolph and tell us what you want to get for Christmas as a gift\n- Story Telling: review',
    '- Song: Are you happy\n- Phonics game\n- ABC Worksheets',
    'Uu: umbrella\nVv: vase, van\nWw: watch, whale\nXx: box, fox\nYy: yo-yo, yellow\nZz: zero, zipper'],
  [30, '12월 15일', 'Hurry Up, Rudolph',
    'Story telling: Overall review',
    '- Review expression and words learned in book', 'Aa~ Zz Review\nAlphabet Dance'],

  // 마지막 두 회차는 칸을 나누지 않고 한 줄로 적혀 있다.
  [31, '12월 21일', '', '', '<Special program 1>', ''],
  [32, '12월 22일', '', '', '<Special program 2>', ''],
];

export const MANUAL_CURRICULUM: Record<number, ManualCurriculumEntry> = {
  3703: {
    source: '들락날락 영어랑 놀자(Group B / 초등반) 강의계획서 이미지의 32회차 표'
      + ' (Period | Book | Introduction | Activity | Phonics).'
      + ' 원본에 [23] 11월 23일 줄이 두 번, 서로 다른 내용으로 찍혀 있다.'
      + ' 24회차 Presentation이 악기를 묻고 있어 `Craft: My guitar` 줄을 넣었고,'
      + ' 다른 줄(learning the different seasons / My snowman)은 넣지 않았다.',
    basicInfo: [
      // 표 전체가 장소 칸으로 딸려 들어가 있었다.
      { label: '장소', value: '금정아이꿈자람 작은도서관' },
    ],
    content: [
      {
        label: '강의목표',
        value: '· 일상생활에서 사용되는 간단한 표현을 듣고 말할 수 있다.\n'
          + '· 구두로 익힌 쉽고 간단한 문장을 따라 읽고 쓸 수 있으며 쉽고 간단한 문장을 스스로'
          + ' 인식할 수 있고, 쉽고 간단한 단어를 스스로 보고 쓸 수 있다.',
      },
    ],
    rows: ROWS_3703.map(([session, date, book, introduction, activity, phonics]) => ({
      session,
      date,
      category: book || null,
      activity,
      teachingMethod: introduction || null,
      notes: phonics || null,
    })),
  },
  3740: {
    source: '제9기 금정 시민 인문 아카데미 포스터의 강의일정 표 (회차 | 일시 | 주제 | 강사)',
    rows: [
      {
        session: 1,
        date: '10. 8.(화) 19:00~21:00',
        activity: '경제학의 핵심개념과 통화정책 매커니즘',
        notes: '김영재 교수 (경제학부)',
      },
      {
        session: 2,
        date: '10. 15.(화) 19:00~21:00',
        activity: '대한민국의 해양 광물자원\n- 미래를 위한 자원 개발과 환경보호의 조화 -',
        notes: '양기호 교수 (해양학과)',
      },
      {
        session: 3,
        date: '10. 22.(화) 19:00~21:00',
        activity: '비틀스가 왜 ‘혁명’을 노래했을까\n- 대중음악으로 읽는 68혁명 -',
        notes: '정대성 교수 (역사교육과)',
      },
      {
        session: 4,
        date: '10. 29.(화) 19:00~21:00',
        activity: '마음을 치유하는 동의수세보원',
        notes: '채한 교수 (한의학과)',
      },
    ],
  },
};

/** 사람이 채운 회차가 있으면 그것을 쓴다. 없으면 `null`을 돌려 자동 추출을 그대로 둔다. */
export function manualCurriculumFor(sourceId: number): ManualCurriculumEntry | null {
  return MANUAL_CURRICULUM[sourceId] ?? null;
}
