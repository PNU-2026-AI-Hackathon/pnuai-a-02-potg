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

/**
 * `※`로 시작하는 안내 문구를 떼어낸다.
 *
 * 표 아래에 별도 행으로 붙기도 하고, 마지막 회차의 비고 칸 안에 이어 적히기도 한다.
 * 어느 쪽이든 회차 내용이 아니라 프로그램 전체 안내이므로 이용 안내로 보낸다.
 */
export function splitNoticeMarks(text: string) {
  const notices = [...text.matchAll(/※\s*([^※\n]+)/g)].map((match) => match[1].trim()).filter(Boolean);
  return { text: text.replace(/※[^※\n]*/g, '').trim(), notices };
}

function cellAt(row: IRCell[], index: number) {
  return index >= 0 ? splitNoticeMarks(clean(row[index]?.text ?? '')).text : '';
}
function multilineCellAt(row: IRCell[], index: number) { return index >= 0 ? cleanMultiline(row[index]?.text ?? '') : ''; }

/**
 * 회차 칸의 단위 표기를 숫자만 남긴다. `1회차` → `1`, `1회차 8/9` → `1 8/9`.
 *
 * 대표 20건은 회차 칸이 `1`, `2`처럼 숫자뿐이었지만 `강의계획서(여름방학특강).pdf` 계열은
 * `1회차`로 적는다. 단위를 벗기지 않으면 모든 행이 걸러져 표가 통째로 사라진다.
 * 뒤따르는 날짜 결합(`1 8/9`) 처리를 그대로 태우기 위해 숫자 자리만 바꾼다.
 */
function stripSessionUnit(text: string) {
  return text.replace(/(\d{1,2})\s*(?:회차|차시|회기|주차|시수|주)/, '$1');
}

