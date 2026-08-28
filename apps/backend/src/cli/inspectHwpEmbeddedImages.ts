import fs from 'fs/promises';
import path from 'path';
import { parse, type IRBlock } from 'kordoc';
import { downloadAttachment } from '../services/attachment/attachmentDownloader';
import { runSubprocess } from '../services/attachment/subprocessRunner';

type ImageReference = { block: number; row: number; column: number; filename: string };

function collectImageReferences(blocks: IRBlock[]) {
  const references: ImageReference[] = [];
  blocks.forEach((block, blockIndex) => {
    if (block.type !== 'table' || !block.table) return;
    block.table.cells.forEach((row, rowIndex) => row.forEach((cell, columnIndex) => {
      for (const nested of cell.blocks ?? []) {
        if (nested.type === 'image' && nested.text) references.push({ block: blockIndex, row: rowIndex, column: columnIndex, filename: nested.text });
      }
      for (const match of cell.text.matchAll(/!\[image\]\(([^)]+)\)/g)) {
        if (!references.some((item) => item.block === blockIndex && item.row === rowIndex && item.column === columnIndex && item.filename === match[1])) {
          references.push({ block: blockIndex, row: rowIndex, column: columnIndex, filename: match[1] });
        }
      }
    }));
  });
  return references;
}

async function main() {
  const [url, sourceId = 'unknown'] = process.argv.slice(2);
  if (!url) throw new Error('사용법: inspectHwpEmbeddedImages <attachment-url> [source-id]');
  const outputDirectory = path.resolve(process.cwd(), '.local', 'program-attachment-enrichment', 'embedded-images', sourceId);
  const downloaded = await downloadAttachment(url);
  try {
    const parsed = await parse(await fs.readFile(downloaded.tempFilePath), { keepTrailingEmptyCols: true });
    if (!parsed.success) throw new Error(parsed.error);
    await fs.mkdir(outputDirectory, { recursive: true });
    for (const image of parsed.images ?? []) await fs.writeFile(path.join(outputDirectory, image.filename), image.data);
    const report = {
      sourceId: Number(sourceId),
      imageCount: parsed.images?.length ?? 0,
      images: (parsed.images ?? []).map((image) => ({ filename: image.filename, mimeType: image.mimeType, bytes: image.data.length })),
      references: collectImageReferences(parsed.blocks),
      tables: parsed.blocks.flatMap((block, blockIndex) => block.type === 'table' && block.table ? [{
        block: blockIndex,
        rows: block.table.cells.map((row, rowIndex) => ({ row: rowIndex, cells: row.map((cell, column) => ({ column, text: cell.text, blockTypes: cell.blocks?.map((nested) => nested.type) ?? [] })) })),
      }] : []),
      warnings: parsed.warnings ?? [],
    };
    const hwpJsRuntime = path.resolve(process.cwd(), '.local', 'hwp-tool-comparison', 'node-runtime');
    const adapter = path.resolve(process.cwd(), 'scripts', 'hwpjs-extract-adapter.js');
    let hwpJsText = '';
    try {
      const alternative = await runSubprocess({
        executable: process.execPath,
        args: [adapter, hwpJsRuntime, downloaded.tempFilePath],
        timeoutMs: 60_000,
        stdoutMaxBytes: 5 * 1024 * 1024,
        stderrMaxBytes: 64 * 1024,
      });
      const parsedAlternative = JSON.parse(alternative.stdout.toString('utf8')) as { text?: string };
      hwpJsText = parsedAlternative.text ?? '';
      await fs.writeFile(path.join(outputDirectory, 'hwpjs.txt'), hwpJsText, 'utf8');
    } catch { /* 대체 추출기는 선택적 진단 경로 */ }
    await fs.writeFile(path.join(outputDirectory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify({ outputDirectory, imageCount: report.imageCount, references: report.references, hwpJsCharacters: hwpJsText.length }, null, 2));
  } finally {
    await downloaded.cleanup();
  }
}

void main();
