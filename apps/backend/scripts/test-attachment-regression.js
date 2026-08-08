const assert = require('assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { prisma } = require('../dist/lib/prisma');
const { syncProgramCases } = require('../dist/services/programCaseSyncService');
const { validateProgramCaseSyncRequest } = require('../dist/validators/programCaseSync');

const sourceType = 'TEST_ATTACHMENT_REGRESSION';
const sourcePostId = `codex-${Date.now()}-${process.pid}`;
const fileUrl = 'https://example.com/attachments/regression.pdf';

function testProgram() {
  return {
    sourceType,
    sourcePostId,
    sourceUrl: 'https://example.com/programs/attachment-regression',
    title: '첨부파일 전체 회귀 테스트',
    targetAudience: '테스트 대상',
    instructor: '테스트 강사',
    capacity: 1,
    currentApplicants: 0,
    applicationStatus: 'TESTING',
    educationStartDate: '2026-08-01',
    educationEndDate: '2026-08-01',
    location: null,
    feeText: null,
    preparationText: null,
    contactText: null,
    notices: '',
    sessions: [],
    attachments: [{ fileName: '회귀.pdf', fileUrl, fileType: 'pdf', extractionStatus: 'PENDING' }],
    hasUnparsedAttachments: false,
    rawText: '',
    crawledAt: '2026-07-20T00:00:00.000Z',
    requestSucceeded: true,
    parseWarnings: [],
  };
}

function validate(rawPrograms) {
  const result = validateProgramCaseSyncRequest(rawPrograms);
  assert.equal(result.ok, true, result.ok ? '' : JSON.stringify(result.issues.slice(0, 5)));
  return result.programs;
}

function digest(ids) {
  return crypto.createHash('sha256').update([...ids].sort().join('\n')).digest('hex');
}

function assertNoDuplicates(rows, fields) {
  const keys = rows.map((row) => fields.map((field) => row[field]).join('\u0000'));
  assert.equal(new Set(keys).size, keys.length);
}

async function run() {
  const dataPath = path.resolve('../../automation/n8n/data/geumjeong-programs-349.json');
  const rawPrograms = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  assert.equal(rawPrograms.length, 349);
  const programs = validate(rawPrograms);
  const [typedTestProgram] = validate([testProgram()]);

  const beforeIds = await prisma.programCaseAttachment.findMany({ select: { id: true } });
  assert.equal(beforeIds.length, 237);
  const beforeDigest = digest(beforeIds.map((row) => row.id));

  try {
    const created = await syncProgramCases([typedTestProgram]);
    assert.equal(created.failed, 0);
    const testCase = await prisma.programCase.findUniqueOrThrow({
      where: { sourceType_sourcePostId: { sourceType, sourcePostId } },
    });
    const testAttachment = await prisma.programCaseAttachment.findUniqueOrThrow({
      where: { programCaseId_fileUrl: { programCaseId: testCase.id, fileUrl } },
    });
    const extractedAt = new Date('2026-07-20T02:00:00.000Z');
    await prisma.programCaseAttachment.update({
      where: { id: testAttachment.id },
      data: {
        extractionStatus: 'COMPLETED',
        rawText: '전체 회귀 테스트 원문',
        cleanedText: '전체 회귀 테스트 정제문',
        checksumSha256: 'b'.repeat(64),
        extractorType: 'TEST',
        extractorVersion: '1.0',
        attemptCount: 1,
        extractedAt,
      },
    });

    const result = await syncProgramCases([...programs, typedTestProgram]);
    assert.equal(result.total, 350);
    assert.equal(result.succeeded, 350);
    assert.equal(result.failed, 0);

    const preserved = await prisma.programCaseAttachment.findUniqueOrThrow({ where: { id: testAttachment.id } });
    assert.equal(preserved.extractionStatus, 'COMPLETED');
    assert.equal(preserved.rawText, '전체 회귀 테스트 원문');
    assert.equal(preserved.cleanedText, '전체 회귀 테스트 정제문');
    assert.equal(preserved.checksumSha256, 'b'.repeat(64));
    assert.equal(preserved.extractorType, 'TEST');
    assert.equal(preserved.extractorVersion, '1.0');
    assert.equal(preserved.attemptCount, 1);
    assert.deepEqual(preserved.extractedAt, extractedAt);
  } finally {
    await prisma.programCase.deleteMany({ where: { sourceType, sourcePostId } });
  }

  const [programCount, sessionCount, attachmentCount, activeAttachmentCount] = await Promise.all([
    prisma.programCase.count(),
    prisma.programCaseSession.count(),
    prisma.programCaseAttachment.count(),
    prisma.programCaseAttachment.count({ where: { isActive: true } }),
  ]);
  assert.equal(programCount, 349);
  assert.equal(sessionCount, 20);
  assert.equal(attachmentCount, 237);
  assert.equal(activeAttachmentCount, 237);

  const [allPrograms, allSessions, allAttachments] = await Promise.all([
    prisma.programCase.findMany({ select: { sourceType: true, sourcePostId: true } }),
    prisma.programCaseSession.findMany({ select: { programCaseId: true, sessionNumber: true } }),
    prisma.programCaseAttachment.findMany({ select: { id: true, programCaseId: true, fileUrl: true } }),
  ]);
  assertNoDuplicates(allPrograms, ['sourceType', 'sourcePostId']);
  assertNoDuplicates(allSessions, ['programCaseId', 'sessionNumber']);
  assertNoDuplicates(allAttachments, ['programCaseId', 'fileUrl']);
  assert.equal(digest(allAttachments.map((row) => row.id)), beforeDigest);

  await prisma.$disconnect();
  console.log('Attachment full-data regression tests passed (349/20/237 preserved).');
}

run().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
