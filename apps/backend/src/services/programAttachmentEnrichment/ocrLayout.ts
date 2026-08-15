import { normalizeExtractedKoreanSpacing } from './sectionMatcher';
import type { OcrTextBox } from '../attachment/clovaOcrResponseParser';

/**
 * OCR 글자 조각을 좌표로 묶어 표 구조를 되살린다.
 *
 * 포스터의 회차표는 평탄한 텍스트로는 복원할 수 없다. 읽기 순서가 좌우 열을 오가며,
 * 회차 번호가 내용보다 뒤에 나오기도 한다. 실제 사례:
 *
 * ```
 * 차시 / 내용 / 차시 / 내용
 * 해와 달이 된 오누이 (그림자동화)
 * 8                          ← 오른쪽 열의 8회차
 * 1                          ← 왼쪽 열의 1회차가 뒤늦게
 * ```
 *
 * 글자마다 붙어 있는 위치를 쓰면 같은 줄과 같은 단을 다시 묶을 수 있다.
 */

export type OcrLine = {
  top: number;
  bottom: number;
  left: number;
  right: number;
  text: string;
  boxes: OcrTextBox[];
};

export type OcrColumn = {
  left: number;
  right: number;
  lines: OcrLine[];
};

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * 같은 줄에 있는 글자 조각을 묶는다.
 *
 * 세로 위치가 글자 높이의 절반 안쪽으로 겹치면 같은 줄로 본다.
 * 고정 픽셀 값을 쓰면 포스터 해상도에 따라 결과가 달라지므로 글자 높이를 기준으로 삼는다.
 */
export function groupLines(boxes: OcrTextBox[], toleranceRatio = 0.5): OcrLine[] {
  if (!boxes.length) return [];
  const heights = boxes.map((box) => Math.max(1, box.bottom - box.top));
  const tolerance = Math.max(4, median(heights) * toleranceRatio);

  const sorted = [...boxes].sort((left, right) => left.top - right.top || left.left - right.left);
  const lines: OcrLine[] = [];
  for (const box of sorted) {
    const center = (box.top + box.bottom) / 2;
    const line = lines.find((candidate) => Math.abs((candidate.top + candidate.bottom) / 2 - center) <= tolerance);
    if (line) {
      line.boxes.push(box);
      line.top = Math.min(line.top, box.top);
      line.bottom = Math.max(line.bottom, box.bottom);
      line.left = Math.min(line.left, box.left);
      line.right = Math.max(line.right, box.right);
    } else {
      lines.push({ top: box.top, bottom: box.bottom, left: box.left, right: box.right, text: '', boxes: [box] });
    }
  }
  for (const line of lines) {
    line.boxes.sort((left, right) => left.left - right.left);
    line.text = line.boxes.map((box) => box.text).join(' ').replace(/\s{2,}/g, ' ').trim();
  }
  return lines.sort((left, right) => left.top - right.top);
}

/**
 * 세로로 비어 있는 띠를 찾아 단을 나눈다.
 *
 * 포스터는 `차시 | 내용`이 좌우로 두 벌 놓인 2단 표를 자주 쓴다.
 * 어느 줄에도 글자가 걸치지 않는 세로 구간이 충분히 넓으면 단 경계로 본다.
 */
/**
 * 머리글이 반복되는 위치에서 단 경계를 찾는다.
 *
 * 포스터의 2단 표는 머리글이 `차시 내용 차시 내용`처럼 되풀이된다.
 * 행마다 좌우 글자가 이어져 세로 빈 띠가 생기지 않으므로 빈 공간만으로는 단을 나눌 수 없다.
 * 되풀이되는 머리글의 가로 위치가 훨씬 확실한 근거다.
 */
export function columnBoundsFromHeader(lines: OcrLine[]): number[] | null {
  for (const line of lines) {
    const labels = line.boxes.filter((box) => /^(?:차시|회차|회기|시수)$/.test(box.text.replace(/\s+/g, '')));
    if (labels.length >= 2) return labels.slice(1).map((box) => box.left);
  }
  return null;
}

