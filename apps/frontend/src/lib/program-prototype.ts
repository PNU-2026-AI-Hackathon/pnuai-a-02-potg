import 'server-only';
import { getBackendUrl } from './backend-url';

/**
 * 게시판 화면이 쓰는 데이터 로더.
 *
 * 정제 규칙은 여기에 두지 않는다. 라벨을 항목으로 옮기고 안내문을 주제별로 묶는 일은
 * 백엔드(programDataNormalization)가 하고, 이 파일은 결과를 읽어 형식만 다듬는다.
 * 규칙이 화면에 있으면 테스트할 수 없고 DB로 옮길 때 다시 써야 한다.
 *
 * 예전에는 백엔드가 만들어 둔 `.local/program-board/programs.json` 을 직접 읽었다.
 * 두 앱이 한 기계에 있을 때만 되는 방식이라, 프런트만 따로 배포하면 파일이 없어
 * 게시판이 빈 채로 열렸다. 지금은 백엔드가 DB에서 꺼내 주는 것을 받아 쓴다.
 */

export type ProgramSection = {
  id: 'content' | 'operation' | 'application' | 'contact';
  title: string;
  items: Array<{ label: string; value: string }>;
};

export type ProgramNoticeGroup = { id: string; title: string; lines: string[] };

export type ProgramTableCell = {
  text: string;
  header: boolean;
  colSpan: number;
  rowSpan: number;
  images: Array<{ url: string; alt: string }>;
};

/**
 * 첨부·포스터에서 뽑아낸 회차 한 줄.
 *
 * 크롤 본문에는 없는 내용이다. 원본이 포스터 이미지나 첨부파일이라 사람이 열어 보기
 * 전에는 알 수 없던 것을, 정제 배치가 표로 만들어 둔 것이다.
 */
export type ProgramCurriculumRow = {
  session: number | null;
  date: string | null;
  activity: string | null;
  materials: string | null;
  notes: string | null;
  materialsOrNotes: string | null;
  /** 원본 계획서의 「교수방법」 칸. 예시 도서 이미지가 이 자리에 붙어 있는 경우가 많다. */
  teachingMethod: string | null;
  referenceImages: Array<{ url: string; alt?: string }>;
};

export type ProgramPrototype = {
  sourceId: number;
  curriculum: ProgramCurriculumRow[];
  sourceUrl: string;
  title: string;
  libraryName: string | null;
  targetGroup: string | null;
  targetDetail: string | null;
  instructor: string | null;
  capacity: number | null;
  programStartDate: string | null;
  programEndDate: string | null;
  applyStartDate: string | null;
  applyEndDate: string | null;
  scheduleText: string | null;
  description: string | null;
  onlineApplicationStatus: string | null;
  programContent: {
    kind: 'table' | 'image' | 'text' | 'attachment_only' | 'empty';
    text: string;
    tables: Array<{ rows: Array<{ cells: ProgramTableCell[] }> }>;
    images: Array<{ url: string; alt: string }>;
  };
  board: {
    sections: ProgramSection[];
    intro: string[];
    notices: ProgramNoticeGroup[];
    unmappedLabels: string[];
  };
  seriesKey: string;
  occurrenceLabel: string | null;
  seriesSize: number;
  isFree: boolean | null;
  feeText: string | null;
  materialFeeAmount: number | null;
  attachments: Array<{ name: string; url: string }>;
  normalizationStatus: 'normalized' | 'partial' | 'needs_review' | 'excluded';
  warnings: string[];
  evidence: { capacityText: string | null };
};

/**
 * 목록 화면이 쓰는 만큼만 담은 요약.
 *
 * 정제 결과 한 건이 평균 19KB라 351건이면 6MB가 넘는다. 목록에는 제목·도서관·대상·기간·정원만
 * 있으면 되므로 전부를 받지 않는다. `ProgramPrototype` 의 부분집합이라 아래 도우미 함수들이
 * 목록과 상세 양쪽에 그대로 쓰인다.
 */
export type ProgramSummary = Pick<
  ProgramPrototype,
  | 'sourceId'
  | 'seriesKey'
  | 'title'
  | 'libraryName'
  | 'targetGroup'
  | 'sourceUrl'
  | 'occurrenceLabel'
  | 'capacity'
  | 'programStartDate'
  | 'programEndDate'
  | 'applyStartDate'
  | 'applyEndDate'
  | 'evidence'
>;

/**
 * 정제 결과는 배치가 만들어 DB에 올려 둔 것이라 한 요청이 도는 동안 바뀌지 않는다.
 * 매번 다시 받아 오면 목록 한 장 그리는 데 6MB를 왕복하게 되므로 잠시 캐시한다.
 */
const BOARD_REVALIDATE_SECONDS = 300;

