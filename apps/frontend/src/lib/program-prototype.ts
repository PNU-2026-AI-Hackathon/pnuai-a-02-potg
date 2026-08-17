import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * 게시판 화면이 쓰는 데이터 로더.
 *
 * 정제 규칙은 여기에 두지 않는다. 라벨을 항목으로 옮기고 안내문을 주제별로 묶는 일은
 * 백엔드(programDataNormalization)가 하고, 이 파일은 결과를 읽어 형식만 다듬는다.
 * 규칙이 화면에 있으면 테스트할 수 없고 DB로 옮길 때 다시 써야 한다.
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

type BoardFile = { items: Array<{ normalized: ProgramPrototype }> };

function boardFileCandidates() {
  const relative = path.join('apps', 'backend', '.local', 'program-board', 'programs.json');
  return [
    path.resolve(process.cwd(), relative),
    path.resolve(process.cwd(), '..', 'backend', '.local', 'program-board', 'programs.json'),
  ];
}

/**
 * 350건이 5MB가 넘어, 요청마다 다시 읽고 파싱하면 화면이 눈에 띄게 느려진다.
 * 파일은 배치로 만들어 두는 산출물이라 프로세스가 사는 동안 바뀌지 않는다.
 */
let boardFilePromise: Promise<BoardFile | null> | null = null;

async function readBoardFile() {
  boardFilePromise ??= (async () => {
    for (const candidate of boardFileCandidates()) {
      try {
        return JSON.parse(await readFile(candidate, 'utf8')) as BoardFile;
      } catch {
        // 다음 후보를 본다.
      }
    }
    /**
     * 데이터 파일은 `.local` 아래라 저장소에 없다. 내려받자마자 연 사람에게는 파일이 없다.
     * 그때 화면이 죽지 않고 빈 목록으로 열려야, 무엇을 해야 하는지 안내라도 할 수 있다.
     */
    console.warn('프로그램 게시판 데이터 파일을 찾지 못했습니다. `npm run program-board:build -- --profile all`로 만들 수 있습니다.');
    return null;
  })();

  return boardFilePromise;
}

/** 신청기간과 오늘로 가른 모집 상태. */
export type ProgramRecruitStatus = 'open' | 'upcoming' | 'closed' | 'unknown';

export function programRecruitStatus(program: ProgramPrototype, today = new Date()): ProgramRecruitStatus {
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
export function sortProgramsForBoard(programs: ProgramPrototype[], today = new Date()) {
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

export async function getProgramPrototypes() {
  const board = await readBoardFile();
  if (!board) return [];
  return sortProgramsForBoard(board.items.map((item) => item.normalized));
}

export async function getProgramPrototype(sourceId: number) {
  const programs = await getProgramPrototypes();
  return programs.find((program) => program.sourceId === sourceId) ?? null;
}

/** 같은 프로그램의 다른 회차. 신청은 회차별로 따로 받으므로 링크만 모아 준다. */
export async function getProgramOccurrences(program: ProgramPrototype) {
  const programs = await getProgramPrototypes();
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

export function programCapacityLabel(program: ProgramPrototype) {
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
