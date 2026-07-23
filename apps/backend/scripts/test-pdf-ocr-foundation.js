const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { getAttachmentOcrConfig } = require('../dist/config/attachmentOcr');
const { parseExtractionArguments } = require('../dist/cli/extractProgramAttachments');
const { AttachmentProcessingError } = require('../dist/services/attachment/attachmentErrors');
const { mergePdfOcrPages } = require('../dist/services/attachment/pdfOcrMerger');
const { detectPdfRendererAvailability, renderPdfPage } = require('../dist/services/attachment/pdfPageRenderer');
const { runPdfOcrPlan } = require('../dist/services/attachment/pdfOcrPlanService');

const id = '123e4567-e89b-42d3-a456-426614174000';
const png = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.from('safe')]);
const expectCode = (action, code) => assert.rejects(action, (error) => error && error.code === code);
const config = (overrides = {}) => ({ ...getAttachmentOcrConfig({}), ...overrides });
const page = (pageNumber, source, text) => ({ pageNumber, source, rawText: text, cleanedText: text });

function testArguments() {
  assert.deepEqual(parseExtractionArguments(['--type', 'PDF_OCR', '--mixed-only', '--limit', '1', '--plan']), {
    type: 'PDF_OCR', mixedOnly: true, limit: 1, plan: true,
  });
  assert.deepEqual(parseExtractionArguments(['--type', 'PDF_OCR', '--mixed-only', '--attachment-id', id, '--plan']), {
    type: 'PDF_OCR', mixedOnly: true, limit: 1, attachmentId: id, plan: true,
  });
  for (const args of [
    ['--type', 'PDF_OCR'], ['--type', 'PDF_OCR', '--mixed-only'],
    ['--type', 'PDF_OCR', '--mixed-only', '--plan', '--limit', '2'],
    ['--type', 'PDF_OCR', '--mixed-only', '--plan', '--retry-failed'],
    ['--type', 'PDF_OCR', '--mixed-only', '--plan', '--ocr-required-only'],
    ['--type', 'PDF_OCR', '--mixed-only', '--plan', '--dry-run'],
    ['--type', 'PDF_OCR', '--mixed-only', '--mixed-only', '--plan'],
    ['--type', 'IMAGE', '--mixed-only', '--plan'],
  ]) assert.throws(() => parseExtractionArguments(args));
}

