const assert = require('assert/strict');
const { prisma } = require('../dist/lib/prisma');
const { syncProgramCases } = require('../dist/services/programCaseSyncService');

const sourceType = 'TEST_ATTACHMENT_PRESERVATION';
const sourcePostId = `codex-${Date.now()}-${process.pid}`;
const firstUrl = 'https://example.com/attachments/preserved.jpg';
const secondUrl = 'https://example.com/attachments/new.pdf';

function program(overrides = {}) {
  return {
    sourceType,
    sourcePostId,
    sourceUrl: 'https://example.com/programs/attachment-preservation',
    title: '첨부파일 보존 테스트',
    targetAudience: '테스트 대상',
    instructor: '테스트 강사',
    capacity: 10,
    currentApplicants: 1,
    applicationStatus: 'TESTING',
    educationStartDate: new Date('2026-08-01T00:00:00.000Z'),
    educationEndDate: new Date('2026-08-02T00:00:00.000Z'),
    educationStartDateText: '2026-08-01',
    educationEndDateText: '2026-08-02',
    location: null,
    feeText: null,
    preparationText: null,
    contactText: null,
    notices: '',
    rawText: '',
    hasUnparsedAttachments: false,
    crawledAt: new Date('2026-07-20T00:00:00.000Z'),
    requestSucceeded: true,
    parseWarnings: [],
    sessions: [{
      sessionNumber: 1,
      sessionDate: new Date('2026-08-01T00:00:00.000Z'),
      dateText: '2026-08-01',
      activity: '테스트 활동',
      sortOrder: 0,
    }],
    attachments: [{
      fileName: '원본.jpg',
      fileUrl: firstUrl,
      fileType: 'jpg',
      extractionStatus: 'PENDING',
    }],
    ...overrides,
  };
}

const extractionSelect = {
  detectedFileType: true,
  detectedMimeType: true,
  fileSizeBytes: true,
  checksumSha256: true,
  extractionStatus: true,
  rawText: true,
  cleanedText: true,
  extractorType: true,
  extractorVersion: true,
  failureCode: true,
  failureMessage: true,
  attemptCount: true,
  lastAttemptedAt: true,
  extractedAt: true,
};

function extractionValues(row) {
  return Object.fromEntries(Object.keys(extractionSelect).map((key) => [key, row[key]]));
}

async function attachment(programCaseId, fileUrl) {
  return prisma.programCaseAttachment.findUniqueOrThrow({
    where: { programCaseId_fileUrl: { programCaseId, fileUrl } },
  });
}

async function expectSuccessfulSync(input) {
  const result = await syncProgramCases([input]);
  assert.equal(result.succeeded, 1);
  assert.equal(result.failed, 0);
  return result;
}

