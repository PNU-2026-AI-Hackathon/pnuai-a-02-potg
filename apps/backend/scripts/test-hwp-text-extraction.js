const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { AttachmentProcessingError } = require('../dist/services/attachment/attachmentErrors');
const {
  cleanHwpText,
  extractHwpText,
  sanitizeHwpRawText,
} = require('../dist/services/attachment/hwpTextExtractor');
const {
  processHwpAttachment,
  processSelectedHwpAttachments,
} = require('../dist/services/attachment/hwpExtractionService');
const { parseExtractionArguments } = require('../dist/cli/extractProgramAttachments');

const baseConfig = {
  timeoutMs: 1000,
  stdoutMaxBytes: 1024,
  stderrMaxBytes: 1024,
  outputMaxBytes: 1024,
  outputMaxCharacters: 1000,
  minimumNonWhitespaceCharacters: 1,
  maximumReplacementCharactersPerTenThousand: 100,
};

async function expectCode(action, code) {
  await assert.rejects(action, (error) => error && error.code === code);
}

function outputPath(options) {
  return options.args[options.args.indexOf('--output') + 1];
}

async function extractorTests(root) {
  const input = path.join(root, 'input.hwp');
  fs.writeFileSync(input, 'fixture');
  const markdown = '# 제목\u0000\n\n<table><tr><td>첫 셀</td><td></td><td>셋 &amp; 값</td></tr></table>\n\n본문';
  const normal = await extractHwpText(input, undefined, {
    cliPath: 'fake-cli',
    config: baseConfig,
    runner: async (options) => {
      fs.writeFileSync(outputPath(options), markdown);
      return { exitCode: 0, signal: null, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0), durationMs: 1 };
    },
  });
  assert.equal(normal.rawText.includes('\u0000'), false);
  assert.ok(normal.rawText.includes('<table>'));
  assert.ok(normal.cleanedText.includes('첫 셀 | | 셋 & 값'));
  assert.ok(normal.cleanedText.indexOf('첫 셀') < normal.cleanedText.indexOf('셋 & 값'));
  assert.equal(normal.metadata.tableCount, 1);
  assert.equal(normal.metadata.rowCount, 1);
  assert.equal(normal.metadata.cellCount, 3);

  await expectCode(() => extractHwpText(input, undefined, {
    cliPath: 'fake-cli', config: baseConfig,
    runner: async (options) => {
      fs.writeFileSync(outputPath(options), ' \n ');
      return { exitCode: 0, signal: null, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0), durationMs: 1 };
    },
  }), 'HWP_OUTPUT_EMPTY');
  await expectCode(() => extractHwpText(input, undefined, {
    cliPath: 'fake-cli', config: baseConfig,
    runner: async () => ({ exitCode: 0, signal: null, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0), durationMs: 1 }),
  }), 'HWP_OUTPUT_MISSING');
  await expectCode(() => extractHwpText(input, undefined, {
    cliPath: 'fake-cli', config: { ...baseConfig, outputMaxBytes: 2 },
    runner: async (options) => {
      fs.writeFileSync(outputPath(options), 'large');
      return { exitCode: 0, signal: null, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0), durationMs: 1 };
    },
  }), 'HWP_OUTPUT_TOO_LARGE');
  for (const [sourceCode, expected] of [
    ['SUBPROCESS_TIMEOUT', 'HWP_EXTRACTION_TIMEOUT'],
    ['SUBPROCESS_EXIT_FAILED', 'HWP_EXTRACTION_PROCESS_FAILED'],
    ['SUBPROCESS_OUTPUT_LIMIT_EXCEEDED', 'HWP_EXTRACTION_PROCESS_FAILED'],
  ]) {
    await expectCode(() => extractHwpText(input, undefined, {
      cliPath: 'fake-cli', config: baseConfig,
      runner: async () => { throw new AttachmentProcessingError(sourceCode, 'private stderr must not escape'); },
    }), expected);
  }
  const controller = new AbortController();
  controller.abort();
  await expectCode(() => extractHwpText(input, controller.signal, {
    cliPath: 'fake-cli', config: baseConfig,
    runner: async (options) => {
      assert.equal(options.signal.aborted, true);
      throw new AttachmentProcessingError('SUBPROCESS_TERMINATED', 'cancelled', true);
    },
  }), 'SUBPROCESS_TERMINATED');
  assert.equal(fs.readdirSync(root).some((name) => name.startsWith('kordoc-')), false);
  assert.equal(sanitizeHwpRawText('a\u0000\u0001b'), 'ab');
  assert.equal(cleanHwpText('<style>secret</style><script>bad()</script><p>문단</p>'), '문단');
}

