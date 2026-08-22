const assert = require('assert/strict');
const {
  runMixedPdfWrite,
} = require('../dist/services/attachment/pdfOcrPlanService');
const {
  runOcrRequiredPdf,
} = require('../dist/services/attachment/pdfOcrRequiredService');
const { parseExtractionArguments } = require('../dist/cli/extractProgramAttachments');

const now = new Date('2026-01-01T00:00:00.000Z');
const row = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  programCaseId: '123e4567-e89b-42d3-a456-426614174001',
  fileName: 'safe.pdf', fileUrl: 'https://example.invalid/safe.pdf', fileType: 'pdf',
  detectedFileType: 'PDF', detectedMimeType: 'application/pdf', fileSizeBytes: 10,
  checksumSha256: 'a'.repeat(64), extractionStatus: 'COMPLETED',
  rawText: 'old', cleanedText: 'old', extractorType: 'PDFJS_TEXT_PARTIAL',
  extractorVersion: 'PDFJS_mock', failureCode: null, failureMessage: null,
  attemptCount: 1, lastAttemptedAt: now, extractedAt: now,
  isActive: true, createdAt: now, updatedAt: now,
};
const config = {
  pdfOcrMaxPages: 50, pdfRenderDpi: 150, pdfRenderTimeoutMs: 30000,
  pdfRenderMaxBytes: 20 * 1024 * 1024,
};
const clova = {
  enabled: true, invokeUrl: 'https://example.invalid/ocr', secret: 'fake',
  timeoutMs: 30000, responseMaxBytes: 5 * 1024 * 1024, maxRetries: 9,
};
const renderer = {
  configured: true, available: true, versionConfigured: true, version: '26.02.0',
};
const extraction = {
  extractorVersion: 'mock', pageCount: 3,
  pages: [
    { pageNumber: 1, text: 'one', classification: 'TEXT' },
    { pageNumber: 2, text: '', classification: 'OCR_CANDIDATE' },
    { pageNumber: 3, text: 'three', classification: 'TEXT' },
  ],
  rawText: '', cleanedText: '', totalCharacterCount: 8,
  totalNonWhitespaceCharacterCount: 8, replacementCharacterCount: 0,
  classification: 'MIXED', ocrCandidatePages: [2],
};
const snapshot = {
  programCases: 1, sessions: 1, attachments: 1, activeAttachments: 1, hwpAttachments: 0,
  imageStatuses: {}, pdfStatuses: { COMPLETED: 1 },
  pdfExtractorTypes: { PDFJS_TEXT_PARTIAL: 1 }, duplicateLogicalKeys: 0, orphanAttachments: 0,
};
const download = (cleanup) => ({
  tempFilePath: 'safe/input.pdf', byteSize: 10, checksumSha256: 'b'.repeat(64),
  responseContentType: 'application/pdf', finalHost: 'example.invalid', cleanup,
});

async function testArguments() {
  assert.deepEqual(
    parseExtractionArguments(['--type', 'PDF_OCR', '--ocr-required-only', '--limit', '5', '--plan']),
    {
      type: 'PDF_OCR', mixedOnly: false, ocrRequiredOnly: true, limit: 5,
      plan: true, renderDryRun: false,
    },
  );
  assert.equal(
    parseExtractionArguments(['--type', 'PDF_OCR', '--mixed-only', '--write']).write,
    true,
  );
  for (const args of [
    ['--type', 'PDF_OCR', '--ocr-required-only', '--limit', '6', '--plan'],
    ['--type', 'PDF_OCR', '--ocr-required-only', '--ocr-dry-run'],
    ['--type', 'PDF_OCR', '--mixed-only', '--write', '--plan'],
    ['--type', 'IMAGE', '--write'],
  ]) assert.throws(() => parseExtractionArguments(args));
}

