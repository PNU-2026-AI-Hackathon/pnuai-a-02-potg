const assert = require('node:assert/strict');
const { prisma } = require('../dist/lib/prisma');
const { buildProgramCaseDocument } = require('../dist/services/programCaseDocument/programCaseDocumentBuilder');
const { createProgramCaseDocumentHash } = require('../dist/services/programCaseDocument/programCaseDocumentHash');
const {
  buildProgramCaseDocumentById,
  PROGRAM_CASE_DOCUMENT_TYPE,
  PROGRAM_CASE_DOCUMENT_VERSION,
} = require('../dist/services/programCaseDocument/programCaseDocumentService');

const cases = [
  { type: 'SESSION', id: '2a38d135-591f-4b39-bcbd-f348c11e60b8' },
  { type: 'JPEG_OCR', id: '46ef67b5-0aba-4ec1-bec7-6ae0fafc7d08' },
  { type: 'PDF_TEXT', id: '82fbfecd-cf11-4be6-b6f3-6bd59cc4b628' },
  { type: 'HWP', id: 'bc37538f-24c5-4205-9583-b64d074e4a42' },
  { type: 'PDF_OCR_MERGED', id: '322a6b0f-8d54-4382-8b11-73f857d9bd8f' },
];

async function sourceSnapshot(id) {
  return prisma.programCase.findUniqueOrThrow({
    where: { id },
    include: {
      sessions: { orderBy: [{ sortOrder: 'asc' }, { sessionNumber: 'asc' }, { id: 'asc' }] },
      attachments: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
    },
  });
}

async function main() {
  const before = new Map();
  for (const item of cases) before.set(item.id, JSON.stringify(await sourceSnapshot(item.id)));

  const firstResults = [];
  for (const item of cases) {
    firstResults.push({ type: item.type, ...(await buildProgramCaseDocumentById(item.id)) });
  }

  const beforeSecondRun = new Map();
  for (const item of cases) {
    const row = await prisma.programCaseDocument.findUniqueOrThrow({
      where: { programCaseId_documentType: { programCaseId: item.id, documentType: PROGRAM_CASE_DOCUMENT_TYPE } },
    });
    beforeSecondRun.set(item.id, row.updatedAt.getTime());
  }

  const secondResults = [];
  for (const item of cases) {
    secondResults.push({ type: item.type, ...(await buildProgramCaseDocumentById(item.id)) });
  }

  const verification = [];
  for (const item of cases) {
    const source = await sourceSnapshot(item.id);
    assert.equal(JSON.stringify(source), before.get(item.id));
    const eligibleAttachments = source.attachments.filter((attachment) =>
      attachment.isActive
      && attachment.extractionStatus === 'COMPLETED'
      && attachment.cleanedText?.trim());
    const content = buildProgramCaseDocument({
      program: source,
      sessions: source.sessions,
      attachments: eligibleAttachments,
    });
    const document = await prisma.programCaseDocument.findUniqueOrThrow({
      where: { programCaseId_documentType: { programCaseId: item.id, documentType: PROGRAM_CASE_DOCUMENT_TYPE } },
    });
    assert.equal(document.documentType, PROGRAM_CASE_DOCUMENT_TYPE);
    assert.equal(document.version, PROGRAM_CASE_DOCUMENT_VERSION);
    assert.equal(document.content, content);
    assert.equal(document.contentHash, createProgramCaseDocumentHash(content));
    assert.equal(document.updatedAt.getTime(), beforeSecondRun.get(item.id));
    assert.equal(await prisma.programCaseDocument.count({
      where: { programCaseId: item.id, documentType: PROGRAM_CASE_DOCUMENT_TYPE },
    }), 1);
    verification.push({
      type: item.type,
      programCaseId: item.id,
      title: source.title,
      contentLength: content.length,
      sessionCount: source.sessions.length,
      attachmentCount: eligibleAttachments.length,
      programNameMarkersInAttachments: eligibleAttachments.reduce(
        (count, attachment) => count + ((attachment.cleanedText ?? '').match(/프로그램명/g) ?? []).length,
        0,
      ),
    });
  }

  assert.ok(firstResults.every((result) => result.status === 'CREATED'));
  assert.ok(secondResults.every((result) => result.status === 'UNCHANGED'));
  console.log(JSON.stringify({
    firstResults: firstResults.map(({ type, programCaseId, status, contentHash, contentLength, warnings }) =>
      ({ type, programCaseId, status, contentHash, contentLength, warnings })),
    secondResults: secondResults.map(({ type, programCaseId, status }) => ({ type, programCaseId, status })),
    verification,
    sourceDataUnchanged: true,
    duplicateDocuments: 0,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
