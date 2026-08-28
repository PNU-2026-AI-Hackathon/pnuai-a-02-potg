const assert = require('assert/strict');
const { parseExtractionArguments } = require('../dist/cli/extractProgramAttachments');
const { AttachmentProcessingError } = require('../dist/services/attachment/attachmentErrors');
const { ClovaOcrRequestError } = require('../dist/services/attachment/clovaOcrClient');
const { resolveOcrDonors } = require('../dist/services/attachment/imageOcrReuse');
const { runImageOcr } = require('../dist/services/attachment/imageOcrDryRunService');

const id = '123e4567-e89b-42d3-a456-426614174000';
const config = {
  enabled: true,
  invokeUrl: 'https://mock-ocr.invalid/general',
  secret: 'fake-secret',
  timeoutMs: 30_000,
  responseMaxBytes: 5 * 1024 * 1024,
  maxRetries: 1,
};
const target = {
  id,
  programCaseId: id,
  fileName: 'private.png',
  fileUrl: 'https://www.geumjeong.go.kr/private.png',
  fileType: 'png',
  detectedFileType: null,
  detectedMimeType: null,
  fileSizeBytes: null,
  checksumSha256: null,
  extractionStatus: 'PENDING',
  rawText: null,
  cleanedText: null,
  extractorType: null,
  extractorVersion: null,
  failureCode: null,
  failureMessage: null,
  attemptCount: 0,
  lastAttemptedAt: null,
  extractedAt: null,
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};
const snapshot = {
  programCases: 1, sessions: 1, attachments: 1, activeAttachments: 1,
  imageStatuses: { PENDING: 1 }, pdfStatuses: {},
};

function testArguments() {
  assert.deepEqual(parseExtractionArguments(['--type', 'IMAGE', '--plan']), {
    type: 'IMAGE', limit: 1, retryFailed: false, plan: true, dryRun: false,
  });
  assert.deepEqual(parseExtractionArguments(['--type', 'IMAGE', '--dry-run']), {
    type: 'IMAGE', limit: 1, retryFailed: false, plan: false, dryRun: true,
  });
  for (const args of [
    [], ['--type', 'HWP'], ['--type', 'IMAGE', '--limit', '0'],
    ['--type', 'IMAGE', '--limit', '6'], ['--type', 'IMAGE', '--plan', '--dry-run'],
    ['--type', 'IMAGE', '--unknown'], ['--type', 'IMAGE', '--plan', '--plan'],
    ['--type', 'IMAGE', '--attachment-id', 'invalid'],
  ]) assert.throws(() => parseExtractionArguments(args));
}

async function testPlan() {
  let downloaded = false;
  let processed = false;
  const result = await runImageOcr(
    { type: 'IMAGE', limit: 1, retryFailed: false, plan: true, dryRun: false },
    {
      getConfig: () => config,
      select: async () => [target],
      downloader: async () => { downloaded = true; throw new Error('must not download'); },
      processImage: async () => { processed = true; throw new Error('must not OCR'); },
    },
  );
  assert.deepEqual([result.selected, result.estimatedApiCalls, result.actualApiCalls], [1, 1, 0]);
  assert.deepEqual([downloaded, processed, result.databaseMutation], [false, false, false]);
  await assert.rejects(() => runImageOcr(
    { type: 'IMAGE', limit: 1, retryFailed: false, plan: true, dryRun: false },
    { getConfig: () => ({ ...config, secret: '' }), select: async () => [target] },
  ), (error) => error.code === 'CLOVA_OCR_CONFIG_MISSING');
}

