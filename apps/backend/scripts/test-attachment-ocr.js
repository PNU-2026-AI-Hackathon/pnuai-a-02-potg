const assert = require('assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');
const { getAttachmentOcrConfig } = require('../dist/config/attachmentOcr');
const { AttachmentProcessingError } = require('../dist/services/attachment/attachmentErrors');
const { inspectImageMetadata } = require('../dist/services/attachment/imageMetadata');
const { preprocessImage } = require('../dist/services/attachment/imagePreprocessor');
const { processImageForOcr, imageOcrLogSummary } = require('../dist/services/attachment/imageOcrProcessor');
const { runSubprocess } = require('../dist/services/attachment/subprocessRunner');
const { checkTesseract, parseTesseractLanguages, parseTesseractVersion, runTesseractOcr } = require('../dist/services/attachment/tesseractOcr');

const helper = path.resolve(__dirname, 'fake-subprocess.js');
const hash = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const expectCode = (action, code) => assert.rejects(action, (error) => error && error.code === code);
const baseConfig = () => getAttachmentOcrConfig({});

async function makeFixtures(root) {
  const jpeg = path.join(root, 'small.jpg');
  const png = path.join(root, 'transparent.png');
  const landscape = path.join(root, 'landscape.png');
  const portrait = path.join(root, 'portrait.png');
  const oriented = path.join(root, 'oriented.jpg');
  const animated = path.join(root, 'multipage.tiff');
  await sharp({ create: { width: 20, height: 10, channels: 3, background: '#336699' } }).jpeg().toFile(jpeg);
  await sharp({ create: { width: 10, height: 10, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toFile(png);
  await sharp({ create: { width: 80, height: 20, channels: 3, background: '#ffffff' } }).png().toFile(landscape);
  await sharp({ create: { width: 20, height: 80, channels: 3, background: '#ffffff' } }).png().toFile(portrait);
  await sharp({ create: { width: 20, height: 10, channels: 3, background: '#ffffff' } }).jpeg().withMetadata({ orientation: 6 }).toFile(oriented);
  await sharp({ create: { width: 4, height: 8, channels: 4, background: '#ffffff', pageHeight: 4 } }).tiff().toFile(animated);
  fs.writeFileSync(path.join(root, 'broken.jpg'), Buffer.from('ffd8ff00deadbeef', 'hex'));
  fs.writeFileSync(path.join(root, 'broken.png'), Buffer.from('89504e470d0a1a0a', 'hex'));
  return { jpeg, png, landscape, portrait, oriented, animated };
}

async function testConfig() {
  const config = baseConfig();
  assert.equal(config.languageArgument, 'kor+eng');
  assert.equal(config.psm, 6);
  assert.equal(config.ocrTimeoutMs, 60_000);
  assert.equal(config.imageMaxPixels, 40_000_000);
  assert.throws(() => getAttachmentOcrConfig({ ATTACHMENT_OCR_TIMEOUT_MS: '0' }));
  assert.throws(() => getAttachmentOcrConfig({ ATTACHMENT_OCR_TIMEOUT_MS: 'NaN' }));
  assert.throws(() => getAttachmentOcrConfig({ ATTACHMENT_OCR_LANGUAGES: 'kor;rm' }));
  assert.throws(() => getAttachmentOcrConfig({ ATTACHMENT_OCR_PSM: '14' }));
}

async function testSubprocess(root) {
  const common = { executable: process.execPath, timeoutMs: 2_000, stdoutMaxBytes: 128, stderrMaxBytes: 128 };
  const normal = await runSubprocess({ ...common, args: [helper, 'echo', 'safe argument'] });
  assert.equal(normal.stdout.toString(), 'safe argument');
  await expectCode(() => runSubprocess({ ...common, args: [helper, 'exit', '7'] }), 'SUBPROCESS_EXIT_FAILED');
  await expectCode(() => runSubprocess({ ...common, executable: path.join(root, 'missing-executable'), args: [] }), 'SUBPROCESS_NOT_FOUND');
  await expectCode(() => runSubprocess({ ...common, timeoutMs: 50, args: [helper, 'delay', '1000'] }), 'SUBPROCESS_TIMEOUT');
  await expectCode(() => runSubprocess({ ...common, args: [helper, 'stdout', '129'] }), 'SUBPROCESS_OUTPUT_LIMIT_EXCEEDED');
  await expectCode(() => runSubprocess({ ...common, args: [helper, 'stderr', '129'] }), 'SUBPROCESS_OUTPUT_LIMIT_EXCEEDED');
  const controller = new AbortController();
  controller.abort();
  await expectCode(() => runSubprocess({ ...common, args: [helper, 'delay', '1000'], signal: controller.signal }), 'SUBPROCESS_TERMINATED');
  const marker = path.join(root, 'must-not-exist');
  const payload = `value;touch ${marker}`;
  const echoed = await runSubprocess({ ...common, args: [helper, 'echo', payload] });
  assert.equal(echoed.stdout.toString(), payload);
  assert.equal(fs.existsSync(marker), false);
  await assert.rejects(() => runSubprocess({ ...common, executable: path.join(root, 'private', 'missing'), args: [] }), (error) => {
    assert.equal(error.message.includes(root), false);
    return true;
  });
}

async function testMetadataAndPreprocessing(root, fixture) {
  const config = baseConfig();
  const jpeg = await inspectImageMetadata(fixture.jpeg, config);
  assert.deepEqual([jpeg.format, jpeg.width, jpeg.height, jpeg.pages], ['jpeg', 20, 10, 1]);
  const png = await inspectImageMetadata(fixture.png, config);
  assert.equal(png.format, 'png');
  assert.equal(png.hasAlpha, true);
  await expectCode(() => inspectImageMetadata(fixture.animated, config), 'IMAGE_ANIMATION_UNSUPPORTED');
  await expectCode(() => inspectImageMetadata(path.join(root, 'broken.jpg'), config), 'IMAGE_DECODE_FAILED');
  await expectCode(() => inspectImageMetadata(path.join(root, 'broken.png'), config), 'IMAGE_DECODE_FAILED');
  await expectCode(() => inspectImageMetadata(fixture.landscape, { ...config, imageMaxWidth: 50 }), 'IMAGE_DIMENSION_LIMIT_EXCEEDED');
  await expectCode(() => inspectImageMetadata(fixture.portrait, { ...config, imageMaxHeight: 50 }), 'IMAGE_DIMENSION_LIMIT_EXCEEDED');
  await expectCode(() => inspectImageMetadata(fixture.jpeg, { ...config, imageMaxPixels: 199 }), 'IMAGE_PIXEL_LIMIT_EXCEEDED');
  await expectCode(() => inspectImageMetadata(fixture.jpeg, { ...config, imageMaxDecodeBytes: 799 }), 'IMAGE_DECODE_MEMORY_LIMIT_EXCEEDED');

  const work = path.join(root, 'preprocess');
  fs.mkdirSync(work);
  const sourceHash = hash(fixture.oriented);
  const prepared = await preprocessImage(fixture.oriented, work, { ...config, imageOcrMaxLongEdge: 12 });
  assert.deepEqual([prepared.width, prepared.height], [6, 12]);
  assert.equal((await sharp(prepared.filePath).metadata()).format, 'png');
  assert.equal(hash(fixture.oriented), sourceHash);
  await prepared.cleanup();
  assert.equal(fs.existsSync(prepared.filePath), false);

  const small = await preprocessImage(fixture.png, work, config);
  assert.deepEqual([small.width, small.height], [10, 10]);
  const pixel = await sharp(small.filePath).raw().toBuffer();
  assert.equal(pixel[0], 255);
  await small.cleanup();
}

function result(stdout = '', stderr = '') {
  return { exitCode: 0, signal: null, stdout: Buffer.from(stdout), stderr: Buffer.from(stderr), durationMs: 1 };
}

async function testTesseract(root) {
  const config = baseConfig();
  assert.equal(parseTesseractVersion('tesseract 5.5.0\n leptonica'), '5.5.0');
  assert.deepEqual(parseTesseractLanguages('List of available languages (2):\neng\nkor\n'), ['eng', 'kor']);
  const preflightRunner = async (options) => options.args[0] === '--version' ? result('tesseract 5.5.0\n') : result('List:\neng\nkor\n');
  assert.equal((await checkTesseract(config, preflightRunner)).version, '5.5.0');
  await expectCode(() => checkTesseract(config, async (options) => options.args[0] === '--version' ? result('tesseract 5.5.0') : result('eng\n')), 'OCR_LANGUAGE_DATA_MISSING');
  await expectCode(() => checkTesseract(config, async () => { throw new AttachmentProcessingError('SUBPROCESS_NOT_FOUND', 'private path'); }), 'OCR_BINARY_NOT_FOUND');

  const inputPath = path.join(root, 'ocr-input.png');
  fs.writeFileSync(inputPath, 'input');
  let receivedArgs;
  const fakeOcr = async (options) => {
    receivedArgs = options.args;
    fs.writeFileSync(`${options.args[1]}.txt`, '  한글\u0000  text\r\n\r\n\r\n42  ', 'utf8');
    return result();
  };
  const ocr = await runTesseractOcr({ inputPath, workDirectory: root, engineVersion: '5.5.0' }, config, fakeOcr);
  assert.deepEqual(receivedArgs.slice(2), ['-l', 'kor+eng', '--psm', '6', 'txt']);
  assert.equal(ocr.rawText.includes('\u0000'), false);
  assert.equal(ocr.cleanedText, '한글 text\n\n42');
  assert.equal(fs.existsSync(path.join(root, 'ocr-output.txt')), false);
  const empty = await runTesseractOcr({ inputPath, workDirectory: root, engineVersion: '5.5.0' }, config, async (options) => { fs.writeFileSync(`${options.args[1]}.txt`, ' \n'); return result(); });
  assert.equal(empty.isEmpty, true);
  await expectCode(() => runTesseractOcr({ inputPath, workDirectory: root, engineVersion: '5.5.0' }, config, async () => { throw new AttachmentProcessingError('SUBPROCESS_TIMEOUT', 'timeout'); }), 'OCR_TIMEOUT');
  await expectCode(() => runTesseractOcr({ inputPath, workDirectory: root, engineVersion: '5.5.0' }, config, async () => { throw new AttachmentProcessingError('SUBPROCESS_EXIT_FAILED', 'exit'); }), 'OCR_PROCESS_FAILED');
  await expectCode(() => runTesseractOcr({ inputPath, workDirectory: root, engineVersion: '5.5.0' }, { ...config, ocrOutputMaxBytes: 2 }, async (options) => { fs.writeFileSync(`${options.args[1]}.txt`, 'large'); return result(); }), 'OCR_OUTPUT_TOO_LARGE');
}

async function testProcessor(root) {
  const order = [];
  let cleaned = false;
  const dependencies = {
    detector: async () => { order.push('detect'); return { detectedFileType: 'PNG', detectedMimeType: 'image/png', fileNameExtension: 'PNG', matchesExpectedType: true }; },
    metadataInspector: async () => { order.push('metadata'); return { format: 'png', width: 10, height: 20, pages: 1, orientation: null, hasAlpha: false, pixelCount: 200, estimatedRgbaBytes: 800 }; },
    preprocessor: async () => { order.push('preprocess'); return { filePath: path.join(root, 'ocr-input.png'), width: 10, height: 20, byteSize: 10, cleanup: async () => { cleaned = true; } }; },
    ocr: async () => { order.push('ocr'); return { rawText: 'secret', cleanedText: 'secret', engine: 'TESSERACT_OCR', engineVersion: '5', languages: ['kor', 'eng'], durationMs: 1, isEmpty: false }; },
  };
  const processed = await processImageForOcr({ sourcePath: 'source', workDirectory: root, expectedType: 'PNG', engineVersion: '5' }, baseConfig(), dependencies);
  assert.deepEqual(order, ['detect', 'metadata', 'preprocess', 'ocr']);
  assert.equal(cleaned, true);
  assert.equal(processed.pixelCount, 200);
  const summary = imageOcrLogSummary(processed);
  assert.equal('rawText' in summary, false);
  assert.equal('cleanedText' in summary, false);

  let ocrCalled = false;
  await assert.rejects(() => processImageForOcr({ sourcePath: 'source', workDirectory: root, expectedType: 'PNG', engineVersion: '5' }, baseConfig(), { ...dependencies, preprocessor: async () => { throw new Error('fail'); }, ocr: async () => { ocrCalled = true; return dependencies.ocr(); } }));
  assert.equal(ocrCalled, false);
  cleaned = false;
  await assert.rejects(() => processImageForOcr({ sourcePath: 'source', workDirectory: root, expectedType: 'PNG', engineVersion: '5' }, baseConfig(), { ...dependencies, ocr: async () => { throw new Error('fail'); } }));
  assert.equal(cleaned, true);
}

async function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'moira-attachment-ocr-test-'));
  try {
    const fixture = await makeFixtures(root);
    await testConfig();
    await testSubprocess(root);
    await testMetadataAndPreprocessing(root, fixture);
    await testTesseract(root);
    await testProcessor(root);
    console.log('Attachment OCR foundation tests passed.');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
