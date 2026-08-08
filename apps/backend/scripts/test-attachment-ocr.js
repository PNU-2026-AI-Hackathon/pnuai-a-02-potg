const assert = require('assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');
const { getAttachmentOcrConfig } = require('../dist/config/attachmentOcr');
const { clovaOcrConfigSummary, getClovaOcrConfig, validateClovaOcrExecutionConfig } = require('../dist/config/clovaOcr');
const { AttachmentProcessingError } = require('../dist/services/attachment/attachmentErrors');
const { buildClovaOcrMultipart, createClovaOcrEngine } = require('../dist/services/attachment/clovaOcrClient');
const { parseClovaOcrResponse } = require('../dist/services/attachment/clovaOcrResponseParser');
const { inspectImageMetadata } = require('../dist/services/attachment/imageMetadata');
const { processImageForOcr, imageOcrLogSummary } = require('../dist/services/attachment/imageOcrProcessor');
const { preprocessImage } = require('../dist/services/attachment/imagePreprocessor');
const { runSubprocess } = require('../dist/services/attachment/subprocessRunner');

const helper = path.resolve(__dirname, 'fake-subprocess.js');
const fakeSecret = 'fake-secret-for-tests';
const fakeUrl = 'https://mock-ocr.invalid/general';
const expectCode = (action, code) => assert.rejects(action, (error) => error && error.code === code);
const hash = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const imageConfig = () => getAttachmentOcrConfig({});
const clovaConfig = (overrides = {}) => ({
  enabled: true,
  invokeUrl: fakeUrl,
  secret: fakeSecret,
  timeoutMs: 500,
  responseMaxBytes: 5 * 1024 * 1024,
  maxRetries: 1,
  ...overrides,
});

function box(x, y) {
  return { vertices: [{ x, y }, { x: x + 10, y }, { x: x + 10, y: y + 10 }, { x, y: y + 10 }] };
}

function field(inferText, inferConfidence, x, y, lineBreak) {
  const value = { inferText, inferConfidence, boundingPoly: box(x, y) };
  if (lineBreak !== undefined) value.lineBreak = lineBreak;
  return value;
}