function attachment(id) {
  const now = new Date('2026-07-25T00:00:00Z');
  return {
    id, programCaseId: `case-${id}`, fileName: 'private.hwp', fileUrl: 'https://files.example.test/private.hwp',
    fileType: 'HWP', detectedFileType: null, detectedMimeType: null, fileSizeBytes: null,
    checksumSha256: null, extractionStatus: 'PENDING', rawText: null, cleanedText: null,
    extractorType: null, extractorVersion: null, failureCode: null, failureMessage: null,
    attemptCount: 0, lastAttemptedAt: null, extractedAt: null, isActive: true, createdAt: now, updatedAt: now,
  };
}

const validOle = {
  magicHex: 'd0cf11e0a1b11ae1', containerKind: 'OLE', isActualHwp: true, isActualHwpx: false, hwpx: null,
  ole: {
    isCfb: true, directoryEntryCount: 4, streamCount: 2, fileHeaderPresent: true, signatureValid: true,
    version: '5.1.0.1', compressed: true, encrypted: false, distribution: false,
    bodyTextPresent: true, viewTextPresent: false, sectionCount: 1,
  },
};

function processorDependencies(root, container = validOle, detectedFileType = 'HWP') {
  const filePath = path.join(root, `${Math.random()}.hwp`);
  fs.writeFileSync(filePath, 'fixture');
  return {
    downloader: async () => ({
      tempFilePath: filePath, byteSize: 7, checksumSha256: 'a'.repeat(64),
      responseContentType: 'application/octet-stream', finalHost: 'files.example.test',
      cleanup: async () => fs.rmSync(filePath, { force: true }),
    }),
    detector: async () => ({
      detectedFileType,
      detectedMimeType: detectedFileType === 'HWPX' ? 'application/hwp+zip' : 'application/x-hwp',
      fileNameExtension: 'HWP',
      matchesExpectedType: detectedFileType === 'HWP',
    }),
    containerAnalyzer: async () => container,
    extractor: async () => ({
      rawText: '<table><tr><td>A</td><td>B</td></tr></table>',
      cleanedText: 'A | B', extractorType: 'KORDOC_HWP', extractorVersion: '4.2.7',
      metadata: {
        outputFormat: 'kordoc-markdown-with-html-tables', outputBytes: 48, tableCount: 1,
        rowCount: 1, cellCount: 2, nonWhitespaceCharacterCount: 3, replacementCharacterCount: 0,
      },
    }),
  };
}

async function serviceTests(root) {
  const cases = [
    ['HWP_UNSUPPORTED_HWPX', { container: { ...validOle, containerKind: 'ZIP', isActualHwp: false, isActualHwpx: true, ole: null }, type: 'HWPX' }],
    ['HWP_SIGNATURE_MISMATCH', { container: { ...validOle, isActualHwp: false, ole: { ...validOle.ole, signatureValid: false } } }],
    ['HWP_ENCRYPTED', { container: { ...validOle, ole: { ...validOle.ole, encrypted: true } } }],
    ['HWP_DISTRIBUTION_DOCUMENT', { container: { ...validOle, ole: { ...validOle.ole, distribution: true } } }],
    ['HWP_BODY_TEXT_MISSING', { container: { ...validOle, ole: { ...validOle.ole, bodyTextPresent: false } } }],
  ];
  for (const [code, value] of cases) {
    const result = await processHwpAttachment(
      attachment(code),
      { dryRun: true, retryFailed: false },
      processorDependencies(root, value.container, value.type || 'HWP'),
    );
    assert.equal(result.errorCode, code);
  }
  const success = await processHwpAttachment(
    attachment('success'), { dryRun: true, retryFailed: false }, processorDependencies(root),
  );
  assert.equal(success.outcome, 'COMPLETED');
  assert.equal(success.extractorType, 'KORDOC_HWP');

  const dependencies = processorDependencies(root);
  let calls = 0;
  dependencies.downloader = async () => {
    calls += 1;
    if (calls === 1) throw new AttachmentProcessingError('DOWNLOAD_FAILED', 'download failed');
    return processorDependencies(root).downloader();
  };
  const continued = await processSelectedHwpAttachments(
    [attachment('first'), attachment('second')],
    { dryRun: true, retryFailed: false },
    dependencies,
  );
  assert.equal(continued.failed, 1);
  assert.equal(continued.completed, 1);
}

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hwp-text-extraction-test-'));
  try {
    await extractorTests(root);
    await serviceTests(root);
    assert.deepEqual(parseExtractionArguments(['--type', 'HWP', '--limit', '4', '--dry-run']), {
      type: 'HWP', limit: 4, retryFailed: false, dryRun: true,
    });
    assert.throws(() => parseExtractionArguments(['--type', 'HWP', '--limit', '5']));
    console.log('HWP text extraction tests passed.');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
