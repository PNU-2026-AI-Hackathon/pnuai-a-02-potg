const assert = require('assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createPdf } = require('./attachment-test-helpers');
const { parseExtractionArguments } = require('../dist/cli/extractProgramAttachments');
const { downloadAttachment } = require('../dist/services/attachment/attachmentDownloader');
const { detectAttachmentFileType } = require('../dist/services/attachment/fileTypeDetector');
const { extractPdfText, cleanExtractedText } = require('../dist/services/attachment/pdfTextExtractor');
const { isPrivateOrReservedAddress, validateAttachmentUrl } = require('../dist/services/attachment/urlSecurity');

const publicResolver = async () => [{ address: '93.184.216.34' }];
const allowedHosts = ['files.example.test'];

async function expectCode(action, code) {
  await assert.rejects(action, (error) => error && error.code === code);
}

async function testUrlSecurity() {
  const valid = await validateAttachmentUrl('https://files.example.test/document.pdf', allowedHosts, publicResolver);
  assert.equal(valid.hostname, 'files.example.test');
  await expectCode(() => validateAttachmentUrl('http://files.example.test/a.pdf', allowedHosts, publicResolver), 'INVALID_URL');
  await expectCode(() => validateAttachmentUrl('https://user:pass@files.example.test/a.pdf', allowedHosts, publicResolver), 'INVALID_URL');
  await expectCode(() => validateAttachmentUrl('https://files.example.test:8443/a.pdf', allowedHosts, publicResolver), 'INVALID_URL');
  await expectCode(() => validateAttachmentUrl('https://evil-files.example.test/a.pdf', allowedHosts, publicResolver), 'HOST_NOT_ALLOWED');
  await expectCode(() => validateAttachmentUrl('https://files.example.test.evil.test/a.pdf', allowedHosts, publicResolver), 'HOST_NOT_ALLOWED');
  await expectCode(() => validateAttachmentUrl('https://localhost/a.pdf', ['localhost'], publicResolver), 'PRIVATE_ADDRESS_BLOCKED');
  for (const address of ['127.0.0.1', '0.0.0.0', '169.254.169.254', '10.0.0.1', '172.16.0.1', '192.168.0.1']) {
    await expectCode(() => validateAttachmentUrl(`https://${address}/a.pdf`, [address], publicResolver), 'PRIVATE_ADDRESS_BLOCKED');
  }
  await expectCode(() => validateAttachmentUrl('https://[::1]/a.pdf', ['::1'], publicResolver), 'PRIVATE_ADDRESS_BLOCKED');
  await expectCode(() => validateAttachmentUrl('https://[fc00::1]/a.pdf', ['fc00::1'], publicResolver), 'PRIVATE_ADDRESS_BLOCKED');
  assert.equal(isPrivateOrReservedAddress('8.8.8.8'), false);
  assert.equal(isPrivateOrReservedAddress('2606:4700:4700::1111'), false);
}

function response(body, init = {}) {
  return new Response(body, init);
}

function downloaderConfig(tempRootDir, overrides = {}) {
  return {
    allowedHosts,
    downloadTimeoutMs: 500,
    headTimeoutMs: 500,
    maxFileSizeBytes: 1024,
    maxRedirects: 2,
    concurrency: 1,
    tempRootDir,
    networkRetries: 1,
    ...overrides,
  };
}

async function testDownloader(root) {
  const payload = Buffer.from('%PDF-1.4\ntest-payload');
  const calls = [];
  const normalFetch = async (_url, init) => {
    calls.push(init.method);
    return init.method === 'HEAD'
      ? response(null, { status: 200, headers: { 'content-length': String(payload.length) } })
      : response(payload, { status: 200, headers: { 'content-type': 'application/pdf', 'content-length': String(payload.length) } });
  };
  const downloaded = await downloadAttachment(
    'https://files.example.test/document.pdf',
    downloaderConfig(root),
    { fetchImplementation: normalFetch, resolver: publicResolver },
  );
  assert.deepEqual(calls, ['HEAD', 'GET']);
  assert.equal(downloaded.byteSize, payload.length);
  assert.equal(downloaded.checksumSha256, crypto.createHash('sha256').update(payload).digest('hex'));
  assert.equal(fs.existsSync(downloaded.tempFilePath), true);
  await downloaded.cleanup();
  await downloaded.cleanup();
  assert.equal(fs.existsSync(downloaded.tempFilePath), false);

  let oversizedGetCalled = false;
  await expectCode(() => downloadAttachment(
    'https://files.example.test/large.pdf',
    downloaderConfig(root, { maxFileSizeBytes: 10 }),
    {
      resolver: publicResolver,
      fetchImplementation: async (_url, init) => {
        if (init.method === 'GET') oversizedGetCalled = true;
        return response(null, { status: 200, headers: { 'content-length': '11' } });
      },
    },
  ), 'FILE_TOO_LARGE');
  assert.equal(oversizedGetCalled, false);

  await expectCode(() => downloadAttachment(
    'https://files.example.test/stream-large.pdf',
    downloaderConfig(root, { maxFileSizeBytes: 10 }),
    {
      resolver: publicResolver,
      fetchImplementation: async (_url, init) => init.method === 'HEAD'
        ? response(null, { status: 405 })
        : response(Buffer.alloc(11), { status: 200 }),
    },
  ), 'FILE_TOO_LARGE');
  assert.equal(fs.readdirSync(root).length, 0);

  await expectCode(() => downloadAttachment(
    'https://files.example.test/timeout.pdf',
    downloaderConfig(root),
    { resolver: publicResolver, fetchImplementation: async () => { throw new DOMException('timeout', 'TimeoutError'); } },
  ), 'DOWNLOAD_TIMEOUT');

  await expectCode(() => downloadAttachment(
    'https://files.example.test/missing.pdf',
    downloaderConfig(root),
    { resolver: publicResolver, fetchImplementation: async () => response(null, { status: 404 }) },
  ), 'DOWNLOAD_FAILED');

  let getAttempts = 0;
  const retried = await downloadAttachment(
    'https://files.example.test/retry.pdf',
    downloaderConfig(root),
    {
      resolver: publicResolver,
      fetchImplementation: async (_url, init) => {
        if (init.method === 'HEAD') return response(null, { status: 200 });
        getAttempts += 1;
        return getAttempts === 1 ? response(null, { status: 500 }) : response(payload, { status: 200 });
      },
    },
  );
  assert.equal(getAttempts, 2);
  await retried.cleanup();

  const redirected = await downloadAttachment(
    'https://files.example.test/start.pdf',
    downloaderConfig(root),
    {
      resolver: publicResolver,
      fetchImplementation: async (url, init) => {
        if (init.method === 'HEAD') return response(null, { status: 200 });
        return String(url).endsWith('/start.pdf')
          ? response(null, { status: 302, headers: { location: '/final.pdf' } })
          : response(payload, { status: 200 });
      },
    },
  );
  await redirected.cleanup();

  await expectCode(() => downloadAttachment(
    'https://files.example.test/redirect.pdf',
    downloaderConfig(root),
    {
      resolver: publicResolver,
      fetchImplementation: async () => response(null, { status: 302, headers: { location: 'https://evil.test/file.pdf' } }),
    },
  ), 'HOST_NOT_ALLOWED');

  await expectCode(() => downloadAttachment(
    'https://files.example.test/empty.pdf',
    downloaderConfig(root),
    {
      resolver: publicResolver,
      fetchImplementation: async (_url, init) => init.method === 'HEAD'
        ? response(null, { status: 200, headers: { 'content-length': '0' } })
        : response(Buffer.alloc(0), { status: 200 }),
    },
  ), 'EMPTY_FILE');
}

async function testFileDetection(root) {
  const fixtures = {
    'file.pdf': Buffer.from('%PDF-1.4\n'),
    'file.hwp': Buffer.from('d0cf11e0a1b11ae10000', 'hex'),
    'file.hwpx': Buffer.concat([Buffer.from('504b0304', 'hex'), Buffer.from('mimetype application/hwp+zip Contents/content.hpf')]),
    'file.jpg': Buffer.from('ffd8ffe000', 'hex'),
    'file.png': Buffer.from('89504e470d0a1a0a0000', 'hex'),
  };
  const expected = { 'file.pdf': 'PDF', 'file.hwp': 'HWP', 'file.hwpx': 'HWPX', 'file.jpg': 'JPEG', 'file.png': 'PNG' };
  for (const [name, content] of Object.entries(fixtures)) {
    const filePath = path.join(root, name);
    fs.writeFileSync(filePath, content);
    const result = await detectAttachmentFileType({ filePath, fileName: name });
    assert.equal(result.detectedFileType, expected[name]);
    assert.equal(result.matchesExpectedType, true);
  }
  const htmlPath = path.join(root, 'error.pdf');
  fs.writeFileSync(htmlPath, '<!doctype html><html><body>error</body></html>');
  await expectCode(() => detectAttachmentFileType({ filePath: htmlPath, fileName: 'error.pdf' }), 'HTML_RESPONSE');
  const headerHtmlPath = path.join(root, 'header-html.pdf');
  fs.writeFileSync(headerHtmlPath, '%PDF-1.4');
  await expectCode(() => detectAttachmentFileType({ filePath: headerHtmlPath, responseContentType: 'text/html' }), 'HTML_RESPONSE');
  const emptyPath = path.join(root, 'empty.pdf');
  fs.writeFileSync(emptyPath, '');
  await expectCode(() => detectAttachmentFileType({ filePath: emptyPath }), 'EMPTY_FILE');
  const unsupportedPath = path.join(root, 'unknown.bin');
  fs.writeFileSync(unsupportedPath, 'unknown');
  await expectCode(() => detectAttachmentFileType({ filePath: unsupportedPath }), 'UNSUPPORTED_FILE_TYPE');
  await expectCode(() => detectAttachmentFileType({
    filePath: path.join(root, 'file.pdf'), fileName: 'fake.jpg', dbFileType: 'jpg', requireExpectedMatch: true,
  }), 'FILE_TYPE_MISMATCH');
}

async function testPdfExtraction(root) {
  const sentence = 'This is generated text content for deterministic PDF extraction testing. ';
  const rich = `${sentence.repeat(2)}\n${sentence.repeat(2)}`;
  const textPath = path.join(root, 'text.pdf');
  const mixedPath = path.join(root, 'mixed.pdf');
  const ocrPath = path.join(root, 'ocr-required.pdf');
  const invalidPath = path.join(root, 'invalid.pdf');
  createPdf(textPath, [`Page one ${rich}`, `Page two ${rich}`]);
  createPdf(mixedPath, [`Text page ${rich}`, '']);
  createPdf(ocrPath, ['tiny']);
  fs.writeFileSync(invalidPath, 'not a pdf');

  const text = await extractPdfText(textPath);
  assert.equal(text.pageCount, 2);
  assert.equal(text.classification, 'TEXT');
  assert.ok(text.rawText.indexOf('[Page 1]') < text.rawText.indexOf('[Page 2]'));
  const mixed = await extractPdfText(mixedPath);
  assert.equal(mixed.classification, 'MIXED');
  assert.deepEqual(mixed.ocrCandidatePages, [2]);
  const ocr = await extractPdfText(ocrPath);
  assert.equal(ocr.classification, 'OCR_REQUIRED');
  await expectCode(() => extractPdfText(invalidPath), 'PDF_PARSE_FAILED');
  assert.equal(cleanExtractedText('  한글\t Unicode  \r\n\r\n\r\n text\u0000 '), '한글 Unicode\n\ntext');
}

function testCliArguments() {
  assert.deepEqual(parseExtractionArguments([]), { type: 'PDF', limit: 5, retryFailed: false, dryRun: false });
  assert.deepEqual(parseExtractionArguments(['--type', 'pdf', '--limit', '2', '--attachment-id', 'id', '--retry-failed', '--dry-run']), {
    type: 'PDF', limit: 2, attachmentId: 'id', retryFailed: true, dryRun: true,
  });
  assert.throws(() => parseExtractionArguments(['--type', 'HWP']));
  assert.throws(() => parseExtractionArguments(['--limit', '21']));
  assert.throws(() => parseExtractionArguments(['--unknown']));
}

async function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'moira-attachment-module-test-'));
  const downloadRoot = path.join(root, 'downloads');
  fs.mkdirSync(downloadRoot);
  try {
    await testUrlSecurity();
    await testDownloader(downloadRoot);
    await testFileDetection(root);
    await testPdfExtraction(root);
    testCliArguments();
    console.log('Attachment download, detection, PDF extraction, and CLI tests passed.');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