function curriculumFromTable(block: IRBlock): DocumentCurriculumRow[] {
  const table = block.table;
  if (!table) return [];
  // 계획서마다 쓰는 말이 달라 머리글 어휘는 데이터처럼 넓게 연다.
  // `시수`·`Period`는 영어 계획서 계열에서, `활동`·`Activity`는 교육내용 자리에서 쓴다.
  const SESSION_LABEL = /^(?:차시|회차|회기|주|주차|일|시수|period|week)(?:날짜)?$/i;
  const CONTENT_WORDS = /(?:교육내용|강의내용|수업계획|수업내용|세부교육내용|주제|활동|activity)/i;
  // 머리글에 붙은 부연 괄호는 떼고 본다. `차시(60분)`도 회차 열이다.
  const headerLabel = (cell: IRCell) => compact(cell.text).replace(/\((?:[^)]*)\)$/, '');
  /**
   * 머리글 행은 짧은 라벨로 이뤄진다.
   * 어휘만 보면 `- Activity: …` 같은 데이터 행이 머리글로 잡히므로 길이도 함께 본다.
   */
  const HEADER_LABEL_MAX = 20;
  /**
   * 회차 칸과 교육내용 칸이 한 칸으로 합쳐진 머리글이 있다(`차시 세부 교육내용`).
   * 이 경우 회차 번호는 칸 안의 줄 앞머리에 남으므로 같은 열을 회차·내용 열로 함께 쓴다.
   */
  const mergedHeaderCell = (cell: IRCell) => {
    const value = compact(cell.text);
    return value.length <= HEADER_LABEL_MAX * 2
      && /(?:차시|회차|회기)/.test(value) && CONTENT_WORDS.test(value);
  };
  const headerIndex = table.cells.findIndex((row) => row.some(mergedHeaderCell)
    || (row.some((cell) => SESSION_LABEL.test(headerLabel(cell)))
      && row.some((cell) => {
        const value = compact(cell.text);
        return value.length <= HEADER_LABEL_MAX && CONTENT_WORDS.test(value);
      })));
  const header = headerIndex >= 0 ? table.cells[headerIndex] : [];
  // `일`은 회차를 세는 열로 쓰이기도 한다(`일 | 일자 | 차시(60분)`).
  // 왼쪽부터 찾으므로 회차를 세는 바깥 열이 안쪽 `차시`보다 먼저 잡힌다.
  let sessionColumn = header.findIndex((cell) => SESSION_LABEL.test(headerLabel(cell)));
  let dateColumn = header.findIndex((cell) => /^(?:일자.*|날짜)$/.test(compact(cell.text)));
  const topicColumn = header.findIndex((cell) => /^주제$/.test(compact(cell.text)));
  const contentLabel = /(?:교육내용|강의내용|수업계획|수업내용|세부교육내용|내용|활동|activity)/i;
  // 머리글이 `교육내용 , 준비물`처럼 두 항목을 한 칸에 적은 표가 있다.
  // 끝이 정확히 맞는 열을 먼저 찾고, 없으면 포함하는 열로 물러선다.
  let contentColumn = header.findIndex((cell) => new RegExp(`${contentLabel.source}$`).test(compact(cell.text)));
  if (contentColumn < 0) contentColumn = header.findIndex((cell) => contentLabel.test(compact(cell.text)));
  // 합쳐진 머리글은 회차와 내용이 같은 열에 있다.
  const mergedIndex = header.findIndex(mergedHeaderCell);
  if (mergedIndex >= 0) { sessionColumn = mergedIndex; contentColumn = mergedIndex; }
  let noteColumn = header.findIndex((cell) => /(?:준비물|비고)$/.test(compact(cell.text)));
  let materialsColumn = header.findIndex((cell) => /^준비물$/.test(compact(cell.text)));
  let teachingMethodColumn = header.findIndex((cell) => /^교수방법(?:준비물)?$/.test(compact(cell.text)));
  let categoryColumn = dateColumn >= 0 && contentColumn - dateColumn > 1 ? dateColumn + 1 : -1;
  let dataRows = headerIndex >= 0 ? table.cells.slice(headerIndex + 1) : table.cells;
  // `Period | (빈 머리글) | Book | …` 처럼 회차 머리글 옆 칸에 실제 번호가 있는 표가 있다.
  // 지목한 열에 숫자가 하나도 없고 옆 칸에 있으면 옆 칸을 회차 열로 본다.
  if (sessionColumn >= 0) {
    const hasNumber = (index: number) => dataRows
      .some((row) => /^\d{1,2}$/.test(stripSessionUnit(cellAt(row, index))));
    if (!hasNumber(sessionColumn) && hasNumber(sessionColumn + 1)) sessionColumn += 1;
  }
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
    if (first) {
      sessionColumn = 0;
      dateColumn = 1;
      contentColumn = 2;
      noteColumn = first.length >= 4 ? 3 : -1;
      materialsColumn = noteColumn;
      teachingMethodColumn = -1;
      categoryColumn = -1;
    } else {
      // 회차 표가 다음 장으로 이어질 때 이어지는 표에는 머리글이 없다.
      // 열 개수도 앞 표와 다를 수 있어 열 번호를 물려받을 수 없으므로 구조로 추론한다.
      // 회차 번호가 있는 행을 찾고, 그 행에서 가장 긴 칸을 교육내용으로 본다.
      const numbered = dataRows.find((row) => row
        .some((cell, index) => index <= 1 && /^\d{1,2}$/.test(stripSessionUnit(clean(cell.text)))));
      if (!numbered) return [];
      sessionColumn = numbered.findIndex((cell, index) => index <= 1 && /^\d{1,2}$/.test(stripSessionUnit(clean(cell.text))));
      const texts = numbered.map((cell) => clean(cell.text));
      const longest = texts.reduce((best, text, index) => (index > sessionColumn && text.length > texts[best].length ? index : best), sessionColumn);
      if (longest === sessionColumn) return [];
      contentColumn = longest;
      dateColumn = texts.findIndex((text, index) => index > sessionColumn && index < contentColumn
        && /\d{1,2}\s*[월./-]\s*\d{1,2}/.test(text));
      noteColumn = texts.findIndex((text, index) => index > contentColumn && Boolean(text));
      materialsColumn = -1;
      teachingMethodColumn = -1;
      categoryColumn = -1;
    }
  }
  const rows: DocumentCurriculumRow[] = [];
  let inheritedCategory: string | null = null;
  for (const row of dataRows) {
    let sessionText = stripSessionUnit(cellAt(row, sessionColumn));
    let combinedDate: string | null = null;
    // `1 8/9` 처럼 회차와 날짜가 한 칸에 있는 경우
    const combined = sessionText.match(/^(\d{1,2})\s+(\d{1,2}[./-]\d{1,2})$/);
    if (combined) { sessionText = combined[1]; combinedDate = combined[2]; }
    // `1회차(9/20)` 처럼 날짜가 괄호로 붙은 경우. 단위를 벗기면 `1(9/20)`이 남는다.
    const parenthesized = sessionText.match(/^(\d{1,2})\s*\(\s*(\d{1,2}\s*[./-]\s*\d{1,2})\s*\)$/);
    if (parenthesized) { sessionText = parenthesized[1]; combinedDate = parenthesized[2].replace(/\s+/g, ''); }
    let content = multilineCellAt(row, contentColumn);
    if ((!sessionText || !/^\d{1,2}$/.test(sessionText)) && contentColumn >= 0) {
      const embedded = content.match(/^(\d{1,2})\s+([\s\S]+)/);
      if (embedded) { sessionText = embedded[1]; content = embedded[2]; }
      else {
        /**
         * 차시 칸과 교육내용 칸이 한 칸으로 합쳐진 표가 있다.
         * 이때 회차 번호는 칸 안 어느 줄의 앞머리에 홀로 남는다.
         * (`도서「김수한무…」` 다음 줄이 `1 ․ 나를 소개하기`)
         */
        const inLine = content.match(/(?:^|\n)\s*(\d{1,2})\s+(?=\S)/);
        if (inLine) {
          sessionText = inLine[1];
          content = content.replace(inLine[0], inLine[0].replace(/\d{1,2}\s+/, '')).trim();
        }
      }
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

/**
 * 기본정보도 계획서 표 안에 함께 있으므로 라벨 범위를 넓게 잡는다.
 *
 * 처음에는 제목·목표만 뽑았으나, 그러면 준비물·교재비·강의실 준비처럼
 * 표에 분명히 적힌 항목이 화면에 실리지 않는다. HWP·PDF 모두 같은 사전을 쓴다.
 */
const DOCUMENT_LABELS = new RegExp('^(?:'
  + '프로그램명|강좌명|강의명|목표|프로그램소개|강의목표'
  + '|교육대상|대상|교육기간|운영기간|교육일시|교육시간|운영횟수'
  + '|교육장소|담당강사|강사명|강사성명'
  + '|재료비|교재비|교재|준비물|학습자준비물|강의실준비'
  + '|수강인원|참여인원'
  + ')$');

function labeledFromTables(blocks: IRBlock[], labels: RegExp = DOCUMENT_LABELS) {
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
  const notices = [
    ...parsed.blocks.flatMap((block) => block.table?.cells ?? [])
      .flatMap((row) => row.map((cell) => clean(cell.text)))
      .filter((value) => /비대면.*(?:주제|내용).*(?:바뀔|변경)/.test(value)),
    ...noticeLinesFrom(parsed.blocks),
  ];
  return { curriculum, labeled: labeledFromTables(parsed.blocks), notices: [...new Set(notices)] };
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
  // 안내 문구는 표 아래 별도 행, 마지막 회차의 비고 칸, 표 바깥 문단 어디에나 올 수 있다.
  const texts = blocks.flatMap((block) => (block.table
    ? block.table.cells.flatMap((row) => row.map((cell) => cell.text ?? ''))
    : [(block as { text?: string }).text ?? '']));
  return [...new Set(texts
    .flatMap((text) => splitNoticeMarks(text.replace(/\s*\n\s*/g, ' ')).notices)
    .map((line) => normalizeExtractedKoreanSpacing(line).trim())
    .filter(Boolean))];
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
    // `※` 안내 문구는 프로그램 소개가 아니라 이용 안내로 가므로 자유문에 넣지 않는다.
    if (current && !isDocumentHeader(text) && !/^※/.test(text.trim())) current.lines.push(text);
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
    labeled: [...labeledFromTables(blocks, DOCUMENT_LABELS), ...freeTextSectionsFrom(blocks)],
    notices: [...new Set(noticeLinesFrom(blocks))],
  }));
}