async function fetchBoard<T>(path: string, empty: T): Promise<T> {
  try {
    const response = await fetch(getBackendUrl(path), {
      next: { revalidate: BOARD_REVALIDATE_SECONDS },
    });

    if (!response.ok) {
      /**
       * 데이터는 정제 배치를 돌리고 `npm run program-board:publish` 로 올려야 생긴다.
       * 아직 안 올린 사람에게도 화면이 죽지 않고 열려야, 무엇을 해야 하는지 안내라도 한다.
       */
      console.warn(`프로그램 게시판 데이터를 받지 못했습니다 (${response.status}). 백엔드에서 program-board:publish 를 돌렸는지 확인해 주세요.`);
      return empty;
    }

    return (await response.json()) as T;
  } catch (error) {
    console.warn('프로그램 게시판 백엔드에 닿지 못했습니다.', error);
    return empty;
  }
}

/** 신청기간과 오늘로 가른 모집 상태. */
export type ProgramRecruitStatus = 'open' | 'upcoming' | 'closed' | 'unknown';

export function programRecruitStatus(
  program: Pick<ProgramSummary, 'applyStartDate' | 'applyEndDate'>,
  today = new Date(),
): ProgramRecruitStatus {
  const { applyStartDate: start, applyEndDate: end } = program;
  if (!start && !end) return 'unknown';
  const now = today.toISOString().slice(0, 10);
  if (start && start > now) return 'upcoming';
  if (end && end < now) return 'closed';
  return 'open';
}

export const programRecruitLabel: Record<ProgramRecruitStatus, string> = {
  open: '모집중',
  upcoming: '모집 예정',
  closed: '모집 마감',
  unknown: '기간 확인 필요',
};

/**
 * 모집 중인 것을 앞에 두고, 각 묶음 안에서는 신청 시작일 최신순.
 *
 * 이 화면을 보는 사람이 먼저 궁금한 것은 지금 신청할 수 있는 프로그램이다. 그다음은
 * 새로 올라온 것 순서다. 모집 예정은 따로 올리지 않는다. 신청 시작일이 아직 오지 않아
 * 날짜가 가장 뒤라, 나머지를 최신순으로 세우면 자연히 맨 앞에 선다.
 */
export function sortProgramsForBoard<T extends Pick<ProgramSummary, 'applyStartDate' | 'applyEndDate' | 'sourceId'>>(
  programs: T[],
  today = new Date(),
) {
  return [...programs].sort((left, right) => {
    const leftOpen = programRecruitStatus(left, today) === 'open';
    const rightOpen = programRecruitStatus(right, today) === 'open';
    if (leftOpen !== rightOpen) return leftOpen ? -1 : 1;

    // 신청 시작일이 없는 건은 뒤로. 날짜를 모르는 것이 새 것처럼 앞에 서면 안 된다.
    const leftDate = left.applyStartDate ?? '';
    const rightDate = right.applyStartDate ?? '';
    if (leftDate !== rightDate) return rightDate.localeCompare(leftDate);
    return right.sourceId - left.sourceId;
  });
}

export async function getProgramSummaries() {
  const { programs } = await fetchBoard<{ programs: ProgramSummary[] }>(
    '/api/program-board/programs',
    { programs: [] },
  );

  return sortProgramsForBoard(programs);
}

export async function getProgramPrototype(sourceId: number) {
  const { program } = await fetchBoard<{ program: ProgramPrototype | null }>(
    `/api/program-board/programs/${sourceId}`,
    { program: null },
  );

  return program;
}

/** 같은 프로그램의 다른 회차. 신청은 회차별로 따로 받으므로 링크만 모아 준다. */
export async function getProgramOccurrences(program: Pick<ProgramSummary, 'seriesKey' | 'sourceId'>) {
  const programs = await getProgramSummaries();
  return programs
    .filter((candidate) => candidate.seriesKey === program.seriesKey && candidate.sourceId !== program.sourceId)
    .sort((left, right) => (left.programStartDate ?? '').localeCompare(right.programStartDate ?? ''));
}

export function formatProgramDate(value: string | null) {
  if (!value) return '확인 필요';
  return value.replace(/-/g, '.');
}

export function formatProgramPeriod(start: string | null, end: string | null) {
  if (!start && !end) return '확인 필요';
  if (start === end) return formatProgramDate(start);
  return `${formatProgramDate(start)} ~ ${formatProgramDate(end)}`;
}

export function programCapacityLabel(program: Pick<ProgramSummary, 'capacity' | 'evidence'>) {
  if (program.capacity !== null) return `${program.capacity}명`;
  const listed = program.evidence.capacityText;
  return listed ? `원사이트 ${listed}명 · 확인 필요` : '확인 필요';
}

export function programFeeLabel(program: ProgramPrototype) {
  if (program.isFree === true && program.materialFeeAmount) return `수강료 무료 · 재료비 ${program.materialFeeAmount.toLocaleString('ko-KR')}원`;
  if (program.isFree === true) return '수강료 무료';
  if (program.materialFeeAmount) return `재료비 ${program.materialFeeAmount.toLocaleString('ko-KR')}원`;
  if (program.feeText) return '비용 안내 있음';
  return '비용 정보 없음';
}
