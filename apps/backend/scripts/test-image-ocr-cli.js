const assert = require('assert/strict');
const { parseExtractionArguments } = require('../dist/cli/extractProgramAttachments');
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

async function run() {
  testArguments();
  await testPlan();
  await testDryRun();
  console.log('IMAGE OCR CLI plan/dry-run orchestration tests passed with mock requests only.');
}

run().catch((error) => {
  console.error(error && error.code ? { code: error.code, message: error.message } : error);
  process.exitCode = 1;
});
