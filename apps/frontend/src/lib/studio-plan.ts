/**
 * 기획서의 틀.
 *
 * 항목은 지어내지 않고 두 곳에서 가져왔다.
 *
 * 하나는 금정구 작은도서관 강의계획서 351건이 실제로 갖고 있던 항목이다.
 * 대상·강사·모집인원·교육기간·신청기간은 351건 전부에, 교육시간은 350건에 있었다.
 * 목표는 108건, 학습자 준비물 96건, 강의실 준비 79건, 재료비 72건이었다.
 * 회차는 244개 프로그램에 1,759개가 있었고 일자가 붙은 것이 977개였다.
 *
 * 다른 하나는 개발계획서가 생성 결과에 담으라고 정한 항목이다. 기획 의도·홍보문·
 * 기대 효과는 351건에 없다. 이미 만들어진 프로그램은 그런 것을 남기지 않지만
 * 새로 기획할 때는 필요하다.
 *
 * 항목을 여기 한 곳에 모아 두는 이유는 셋이 같은 목록을 봐야 하기 때문이다.
 * 생성 프롬프트가 요구하는 JSON, 사서가 고르는 수정 대상, PDF에 그리는 순서가
 * 어긋나면 항목 단위 수정이 곧바로 깨진다.
 */

/** 회차 한 줄. 정제한 351건이 쓰는 회차 구조와 같은 모양이다. */
export type StudioPlanSession = {
  session: number;
  /** 원본 계획서도 일자가 없는 회차가 절반을 넘는다. 비워 둘 수 있어야 한다. */
  date?: string | null;
  activity: string;
  materials?: string | null;
  notes?: string | null;
};

export type StudioPlan = {
  /** 개요 */
  title: string;
  intent: string;
  target: string;
  period: string;
  classTime: string;
  applicationPeriod: string;
  sessionCount: string;
  capacity: string;
  location: string;
  instructor: string;
  /** 내용 */
  goal: string;
  sessions: StudioPlanSession[];
  /** 준비 사항 */
  materials: string;
  materialFee: string;
  roomSetup: string;
  /** 마무리 */
  expectedEffects: string;
  promotion: string;
  cautions: string[];
};

export type StudioPlanFieldKey = keyof StudioPlan;

export type StudioPlanFieldKind = 'text' | 'lines' | 'sessions';

export type StudioPlanField = {
  key: StudioPlanFieldKey;
  label: string;
  group: '개요' | '내용' | '준비 사항' | '마무리';
  kind: StudioPlanFieldKind;
  /** LLM에게 이 항목이 무엇인지 알려 줄 한 줄. 프롬프트에 그대로 들어간다. */
  hint: string;
  /** 사서가 정하지 않은 값을 지어내면 안 되는 항목. 근거가 없으면 미정으로 남긴다. */
  factual?: boolean;
  /**
   * 사서가 직접 적는 항목. 생성에도 수정에도 넘기지 않는다.
   *
   * 강사는 도서관이 섭외로 정하는 값이라 참고 사례에서 이름을 가져오면 실제 사람을
   * 엉뚱한 프로그램에 붙이게 된다. 빈칸으로 두고 사서가 채운다.
   */
  manualOnly?: boolean;
};

export const UNDECIDED = '미정(담당자 확정 필요)';

export const studioPlanFields: StudioPlanField[] = [
  { key: 'title', label: '프로그램명', group: '개요', kind: 'text', hint: '프로그램 이름' },
  { key: 'intent', label: '기획 의도', group: '개요', kind: 'text', hint: '왜 이 프로그램이 필요한지' },
  { key: 'target', label: '대상', group: '개요', kind: 'text', hint: '참여 대상과 연령' },
  { key: 'period', label: '운영 기간', group: '개요', kind: 'text', hint: '언제부터 언제까지', factual: true },
  /**
   * 교육 시간과 신청 기간은 도서관 사정과 접수 일정에서 나오는 값이라 참고 사례에서
   * 가져오면 남의 일정을 옮겨 적게 된다. 칸만 두고 사서가 채운다.
   * 351건 중 신청 기간은 351건, 교육 시간은 350건에 있던 항목이다.
   */
  { key: 'classTime', label: '교육 시간', group: '개요', kind: 'text', hint: '요일과 시각', manualOnly: true },
  { key: 'applicationPeriod', label: '신청 기간', group: '개요', kind: 'text', hint: '접수를 받는 기간과 방법', manualOnly: true },
  { key: 'sessionCount', label: '운영 횟수', group: '개요', kind: 'text', hint: '총 몇 회차인지' },
  { key: 'capacity', label: '모집 인원', group: '개요', kind: 'text', hint: '몇 명을 모집할지', factual: true },
  { key: 'location', label: '운영 장소', group: '개요', kind: 'text', hint: '어디에서 진행할지', factual: true },
  { key: 'instructor', label: '강사', group: '개요', kind: 'text', hint: '수업을 맡을 강사', manualOnly: true },

  { key: 'goal', label: '목표', group: '내용', kind: 'text', hint: '참여자가 무엇을 얻어 가는지' },
  { key: 'sessions', label: '회차별 활동', group: '내용', kind: 'sessions', hint: '회차마다 무엇을 하는지' },

  { key: 'materials', label: '준비물', group: '준비 사항', kind: 'text', hint: '참여자가 가져올 것' },
  { key: 'materialFee', label: '재료비', group: '준비 사항', kind: 'text', hint: '참여자가 낼 금액', factual: true },
  { key: 'roomSetup', label: '강의실 준비', group: '준비 사항', kind: 'text', hint: '도서관이 갖춰 둘 것' },

  { key: 'expectedEffects', label: '기대 효과', group: '마무리', kind: 'text', hint: '프로그램이 남길 변화' },
  { key: 'promotion', label: '홍보문', group: '마무리', kind: 'text', hint: '주민에게 보일 안내 문구' },
  { key: 'cautions', label: '운영 시 유의점', group: '마무리', kind: 'lines', hint: '진행할 때 조심할 것' },
];

