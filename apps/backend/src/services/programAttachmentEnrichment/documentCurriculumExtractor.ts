import fs from 'fs/promises';
import path from 'path';
import { parse, type IRBlock, type IRCell } from 'kordoc';
import { normalizeActivityText, normalizeExtractedKoreanSpacing } from './sectionMatcher';

export type DocumentCurriculumRow = {
  session: number; date: string | null; content: string; note: string | null;
  category?: string | null; teachingMethod?: string | null; materials?: string | null;
  referenceImages?: Array<{ filename: string; mimeType: string }>;
};

function compact(value: string) { return value.replace(/\s+/g, ''); }
function clean(value: string) { return normalizeExtractedKoreanSpacing(value.replace(/\s*\n\s*/g, ' ')); }

/**
 * 셀 안의 줄바꿈을 살려서 정리한다.
 *
 * 원본 표의 활동 내용 칸은 `제목 / 설명 / 준비물` 처럼 줄로 나뉘어 있다.
 * 한 줄로 합치면 어디까지가 제목인지 알 수 없게 되므로 활동 내용에는 이 함수를 쓴다.
 */
function cleanMultiline(value: string) {
  return value.split(/\n/).map((line) => normalizeExtractedKoreanSpacing(line.trim()))
    .filter(Boolean).join('\n');
}

function cellAt(row: IRCell[], index: number) { return index >= 0 ? clean(row[index]?.text ?? '') : ''; }
function multilineCellAt(row: IRCell[], index: number) { return index >= 0 ? cleanMultiline(row[index]?.text ?? '') : ''; }

/**
 * 회차 칸의 단위 표기를 숫자만 남긴다. `1회차` → `1`, `1회차 8/9` → `1 8/9`.
 *
 * 대표 20건은 회차 칸이 `1`, `2`처럼 숫자뿐이었지만 `강의계획서(여름방학특강).pdf` 계열은
 * `1회차`로 적는다. 단위를 벗기지 않으면 모든 행이 걸러져 표가 통째로 사라진다.
 * 뒤따르는 날짜 결합(`1 8/9`) 처리를 그대로 태우기 위해 숫자 자리만 바꾼다.
 */
function stripSessionUnit(text: string) {
  return text.replace(/(\d{1,2})\s*(?:회차|차시|회기|주차)/, '$1');
}

function curriculumFromTable(block: IRBlock): DocumentCurriculumRow[] {
  const table = block.table;
  if (!table) return [];
  const headerIndex = table.cells.findIndex((row) => {
    const joined = row.map((cell) => compact(cell.text)).join('|');
    return /(?:차시|회차|회기|^주\|)/.test(joined) && /(?:교육내용|강의내용|수업계획|수업내용|세부교육내용|주제)/.test(joined);
  });
  const header = headerIndex >= 0 ? table.cells[headerIndex] : [];
  let sessionColumn = header.findIndex((cell) => /^(?:차시|회차|회기|주)(?:\(날짜\)|날짜)?$/.test(compact(cell.text)));
  let dateColumn = header.findIndex((cell) => /^(?:일자.*|날짜)$/.test(compact(cell.text)));
  const topicColumn = header.findIndex((cell) => /^주제$/.test(compact(cell.text)));
  let contentColumn = header.findIndex((cell) => /(?:교육내용|강의내용|수업계획|수업내용|세부교육내용|내용)$/.test(compact(cell.text)));
  let noteColumn = header.findIndex((cell) => /(?:준비물|비고)$/.test(compact(cell.text)));
  let materialsColumn = header.findIndex((cell) => /^준비물$/.test(compact(cell.text)));
  let teachingMethodColumn = header.findIndex((cell) => /^교수방법(?:준비물)?$/.test(compact(cell.text)));
  let categoryColumn = dateColumn >= 0 && contentColumn - dateColumn > 1 ? dateColumn + 1 : -1;
  let dataRows = headerIndex >= 0 ? table.cells.slice(headerIndex + 1) : table.cells;
  const firstNumberedRow = dataRows.find((row) => /^\d{1,2}(?:\s+\d{1,2}[./-]\d{1,2})?$/.test(stripSessionUnit(cellAt(row, sessionColumn))));
  if (headerIndex >= 0 && contentColumn >= 0 && firstNumberedRow?.[contentColumn]?.rowSpan && firstNumberedRow[contentColumn].rowSpan > 1) {
    const nextContent = firstNumberedRow.findIndex((cell, index) => index > contentColumn && Boolean(clean(cell.text)));
    if (nextContent > contentColumn) {
      categoryColumn = contentColumn;
      contentColumn = nextContent;
    }
  }
  if (headerIndex < 0) {
    const first = dataRows.find((row) => /^\d{1,2}$/.test(cellAt(row, 0)) && /^\d{1,2}[./-]\d{1,2}$/.test(cellAt(row, 1)));
    if (!first) return [];
    sessionColumn = 0;
    dateColumn = 1;
    contentColumn = 2;
    noteColumn = first.length >= 4 ? 3 : -1;
    materialsColumn = noteColumn;
    teachingMethodColumn = -1;
    categoryColumn = -1;
  }
  const rows: DocumentCurriculumRow[] = [];
  let inheritedCategory: string | null = null;
  for (const row of dataRows) {
    let sessionText = stripSessionUnit(cellAt(row, sessionColumn));
    let combinedDate: string | null = null;
    const combined = sessionText.match(/^(\d{1,2})\s+(\d{1,2}[./-]\d{1,2})$/);
    if (combined) { sessionText = combined[1]; combinedDate = combined[2]; }
    let content = multilineCellAt(row, contentColumn);
    if ((!sessionText || !/^\d{1,2}$/.test(sessionText)) && contentColumn >= 0) {
      const embedded = content.match(/^(\d{1,2})\s+([\s\S]+)/);
      if (embedded) { sessionText = embedded[1]; content = embedded[2]; }
    }
    if (!/^\d{1,2}$/.test(sessionText)) {
      // 회차 칸이 비고 내용만 있는 행은 앞 회차가 이어지는 줄이다.
      // 표 아래에 덧붙인 `※` 주의사항은 회차 내용이 아니므로 제외한다.
      const continuation = rows.length && !sessionText && content && !/^※/.test(content)
        && !/^※/.test(cellAt(row, 0));
      if (continuation) {
        const previous = rows[rows.length - 1];
        previous.content = normalizeActivityText([previous.content, content].filter(Boolean).join('\n'));
      }
      continue;
    }
    const topic = cellAt(row, topicColumn);
    const category = cellAt(row, categoryColumn) || inheritedCategory;
    if (cellAt(row, categoryColumn)) inheritedCategory = cellAt(row, categoryColumn);
    const materials = cellAt(row, materialsColumn);
    const teachingMethod = cellAt(row, teachingMethodColumn);
    const note = noteColumn >= 0 && noteColumn !== materialsColumn && noteColumn !== teachingMethodColumn ? cellAt(row, noteColumn) : '';
    rows.push({
      session: Number(sessionText),
      date: combinedDate || cellAt(row, dateColumn) || null,
      content: normalizeActivityText([topic, content].filter(Boolean).join('\n')),
      note: note || null,
      category: category || null,
      teachingMethod: teachingMethod || null,
      materials: materials || null,
    });
  }
  return rows;
}

