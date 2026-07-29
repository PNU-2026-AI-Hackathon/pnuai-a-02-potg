const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { prisma } = require('../dist/lib/prisma');
const {
  syncProgramCaseDocumentChunksById,
} = require('../dist/services/programCaseDocumentChunk/programCaseDocumentChunkService');

async function main() {
  const sourcePostId = `program-chunk-test-${randomUUID()}`;
  const before = await Promise.all([
    prisma.programCase.count(),
    prisma.programCaseSession.count(),
    prisma.programCaseAttachment.count(),
    prisma.programCaseDocument.count(),
  ]);
  const program = await prisma.programCase.create({
    data: {
      sourceType: 'PROGRAM_CASE_CHUNK_TEST', sourcePostId,
      sourceUrl: 'https://example.invalid/chunk-test', title: '청크 통합 테스트',
      targetAudience: '테스트 대상', instructor: '테스트', capacity: 10,
      currentApplicants: 0, applicationStatus: '접수중',
      educationStartDate: new Date('2026-01-01'), educationEndDate: new Date('2026-01-02'),
      educationStartDateText: '2026-01-01', educationEndDateText: '2026-01-02',
      notices: '테스트 안내', rawText: '테스트 원본', hasUnparsedAttachments: false,
      crawledAt: new Date(), requestSucceeded: true, parseWarnings: [],
      sessions: { create: { sessionNumber: 1, dateText: '2026-01-01', activity: '테스트 활동', sortOrder: 0 } },
      attachments: {
        create: {
          fileName: '테스트.txt', fileUrl: `https://example.invalid/${sourcePostId}.txt`,
          fileType: 'txt', extractionStatus: 'COMPLETED', cleanedText: '테스트 첨부 원문',
          extractorType: 'TEXT_TEST',
        },
      },
      documents: {
        create: { documentType: 'SEARCH', content: '테스트 검색 문서', contentHash: 'fixture', version: '1' },
      },
    },
    include: { attachments: true, documents: true },
  });
  const document = program.documents[0];
  const attachment = program.attachments[0];
  try {
    const created = await syncProgramCaseDocumentChunksById(document.id);
    assert.equal(created.status, 'SUCCESS');
    assert.ok(created.created >= 3);
    const beforeRows = await prisma.programCaseDocumentChunk.findMany({
      where: { programCaseDocumentId: document.id },
      select: { id: true, updatedAt: true },
      orderBy: { chunkOrder: 'asc' },
    });
    const unchanged = await syncProgramCaseDocumentChunksById(document.id);
    assert.equal(unchanged.unchanged, created.total);
    const afterRows = await prisma.programCaseDocumentChunk.findMany({
      where: { programCaseDocumentId: document.id },
      select: { id: true, updatedAt: true },
      orderBy: { chunkOrder: 'asc' },
    });
    assert.deepEqual(afterRows, beforeRows);
    await prisma.programCaseAttachment.update({
      where: { id: attachment.id },
      data: { cleanedText: '변경된 테스트 첨부 원문' },
    });
    const updated = await syncProgramCaseDocumentChunksById(document.id);
    assert.equal(updated.updated, 1);
    await prisma.programCaseAttachment.update({ where: { id: attachment.id }, data: { isActive: false } });
    const removed = await syncProgramCaseDocumentChunksById(document.id);
    assert.equal(removed.deleted, 1);
    await prisma.programCaseDocument.delete({ where: { id: document.id } });
    assert.equal(await prisma.programCaseDocumentChunk.count({ where: { programCaseDocumentId: document.id } }), 0);
  } finally {
    await prisma.programCase.deleteMany({ where: { sourceType: 'PROGRAM_CASE_CHUNK_TEST', sourcePostId } });
  }
  const after = await Promise.all([
    prisma.programCase.count(),
    prisma.programCaseSession.count(),
    prisma.programCaseAttachment.count(),
    prisma.programCaseDocument.count(),
  ]);
  assert.deepEqual(after, before);
  console.log('Program case document chunk database tests passed.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
