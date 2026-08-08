const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { prisma } = require('../dist/lib/prisma');
const {
  buildProgramCaseDocumentById,
  PROGRAM_CASE_DOCUMENT_TYPE,
  PROGRAM_CASE_DOCUMENT_VERSION,
} = require('../dist/services/programCaseDocument/programCaseDocumentService');

async function main() {
  const sourcePostId = `program-document-test-${randomUUID()}`;
  const beforeCounts = await Promise.all([
    prisma.programCase.count(),
    prisma.programCaseSession.count(),
    prisma.programCaseAttachment.count(),
  ]);
  const program = await prisma.programCase.create({
    data: {
      sourceType: 'PROGRAM_CASE_DOCUMENT_TEST',
      sourcePostId,
      sourceUrl: 'https://example.invalid/program-document-test',
      title: '검색 문서 통합 테스트',
      targetAudience: '테스트 대상',
      instructor: '테스트 강사',
      capacity: 10,
      currentApplicants: 1,
      applicationStatus: '접수중',
      educationStartDate: new Date('2026-01-01T00:00:00.000Z'),
      educationEndDate: new Date('2026-01-02T00:00:00.000Z'),
      educationStartDateText: '2026-01-01',
      educationEndDateText: '2026-01-02',
      location: null,
      feeText: null,
      preparationText: null,
      contactText: null,
      notices: '테스트 안내',
      rawText: '테스트 원문 테스트 안내',
      hasUnparsedAttachments: false,
      crawledAt: new Date(),
      requestSucceeded: true,
      parseWarnings: [],
      sessions: {
        create: {
          sessionNumber: 1,
          sessionDate: new Date('2026-01-01T00:00:00.000Z'),
          dateText: '2026-01-01',
          activity: '테스트 활동',
          sortOrder: 0,
        },
      },
      attachments: {
        create: {
          fileName: '테스트.txt',
          fileUrl: 'https://example.invalid/program-document-test.txt',
          fileType: 'txt',
          detectedFileType: 'TXT',
          extractionStatus: 'COMPLETED',
          cleanedText: '테스트 첨부 본문',
          extractorType: 'TEXT_TEST',
        },
      },
    },
  });

  try {
    const created = await buildProgramCaseDocumentById(program.id);
    assert.equal(created.status, 'CREATED');
    assert.equal(created.version, PROGRAM_CASE_DOCUMENT_VERSION);
    assert.equal(created.documentType, PROGRAM_CASE_DOCUMENT_TYPE);

    const createdRow = await prisma.programCaseDocument.findUniqueOrThrow({
      where: { programCaseId_documentType: { programCaseId: program.id, documentType: PROGRAM_CASE_DOCUMENT_TYPE } },
    });
    await prisma.programCaseDocument.update({
      where: { id: createdRow.id },
      data: { version: '0', contentHash: 'stale' },
    });
    const updated = await buildProgramCaseDocumentById(program.id);
    assert.equal(updated.status, 'UPDATED');

    const beforeUnchanged = await prisma.programCaseDocument.findUniqueOrThrow({ where: { id: createdRow.id } });
    const unchanged = await buildProgramCaseDocumentById(program.id);
    assert.equal(unchanged.status, 'UNCHANGED');
    const afterUnchanged = await prisma.programCaseDocument.findUniqueOrThrow({ where: { id: createdRow.id } });
    assert.equal(afterUnchanged.updatedAt.getTime(), beforeUnchanged.updatedAt.getTime());
    assert.equal(await prisma.programCaseDocument.count({
      where: { programCaseId: program.id, documentType: PROGRAM_CASE_DOCUMENT_TYPE },
    }), 1);

    await prisma.programCase.delete({ where: { id: program.id } });
    assert.equal(await prisma.programCaseDocument.count({ where: { programCaseId: program.id } }), 0);
  } finally {
    await prisma.programCase.deleteMany({ where: { sourceType: 'PROGRAM_CASE_DOCUMENT_TEST', sourcePostId } });
  }

  const afterCounts = await Promise.all([
    prisma.programCase.count(),
    prisma.programCaseSession.count(),
    prisma.programCaseAttachment.count(),
  ]);
  assert.deepEqual(afterCounts, beforeCounts);
  console.log('Program case document database tests passed.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