export function splitColumns(lines: OcrLine[], minGapRatio = 0.04): OcrColumn[] {
  const headerBounds = columnBoundsFromHeader(lines);
  if (headerBounds?.length) {
    const boxes = lines.flatMap((line) => line.boxes);
    const pageLeft = Math.min(...boxes.map((box) => box.left));
    const pageRight = Math.max(...boxes.map((box) => box.right));
    const bounds = [pageLeft, ...headerBounds, pageRight + 1];
    const columns: OcrColumn[] = [];
    for (let index = 0; index < bounds.length - 1; index += 1) {
      const columnBoxes = boxes.filter((box) => {
        const center = (box.left + box.right) / 2;
        return center >= bounds[index] && center < bounds[index + 1];
      });
      if (columnBoxes.length) columns.push({ left: bounds[index], right: bounds[index + 1], lines: groupLines(columnBoxes) });
    }
    if (columns.length > 1) return columns;
  }
  return splitColumnsByGap(lines, minGapRatio);
}

function splitColumnsByGap(lines: OcrLine[], minGapRatio: number): OcrColumn[] {
  const boxes = lines.flatMap((line) => line.boxes);
  if (boxes.length < 8) return [{ left: 0, right: Number.MAX_SAFE_INTEGER, lines }];

  const pageLeft = Math.min(...boxes.map((box) => box.left));
  const pageRight = Math.max(...boxes.map((box) => box.right));
  const width = pageRight - pageLeft;
  const minGap = Math.max(12, width * minGapRatio);

  const spans = [...boxes].map((box) => ({ left: box.left, right: box.right }))
    .sort((left, right) => left.left - right.left);
  const gaps: Array<{ from: number; to: number }> = [];
  let reach = spans[0].right;
  for (const span of spans.slice(1)) {
    if (span.left - reach >= minGap) gaps.push({ from: reach, to: span.left });
    reach = Math.max(reach, span.right);
  }
  if (!gaps.length) return [{ left: pageLeft, right: pageRight, lines }];

  const bounds = [pageLeft, ...gaps.flatMap((gap) => [(gap.from + gap.to) / 2]), pageRight];
  const columns: OcrColumn[] = [];
  for (let index = 0; index < bounds.length - 1; index += 1) {
    const left = bounds[index];
    const right = bounds[index + 1];
    const columnBoxes = boxes.filter((box) => (box.left + box.right) / 2 >= left && (box.left + box.right) / 2 < right);
    if (!columnBoxes.length) continue;
    columns.push({ left, right, lines: groupLines(columnBoxes) });
  }
  return columns.length ? columns : [{ left: pageLeft, right: pageRight, lines }];
}

export type OcrCurriculumRow = { session: number; activity: string };

/** 줄 맨 앞에 있는 회차 번호. `1`, `1회차`, `1차시` 모두 인정한다. */
function leadingSession(text: string) {
  const match = text.match(/^\s*(\d{1,2})\s*(?:회차|차시|주차|주)?\s*[.)]?\s+(.*)$/);
  if (!match) return null;
  const session = Number(match[1]);
  if (!Number.isSafeInteger(session) || session < 1 || session > 40) return null;
  return { session, rest: match[2].trim() };
}

/**
 * 한 단 안에서 회차 줄을 읽는다.
 *
 * 회차 번호로 시작하는 줄을 만나면 새 회차를 열고, 번호 없는 줄은 앞 회차에 이어 붙인다.
 * 번호만 홀로 있는 줄도 다음 줄들을 내용으로 받는다.
 */
export function curriculumFromColumn(lines: OcrLine[]): OcrCurriculumRow[] {
  const rows: OcrCurriculumRow[] = [];
  for (const line of lines) {
    const text = line.text.trim();
    if (!text) continue;
    const lead = leadingSession(text);
    if (lead) {
      rows.push({ session: lead.session, activity: lead.rest });
      continue;
    }
    if (rows.length) {
      const last = rows[rows.length - 1];
      last.activity = `${last.activity}${last.activity ? '\n' : ''}${text}`;
    }
  }
  return rows.filter((row) => row.activity.trim());
}