async function testMixedWrite() {
  let pdfCleanup = 0;
  let pageCleanup = 0;
  let completed;
  const claimed = { ...row, extractionStatus: 'PROCESSING', attemptCount: 2, updatedAt: new Date() };
  const result = await runMixedPdfWrite(
    {
      type: 'PDF_OCR', mixedOnly: true, limit: 1,
      plan: false, renderDryRun: false, write: true,
    },
    {
      select: async () => [row], claimMixed: async () => claimed,
      completeMixed: async (_target, value) => { completed = value; return 1; },
      restoreMixed: async () => { throw new Error('restore must not run'); },
      getConfig: () => config, getClovaConfig: () => clova,
      rendererAvailability: async () => renderer, snapshot: async () => snapshot,
      getRow: async () => claimed, downloader: async () => download(async () => { pdfCleanup += 1; }),
      detector: async () => ({ detectedFileType: 'PDF', detectedMimeType: 'application/pdf' }),
      extractPdf: async () => extraction,
      renderPage: async () => ({
        filePath: 'safe/page.png', byteSize: 100, cleanup: async () => { pageCleanup += 1; },
      }),
      inspectMetadata: async () => ({
        format: 'png', width: 100, height: 100, pages: 1, orientation: null,
        hasAlpha: false, pixelCount: 10000, estimatedRgbaBytes: 40000,
      }),
      createEngine: () => ({}),
      processImage: async () => ({
        detectedFormat: 'PNG', width: 100, height: 100, pixelCount: 10000,
        preprocessedWidth: 100, preprocessedHeight: 100, engine: 'CLOVA_OCR',
        engineVersion: 'V2', rawText: 'two', cleanedText: 'two', isEmpty: false,
        durationMs: 1, apiCallCount: 1, retryCount: 0, averageConfidence: 0.9,
        fieldCount: 1, readingOrderStrategy: 'LINE_BREAK',
      }),
    },
  );
  assert.deepEqual([result.claimed, result.completed, result.actualApiCalls], [1, 1, 1]);
  assert.deepEqual([pdfCleanup, pageCleanup], [1, 1]);
  assert.equal(completed.mergedRawText, '[Page 1]\none\n\n[Page 2]\ntwo\n\n[Page 3]\nthree');
  assert.match(completed.extractorVersion, /CLOVA_V2\+POPPLER_26\.02\.0/);

  const raced = await runMixedPdfWrite(
    { type: 'PDF_OCR', mixedOnly: true, limit: 1, plan: false, renderDryRun: false, write: true },
    {
      select: async () => [row], claimMixed: async () => null,
      getConfig: () => config, getClovaConfig: () => clova,
      rendererAvailability: async () => renderer,
    },
  );
  assert.deepEqual([raced.claimed, raced.skippedByClaimConcurrency, raced.actualApiCalls], [0, 1, 0]);

  let restored = 0;
  const failed = await runMixedPdfWrite(
    { type: 'PDF_OCR', mixedOnly: true, limit: 1, plan: false, renderDryRun: false, write: true },
    {
      select: async () => [row], claimMixed: async () => claimed,
      restoreMixed: async (original, processing) => {
        assert.equal(original.rawText, 'old');
        assert.equal(processing.extractionStatus, 'PROCESSING');
        restored += 1;
        return 1;
      },
      getConfig: () => config, getClovaConfig: () => clova,
      rendererAvailability: async () => renderer, snapshot: async () => snapshot,
      downloader: async () => download(async () => undefined),
      detector: async () => ({}), extractPdf: async () => extraction,
      renderPage: async () => { throw Object.assign(new Error('safe'), { code: 'PDF_RENDER_FAILED' }); },
      getRow: async () => claimed,
    },
  );
  assert.deepEqual([failed.failed, failed.restored, restored, failed.actualApiCalls], [1, 1, 1, 0]);
}