const PDF_LABELS = /^(?:프로그램명|강좌명|목표|프로그램소개|강의목표)$/;

/**
 * HWP는 기본정보도 같은 표 안에 있으므로 라벨 범위를 넓게 잡는다.
 * 평탄화 텍스트 경로가 라벨 사전으로 뽑던 항목을 표 셀에서 그대로 얻기 위한 것이다.
 */
const HWP_LABELS = new RegExp('^(?:'
  + '프로그램명|강좌명|강의명|목표|프로그램소개|강의목표'
  + '|교육대상|대상|교육기간|운영기간|교육일시|교육시간|운영횟수'
  + '|교육장소|담당강사|강사명|강사성명'
  + '|재료비|교재비|교재|준비물|학습자준비물|강의실준비'
  + '|수강인원|참여인원'
  + ')$');

function labeledFromTables(blocks: IRBlock[], labels: RegExp = PDF_LABELS) {
  const result: Array<{ label: string; value: string }> = [];
  for (const block of blocks) for (const row of block.table?.cells ?? []) {
    for (let index = 0; index < row.length; index += 1) {
      const label = compact(row[index].text);
      if (!labels.test(label)) continue;
      const value = row.slice(index + 1).map((cell) => clean(cell.text)).find(Boolean);
      if (value && !result.some((item) => item.label === label && item.value === value)) result.push({ label, value });
    }
    const supplemental = row.map((cell) => clean(cell.text)).find((value) => /sub-books\s*:/i.test(value));
    if (supplemental) result.push({ label: '참고자료', value: supplemental.replace(/^\(?참고\)?\s*/i, '') });
  }
  return result;
}

export async function extractDocumentStructure(filePath: string, pages: number[], imageOutputDir?: string) {
  const parsed = await parse(await fs.readFile(filePath), { pages, keepTrailingEmptyCols: true });
  if (!parsed.success) throw new Error(parsed.error);
  const curriculum = parsed.blocks.flatMap(curriculumFromTable).sort((left, right) => left.session - right.session);
  const images = parsed.images ?? [];
  if (imageOutputDir && images.length === curriculum.length) {
    await fs.mkdir(imageOutputDir, { recursive: true });
    for (let index = 0; index < images.length; index += 1) {
      const filename = `pdf_${String(curriculum[index].session).padStart(2, '0')}.png`;
      await fs.writeFile(path.join(imageOutputDir, filename), Buffer.from(images[index].data));
      curriculum[index].referenceImages = [{ filename, mimeType: images[index].mimeType }];
    }
  }
  const notices = parsed.blocks.flatMap((block) => block.table?.cells ?? [])
    .flatMap((row) => row.map((cell) => clean(cell.text)))
    .filter((value) => /비대면.*(?:주제|내용).*(?:바뀔|변경)/.test(value));
  return { curriculum, labeled: labeledFromTables(parsed.blocks), notices };
}