/** 포스터에서 값 뒤에 바로 따라붙는 다음 항목 이름. 여기서 값을 끊는다. */
const NEXT_LABEL = new RegExp('\\s*(?:'
  + '프로그램\\s*명|강\\s*좌\\s*명|강\\s*의\\s*명|목\\s*표|교육\\s*대상|대\\s*상'
  + '|교육\\s*기간|운영\\s*기간|교육\\s*일시|교육\\s*시간|교육\\s*장소|장\\s*소'
  + '|담당\\s*강사|강\\s*사|재료비|교재비|학습자\\s*준비물|준비물|강의실\\s*준비'
  + '|수\\s*강\\s*정\\s*보|준\\s*비\\s*사\\s*항|개\\s*요|모집\\s*인원|신청\\s*기간|신청\\s*방법'
  + ')\\s*[:：]?\\s*.*$');

/**
 * 포스터 라벨 값에서 뒤따라온 다음 항목을 잘라낸다.
 *
 * 문서는 표 칸이 값을 끊어주지만 포스터를 읽은 글은 한 줄로 이어져 온다.
 * `교육장소 = 북파크 작은도서관 재료비 10,000원 학습자`처럼 다음 항목이 값에 섞인다.
 */
export function trimAtNextLabel(value: string) {
  const trimmed = value.replace(NEXT_LABEL, '').trim();
  return trimmed || value.trim();
}

/** 계획서 이미지에서 기본정보 칸에 쓰이는 이름. 값은 이 이름 오른쪽 칸에 있다. */
const INFO_LABEL = /^(?:프로그램명|강좌명|강의명|목표|강의목표|프로그램소개|교육대상|대상|교육기간|운영기간|교육일시|교육시간|교육장소|장소|담당강사|강사|강사명|재료비|교재비|교재|학습자준비물|준비물|강의실준비|수강인원|모집인원|운영횟수)$/;

/**
 * 값을 끊기만 하고 기본정보로는 내보내지 않는 이름.
 *
 * 회차표 머리글과 구획 이름은 뒤에 오는 글자가 다른 칸의 값임을 알려 주지만,
 * 그 자체는 기본정보 항목이 아니다. 내보내면 회차 내용이 기본정보로 샌다.
 */
const BOUNDARY_LABEL = /^(?:차시|회차|회기|시수|세부교육내용|교육내용|교수방법|개요|수강정보|준비사항|비고)$/;

/**
 * 기본정보 칸을 위치로 읽는다.
 *
 * 평탄한 추출문은 읽기 순서가 표를 따라가지 않아 값이 엉뚱한 이름 뒤에 붙는다.
 * `교재비 / 강의실 준비 / 빔프로젝트, 스피커 / 없음`처럼 값이 두 칸 밀리기도 한다.
 * 좌표를 쓰면 `교재비`와 `없음`이 같은 행에 있다는 것을 알 수 있다.
 *
 * 한 행 안에서 이름을 만나면 그 오른쪽부터 다음 이름 직전까지가 값이고,
 * 이름 없이 이어지는 아랫줄은 같은 가로 자리에 있을 때만 값에 덧붙인다.
 */
export function labeledFromOcrBoxes(boxes: OcrTextBox[]): Array<{ label: string; value: string }> {
  const lines = groupLines(boxes);
  if (!lines.length) return [];

  const unit = median(boxes.map((box) => Math.max(1, box.bottom - box.top)));
  type Pair = { label: string; parts: string[]; valueLeft: number };
  const pairs: Pair[] = [];
  let open: Pair | null = null;

  for (const line of lines) {
    const cells = headerLabels(line);
    let current: Pair | null = null;
    for (const cell of cells) {
      if (INFO_LABEL.test(cell.text)) {
        current = { label: cell.text, parts: [], valueLeft: Number.MAX_SAFE_INTEGER };
        pairs.push(current);
        open = current;
        continue;
      }
      if (current) {
        current.parts.push(cell.raw);
        current.valueLeft = Math.min(current.valueLeft, cell.left);
        continue;
      }
      /**
       * 이름 없이 이어지는 줄은 앞 항목의 값이 여러 줄인 경우다.
       * 다만 가로 자리가 다르면 다른 칸의 값이므로 붙이지 않는다.
       * `교육장소` 값 아래에 `학습자 준비물` 값이 놓인 배치에서 잘못 붙는 것을 막는다.
       */
      if (open && Math.abs(cell.left - open.valueLeft) <= unit * 2) open.parts.push(cell.raw);
    }
  }

  /**
   * 값이 여러 줄인 칸은 이름이 세로 가운데 놓여, 값의 첫 줄이 이름보다 위에 오기도 한다.
   * 자기 줄에서 값을 못 찾은 이름은 바로 위·아래 줄에서 오른쪽 글자를 찾는다.
   */
  const lineCells = lines.map((line) => headerLabels(line));
  for (const [lineIndex, cells] of lineCells.entries()) {
    // 표 머리글 줄은 기본정보 행이 아니다. 아랫줄은 회차 내용이므로 값으로 끌어오지 않는다.
    if (cells.some((cell) => BOUNDARY_LABEL.test(cell.text))) continue;
    for (const cell of cells) {
      if (!INFO_LABEL.test(cell.text)) continue;
      const pair = pairs.find((candidate) => candidate.label === cell.text && !candidate.parts.length);
      if (!pair) continue;
      for (const neighbour of [lineCells[lineIndex - 1], lineCells[lineIndex + 1]]) {
        if (!neighbour || neighbour.some((other) => INFO_LABEL.test(other.text))) continue;
        for (const other of neighbour.filter((candidate) => candidate.left >= cell.right)) pair.parts.push(other.raw);
      }
    }
  }

  const result: Array<{ label: string; value: string }> = [];
  for (const pair of pairs) {
    const value = normalizeExtractedKoreanSpacing(pair.parts.join(' ').replace(/\s{2,}/g, ' ')).trim();
    if (value && !result.some((item) => item.label === pair.label)) result.push({ label: pair.label, value });
  }
  return result;
}