function testMerge() {
  const merged = mergePdfOcrPages({
    pageCount: 3,
    pdfJsPages: [page(3, 'PDFJS_TEXT', 'third'), page(1, 'PDFJS_TEXT', 'first')],
    ocrCandidatePages: [2],
    ocrPages: [page(2, 'CLOVA_OCR', 'second')],
  });
  assert.deepEqual(merged.pages.map((value) => [value.pageNumber, value.source]), [
    [1, 'PDFJS_TEXT'], [2, 'CLOVA_OCR'], [3, 'PDFJS_TEXT'],
  ]);
  assert.equal(merged.rawText, '[Page 1]\nfirst\n\n[Page 2]\nsecond\n\n[Page 3]\nthird');
  assert.equal(merged.cleanedText, 'first\n\nsecond\n\nthird');
  assert.deepEqual([merged.pdfJsPageCount, merged.ocrPageCount], [2, 1]);
  assert.deepEqual(mergePdfOcrPages({
    pageCount: 2, pdfJsPages: [page(1, 'PDFJS_TEXT', 'a'), page(2, 'PDFJS_TEXT', 'b')],
    ocrCandidatePages: [], ocrPages: [],
  }).pages.map((value) => value.pageNumber), [1, 2]);
  assert.equal(mergePdfOcrPages({
    pageCount: 1, pdfJsPages: [], ocrCandidatePages: [1], ocrPages: [page(1, 'CLOVA_OCR', '')],
  }).rawText, '[Page 1]');
  const multipleInput = {
    pageCount: 4,
    pdfJsPages: [page(2, 'PDFJS_TEXT', 'two'), page(3, 'PDFJS_TEXT', 'three')],
    ocrCandidatePages: [1, 4],
    ocrPages: [page(4, 'CLOVA_OCR', 'four'), page(1, 'CLOVA_OCR', 'one')],
  };
  assert.deepEqual(mergePdfOcrPages(multipleInput), mergePdfOcrPages(multipleInput));
  assert.equal((mergePdfOcrPages(multipleInput).rawText.match(/\[Page /g) || []).length, 4);
  for (const input of [
    { pageCount: 3, pdfJsPages: [page(1, 'PDFJS_TEXT', 'a'), page(3, 'PDFJS_TEXT', 'c')], ocrCandidatePages: [2], ocrPages: [] },
    { pageCount: 2, pdfJsPages: [page(1, 'PDFJS_TEXT', 'a'), page(1, 'PDFJS_TEXT', 'a')], ocrCandidatePages: [], ocrPages: [] },
    { pageCount: 2, pdfJsPages: [page(1, 'PDFJS_TEXT', 'a')], ocrCandidatePages: [3], ocrPages: [] },
  ]) {
    assert.throws(() => mergePdfOcrPages(input), (error) => error instanceof AttachmentProcessingError);
  }
  assert.throws(() => mergePdfOcrPages({
    pageCount: 2, pdfJsPages: [page(1, 'PDFJS_TEXT', 'a'), page(2, 'PDFJS_TEXT', 'b')],
    ocrCandidatePages: [1, 1], ocrPages: [page(1, 'CLOVA_OCR', 'x')],
  }), (error) => error.code === 'PDF_OCR_PAGE_NUMBER_DUPLICATED');
}

async function testRenderer(root) {
  const work = path.join(root, 'work');
  fs.mkdirSync(work);
  const pdfPath = path.join(work, 'input.pdf');
  fs.writeFileSync(pdfPath, '%PDF-safe');
  let observed;
  const runner = async (options) => {
    observed = options;
    fs.writeFileSync(`${options.args[options.args.length - 1]}.png`, png);
    return { exitCode: 0, signal: null, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0), durationMs: 1 };
  };
  const rendered = await renderPdfPage({ pdfPath, pageNumber: 2, pageCount: 3, workDirectory: work }, config(), runner);
  assert.deepEqual(observed.args.slice(0, 8), ['-png', '-singlefile', '-r', '200', '-f', '2', '-l', '2']);
  assert.equal(observed.executable, 'pdftocairo');
  assert.equal(observed.cwd, path.resolve(work));
  assert.equal(rendered.byteSize, png.length);
  await rendered.cleanup();
  assert.equal(fs.existsSync(rendered.filePath), false);

  const outputRunner = (content) => async (options) => {
    if (content !== null) fs.writeFileSync(`${options.args[options.args.length - 1]}.png`, content);
    return { exitCode: 0, signal: null, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0), durationMs: 1 };
  };
  await expectCode(() => renderPdfPage({ pdfPath, pageNumber: 1, pageCount: 1, workDirectory: work }, config(), outputRunner(null)), 'PDF_RENDER_OUTPUT_MISSING');
  await expectCode(() => renderPdfPage({ pdfPath, pageNumber: 1, pageCount: 1, workDirectory: work }, config(), outputRunner(Buffer.alloc(0))), 'PDF_RENDER_OUTPUT_INVALID');
  await expectCode(() => renderPdfPage({ pdfPath, pageNumber: 1, pageCount: 1, workDirectory: work }, config(), outputRunner(Buffer.from('not png'))), 'PDF_RENDER_OUTPUT_INVALID');
  await expectCode(() => renderPdfPage({ pdfPath, pageNumber: 1, pageCount: 1, workDirectory: work }, config({ pdfRenderMaxBytes: 8 }), outputRunner(png)), 'PDF_RENDER_OUTPUT_TOO_LARGE');
  await expectCode(() => renderPdfPage({ pdfPath, pageNumber: 0, pageCount: 1, workDirectory: work }, config(), runner), 'PDF_PAGE_NUMBER_INVALID');
  await expectCode(() => renderPdfPage({ pdfPath, pageNumber: 1, pageCount: 51, workDirectory: work }, config(), runner), 'PDF_PAGE_LIMIT_EXCEEDED');
  await expectCode(() => renderPdfPage(
    { pdfPath: path.join(root, 'outside.pdf'), pageNumber: 1, pageCount: 1, workDirectory: work }, config(), runner,
  ), 'PDF_RENDER_FAILED');
  await expectCode(() => renderPdfPage({ pdfPath, pageNumber: 1, pageCount: 1, workDirectory: work }, config(), async () => {
    throw new AttachmentProcessingError('SUBPROCESS_TIMEOUT', 'hidden');
  }), 'PDF_RENDER_TIMEOUT');
  await expectCode(() => renderPdfPage({ pdfPath, pageNumber: 1, pageCount: 1, workDirectory: work }, config(), async () => {
    throw new AttachmentProcessingError('SUBPROCESS_EXIT_FAILED', 'hidden');
  }), 'PDF_RENDER_FAILED');
  assert.equal((await detectPdfRendererAvailability(config(), async () => ({
    exitCode: 0, signal: null, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0), durationMs: 1,
  }))).available, true);
  assert.equal((await detectPdfRendererAvailability(config(), async () => {
    throw new AttachmentProcessingError('SUBPROCESS_NOT_FOUND', 'hidden');
  })).available, false);
}

