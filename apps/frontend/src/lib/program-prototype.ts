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

export type ProgramPrototype = {
  sourceId: number;
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

async function readBoardFile() {
  let lastError: unknown;
  for (const candidate of boardFileCandidates()) {
    try {
      return JSON.parse(await readFile(candidate, 'utf8')) as BoardFile;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export async function getProgramPrototypes() {
  const board = await readBoardFile();
  return board.items
    .map((item) => item.normalized)
    .sort((left, right) => {
      const leftDate = left.programStartDate ?? '';
      const rightDate = right.programStartDate ?? '';
      return rightDate.localeCompare(leftDate) || right.sourceId - left.sourceId;
    });
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
