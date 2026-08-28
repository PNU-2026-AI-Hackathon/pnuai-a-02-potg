const assert = require('assert/strict');
const {
  buildAttachmentVerificationReport,
  runReadOnlyAttachmentVerification,
} = require('../dist/services/attachment/attachmentVerification');
const { parseVerificationArguments, safeVerificationError } = require('../dist/cli/verifyAttachmentExtractions');

function row(overrides = {}) {
  return {
    id: 'a-1', programCaseId: 'p-1', fileUrl: 'https://secret.example/a.pdf',
    fileType: 'pdf', detectedFileType: 'PDF', detectedMimeType: 'application/pdf',
    fileSizeBytes: 123, checksumSha256: 'secret-checksum', extractionStatus: 'COMPLETED',
    rawText: '개인정보 원문 '.repeat(20), cleanedText: '정제 본문 '.repeat(20),
    extractorType: 'PDFJS_TEXT', extractorVersion: '6.1', failureCode: null,
    failureMessage: null, attemptCount: 1, lastAttemptedAt: new Date('2026-07-20T00:00:00Z'),
    extractedAt: new Date('2026-07-20T00:01:00Z'), isActive: true, programExists: true,
    ...overrides,
  };
}

function testReportSafetyAndAggregation() {
  const report = buildAttachmentVerificationReport([
    row(),
    row({ id: 'a-2', programCaseId: 'p-2', fileUrl: 'https://secret.example/reused.pdf',
      checksumSha256: 'secret-checksum', extractionStatus: 'FAILED', rawText: null,
      cleanedText: null, extractorType: null, extractorVersion: null, failureCode: 'OCR_REQUIRED',
      failureMessage: 'private failure detail', extractedAt: null }),
  ], 3, 1, 0, new Date('2026-07-27T00:00:00Z'));
  assert.equal(report.totals.programCases, 3);
  assert.equal(report.totals.programCasesWithActiveAttachments, 2);
  assert.equal(report.statuses.COMPLETED, 1);
  assert.equal(report.statuses.FAILED, 1);
  assert.equal(report.duplicates.checksum[0].crossProgramReuse, true);
  const output = JSON.stringify(report);
  for (const secret of ['https://secret.example', 'secret-checksum', '개인정보 원문', '정제 본문', 'private failure detail']) {
    assert.equal(output.includes(secret), false);
  }
}

async function testReadOnlyTransaction() {
  const commands = [];
  const rows = [row()];
  const client = {
    async query(sql) {
      commands.push(sql.trim());
      if (sql.startsWith('SHOW')) return { rows: [{ transaction_read_only: 'on' }] };
      if (sql.includes('FROM "ProgramCaseAttachment"')) return { rows };
      if (sql.includes('FROM "ProgramCaseSession" s')) return { rows: [{ count: 0 }] };
      if (sql.includes('FROM "ProgramCaseSession"')) return { rows: [{ count: 1 }] };
      if (sql.includes('FROM "ProgramCase"')) return { rows: [{ count: 2 }] };
      return { rows: [] };
    },
  };
  await runReadOnlyAttachmentVerification(client, new Date('2026-07-27T00:00:00Z'));
  assert.equal(commands[0], 'BEGIN TRANSACTION READ ONLY');
  assert.equal(commands[1], 'SHOW transaction_read_only');
  assert.equal(commands.at(-1), 'ROLLBACK');
  assert.equal(commands.some((command) => /\b(UPDATE|INSERT|DELETE|UPSERT)\b/i.test(command)), false);
}

async function testRollbackOnFailure() {
  const commands = [];
  const client = {
    async query(sql) {
      commands.push(sql.trim());
      if (sql.startsWith('SHOW')) return { rows: [{ transaction_read_only: 'off' }] };
      return { rows: [] };
    },
  };
  await assert.rejects(() => runReadOnlyAttachmentVerification(client), /did not confirm/);
  assert.equal(commands.at(-1), 'ROLLBACK');
}

async function run() {
  assert.deepEqual(
    parseVerificationArguments(['--environment', 'production', '--as-of', '2026-07-27T00:00:00Z']),
    { environment: 'production', asOf: new Date('2026-07-27T00:00:00Z') },
  );
  assert.throws(() => parseVerificationArguments([]));
  assert.equal(
    safeVerificationError(new Error('connect EACCES sensitive-db-host:5432')),
    'Attachment verification failed before a safe report could be produced.',
  );
  testReportSafetyAndAggregation();
  await testReadOnlyTransaction();
  await testRollbackOnFailure();
  console.log('Read-only attachment verification tests passed.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