export const studioPlanFieldMap = new Map(studioPlanFields.map((field) => [field.key, field]));

export const studioPlanGroups = ['개요', '내용', '준비 사항', '마무리'] as const;

/** 생성과 수정에 넘길 항목. 사서가 직접 적는 항목은 뺀다. */
export const generatedStudioPlanFields = studioPlanFields.filter((field) => !field.manualOnly);

export const studioPlanStorageKey = 'moira-studio-generated-plan';

/**
 * 저장소나 서버에서 온 값을 기획서 항목 구조로 만든다. 기획서가 아니면 null이다.
 *
 * 빠진 항목을 빈칸으로 채우고 넘긴다. 항목이 다 있어야만 받아 주면, 나중에 항목을
 * 하나 늘릴 때마다 그 전에 저장한 기획서가 전부 「기획서가 아님」이 되어 화면에서
 * 사라진다. 항목 목록은 앞으로도 늘어난다.
 *
 * 회차 배열이 있는지만 진짜 기준으로 본다. 값의 내용은 보지 않는다. 빈 문자열도
 * 사서가 채워 가는 정상 상태다.
 */
export function toStudioPlan(value: unknown): StudioPlan | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  if (!Array.isArray(source.sessions)) return null;

  const plan = emptyStudioPlan();
  for (const field of studioPlanFields) {
    if (field.kind === 'sessions') continue;
    const raw = source[field.key];
    if (field.kind === 'lines') {
      if (Array.isArray(raw)) {
        plan[field.key] = raw.filter((line): line is string => typeof line === 'string') as never;
      }
      continue;
    }
    if (typeof raw === 'string') plan[field.key] = raw as never;
  }

  plan.sessions = source.sessions
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
    .map((row, index) => ({
      session: typeof row.session === 'number' ? row.session : index + 1,
      date: typeof row.date === 'string' ? row.date : '',
      activity: typeof row.activity === 'string' ? row.activity : '',
      materials: typeof row.materials === 'string' ? row.materials : '',
      notes: typeof row.notes === 'string' ? row.notes : '',
    }));

  return plan;
}

/**
 * 기획서를 글로 옮긴다.
 *
 * 저장과 목록은 아직 글 한 덩어리를 다루므로 항목에서 글을 만들어 함께 보낸다.
 * 진실은 항목이고 이 글은 그때그때 만들어 쓴다. 반대로 글을 고쳐 항목을 되맞추지는 않는다.
 */
export function planToContent(plan: StudioPlan) {
  const blocks: string[] = [];
  for (const field of studioPlanFields) {
    const value = plan[field.key];
    if (field.kind === 'sessions') {
      const rows = value as StudioPlanSession[];
      if (!rows.length) continue;
      blocks.push([field.label, ...rows.map((row) => {
        const parts = [`- ${row.session}회차`];
        if (row.date) parts.push(`(${row.date})`);
        parts.push(`: ${row.activity}`);
        if (row.materials) parts.push(` / 준비물: ${row.materials}`);
        if (row.notes) parts.push(` / 비고: ${row.notes}`);
        return parts.join('');
      })].join('\n'));
      continue;
    }
    const text = field.kind === 'lines' ? (value as string[]).map((line) => `- ${line}`).join('\n') : String(value ?? '');
    if (!text.trim()) continue;
    blocks.push(`${field.label}\n${text}`);
  }
  return blocks.join('\n\n');
}

/** 빈 기획서. 파서가 값을 채우지 못했을 때의 바닥값으로 쓴다. */
export function emptyStudioPlan(): StudioPlan {
  return {
    title: '', intent: '', target: '', period: '', sessionCount: '', capacity: '', location: '',
    instructor: '', classTime: '', applicationPeriod: '',
    goal: '', sessions: [],
    materials: '', materialFee: '', roomSetup: '',
    expectedEffects: '', promotion: '', cautions: [],
  };
}
