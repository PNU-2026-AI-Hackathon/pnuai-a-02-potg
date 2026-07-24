const assert = require('assert/strict');
const { parseRecoveryArguments } = require('../dist/cli/recoverAttachmentExtractions');
const { runAttachmentRecovery } = require('../dist/services/attachment/attachmentRecoveryService');

const id = '123e4567-e89b-42d3-a456-426614174000';
const now = new Date('2026-01-01T12:00:00Z');
const base = {
  id, programCaseId: id, fileName: 'fixture.pdf', fileUrl: 'https://fixture.invalid/file.pdf',
  fileType: 'pdf', detectedFileType: 'PDF', detectedMimeType: 'application/pdf', fileSizeBytes: 1,
  checksumSha256: 'a'.repeat(64), extractionStatus: 'PROCESSING', rawText: 'fixture',
  cleanedText: 'fixture', extractorType: 'PDFJS_TEXT_PARTIAL', extractorVersion: 'mock',
  failureCode: null, failureMessage: null, attemptCount: 2,
  lastAttemptedAt: new Date('2026-01-01T10:00:00Z'), extractedAt: new Date('2026-01-01T09:00:00Z'),
  isActive: true, createdAt: new Date('2026-01-01T08:00:00Z'), updatedAt: new Date('2026-01-01T10:00:00Z'),
};
const snapshot = { attachments: 8 };

function testParser() {
  assert.deepEqual(parseRecoveryArguments(['--type', 'PDF_OCR', '--mixed-only', '--plan']), {
    type: 'PDF_OCR', mixedOnly: true, staleAfterMinutes: 60, limit: 20, mode: 'plan',
  });
  assert.equal(parseRecoveryArguments([
    '--type', 'PDF_OCR', '--mixed-only', '--stale-after-minutes', '15', '--limit', '100', '--apply',
  ]).mode, 'apply');
  for (const args of [
    [], ['--type', 'IMAGE', '--mixed-only', '--plan'], ['--type', 'PDF_OCR', '--plan'],
    ['--type', 'PDF_OCR', '--mixed-only'], ['--type', 'PDF_OCR', '--mixed-only', '--plan', '--apply'],
    ['--type', 'PDF_OCR', '--mixed-only', '--stale-after-minutes', '14', '--plan'],
    ['--type', 'PDF_OCR', '--mixed-only', '--stale-after-minutes', '1441', '--plan'],
    ['--type', 'PDF_OCR', '--mixed-only', '--stale-after-minutes', '1.5', '--plan'],
    ['--type', 'PDF_OCR', '--mixed-only', '--limit', '0', '--plan'],
    ['--type', 'PDF_OCR', '--mixed-only', '--limit', '101', '--plan'],
    ['--type', 'PDF_OCR', '--mixed-only', '--attachment-id', 'bad', '--plan'],
    ['--type', 'PDF_OCR', '--mixed-only', '--plan', '--plan'],
    ['--type', 'PDF_OCR', '--mixed-only', '--unknown', '--plan'],
  ]) assert.throws(() => parseRecoveryArguments(args));
}

async function testRecovery() {
  const rows = [
    base,
    { ...base, id: '223e4567-e89b-42d3-a456-426614174000', lastAttemptedAt: new Date('2026-01-01T11:55:00Z') },
    { ...base, id: '323e4567-e89b-42d3-a456-426614174000', rawText: null },
    { ...base, id: '423e4567-e89b-42d3-a456-426614174000', cleanedText: null },
    { ...base, id: '523e4567-e89b-42d3-a456-426614174000', extractorType: 'CLOVA_OCR_GENERAL' },
    { ...base, id: '623e4567-e89b-42d3-a456-426614174000', isActive: false },
    { ...base, id: '723e4567-e89b-42d3-a456-426614174000', lastAttemptedAt: null },
  ];
  let updates = 0;
  const plan = await runAttachmentRecovery(
    { type: 'PDF_OCR', mixedOnly: true, staleAfterMinutes: 60, limit: 20, mode: 'plan' },
    { now: () => now, selectProcessing: async () => rows, snapshot: async () => snapshot, recover: async () => { updates += 1; return 1; } },
  );
  assert.deepEqual(
    [plan.processingTotal, plan.staleByTime, plan.eligibleForRecovery, plan.estimatedUpdates, plan.actualUpdates, updates],
    [7, 5, 1, 1, 0, 0],
  );
  assert.equal(plan.databaseMutation, false);
  const preserved = { ...base };
  const applied = await runAttachmentRecovery(
    { type: 'PDF_OCR', mixedOnly: true, staleAfterMinutes: 60, limit: 20, mode: 'apply' },
    {
      now: () => now, selectProcessing: async () => [preserved], snapshot: async () => snapshot,
      recover: async (row) => {
        updates += 1;
        assert.deepEqual(
          [row.rawText, row.cleanedText, row.attemptCount, row.lastAttemptedAt, row.extractorVersion, row.extractedAt],
          [preserved.rawText, preserved.cleanedText, 2, preserved.lastAttemptedAt, 'mock', preserved.extractedAt],
        );
        return 1;
      },
    },
  );
  assert.deepEqual([applied.recovered, applied.skippedByConcurrency, applied.actualUpdates], [1, 0, 1]);
  const raced = await runAttachmentRecovery(
    { type: 'PDF_OCR', mixedOnly: true, staleAfterMinutes: 60, limit: 20, mode: 'apply' },
    { now: () => now, selectProcessing: async () => [base], snapshot: async () => snapshot, recover: async () => 0 },
  );
  assert.deepEqual([raced.recovered, raced.skippedByConcurrency], [0, 1]);
}

async function run() {
  testParser();
  await testRecovery();
  console.log('Attachment stale PROCESSING recovery parser, plan, apply, exclusion, and concurrency tests passed with mocks only.');
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
