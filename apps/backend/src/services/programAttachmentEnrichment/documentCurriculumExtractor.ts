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

function cellAt(row: IRCell[], index: number) { return index >= 0 ? clean(row[index]?.text ?? '') : ''; }

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
  const firstNumberedRow = dataRows.find((row) => /^\d{1,2}(?:\s+\d{1,2}[./-]\d{1,2})?$/.test(cellAt(row, sessionColumn)));
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
    let sessionText = cellAt(row, sessionColumn);
    let combinedDate: string | null = null;
    const combined = sessionText.match(/^(\d{1,2})\s+(\d{1,2}[./-]\d{1,2})$/);
    if (combined) { sessionText = combined[1]; combinedDate = combined[2]; }
    let content = cellAt(row, contentColumn);
    if ((!sessionText || !/^\d{1,2}$/.test(sessionText)) && contentColumn >= 0) {
      const embedded = content.match(/^(\d{1,2})\s+([\s\S]+)/);
      if (embedded) { sessionText = embedded[1]; content = embedded[2]; }
    }
    if (!/^\d{1,2}$/.test(sessionText)) continue;
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

function labeledFromTables(blocks: IRBlock[]) {
  const labels = /^(?:프로그램명|강좌명|목표|프로그램소개|강의목표)$/;
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