async function testPlan() {
  const now = new Date('2026-01-01T00:00:00Z');
  const target = {
    id, programCaseId: id, fileName: 'private.pdf', fileUrl: 'https://www.geumjeong.go.kr/private.pdf',
    fileType: 'pdf', detectedFileType: 'PDF', detectedMimeType: 'application/pdf', fileSizeBytes: 100,
    checksumSha256: 'a'.repeat(64), extractionStatus: 'COMPLETED', rawText: 'private',
    cleanedText: 'private', extractorType: 'PDFJS_TEXT_PARTIAL', extractorVersion: 'v',
    failureCode: null, failureMessage: null, attemptCount: 1, lastAttemptedAt: now, extractedAt: now,
    isActive: true, createdAt: now, updatedAt: now,
  };
  const snapshot = {
    programCases: 349, sessions: 20, attachments: 237, activeAttachments: 237, hwpAttachments: 26,
    imageStatuses: { COMPLETED: 156 }, pdfStatuses: { COMPLETED: 55 },
    pdfExtractorTypes: { PDFJS_TEXT: 54, PDFJS_TEXT_PARTIAL: 1 },
  };
  let cleaned = false;
  let rendered = false;
  const result = await runPdfOcrPlan(
    { type: 'PDF_OCR', mixedOnly: true, limit: 1, plan: true },
    {
      select: async () => [target],
      getConfig: () => config(),
      snapshot: async () => snapshot,
      getRow: async () => target,
      rendererAvailability: async () => ({ configured: true, available: false, versionConfigured: false }),
      downloader: async () => ({
        tempFilePath: 'safe/input.pdf', byteSize: 1234, checksumSha256: 'hidden',
        responseContentType: 'application/pdf', finalHost: 'hidden', cleanup: async () => { cleaned = true; },
      }),
      detector: async () => ({ detectedFileType: 'PDF', detectedMimeType: 'application/pdf', fileNameExtension: 'PDF', matchesExpectedType: true }),
      extractPdf: async () => ({
        extractorVersion: 'mock', pageCount: 3,
        pages: [
          { pageNumber: 1, text: 'private', characterCount: 100, nonWhitespaceCharacterCount: 100, hangulCharacterCount: 0, latinCharacterCount: 100, digitCharacterCount: 0, replacementCharacterCount: 0, classification: 'TEXT' },
          { pageNumber: 2, text: '', characterCount: 0, nonWhitespaceCharacterCount: 0, hangulCharacterCount: 0, latinCharacterCount: 0, digitCharacterCount: 0, replacementCharacterCount: 0, classification: 'OCR_CANDIDATE' },
          { pageNumber: 3, text: 'private', characterCount: 40, nonWhitespaceCharacterCount: 40, hangulCharacterCount: 0, latinCharacterCount: 40, digitCharacterCount: 0, replacementCharacterCount: 0, classification: 'LOW_DENSITY' },
        ],
        rawText: 'must not leak', cleanedText: 'must not leak', totalCharacterCount: 140,
        totalNonWhitespaceCharacterCount: 140, replacementCharacterCount: 0,
        classification: 'MIXED', ocrCandidatePages: [2],
      }),
    },
  );
  assert.equal(cleaned, true);
  assert.equal(rendered, false);
  assert.deepEqual(
    [result.selected, result.totalPages, result.pdfJsTextPages, result.lowDensityPages, result.ocrCandidatePageCount],
    [1, 3, 1, 1, 1],
  );
  assert.deepEqual(
    [result.estimatedRenderCount, result.estimatedApiCalls, result.actualApiCalls, result.databaseMutation],
    [1, 1, 0, false],
  );
  assert.deepEqual([result.targetFingerprintUnchanged, result.aggregateCountsUnchanged], [true, true]);
  assert.equal(JSON.stringify(result).includes('must not leak'), false);
  assert.equal(JSON.stringify(result).includes(id), false);
}

async function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'moira-pdf-ocr-test-'));
  try {
    testArguments();
    testMerge();
    await testRenderer(root);
    await testPlan();
    console.log('PDF OCR renderer, merger, CLI, and read-only plan tests passed with safe mocks only.');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error && error.code ? { code: error.code, message: error.message } : error);
  process.exitCode = 1;
});