export async function extractDocumentCurriculum(filePath: string, pages: number[]) {
  return (await extractDocumentStructure(filePath, pages)).curriculum;
}

/** 문서 전체 머리말. 프로그램 구간이 아니라 매 장 반복되는 양식 제목이다. */
function isDocumentHeader(text: string) {
  const value = text.replace(/\s+/g, ' ').trim();
  return value.length <= 40 && /(?:작은도서관|강의\s*계획서)$/.test(value) && !/프로그램\s*명/.test(value);
}

function tableHasProgramName(block: IRBlock) {
  return (block.table?.cells ?? []).some((row) => row
    .some((cell) => /^(?:프로그램\s*명|강\s*좌\s*명|강\s*의\s*명)$/.test(compact(cell.text))));
}

function blockText(block: IRBlock) {
  if (block.table) {
    return (block.table.cells ?? []).map((row) => row.map((cell) => clean(cell.text)).filter(Boolean).join(' | ')).join('\n');
  }
  return clean((block as { text?: string }).text ?? '');
}

/**
 * 표 아래에 덧붙은 주의사항 행. 회차 비고가 아니라 프로그램 전체 안내다.
 *
 * `※`로 시작하고 회차 번호가 없는 행이 여기 해당한다.
 * 한 셀 안에 여러 줄로 적혀 있으면 줄 단위로 나눈다.
 */
function noticeLinesFrom(blocks: IRBlock[]) {
  return blocks.flatMap((block) => block.table?.cells ?? [])
    .filter((row) => !/^\d{1,2}$/.test(stripSessionUnit(cellAt(row, 0))))
    .flatMap((row) => row.map((cell) => cell.text ?? ''))
    .flatMap((text) => text.split(/\n/))
    .map((line) => normalizeExtractedKoreanSpacing(line.trim()))
    .filter((line) => /^※/.test(line))
    .map((line) => line.replace(/^※\s*/, ''));
}

/**
 * 번호가 붙은 자유문 구획. `1. 강의 개요` 처럼 표가 아니라 문단으로 적힌 계획서에서 쓴다.
 *
 * 제목 줄 다음에 오는 문단들을 그 제목의 값으로 묶는다.
 */
function freeTextSectionsFrom(blocks: IRBlock[]) {
  const result: Array<{ label: string; value: string }> = [];
  let current: { label: string; lines: string[] } | null = null;
  for (const block of blocks) {
    if (block.table) { continue; }
    const text = blockText(block);
    if (!text) continue;
    const heading = text.match(/^#*\s*(\d+)\s*\.\s*(.{2,40})$/);
    if (heading) {
      if (current?.lines.length) result.push({ label: current.label, value: current.lines.join('\n') });
      current = { label: heading[2].trim(), lines: [] };
      continue;
    }
    if (current && !isDocumentHeader(text)) current.lines.push(text);
  }
  if (current?.lines.length) result.push({ label: current.label, value: current.lines.join('\n') });
  return result;
}

export type HwpProgramSection = {
  index: number;
  text: string;
  curriculum: DocumentCurriculumRow[];
  labeled: Array<{ label: string; value: string }>;
  notices: string[];
};

/**
 * HWP를 표 셀 구조 기준으로 프로그램 구간마다 나눠 읽는다.
 *
 * 평탄화된 텍스트는 셀 안의 줄바꿈과 `<도서명>` 표기를 잃고 열 경계도 추측해야 한다.
 * PDF에 이미 적용한 "원본 표 셀 구조 우선" 규칙을 HWP에도 그대로 쓴다.
 * 한 파일에 여러 프로그램이 있으면 프로그램명 표마다 구간이 하나씩 생긴다.
 */
export async function extractHwpProgramSections(filePath: string): Promise<HwpProgramSection[]> {
  const parsed = await parse(await fs.readFile(filePath), { keepTrailingEmptyCols: true });
  if (!parsed.success) throw new Error(parsed.error);

  const groups: IRBlock[][] = [];
  let current: IRBlock[] | null = null;
  for (const block of parsed.blocks) {
    const header = !block.table && isDocumentHeader(blockText(block));
    if ((header || tableHasProgramName(block)) && current?.length) current = null;
    if (header) continue;
    if (!current) { current = []; groups.push(current); }
    current.push(block);
  }

  return groups.map((blocks, index) => ({
    index: index + 1,
    text: blocks.map(blockText).filter(Boolean).join('\n\n'),
    curriculum: blocks.flatMap(curriculumFromTable).sort((left, right) => left.session - right.session),
    labeled: [...labeledFromTables(blocks, HWP_LABELS), ...freeTextSectionsFrom(blocks)],
    notices: [...new Set(noticeLinesFrom(blocks))],
  }));
}