async function testOcrRequired() {
  const failedRow = { ...row, extractionStatus: 'FAILED', failureCode: 'OCR_REQUIRED' };
  const common = {
    getConfig: () => config, getClovaConfig: () => clova, createEngine: () => ({}),
    rendererAvailability: async () => renderer,
  };
  const plan = await runOcrRequiredPdf(
    {
      type: 'PDF_OCR', mixedOnly: false, ocrRequiredOnly: true,
      limit: 5, plan: true,
    },
    { ...common, select: async () => [] },
  );
  assert.deepEqual([plan.selected, plan.estimatedApiCalls, plan.actualApiCalls], [0, 0, 0]);
  assert.equal(plan.preflight.effectiveMaxRetries, 0);

  const rendered = [];
  const cleaned = [];
  let stored;
  const success = await runOcrRequiredPdf(
    {
      type: 'PDF_OCR', mixedOnly: false, ocrRequiredOnly: true,
      limit: 1, plan: false, write: true,
    },
    {
      ...common, select: async () => [failedRow], claim: async () => true,
      downloader: async () => download(async () => { cleaned.push('pdf'); }),
      detector: async () => ({ detectedFileType: 'PDF', detectedMimeType: 'application/pdf' }),
      analyze: async () => ({ ...extraction, pageCount: 3 }),
      render: async ({ pageNumber }) => {
        rendered.push(pageNumber);
        return {
          filePath: `safe/${pageNumber}.png`, byteSize: 1,
          cleanup: async () => { cleaned.push(pageNumber); },
        };
      },
      processImage: async ({ sourcePath }) => ({
        rawText: `raw-${sourcePath}`, cleanedText: `clean-${sourcePath}`,
        apiCallCount: 1, retryCount: 0,
      }),
      complete: async (_target, value) => { stored = value; return 1; },
    },
  );
  assert.deepEqual([success.completed, success.failed, success.actualApiCalls], [1, 0, 3]);
  assert.deepEqual(rendered, [1, 2, 3]);
  assert.deepEqual(cleaned, [1, 2, 3, 'pdf']);
  assert.match(stored.rawText, /^\[Page 1\]/);
  assert.equal(stored.extractorType, 'CLOVA_OCR_PDF');

  let calls = 0;
  let failures = 0;
  const failed = await runOcrRequiredPdf(
    {
      type: 'PDF_OCR', mixedOnly: false, ocrRequiredOnly: true,
      limit: 1, plan: false, write: true,
    },
    {
      ...common, select: async () => [failedRow], claim: async () => true,
      downloader: async () => download(async () => undefined),
      detector: async () => ({}), analyze: async () => ({ ...extraction, pageCount: 3 }),
      render: async ({ pageNumber }) => ({
        filePath: `safe/${pageNumber}.png`, byteSize: 1, cleanup: async () => undefined,
      }),
      processImage: async () => {
        calls += 1;
        if (calls === 2) throw Object.assign(new Error('safe'), { code: 'CLOVA_OCR_REQUEST_FAILED' });
        return { rawText: 'ok', cleanedText: 'ok', apiCallCount: 1, retryCount: 0 };
      },
      fail: async () => { failures += 1; },
    },
  );
  assert.deepEqual([calls, failures, failed.failed, failed.actualApiCalls], [2, 1, 1, 1]);

  let renderFailureOcrCalls = 0;
  const renderFailed = await runOcrRequiredPdf(
    { type: 'PDF_OCR', mixedOnly: false, ocrRequiredOnly: true, limit: 1, plan: false, write: true },
    {
      ...common, select: async () => [failedRow], claim: async () => true,
      downloader: async () => download(async () => undefined),
      detector: async () => ({}), analyze: async () => ({ ...extraction, pageCount: 1 }),
      render: async () => { throw Object.assign(new Error('safe'), { code: 'PDF_RENDER_FAILED' }); },
      processImage: async () => { renderFailureOcrCalls += 1; },
      fail: async () => undefined,
    },
  );
  assert.deepEqual([renderFailed.failed, renderFailed.actualApiCalls, renderFailureOcrCalls], [1, 0, 0]);

  let emptyStored;
  const empty = await runOcrRequiredPdf(
    { type: 'PDF_OCR', mixedOnly: false, ocrRequiredOnly: true, limit: 1, plan: false, write: true },
    {
      ...common, select: async () => [failedRow], claim: async () => true,
      downloader: async () => download(async () => undefined),
      detector: async () => ({}), analyze: async () => ({ ...extraction, pageCount: 1 }),
      render: async () => ({ filePath: 'safe/1.png', byteSize: 1, cleanup: async () => undefined }),
      processImage: async () => ({ rawText: '', cleanedText: '', apiCallCount: 1, retryCount: 0 }),
      complete: async (_target, value) => { emptyStored = value; return 1; },
    },
  );
  assert.deepEqual([empty.completed, empty.actualApiCalls, emptyStored.cleanedText], [1, 1, '']);

  let pageLimitRenderCount = 0;
  const limited = await runOcrRequiredPdf(
    { type: 'PDF_OCR', mixedOnly: false, ocrRequiredOnly: true, limit: 1, plan: false, write: true },
    {
      ...common, select: async () => [failedRow], claim: async () => true,
      downloader: async () => download(async () => undefined),
      detector: async () => ({}), analyze: async () => ({ ...extraction, pageCount: 51 }),
      render: async () => { pageLimitRenderCount += 1; },
      fail: async () => undefined,
    },
  );
  assert.deepEqual([limited.failed, limited.actualApiCalls, pageLimitRenderCount], [1, 0, 0]);

  const completionRace = await runOcrRequiredPdf(
    { type: 'PDF_OCR', mixedOnly: false, ocrRequiredOnly: true, limit: 1, plan: false, write: true },
    {
      ...common, select: async () => [failedRow], claim: async () => true,
      downloader: async () => download(async () => undefined),
      detector: async () => ({}), analyze: async () => ({ ...extraction, pageCount: 1 }),
      render: async () => ({ filePath: 'safe/1.png', byteSize: 1, cleanup: async () => undefined }),
      processImage: async () => ({ rawText: 'ok', cleanedText: 'ok', apiCallCount: 1, retryCount: 0 }),
      complete: async () => 0,
    },
  );
  assert.deepEqual([completionRace.completed, completionRace.skipped, completionRace.failed], [0, 1, 0]);
}

async function run() {
  await testArguments();
  await testMixedWrite();
  await testOcrRequired();
  console.log(JSON.stringify({ passed: true, suites: 3 }));
}

run().catch((error) => {
  console.error(JSON.stringify({ code: error.code || 'ERR_ASSERTION', message: error.message }));
  process.exitCode = 1;
});