async function testDryRun() {
  const order = [];
  let cleaned = false;
  let snapshots = 0;
  let engineConfig;
  const result = await runImageOcr(
    { type: 'IMAGE', limit: 1, retryFailed: false, plan: false, dryRun: true },
    {
      getConfig: () => config,
      select: async () => [target],
      snapshot: async () => { snapshots += 1; return snapshot; },
      getRow: async () => target,
      downloader: async () => {
        order.push('download');
        return {
          tempFilePath: 'safe/attachment.bin', byteSize: 123, checksumSha256: 'hidden',
          responseContentType: 'image/png', finalHost: 'hidden',
          cleanup: async () => { cleaned = true; },
        };
      },
      createEngine: (received) => {
        engineConfig = received;
        return { recognize: async () => { throw new Error('unused'); } };
      },
      processImage: async ({ ocrEngine }) => {
        order.push('process');
        assert.ok(ocrEngine);
        return {
          detectedFormat: 'PNG', width: 10, height: 20, pixelCount: 200,
          preprocessedWidth: 10, preprocessedHeight: 20, engine: 'CLOVA_OCR',
          engineVersion: 'V2', rawText: 'private body', cleanedText: 'private body',
          isEmpty: false, durationMs: 5, apiCallCount: 1, retryCount: 0,
          averageConfidence: 0.9, fieldCount: 2, readingOrderStrategy: 'LINE_BREAK',
        };
      },
    },
  );
  assert.deepEqual(order, ['download', 'process']);
  assert.equal(cleaned, true);
  assert.equal(snapshots, 2);
  assert.equal(engineConfig.maxRetries, 0);
  assert.equal(result.targetFingerprintUnchanged, true);
  assert.equal(result.aggregateCountsUnchanged, true);
  assert.equal(JSON.stringify(result).includes('private body'), false);

  let attempts = 0;
  await assert.rejects(() => runImageOcr(
    { type: 'IMAGE', limit: 1, retryFailed: false, plan: false, dryRun: true },
    {
      getConfig: () => config,
      select: async () => [target],
      snapshot: async () => snapshot,
      getRow: async () => target,
      downloader: async () => ({
        tempFilePath: 'safe/attachment.bin', byteSize: 1, checksumSha256: 'hidden',
        responseContentType: 'image/png', finalHost: 'hidden', cleanup: async () => {},
      }),
      processImage: async () => { attempts += 1; throw new Error('fake-secret https://mock-ocr.invalid body'); },
    },
  ), (error) => {
    assert.equal(`${error.message}`.includes('fake-secret'), false);
    assert.equal(`${error.message}`.includes('mock-ocr.invalid'), false);
    return true;
  });
  assert.equal(attempts, 1);
}

function writeDependencies(overrides = {}) {
  let cleaned = false;
  const saved = [];
  const base = {
    getConfig: () => config,
    select: async () => [target],
    claim: async () => true,
    downloader: async () => ({
      tempFilePath: 'safe/attachment.bin', byteSize: 123, checksumSha256: 'a'.repeat(64),
      responseContentType: 'image/png', finalHost: 'hidden',
      cleanup: async () => { cleaned = true; },
    }),
    createEngine: () => ({ recognize: async () => { throw new Error('unused'); } }),
    findDonors: async () => [],
    detector: async () => ({ detectedFileType: 'PNG', detectedMimeType: 'image/png', matchesExpectedType: true }),
    processImage: async () => ({
      detectedFormat: 'PNG', width: 10, height: 20, pixelCount: 200,
      preprocessedWidth: 10, preprocessedHeight: 20, engine: 'CLOVA_OCR',
      engineVersion: 'V2', rawText: 'stored', cleanedText: 'stored',
      isEmpty: false, durationMs: 5, apiCallCount: 1, retryCount: 0,
      averageConfidence: 0.9, fieldCount: 2, readingOrderStrategy: 'LINE_BREAK',
    }),
    saveCompleted: async (_id, data) => saved.push(['completed', data]),
    saveFailed: async (_id, data) => saved.push(['failed', data]),
  };
  return { dependencies: { ...base, ...overrides }, saved, wasCleaned: () => cleaned };
}