const SESSION_HEADER = /^(?:차시|회차|회기|시수)$/;
const CONTENT_HEADER = /^(?:내용|교육내용|세부교육내용|강의내용|활동|주제|동화명|도서명|프로그램명)$/;

/**
 * 머리글로 격자를 만들어 셀 단위로 회차를 읽는다.
 *
 * 포스터의 회차표는 차시 칸과 내용 칸이 세로로 나뉘어 있고, 차시 번호는 내용의
 * 제목 줄과 설명 줄 사이에 홀로 놓이기도 한다. 줄 단위로 읽으면 번호와 내용이
 * 어긋나므로, 머리글의 가로 위치로 칸 경계를 정한 뒤 세로 구간으로 행을 나눈다.
 */
type HeaderLabel = { text: string; raw: string; left: number; right: number };

/**
 * 머리글 줄의 글자 조각을 라벨 단위로 묶는다.
 *
 * OCR은 `세부 교육내용`을 `세부`·`교육내용` 두 조각으로 끊어 주기도 한다.
 * 조각 하나의 위치를 열 경계로 쓰면 칸 안의 실제 글자가 범위 밖으로 밀린다.
 * 글자 크기에 견줘 가까운 조각끼리 묶어야 한 칸의 머리글을 온전히 얻는다.
 */
function headerLabels(line: OcrLine): HeaderLabel[] {
  const heights = line.boxes.map((box) => Math.max(1, box.bottom - box.top));
  const gap = Math.max(8, median(heights) * 1.2);
  const groups: HeaderLabel[] = [];
  for (const box of [...line.boxes].sort((left, right) => left.left - right.left)) {
    const last = groups[groups.length - 1];
    if (last && box.left - last.right <= gap) {
      // 이름 판정에는 공백을 지운 형태를, 값에는 띄어쓰기를 살린 원문을 쓴다.
      last.text += box.text;
      last.raw += ` ${box.text}`;
      last.right = Math.max(last.right, box.right);
    } else {
      groups.push({ text: box.text, raw: box.text, left: box.left, right: box.right });
    }
  }
  return groups.map((group) => ({
    ...group,
    text: group.text.replace(/\s+/g, ''),
    raw: group.raw.replace(/\s{2,}/g, ' ').trim(),
  }));
}

/** `1`, `1회차`, `2차시` 어느 형태든 회차 번호를 읽는다. */
function sessionNumber(text: string) {
  const match = text.replace(/\s+/g, '').match(/^(\d{1,2})(?:회차|차시|회기|주차|주)?$/);
  if (!match) return null;
  const value = Number(match[1]);
  return value >= 1 && value <= 40 ? value : null;
}