function responseBody(fields = [field('안녕', 0.9, 0, 0, false), field('CLOVA 42', 0.7, 20, 0, true)]) {
  return { version: 'V2', images: [{ inferResult: 'SUCCESS', fields }] };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

async function makeFixtures(root) {
  const jpeg = path.join(root, 'small.jpg');
  const png = path.join(root, 'transparent.png');
  const landscape = path.join(root, 'landscape.png');
  const portrait = path.join(root, 'portrait.png');
  const oriented = path.join(root, 'oriented.jpg');
  const multipage = path.join(root, 'multipage.tiff');
  await sharp({ create: { width: 20, height: 10, channels: 3, background: '#336699' } }).jpeg().toFile(jpeg);
  await sharp({ create: { width: 10, height: 10, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toFile(png);
  await sharp({ create: { width: 80, height: 20, channels: 3, background: '#336699' } }).png().toFile(landscape);
  await sharp({ create: { width: 20, height: 80, channels: 3, background: '#336699' } }).png().toFile(portrait);
  await sharp({ create: { width: 20, height: 10, channels: 3, background: '#336699' } }).jpeg().withMetadata({ orientation: 6 }).toFile(oriented);
  await sharp({ create: { width: 4, height: 8, channels: 4, background: '#ffffff', pageHeight: 4 } }).tiff().toFile(multipage);
  fs.writeFileSync(path.join(root, 'broken.jpg'), Buffer.from('ffd8ff00deadbeef', 'hex'));
  fs.writeFileSync(path.join(root, 'broken.png'), Buffer.from('89504e470d0a1a0a', 'hex'));
  return { jpeg, png, landscape, portrait, oriented, multipage };
}

async function testConfig() {
  assert.deepEqual(getClovaOcrConfig({}), {
    enabled: false, invokeUrl: '', secret: '', timeoutMs: 30_000, responseMaxBytes: 5 * 1024 * 1024, maxRetries: 1,
  });
  assert.throws(() => getClovaOcrConfig({ CLOVA_OCR_ENABLED: 'yes' }));
  assert.throws(() => getClovaOcrConfig({ CLOVA_OCR_TIMEOUT_MS: 'NaN' }));
  assert.throws(() => getClovaOcrConfig({ CLOVA_OCR_RESPONSE_MAX_BYTES: '0' }));
  assert.throws(() => getClovaOcrConfig({ CLOVA_OCR_MAX_RETRIES: '3' }));
  await expectCode(async () => validateClovaOcrExecutionConfig(clovaConfig({ enabled: false })), 'CLOVA_OCR_DISABLED');
  await expectCode(async () => validateClovaOcrExecutionConfig(clovaConfig({ invokeUrl: '' })), 'CLOVA_OCR_CONFIG_MISSING');
  await expectCode(async () => validateClovaOcrExecutionConfig(clovaConfig({ secret: '' })), 'CLOVA_OCR_CONFIG_MISSING');
  await expectCode(async () => validateClovaOcrExecutionConfig(clovaConfig({ invokeUrl: 'http://mock.invalid/general' })), 'CLOVA_OCR_CONFIG_MISSING');
  await expectCode(async () => validateClovaOcrExecutionConfig(clovaConfig({ invokeUrl: 'https://user:pass@mock.invalid/general' })), 'CLOVA_OCR_CONFIG_MISSING');
  await expectCode(async () => validateClovaOcrExecutionConfig(clovaConfig({ invokeUrl: `${fakeUrl}#fragment` })), 'CLOVA_OCR_CONFIG_MISSING');
  assert.deepEqual(clovaOcrConfigSummary(clovaConfig()), {
    enabled: true, invokeUrlConfigured: true, secretConfigured: true, timeoutMs: 500,
    responseMaxBytes: 5 * 1024 * 1024, maxRetries: 1,
  });
}

async function testSubprocess(root) {
  const common = { executable: process.execPath, timeoutMs: 2_000, stdoutMaxBytes: 128, stderrMaxBytes: 128 };
  assert.equal((await runSubprocess({ ...common, args: [helper, 'echo', 'safe'] })).stdout.toString(), 'safe');
  await expectCode(() => runSubprocess({ ...common, args: [helper, 'exit', '7'] }), 'SUBPROCESS_EXIT_FAILED');
  await expectCode(() => runSubprocess({ ...common, executable: path.join(root, 'missing'), args: [] }), 'SUBPROCESS_NOT_FOUND');
  await expectCode(() => runSubprocess({ ...common, timeoutMs: 50, args: [helper, 'delay', '1000'] }), 'SUBPROCESS_TIMEOUT');
  await expectCode(() => runSubprocess({ ...common, args: [helper, 'stdout', '129'] }), 'SUBPROCESS_OUTPUT_LIMIT_EXCEEDED');
  await expectCode(() => runSubprocess({ ...common, args: [helper, 'stderr', '129'] }), 'SUBPROCESS_OUTPUT_LIMIT_EXCEEDED');
  const marker = path.join(root, 'must-not-exist');
  const payload = `value;touch ${marker}`;
  assert.equal((await runSubprocess({ ...common, args: [helper, 'echo', payload] })).stdout.toString(), payload);
  assert.equal(fs.existsSync(marker), false);
}

async function testImages(root, fixture) {
  const config = imageConfig();
  assert.deepEqual([...(Object.values(await inspectImageMetadata(fixture.jpeg, config)).slice(0, 4))], ['jpeg', 20, 10, 1]);
  assert.equal((await inspectImageMetadata(fixture.png, config)).hasAlpha, true);
  await expectCode(() => inspectImageMetadata(fixture.multipage, config), 'IMAGE_ANIMATION_UNSUPPORTED');
  await expectCode(() => inspectImageMetadata(path.join(root, 'broken.jpg'), config), 'IMAGE_DECODE_FAILED');
  await expectCode(() => inspectImageMetadata(path.join(root, 'broken.png'), config), 'IMAGE_DECODE_FAILED');
  await expectCode(() => inspectImageMetadata(fixture.landscape, { ...config, imageMaxWidth: 50 }), 'IMAGE_DIMENSION_LIMIT_EXCEEDED');
  await expectCode(() => inspectImageMetadata(fixture.portrait, { ...config, imageMaxHeight: 50 }), 'IMAGE_DIMENSION_LIMIT_EXCEEDED');
  await expectCode(() => inspectImageMetadata(fixture.jpeg, { ...config, imageMaxPixels: 199 }), 'IMAGE_PIXEL_LIMIT_EXCEEDED');

  const work = path.join(root, 'preprocess');
  fs.mkdirSync(work);
  const originalHash = hash(fixture.oriented);
  const prepared = await preprocessImage(fixture.oriented, work, { ...config, imageOcrMaxLongEdge: 12 });
  assert.deepEqual([prepared.width, prepared.height], [6, 12]);
  const metadata = await sharp(prepared.filePath).metadata();
  assert.equal(metadata.format, 'png');
  assert.equal(metadata.space, 'srgb');
  assert.equal(hash(fixture.oriented), originalHash);
  await prepared.cleanup();
  assert.equal(fs.existsSync(prepared.filePath), false);
  const transparent = await preprocessImage(fixture.png, work, config);
  assert.equal((await sharp(transparent.filePath).raw().toBuffer())[0], 255);
  await transparent.cleanup();
}

async function testMultipart(root, fixture) {
  const form = await buildClovaOcrMultipart({ filePath: fixture.jpeg, format: 'jpeg', requestId: 'fixed-request-id', timestamp: 123 });
  assert.deepEqual([...form.keys()].sort(), ['file', 'message']);
  const message = JSON.parse(form.get('message'));
  assert.deepEqual(message, {
    version: 'V2', requestId: 'fixed-request-id', timestamp: 123, lang: 'ko',
    images: [{ format: 'jpg', name: 'ocr-input' }], enableTableDetection: false,
  });
  const file = form.get('file');
  assert.equal(file.name, 'ocr-input.jpg');
  assert.equal(JSON.stringify(message).includes('http'), false);
  assert.equal(JSON.stringify(message).includes(path.basename(fixture.jpeg)), false);
  assert.equal(JSON.stringify(message).includes(fakeSecret), false);
}

async function testParser() {
  const line = parseClovaOcrResponse(responseBody());
  assert.equal(line.rawText, '안녕 CLOVA 42');
  assert.equal(line.fieldCount, 2);
  assert.equal(line.averageConfidence, 0.8);
  assert.equal(line.readingOrderStrategy, 'LINE_BREAK');
  const coordinate = parseClovaOcrResponse(responseBody([
    field('오른쪽', 0.5, 30, 20), field('왼쪽', 0.5, 0, 20), field('위', 0.5, 10, 0),
  ]));
  assert.equal(coordinate.rawText, '위 왼쪽 오른쪽');
  assert.equal(coordinate.readingOrderStrategy, 'COORDINATE');
  assert.equal(parseClovaOcrResponse(responseBody([])).isEmpty, true);
  const cleaned = parseClovaOcrResponse(responseBody([field('A\0\u0001', 1, 0, 0, true)]));
  assert.equal(cleaned.rawText.includes('\0'), false);
  assert.equal(cleaned.rawText.includes('\u0001'), false);
  assert.equal(cleaned.cleanedText, 'A');
  assert.deepEqual(parseClovaOcrResponse(responseBody()), line);
  await expectCode(async () => parseClovaOcrResponse({}), 'CLOVA_OCR_RESPONSE_INVALID');
  await expectCode(async () => parseClovaOcrResponse({ images: [{ inferResult: 'FAILURE', fields: [] }] }), 'CLOVA_OCR_IMAGE_FAILED');
  await expectCode(async () => parseClovaOcrResponse(responseBody([{ inferText: 'bad' }])), 'CLOVA_OCR_RESPONSE_INVALID');
}

async function testClient(root, fixture) {
  let actualCalls = 0;
  const requestObservations = [];
  const mockFetch = async (url, init) => {
    actualCalls += 1;
    requestObservations.push({
      isFakeUrl: url === fakeUrl,
      method: init.method,
      secretMatches: init.headers['X-OCR-SECRET'] === fakeSecret,
      manuallySetContentType: Object.keys(init.headers).some((key) => key.toLowerCase() === 'content-type'),
      isFormData: init.body instanceof FormData,
    });
    return jsonResponse(responseBody());
  };
  const engine = createClovaOcrEngine(clovaConfig(), {
    fetchImplementation: mockFetch, randomUuid: () => 'uuid', now: () => 123, sleep: async () => {},
  });
  const success = await engine.recognize({ filePath: fixture.jpeg, format: 'jpg' });
  assert.equal(success.engine, 'CLOVA_OCR');
  assert.equal(success.engineVersion, 'V2');
  assert.deepEqual([success.apiCallCount, success.retryCount], [1, 0]);
  assert.deepEqual(requestObservations[0], {
    isFakeUrl: true, method: 'POST', secretMatches: true, manuallySetContentType: false, isFormData: true,
  });

  for (const [status, code] of [[400, 'CLOVA_OCR_REQUEST_INVALID'], [401, 'CLOVA_OCR_AUTH_FAILED'], [403, 'CLOVA_OCR_FORBIDDEN'], [418, 'CLOVA_OCR_REQUEST_FAILED']]) {
    await expectCode(() => createClovaOcrEngine(clovaConfig({ maxRetries: 0 }), { fetchImplementation: async () => jsonResponse({}, status) })
      .recognize({ filePath: fixture.jpeg, format: 'jpg' }), code);
  }
  for (const status of [429, 500]) {
    let calls = 0;
    const delays = [];
    const retried = await createClovaOcrEngine(clovaConfig(), {
      fetchImplementation: async () => (++calls === 1 ? jsonResponse({}, status) : jsonResponse(responseBody())),
      sleep: async (delay) => delays.push(delay),
    }).recognize({ filePath: fixture.jpeg, format: 'jpg' });
    assert.deepEqual([retried.apiCallCount, retried.retryCount, calls, delays.length], [2, 1, 2, 1]);
  }
  let networkCalls = 0;
  const networkRetry = await createClovaOcrEngine(clovaConfig(), {
    fetchImplementation: async () => { networkCalls += 1; if (networkCalls === 1) throw new Error('network'); return jsonResponse(responseBody()); },
    sleep: async () => {},
  }).recognize({ filePath: fixture.jpeg, format: 'jpg' });
  assert.deepEqual([networkRetry.apiCallCount, networkRetry.retryCount], [2, 1]);

  let authCalls = 0;
  await expectCode(() => createClovaOcrEngine(clovaConfig(), { fetchImplementation: async () => { authCalls += 1; return jsonResponse({}, 401); } })
    .recognize({ filePath: fixture.jpeg, format: 'jpg' }), 'CLOVA_OCR_AUTH_FAILED');
  assert.equal(authCalls, 1);
  let schemaCalls = 0;
  await expectCode(() => createClovaOcrEngine(clovaConfig(), { fetchImplementation: async () => { schemaCalls += 1; return jsonResponse({}); } })
    .recognize({ filePath: fixture.jpeg, format: 'jpg' }), 'CLOVA_OCR_RESPONSE_INVALID');
  assert.equal(schemaCalls, 1);
  await expectCode(() => createClovaOcrEngine(clovaConfig({ maxRetries: 0 }), { fetchImplementation: async () => new Response('{', { status: 200 }) })
    .recognize({ filePath: fixture.jpeg, format: 'jpg' }), 'CLOVA_OCR_RESPONSE_INVALID');
  await expectCode(() => createClovaOcrEngine(clovaConfig({ maxRetries: 0, responseMaxBytes: 2 }), { fetchImplementation: async () => new Response('large', { status: 200 }) })
    .recognize({ filePath: fixture.jpeg, format: 'jpg' }), 'CLOVA_OCR_RESPONSE_TOO_LARGE');
  let timeoutCalls = 0;
  await expectCode(() => createClovaOcrEngine(clovaConfig({ timeoutMs: 20, maxRetries: 2 }), {
    fetchImplementation: async (_url, init) => {
      timeoutCalls += 1;
      return new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
    },
    sleep: async () => {},
  }).recognize({ filePath: fixture.jpeg, format: 'jpg' }), 'CLOVA_OCR_TIMEOUT');
  assert.equal(timeoutCalls, 1);

  const sensitiveEngine = createClovaOcrEngine(clovaConfig(), { fetchImplementation: async () => { throw new Error(`${fakeSecret} ${fakeUrl} ${fixture.jpeg}`); } });
  await assert.rejects(() => sensitiveEngine.recognize({ filePath: fixture.jpeg, format: 'jpg' }), (error) => {
    const exposed = `${error.message} ${error.stack || ''}`;
    assert.equal(exposed.includes(fakeSecret), false);
    assert.equal(exposed.includes(fakeUrl), false);
    assert.equal(exposed.includes(fixture.jpeg), false);
    return true;
  });
  assert.ok(actualCalls > 0);
}

async function testProcessor(root) {
  const order = [];
  let cleaned = false;
  const dependencies = {
    detector: async () => { order.push('detect'); return { detectedFileType: 'PNG', detectedMimeType: 'image/png', fileNameExtension: 'PNG', matchesExpectedType: true }; },
    metadataInspector: async () => { order.push('metadata'); return { format: 'png', width: 10, height: 20, pages: 1, orientation: null, hasAlpha: false, pixelCount: 200, estimatedRgbaBytes: 800 }; },
    preprocessor: async () => { order.push('preprocess'); return { filePath: path.join(root, 'ocr-input.png'), width: 10, height: 20, byteSize: 10, cleanup: async () => { cleaned = true; } }; },
  };
  const ocrEngine = { recognize: async () => {
    order.push('clova');
    return { rawText: 'secret', cleanedText: 'secret', engine: 'CLOVA_OCR', engineVersion: 'V2', isEmpty: false, durationMs: 1, apiCallCount: 1, retryCount: 0, averageConfidence: 0.9, fieldCount: 1, readingOrderStrategy: 'LINE_BREAK' };
  } };
  const processed = await processImageForOcr({ sourcePath: 'source', workDirectory: root, expectedType: 'PNG', ocrEngine }, imageConfig(), dependencies);
  assert.deepEqual(order, ['detect', 'metadata', 'preprocess', 'clova']);
  assert.equal(cleaned, true);
  assert.equal(processed.apiCallCount, 1);
  const summary = imageOcrLogSummary(processed);
  assert.equal('rawText' in summary, false);
  assert.equal('cleanedText' in summary, false);

  let apiCalled = false;
  await assert.rejects(() => processImageForOcr({
    sourcePath: 'source', workDirectory: root, expectedType: 'PNG', ocrEngine: { recognize: async () => { apiCalled = true; return ocrEngine.recognize(); } },
  }, imageConfig(), { ...dependencies, preprocessor: async () => { throw new Error('fail'); } }));
  assert.equal(apiCalled, false);
  cleaned = false;
  await assert.rejects(() => processImageForOcr({
    sourcePath: 'source', workDirectory: root, expectedType: 'PNG', ocrEngine: { recognize: async () => { throw new Error('api fail'); } },
  }, imageConfig(), dependencies));
  assert.equal(cleaned, true);
}

async function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'moira-attachment-ocr-test-'));
  try {
    const fixture = await makeFixtures(root);
    await testConfig();
    await testSubprocess(root);
    await testImages(root, fixture);
    await testMultipart(root, fixture);
    await testParser();
    await testClient(root, fixture);
    await testProcessor(root);
    console.log('CLOVA OCR client, parser, image processor, and shared subprocess tests passed with mock requests only.');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error && error.code ? { code: error.code, message: error.message } : error);
  process.exitCode = 1;
});
