import fs from 'fs/promises';
import path from 'path';
import { parse, type IRBlock, type IRCell } from 'kordoc';

export type HwpEmbeddedCurriculumReference = {
  session: number;
  referenceBooks: string[];
  images: Array<{ filename: string; mimeType: string }>;
};

function imageNames(cell: IRCell) {
  const names = new Set<string>();
  for (const block of cell.blocks ?? []) if (block.type === 'image' && block.text) names.add(block.text);
  for (const match of cell.text.matchAll(/!\[image\]\(([^)]+)\)/g)) names.add(match[1]);
  return [...names];
}

function bookNames(value: string) {
  return value.replace(/!\[image\]\([^)]+\)/g, '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function findCurriculumReferences(blocks: IRBlock[], mimeByName: Map<string, string>) {
  const references: HwpEmbeddedCurriculumReference[] = [];
  for (const block of blocks) {
    if (block.type !== 'table' || !block.table) continue;
    const headerIndex = block.table.cells.findIndex((row) => row.some((cell) => /차시|회차/.test(cell.text)) && row.some((cell) => /참고\s*도서/.test(cell.text)));
    if (headerIndex < 0) continue;
    const header = block.table.cells[headerIndex];
    const referenceColumn = header.findIndex((cell) => /참고\s*도서/.test(cell.text));
    const imageColumn = header.findIndex((cell) => /비\s*고/.test(cell.text));
    for (const row of block.table.cells.slice(headerIndex + 1)) {
      const session = Number(row.find((cell) => /^\d{1,2}$/.test(cell.text.trim()))?.text);
      if (!Number.isSafeInteger(session)) continue;
      const imageCells = imageColumn >= 0 ? [row[imageColumn]] : row;
      const images = imageCells.flatMap((cell) => cell ? imageNames(cell) : []).map((filename) => ({ filename, mimeType: mimeByName.get(filename) ?? 'image/jpeg' }));
      references.push({ session, referenceBooks: referenceColumn >= 0 && row[referenceColumn] ? bookNames(row[referenceColumn].text) : [], images });
    }
  }
  return references;
}

export async function extractHwpEmbeddedContent(filePath: string, outputDirectory: string) {
  const parsed = await parse(await fs.readFile(filePath), { keepTrailingEmptyCols: true });
  if (!parsed.success) throw new Error(parsed.error);
  await fs.mkdir(outputDirectory, { recursive: true });
  const mimeByName = new Map((parsed.images ?? []).map((image) => [image.filename, image.mimeType]));
  for (const image of parsed.images ?? []) await fs.writeFile(path.join(outputDirectory, image.filename), image.data);
  return {
    imageCount: parsed.images?.length ?? 0,
    curriculumReferences: findCurriculumReferences(parsed.blocks, mimeByName),
  };
}