export function curriculumFromHeaderGrid(lines: OcrLine[]): OcrCurriculumRow[] {
  const headerIndex = lines.findIndex((line) => {
    const labels = headerLabels(line);
    return labels.some((label) => SESSION_HEADER.test(label.text))
      && labels.some((label) => CONTENT_HEADER.test(label.text));
  });
  if (headerIndex < 0) return [];
  const headerLine = lines[headerIndex];
  const labels = headerLabels(headerLine);

  const sessionIndex = labels.findIndex((label) => SESSION_HEADER.test(label.text));
  const contentIndex = labels.findIndex((label, index) => index > sessionIndex && CONTENT_HEADER.test(label.text));
  if (sessionIndex < 0 || contentIndex < 0) return [];

  // 열 경계는 라벨 사이 중간점으로 잡는다. 라벨은 칸 가운데 놓이므로
  // 라벨의 좌우 끝을 그대로 쓰면 칸 안의 글자를 놓친다.
  const boundary = (index: number) => (index <= 0
    ? -Number.MAX_SAFE_INTEGER
    : (labels[index - 1].right + labels[index].left) / 2);
  const sessionLeft = boundary(sessionIndex);
  const sessionRight = boundary(sessionIndex + 1);
  const contentLeft = boundary(contentIndex);
  const contentRight = labels[contentIndex + 1] ? boundary(contentIndex + 1) : Number.MAX_SAFE_INTEGER;

  const body = lines.slice(headerIndex + 1).flatMap((line) => line.boxes);
  const inColumn = (box: OcrTextBox, left: number, right: number) => {
    const center = (box.left + box.right) / 2;
    return center >= left && center < right;
  };

  const numbers = body
    .filter((box) => inColumn(box, sessionLeft, Math.max(sessionRight, contentLeft)) && sessionNumber(box.text) != null)
    .sort((left, right) => left.top - right.top);
  if (numbers.length < 2) return [];

  /**
   * 내용 칸의 왼쪽 끝은 라벨 위치가 아니라 회차 번호의 오른쪽 끝에서 잡는다.
   * 라벨은 칸 가운데 놓이는데 회차 칸은 좁고 내용 칸은 넓어, 라벨 사이 중간점을
   * 쓰면 경계가 오른쪽으로 밀려 각 줄의 첫 낱말이 잘려 나간다.
   */
  const contentStart = Math.max(...numbers.map((box) => box.right)) + 2;
  const contentBoxes = body.filter((box) => box.left >= contentStart && inColumn(box, contentStart, contentRight));
  const rows: OcrCurriculumRow[] = [];
  for (const [index, number] of numbers.entries()) {
    // 회차 번호는 칸 가운데 놓이므로 번호 사이 중간을 행 경계로 삼는다.
    const bandTop = index === 0 ? headerLine.bottom : (numbers[index - 1].bottom + number.top) / 2;
    const bandBottom = index === numbers.length - 1
      ? Number.MAX_SAFE_INTEGER
      : (number.bottom + numbers[index + 1].top) / 2;
    const cell = contentBoxes.filter((box) => {
      const center = (box.top + box.bottom) / 2;
      return center >= bandTop && center < bandBottom;
    });
    const text = groupLines(cell).map((line) => line.text).filter(Boolean).join('\n').trim();
    if (text) rows.push({ session: sessionNumber(number.text)!, activity: text });
  }
  return rows;
}

/**
 * OCR 글자 위치에서 회차 목록을 복원한다.
 *
 * 머리글로 격자를 세울 수 있을 때만 복원한다. 머리글 없이 줄만 보고 읽으면
 * 여러 회차의 내용이 한 줄로 이어지거나 옆 단과 섞이는 것을 실제 포스터에서 확인했다.
 * 회차가 1부터 끊김 없이 이어질 때만 인정하며, 근거가 약하면 배치하지 않는다.
 */
export function curriculumFromOcrBoxes(boxes: OcrTextBox[]): OcrCurriculumRow[] {
  if (!boxes.length) return [];
  const rows = curriculumFromHeaderGrid(groupLines(boxes));
  if (rows.length < 2) return [];
  const sessions = rows.map((row) => row.session);
  if (new Set(sessions).size !== sessions.length) return [];
  const sorted = [...rows].sort((left, right) => left.session - right.session);
  const contiguous = sorted.every((row, index) => row.session === index + 1);
  return contiguous ? sorted : [];
}