async function run() {
  let programCaseId;
  try {
    const createdResult = await expectSuccessfulSync(program());
    assert.equal(createdResult.created, 1);
    const savedProgram = await prisma.programCase.findUniqueOrThrow({
      where: { sourceType_sourcePostId: { sourceType, sourcePostId } },
    });
    programCaseId = savedProgram.id;

    const created = await attachment(programCaseId, firstUrl);
    assert.equal(created.extractionStatus, 'PENDING');
    assert.equal(created.attemptCount, 0);
    assert.equal(created.isActive, true);

    const lastAttemptedAt = new Date('2026-07-20T01:00:00.000Z');
    const extractedAt = new Date('2026-07-20T01:01:00.000Z');
    const seeded = await prisma.programCaseAttachment.update({
      where: { id: created.id },
      data: {
        detectedFileType: 'JPEG',
        detectedMimeType: 'image/jpeg',
        fileSizeBytes: 12345,
        checksumSha256: 'a'.repeat(64),
        extractionStatus: 'COMPLETED',
        rawText: '테스트 원문',
        cleanedText: '테스트 정제문',
        extractorType: 'CLOVA_OCR_GENERAL',
        extractorVersion: 'V2',
        attemptCount: 1,
        lastAttemptedAt,
        extractedAt,
      },
    });
    const expectedExtraction = extractionValues(seeded);

    await expectSuccessfulSync(program({ attachments: [{
      fileName: '변경된 이름.jpg', fileUrl: firstUrl, fileType: 'jpeg', extractionStatus: 'FAILED',
    }] }));
    const sameUrl = await attachment(programCaseId, firstUrl);
    assert.equal(sameUrl.id, created.id);
    assert.equal(sameUrl.fileName, '변경된 이름.jpg');
    assert.equal(sameUrl.fileType, 'jpeg');
    assert.equal(sameUrl.isActive, true);
    assert.deepEqual(extractionValues(sameUrl), expectedExtraction);

    await expectSuccessfulSync(program({ attachments: [] }));
    const removed = await attachment(programCaseId, firstUrl);
    assert.equal(removed.id, created.id);
    assert.equal(removed.isActive, false);
    assert.deepEqual(extractionValues(removed), expectedExtraction);

    await expectSuccessfulSync(program({ attachments: [{
      fileName: '재등장.jpg', fileUrl: firstUrl, fileType: 'jpg', extractionStatus: 'PENDING',
    }] }));
    const reappeared = await attachment(programCaseId, firstUrl);
    assert.equal(reappeared.id, created.id);
    assert.equal(reappeared.isActive, true);
    assert.deepEqual(extractionValues(reappeared), expectedExtraction);

    await expectSuccessfulSync(program({ attachments: [{
      fileName: '신규.pdf', fileUrl: secondUrl, fileType: 'pdf', extractionStatus: 'COMPLETED',
    }] }));
    const inactiveOld = await attachment(programCaseId, firstUrl);
    const newAttachment = await attachment(programCaseId, secondUrl);
    assert.equal(inactiveOld.isActive, false);
    assert.deepEqual(extractionValues(inactiveOld), expectedExtraction);
    assert.notEqual(newAttachment.id, created.id);
    assert.equal(newAttachment.extractionStatus, 'PENDING');
    assert.equal(newAttachment.attemptCount, 0);
    assert.equal(newAttachment.isActive, true);

    await expectSuccessfulSync(program({ attachments: [{
      fileName: '신규 이름 변경.pdf', fileUrl: secondUrl, fileType: 'PDF', extractionStatus: 'FAILED',
    }] }));
    const metadataChanged = await attachment(programCaseId, secondUrl);
    assert.equal(metadataChanged.id, newAttachment.id);
    assert.equal(metadataChanged.fileName, '신규 이름 변경.pdf');
    assert.equal(metadataChanged.fileType, 'PDF');
    assert.equal(metadataChanged.extractionStatus, 'PENDING');

    const beforeRollback = await prisma.programCase.findUniqueOrThrow({ where: { id: programCaseId } });
    const duplicateSession = program().sessions[0];
    const rollbackResult = await syncProgramCases([program({
      title: '롤백되면 안 남는 제목',
      sessions: [duplicateSession, { ...duplicateSession, sortOrder: 1 }],
      attachments: [],
    })]);
    assert.equal(rollbackResult.failed, 1);
    const afterRollback = await prisma.programCase.findUniqueOrThrow({ where: { id: programCaseId } });
    assert.equal(afterRollback.title, beforeRollback.title);
    const afterRollbackAttachment = await attachment(programCaseId, secondUrl);
    assert.equal(afterRollbackAttachment.isActive, true);
    assert.equal(afterRollbackAttachment.id, newAttachment.id);

    const allAttachments = await prisma.programCaseAttachment.findMany({
      select: { programCaseId: true, fileUrl: true },
    });
    const keys = allAttachments.map((row) => `${row.programCaseId}\u0000${row.fileUrl}`);
    assert.equal(new Set(keys).size, keys.length);

    console.log('Attachment preservation synchronization tests passed.');
  } finally {
    await prisma.programCase.deleteMany({ where: { sourceType, sourcePostId } });
    await prisma.$disconnect();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