async function testWriteTransitions() {
  const donorBase = {
    id: '223e4567-e89b-42d3-a456-426614174000',
    rawText: 'donor text', cleanedText: 'donor text',
    extractorType: 'CLOVA_OCR_GENERAL', extractorVersion: 'V2',
    extractedAt: new Date('2026-01-01T00:00:00Z'),
  };
  assert.equal(resolveOcrDonors([]).kind, 'NONE');
  assert.equal(resolveOcrDonors([donorBase]).kind, 'REUSABLE');
  assert.equal(resolveOcrDonors([donorBase, { ...donorBase, id, cleanedText: 'different' }]).kind, 'CONFLICT');

  let reuseOcrCalls = 0;
  const reuse = writeDependencies({
    findDonors: async () => [{ ...donorBase, rawText: '', cleanedText: '' }],
    processImage: async () => { reuseOcrCalls += 1; throw new Error('must not OCR'); },
  });
  const reused = await runImageOcr(
    { type: 'IMAGE', limit: 1, retryFailed: false, plan: false, dryRun: false },
    reuse.dependencies,
  );
  assert.deepEqual([reused.reusedCount, reused.ocrProcessedCount, reused.apiCallsSaved, reused.actualApiCalls], [1, 0, 1, 0]);
  assert.equal(reused.emptyTextCount, 1);
  assert.equal(reuseOcrCalls, 0);
  assert.equal(reuse.saved[0][1].cleanedText, '');

  const conflict = writeDependencies({
    findDonors: async () => [donorBase, { ...donorBase, id, cleanedText: 'different' }],
    processImage: async () => { throw new Error('must not OCR on donor conflict'); },
  });
  const conflictResult = await runImageOcr(
    { type: 'IMAGE', limit: 1, retryFailed: false, plan: false, dryRun: false },
    conflict.dependencies,
  );
  assert.deepEqual(
    [conflictResult.checksumConflictCount, conflictResult.completed, conflictResult.failed, conflictResult.actualApiCalls],
    [1, 0, 1, 0],
  );
  assert.deepEqual(conflictResult.failureCodes, ['CHECKSUM_DONOR_CONFLICT']);

  const success = writeDependencies();
  const result = await runImageOcr(
    { type: 'IMAGE', limit: 1, retryFailed: false, plan: false, dryRun: false },
    success.dependencies,
  );
  assert.deepEqual([result.claimed, result.completed, result.failed, result.apiCallCount], [1, 1, 0, 1]);
  assert.equal(success.wasCleaned(), true);
  assert.equal(success.saved[0][0], 'completed');
  assert.deepEqual({
    status: success.saved[0][1].extractionStatus,
    extractor: success.saved[0][1].extractorType,
    version: success.saved[0][1].extractorVersion,
    failure: success.saved[0][1].failureCode,
  }, { status: 'COMPLETED', extractor: 'CLOVA_OCR_GENERAL', version: 'V2', failure: null });

  const empty = writeDependencies({
    processImage: async () => ({
      detectedFormat: 'PNG', width: 1, height: 1, pixelCount: 1,
      preprocessedWidth: 1, preprocessedHeight: 1, engine: 'CLOVA_OCR',
      engineVersion: 'V2', rawText: '', cleanedText: '', isEmpty: true,
      durationMs: 1, apiCallCount: 1, retryCount: 0, fieldCount: 0,
      readingOrderStrategy: 'LINE_BREAK',
    }),
  });
  const emptyResult = await runImageOcr(
    { type: 'IMAGE', limit: 1, retryFailed: false, plan: false, dryRun: false },
    empty.dependencies,
  );
  assert.equal(emptyResult.emptyTextCount, 1);
  assert.equal(empty.saved[0][1].rawText, '');
  assert.equal(empty.saved[0][1].failureCode, null);

  let calls = 0;
  const skipped = writeDependencies({
    claim: async () => false,
    processImage: async () => { calls += 1; throw new Error('must not run'); },
  });
  const skipResult = await runImageOcr(
    { type: 'IMAGE', limit: 1, retryFailed: false, plan: false, dryRun: false },
    skipped.dependencies,
  );
  assert.deepEqual([skipResult.claimed, skipResult.skipped, calls], [0, 1, 0]);

  const failure = writeDependencies({
    processImage: async () => { calls += 1; throw new AttachmentProcessingError('IMAGE_DECODE_FAILED', 'safe failure'); },
  });
  const failed = await runImageOcr(
    { type: 'IMAGE', limit: 1, retryFailed: false, plan: false, dryRun: false },
    failure.dependencies,
  );
  assert.deepEqual([failed.failed, failed.apiCallCount], [1, 0]);
  assert.equal(failure.saved[0][0], 'failed');
  assert.equal(failure.saved[0][1].failureCode, 'IMAGE_DECODE_FAILED');
  assert.equal(failure.wasCleaned(), true);

  const completed = await runImageOcr(
    { type: 'IMAGE', limit: 1, retryFailed: false, plan: false, dryRun: false },
    { getConfig: () => config, select: async () => [] },
  );
  assert.deepEqual([completed.selected, completed.actualApiCalls], [0, 0]);
}

