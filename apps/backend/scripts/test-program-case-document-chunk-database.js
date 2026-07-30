const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { prisma } = require('../dist/lib/prisma');
const { buildProgramCaseDocumentById } =
  require('../dist/services/programCaseDocument/programCaseDocumentService');
const { syncProgramCaseDocumentChunksById } =
  require('../dist/services/programCaseDocumentChunk/programCaseDocumentChunkService');
const { containsForbiddenProgramCaseSearchPattern } =
  require('../dist/services/programCaseDocument/programCaseDocumentSanitizer');

async function main() {
  const databaseName = await prisma.$queryRaw`SELECT current_database() AS name`;
  if (databaseName[0]?.name !== 'moira_pgvector_integration_test') {
    throw new Error('Integration test database guard failed.');
  }
  const sourcePostId = `program-chunk-test-${randomUUID()}`;
  const fakePhone = ['010', '0000', '0000'].join('-');
  const fakeEmail = ['privacy-test', 'example.invalid'].join('@');
  const before = await Promise.all([
    prisma.programCase.count(), prisma.programCaseSession.count(),
    prisma.programCaseAttachment.count(), prisma.programCaseDocument.count(),
  ]);
  const program = await prisma.programCase.create({
    data: {
      sourceType: 'PROGRAM_CASE_CHUNK_TEST', sourcePostId,
      sourceUrl: 'https://example.invalid/chunk-test',
      title: '개인정보 정제 통합 테스트', targetAudience: '전체',
      instructor: '테스트강사', contactText: fakePhone,
      capacity: 10, currentApplicants: 0, applicationStatus: 'TEST',
      educationStartDate: new Date('2026-01-01'),
      educationEndDate: new Date('2026-01-02'),
      educationStartDateText: '2026-01-01', educationEndDateText: '2026-01-02',
      notices: '공공시설 프로그램 안내',
      rawText: `프로그램 일정: 2026-01-01\n신청자 성명: 테스트이름 ${fakePhone}\n문의: ${fakeEmail}`,
      hasUnparsedAttachments: false, crawledAt: new Date(),
      requestSucceeded: true, parseWarnings: [],
      sessions: { create: { sessionNumber: 1, dateText: '2026-01-01', activity: '독서 활동', sortOrder: 0 } },
      attachments: {
        create: {
          fileName: '프로그램안내.txt',
          fileUrl: `https://example.invalid/${sourcePostId}.txt`,
          fileType: 'txt', extractionStatus: 'COMPLETED',
          cleanedText: `준비물 안내\n문의 ${fakePhone}`,
          extractorType: 'TEXT_TEST',
        },
      },
    },
    include: { attachments: true },
  });
  try {
    const built = await buildProgramCaseDocumentById(program.id);
    assert.equal(built.status, 'CREATED');
    const document = await prisma.programCaseDocument.findUniqueOrThrow({
      where: { programCaseId_documentType: { programCaseId: program.id, documentType: 'SEARCH' } },
    });
    assert.equal(document.version, '2');
    assert.equal(containsForbiddenProgramCaseSearchPattern(document.content), false);
    assert.equal(document.content.includes(fakePhone), false);
    assert.equal(document.content.includes(fakeEmail), false);
    assert.doesNotMatch(document.content, /테스트강사|테스트이름/);

    const created = await syncProgramCaseDocumentChunksById(document.id);
    assert.equal(created.status, 'SUCCESS');
    assert.ok(created.created >= 3);
    const chunks = await prisma.programCaseDocumentChunk.findMany({
      where: { programCaseDocumentId: document.id },
      select: { content: true, contentHash: true, builderVersion: true },
    });
    assert.equal(chunks.some((chunk) => containsForbiddenProgramCaseSearchPattern(chunk.content)), false);
    assert.equal(chunks.some((chunk) => chunk.content.includes(fakePhone) || chunk.content.includes(fakeEmail)), false);
    assert.ok(chunks.every((chunk) => chunk.builderVersion === 'program-case-chunk-v2'));

    const unchanged = await syncProgramCaseDocumentChunksById(document.id);
    assert.equal(unchanged.unchanged, created.total);
  } finally {
    await prisma.programCase.deleteMany({
      where: { sourceType: 'PROGRAM_CASE_CHUNK_TEST', sourcePostId },
    });
  }
  const after = await Promise.all([
    prisma.programCase.count(), prisma.programCaseSession.count(),
    prisma.programCaseAttachment.count(), prisma.programCaseDocument.count(),
  ]);
  assert.deepEqual(after, before);
  console.log(JSON.stringify({
    passed: true, database: 'moira_pgvector_integration_test',
    forbiddenDocumentPatterns: 0, forbiddenChunkPatterns: 0, fixtureRowsRemaining: 0,
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'integration test failed');
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
