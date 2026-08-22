const assert = require('node:assert/strict');
const { prisma } = require('../dist/lib/prisma');
const {
  syncProgramCaseDocumentChunksById,
} = require('../dist/services/programCaseDocumentChunk/programCaseDocumentChunkService');

async function firstUnused(where, used, orderBy) {
  const rows = await prisma.programCaseDocument.findMany({
    where: { documentType: 'SEARCH', ...where },
    select: { id: true, programCaseId: true, content: true, programCase: { select: { title: true } } },
    orderBy: orderBy ?? { id: 'asc' },
  });
  return rows.find((row) => !used.has(row.id)) ?? rows[0] ?? null;
}

async function main() {
  const used = new Set();
  const definitions = [
    ['SESSIONS', { programCase: { sessions: { some: {} } } }],
    ['JPEG_OCR', { programCase: { attachments: { some: { isActive: true, extractionStatus: 'COMPLETED', detectedFileType: 'JPEG' } } } }],
    ['PDF_TEXT', { programCase: { attachments: { some: { isActive: true, extractionStatus: 'COMPLETED', extractorType: 'PDFJS_TEXT' } } } }],
    ['HWP', { programCase: { attachments: { some: { isActive: true, extractionStatus: 'COMPLETED', extractorType: 'KORDOC_HWP' } } } }],
    ['PDF_OCR_MERGED', { programCase: { attachments: { some: { isActive: true, extractionStatus: 'COMPLETED', extractorType: 'PDFJS_TEXT_OCR_MERGED' } } } }],
    ['LONG_PDF', { programCase: { attachments: { some: { isActive: true, extractionStatus: 'COMPLETED', detectedFileType: 'PDF' } } } }],
    ['NO_ATTACHMENT', { programCase: { attachments: { none: { isActive: true, extractionStatus: 'COMPLETED', cleanedText: { not: null } } } } }],
  ];
  const selected = [];
  for (const [type, where] of definitions) {
    let row;
    if (type === 'LONG_PDF') {
      const candidates = await prisma.programCaseDocument.findMany({
        where: { documentType: 'SEARCH', ...where },
        select: { id: true, programCaseId: true, content: true, programCase: { select: { title: true } } },
      });
      row = candidates.filter((item) => !used.has(item.id)).sort((a, b) => b.content.length - a.content.length)[0]
        ?? candidates.sort((a, b) => b.content.length - a.content.length)[0];
    } else row = await firstUnused(where, used);
    assert.ok(row, `Missing representative: ${type}`);
    used.add(row.id);
    selected.push({ type, row });
  }
  const output = [];
  for (const { type, row } of selected) {
    const result = await syncProgramCaseDocumentChunksById(row.id);
    assert.equal(result.status, 'SUCCESS');
    const chunks = await prisma.programCaseDocumentChunk.findMany({
      where: { programCaseDocumentId: row.id },
      orderBy: { chunkOrder: 'asc' },
    });
    assert.equal(new Set(chunks.map((x) => x.chunkKey)).size, chunks.length);
    assert.deepEqual(chunks.map((x) => x.chunkOrder), chunks.map((_, i) => i));
    assert.ok(chunks.filter((x) => x.chunkType === 'ATTACHMENT').every((x) => x.content.length <= 2000));
    output.push({
      type, programCaseDocumentId: row.id, programCaseId: row.programCaseId,
      title: row.programCase.title, documentCharacters: row.content.length,
      totalChunks: chunks.length,
      core: chunks.filter((x) => x.chunkType === 'CORE').length,
      sessions: chunks.filter((x) => x.chunkType === 'SESSIONS').length,
      attachment: chunks.filter((x) => x.chunkType === 'ATTACHMENT').length,
      minCharacters: Math.min(...chunks.map((x) => x.content.length)),
      maxCharacters: Math.max(...chunks.map((x) => x.content.length)),
      maxAttachmentCharacters: Math.max(0, ...chunks.filter((x) => x.chunkType === 'ATTACHMENT').map((x) => x.content.length)),
      warningCount: result.warningCount,
    });
  }
  console.log(JSON.stringify(output, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