async function testBatchIsolation() {
  const targets = Array.from({ length: 5 }, (_, index) => ({
    ...target,
    id: `123e4567-e89b-42d3-a456-42661417400${index}`,
    fileUrl: `https://www.geumjeong.go.kr/${index}.png`,
  }));
  const cleaned = [];
  const stored = [];
  const calls = [];
  const result = await runImageOcr(
    { type: 'IMAGE', limit: 5, retryFailed: false, plan: false, dryRun: false },
    {
      getConfig: () => config,
      select: async (options) => options.attachmentId
        ? targets.filter((item) => item.id === options.attachmentId)
        : targets,
      claim: async (item) => !item.fileUrl.endsWith('/3.png'),
      downloader: async (url) => ({
        tempFilePath: `safe/${new URL(url).pathname.slice(1)}`,
        byteSize: 123,
        checksumSha256: 'a'.repeat(64),
        responseContentType: 'image/png',
        finalHost: 'hidden',
        cleanup: async () => cleaned.push(url),
      }),
      createEngine: () => ({ recognize: async () => { throw new Error('unused'); } }),
      findDonors: async () => [],
      detector: async () => ({ detectedFileType: 'PNG', detectedMimeType: 'image/png', matchesExpectedType: true }),
      processImage: async ({ sourcePath }) => {
        const index = Number(sourcePath.match(/(\d+)\.png$/)[1]);
        calls.push(index);
        if (index === 1) throw new ClovaOcrRequestError(
          'CLOVA_OCR_REQUEST_FAILED', 'safe failure', false, 500, 1, 'REQUEST',
        );
        const empty = index === 2;
        return {
          detectedFormat: 'PNG', width: 10, height: 20, pixelCount: 200,
          preprocessedWidth: 10, preprocessedHeight: 20, engine: 'CLOVA_OCR',
          engineVersion: 'V2', rawText: empty ? '' : 'stored', cleanedText: empty ? '' : 'stored',
          isEmpty: empty, durationMs: 5, apiCallCount: 1, retryCount: 0,
          averageConfidence: empty ? undefined : 0.9, fieldCount: empty ? 0 : 2,
          readingOrderStrategy: 'LINE_BREAK',
        };
      },
      saveCompleted: async (savedId) => stored.push(['completed', savedId]),
      saveFailed: async (savedId) => stored.push(['failed', savedId]),
    },
  );
  assert.deepEqual({
    selected: result.selected, claimed: result.claimed, completed: result.completed,
    failed: result.failed, skipped: result.skipped, calls: result.actualApiCalls,
    empty: result.emptyTextCount, retries: result.retryCount,
  }, { selected: 5, claimed: 4, completed: 3, failed: 1, skipped: 1, calls: 4, empty: 1, retries: 0 });
  assert.deepEqual(calls, [0, 1, 2, 4]);
  assert.equal(stored.length, 4);
  assert.equal(cleaned.length, 4);
  assert.equal(result.results.length, 5);
  assert.equal(JSON.stringify(result).includes('stored'), false);
}

async function run() {
  testArguments();
  await testPlan();
  await testDryRun();
  await testWriteTransitions();
  await testBatchIsolation();
  console.log('IMAGE OCR CLI plan/dry-run orchestration tests passed with mock requests only.');
}

run().catch((error) => {
  console.error(error && error.code ? { code: error.code, message: error.message } : error);
  process.exitCode = 1;
});
