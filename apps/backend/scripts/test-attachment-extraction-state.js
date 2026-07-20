const assert = require('assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createPdf } = require('./attachment-test-helpers');
const { prisma } = require('../dist/lib/prisma');
const { syncProgramCases } = require('../dist/services/programCaseSyncService');
const {
  processPdfAttachment,
  processSelectedPdfAttachments,
  runAttachmentExtraction,
} = require('../dist/services/attachment/attachmentExtractionService');

const sourceType = 'TEST_ATTACHMENT_EXTRACTION';
const sourcePostId = `codex-${Date.now()}-${process.pid}`;

function program() {
  return {
    sourceType,
    sourcePostId,
    sourceUrl: 'https://example.com/programs/attachment-extraction',
    title: '첨부파일 추출 상태 테스트',
    targetAudience: '테스트 대상',
    instructor: '테스트 강사',
    capacity: 1,
    currentApplicants: 0,
    applicationStatus: 'TESTING',
    educationStartDate: new Date('2026-08-01T00:00:00.000Z'),
    educationEndDate: new Date('2026-08-01T00:00:00.000Z'),
    educationStartDateText: '2026-08-01',
    educationEndDateText: '2026-08-01',
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
    sessions: [],
    attachments: [{
      fileName: 'success.pdf',
      fileUrl: 'https://files.example.test/success.pdf',
      fileType: 'pdf',
      extractionStatus: 'PENDING',
    }],
  };
}

async function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'moira-attachment-state-test-'));
  const sentence = 'Generated PDF text for attachment state transition testing. ';
  const rich = `${sentence.repeat(2)}\n${sentence.repeat(2)}`;
  const textPath = path.join(root, 'text.pdf');
  const ocrPath = path.join(root, 'ocr.pdf');
  const invalidPath = path.join(root, 'invalid.pdf');
  const nulPath = path.join(root, 'nul.pdf');
  createPdf(textPath, [rich]);
  createPdf(ocrPath, ['tiny']);
  createPdf(nulPath, [`${rich}\u0000storage safe tail`]);
  fs.writeFileSync(invalidPath, 'not a supported attachment');
  let cleanupCount = 0;
  let observedId = null;
  let expectedStatus = null;
  let retryWithText = false;

  const downloader = async (url) => {
    if (observedId) {
      const processing = await prisma.programCaseAttachment.findUniqueOrThrow({ where: { id: observedId } });
      assert.equal(processing.extractionStatus, expectedStatus);
      if (expectedStatus === 'PROCESSING') assert.equal(processing.failureCode, null);
    }
    const name = new URL(url).pathname.split('/').pop();
    const filePath = name === 'ocr.pdf' && !retryWithText
      ? ocrPath
      : name === 'bad.pdf'
        ? invalidPath
        : name === 'nul.pdf'
          ? nulPath
          : textPath;
    const content = fs.readFileSync(filePath);
    return {
      tempFilePath: filePath,
      byteSize: content.length,
      checksumSha256: crypto.createHash('sha256').update(content).digest('hex'),
      responseContentType: 'application/pdf',
      finalHost: 'files.example.test',
      cleanup: async () => { cleanupCount += 1; },
    };
  };
  const dependencies = { downloader, now: () => new Date('2026-07-20T03:00:00.000Z') };

  try {
    const synced = await syncProgramCases([program()]);
    assert.equal(synced.failed, 0);
    const savedProgram = await prisma.programCase.findUniqueOrThrow({
      where: { sourceType_sourcePostId: { sourceType, sourcePostId } },
    });
    const success = await prisma.programCaseAttachment.findUniqueOrThrow({
      where: { programCaseId_fileUrl: { programCaseId: savedProgram.id, fileUrl: 'https://files.example.test/success.pdf' } },
    });
    await prisma.programCaseAttachment.update({
      where: { id: success.id },
      data: { failureCode: 'OLD_FAILURE', failureMessage: 'old failure' },
    });
    observedId = success.id;
    expectedStatus = 'PROCESSING';
    const completed = await processPdfAttachment(
      await prisma.programCaseAttachment.findUniqueOrThrow({ where: { id: success.id } }),
      { dryRun: false, retryFailed: false },
      dependencies,
    );
    assert.equal(completed.outcome, 'COMPLETED');
    const completedRow = await prisma.programCaseAttachment.findUniqueOrThrow({ where: { id: success.id } });
    assert.equal(completedRow.extractionStatus, 'COMPLETED');
    assert.equal(completedRow.attemptCount, 1);
    assert.equal(completedRow.failureCode, null);
    assert.equal(completedRow.extractorType, 'PDFJS_TEXT');
    assert.ok(completedRow.rawText.includes('[Page 1]'));
    assert.ok(completedRow.cleanedText.length > 100);

    const nul = await prisma.programCaseAttachment.create({
      data: {
        programCaseId: savedProgram.id,
        fileName: 'nul.pdf',
        fileUrl: 'https://files.example.test/nul.pdf',
        fileType: 'pdf',
      },
    });
    observedId = nul.id;
    expectedStatus = 'PROCESSING';
    const nulResult = await processPdfAttachment(nul, { dryRun: false, retryFailed: false }, dependencies);
    assert.equal(nulResult.outcome, 'COMPLETED');
    const nulRow = await prisma.programCaseAttachment.findUniqueOrThrow({ where: { id: nul.id } });
    assert.equal(nulRow.extractionStatus, 'COMPLETED');
    assert.equal(nulRow.rawText.includes('\u0000'), false);

    const createAttachment = (name, data = {}) => prisma.programCaseAttachment.create({
      data: {
        programCaseId: savedProgram.id,
        fileName: name,
        fileUrl: `https://files.example.test/${name}`,
        fileType: 'pdf',
        ...data,
      },
    });

    const ocr = await createAttachment('ocr.pdf');
    observedId = ocr.id;
    expectedStatus = 'PROCESSING';
    const failed = await processPdfAttachment(ocr, { dryRun: false, retryFailed: false }, dependencies);
    assert.equal(failed.outcome, 'FAILED');
    assert.equal(failed.errorCode, 'OCR_REQUIRED');
    let failedRow = await prisma.programCaseAttachment.findUniqueOrThrow({ where: { id: ocr.id } });
    assert.equal(failedRow.extractionStatus, 'FAILED');
    assert.equal(failedRow.attemptCount, 1);
    assert.equal(failedRow.extractedAt, null);
    await assert.rejects(() => processPdfAttachment(failedRow, { dryRun: false, retryFailed: false }, dependencies));
    retryWithText = true;
    failedRow = await prisma.programCaseAttachment.findUniqueOrThrow({ where: { id: ocr.id } });
    const retried = await processPdfAttachment(failedRow, { dryRun: false, retryFailed: true }, dependencies);
    assert.equal(retried.outcome, 'COMPLETED');
    assert.equal((await prisma.programCaseAttachment.findUniqueOrThrow({ where: { id: ocr.id } })).attemptCount, 2);

    observedId = null;
    const inactive = await createAttachment('inactive.pdf', { isActive: false });
    const inactiveSelection = await runAttachmentExtraction({
      type: 'PDF', limit: 1, attachmentId: inactive.id, retryFailed: false, dryRun: false,
    }, dependencies);
    assert.equal(inactiveSelection.selected, 0);
    const completedSelection = await runAttachmentExtraction({
      type: 'PDF', limit: 1, attachmentId: success.id, retryFailed: false, dryRun: false,
    }, dependencies);
    assert.equal(completedSelection.selected, 0);

    const dry = await createAttachment('dry.pdf');
    const beforeDryRun = await prisma.programCaseAttachment.findUniqueOrThrow({ where: { id: dry.id } });
    observedId = dry.id;
    expectedStatus = 'PENDING';
    const dryResult = await processPdfAttachment(beforeDryRun, { dryRun: true, retryFailed: false }, dependencies);
    assert.equal(dryResult.outcome, 'COMPLETED');
    const afterDryRun = await prisma.programCaseAttachment.findUniqueOrThrow({ where: { id: dry.id } });
    assert.deepEqual(afterDryRun, beforeDryRun);

    observedId = null;
    const bad = await createAttachment('bad.pdf');
    const good = await createAttachment('good.pdf');
    const batch = await processSelectedPdfAttachments([bad, good], { dryRun: false, retryFailed: false }, dependencies);
    assert.equal(batch.selected, 2);
    assert.equal(batch.failed, 1);
    assert.equal(batch.completed, 1);
    assert.equal((await prisma.programCaseAttachment.findUniqueOrThrow({ where: { id: bad.id } })).extractionStatus, 'FAILED');
    assert.equal((await prisma.programCaseAttachment.findUniqueOrThrow({ where: { id: good.id } })).extractionStatus, 'COMPLETED');
    assert.ok(cleanupCount >= 5);

    console.log('Attachment extraction state transition and dry-run tests passed.');
  } finally {
    await prisma.programCase.deleteMany({ where: { sourceType, sourcePostId } });
    await prisma.$disconnect();
    fs.rmSync(root, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
