const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { getHwpAnalysisLimits } = require('../dist/config/hwpAnalysis');
const { analyzeHwpContainer } = require('../dist/services/attachment/hwpContainerAnalyzer');
const {
  analyzeHwpAttachment,
  analyzeHwpDataset,
  maskUrl,
} = require('../dist/services/attachment/hwpAttachmentAnalysisService');
const { detectAttachmentFileType } = require('../dist/services/attachment/fileTypeDetector');

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function storedZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, contents] of entries) {
    const nameBytes = Buffer.from(name);
    const data = Buffer.from(contents);
    const checksum = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    const localRecord = Buffer.concat([local, nameBytes, data]);
    locals.push(localRecord);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(Buffer.concat([central, nameBytes]));
    offset += localRecord.length;
  }
  const centralDirectory = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralDirectory, eocd]);
}

function row(id, name = 'sample.hwp') {
  return {
    id,
    programCaseId: '10000000-0000-4000-8000-000000000001',
    fileName: name,
    fileUrl: 'https://www.geumjeong.go.kr/file?token=secret',
    fileType: name.endsWith('x') ? 'HWPX' : 'HWP',
    extractionStatus: 'PENDING',
    extractorType: null,
    rawTextPresent: false,
    cleanedTextPresent: false,
  };
}

async function main() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'moira-hwp-analysis-test-'));
  try {
    const limits = getHwpAnalysisLimits({});
    const validHwpx = storedZip([
      ['mimetype', 'application/hwp+zip'],
      ['Contents/content.hpf', '<opf/>'],
      ['Contents/section0.xml', '<section/>'],
      ['META-INF/manifest.xml', '<manifest/>'],
    ]);
    const validPath = path.join(temp, 'valid.hwpx');
    fs.writeFileSync(validPath, validHwpx);
    const valid = await analyzeHwpContainer(validPath, validHwpx.length, limits);
    assert.strictEqual(valid.isActualHwpx, true);
    assert.strictEqual(valid.hwpx.sectionCount, 1);

    const missingPath = path.join(temp, 'missing.hwpx');
    const missing = storedZip([['mimetype', 'application/hwp+zip']]);
    fs.writeFileSync(missingPath, missing);
    const missingResult = await analyzeHwpContainer(missingPath, missing.length, limits);
    assert.strictEqual(missingResult.isActualHwpx, false);
    assert.strictEqual(missingResult.hwpx.requiredEntriesValid, false);

    const traversalPath = path.join(temp, 'traversal.hwpx');
    const traversal = storedZip([['../escape.xml', 'x']]);
    fs.writeFileSync(traversalPath, traversal);
    await assert.rejects(() => analyzeHwpContainer(traversalPath, traversal.length, limits), /unsafe/);

    const brokenPath = path.join(temp, 'broken.zip');
    fs.writeFileSync(brokenPath, Buffer.from('504b030400000000', 'hex'));
    await assert.rejects(() => analyzeHwpContainer(brokenPath, 8, limits), /end-of-central-directory/);

    const ordinaryOlePath = path.join(temp, 'ordinary.doc');
    fs.writeFileSync(ordinaryOlePath, Buffer.concat([
      Buffer.from('d0cf11e0a1b11ae1', 'hex'),
      Buffer.alloc(504),
    ]));
    await assert.rejects(() => analyzeHwpContainer(ordinaryOlePath, 512, limits));

    const htmlPath = path.join(temp, 'error.html');
    fs.writeFileSync(htmlPath, '<!doctype html><html>error</html>');
    await assert.rejects(
      () => detectAttachmentFileType({ filePath: htmlPath, responseContentType: 'text/html' }),
      (error) => error.code === 'HTML_RESPONSE',
    );

    let cleaned = 0;
    const successfulDownloader = async () => ({
      tempFilePath: validPath,
      byteSize: validHwpx.length,
      checksumSha256: crypto.createHash('sha256').update(validHwpx).digest('hex'),
      responseContentType: 'application/octet-stream',
      finalHost: 'www.geumjeong.go.kr',
      cleanup: async () => { cleaned += 1; },
    });
    const analyzed = await analyzeHwpAttachment(row('10000000-0000-4000-8000-000000000002', 'sample.hwpx'), {
      downloader: successfulDownloader,
      limits,
    });
    assert.strictEqual(analyzed.detectedFileType, 'HWPX');
    assert.strictEqual(cleaned, 1);
    assert(!analyzed.fileUrl.includes('secret'));
    assert(maskUrl('https://example.test/a?token=abc').includes('***'));

    let failureCleaned = 0;
    const failureDownloader = async () => ({
      tempFilePath: brokenPath,
      byteSize: 8,
      checksumSha256: '0'.repeat(64),
      responseContentType: null,
      finalHost: 'www.geumjeong.go.kr',
      cleanup: async () => { failureCleaned += 1; },
    });
    const failed = await analyzeHwpAttachment(row('10000000-0000-4000-8000-000000000003'), {
      downloader: failureDownloader,
      limits,
    });
    assert(['UNSUPPORTED_FILE_TYPE', 'HWPX_CONTAINER_INVALID'].includes(failed.errorCode));
    assert.strictEqual(failureCleaned, 1);

    let calls = 0;
    const continued = await analyzeHwpDataset([
      row('10000000-0000-4000-8000-000000000004'),
      row('10000000-0000-4000-8000-000000000005', 'next.hwpx'),
    ], {}, {
      limits,
      downloader: async () => {
        calls += 1;
        if (calls === 1) throw Object.assign(new Error('download failed'), { code: 'DOWNLOAD_FAILED' });
        return successfulDownloader();
      },
    });
    assert.strictEqual(continued.results.length, 2);
    assert.strictEqual(continued.results[0].errorCode, 'UNKNOWN_ERROR');
    assert.strictEqual(continued.results[1].detectedFileType, 'HWPX');

    const repositorySource = fs.readFileSync(
      path.join(__dirname, '../src/services/attachment/hwpReadOnlyRepository.ts'),
      'utf8',
    );
    assert(repositorySource.includes('BEGIN TRANSACTION READ ONLY'));
    assert(!/\b(UPDATE|INSERT|DELETE|UPSERT|TRUNCATE)\b/.test(
      repositorySource.replace(/BEGIN TRANSACTION READ ONLY/g, '').replace(/SELECT[\s\S]*?FROM/g, ''),
    ));
    console.log('HWP analysis tests passed.');
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
