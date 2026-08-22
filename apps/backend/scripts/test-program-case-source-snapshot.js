const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {
  buildSourceSnapshot, loadCrawlerSource, validateBuiltSnapshot,
} = require('../dist/services/programCaseSourceSnapshot/sourceSnapshotService');

const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');

function baseProgram() {
  const binary = Buffer.from('same verified binary');
  const mismatch = Buffer.from('expected different binary');
  return {
    binary, mismatch,
    row: {
      id: 'program-1', sourceType: 'SOURCE', sourcePostId: '1', sourceUrl: 'https://example.test/program/1',
      title: '프로그램', targetAudience: '어린이', instructor: '', capacity: 10, currentApplicants: 0,
      applicationStatus: 'OPEN', educationStartDate: new Date('2026-01-01T00:00:00Z'),
      educationEndDate: new Date('2026-01-02T00:00:00Z'), educationStartDateText: '2026-01-01',
      educationEndDateText: '2026-01-02', location: null, feeText: null, preparationText: null,
      contactText: null, notices: '본문', rawText: '평탄화 본문', hasUnparsedAttachments: true,
      crawledAt: new Date('2026-01-03T00:00:00Z'), requestSucceeded: true, parseWarnings: [],
      createdAt: new Date('2026-01-03T00:00:00Z'), updatedAt: new Date('2026-01-03T00:00:00Z'), sessions: [],
      attachments: [
        attachment('a1', 'https://example.test/a1', hash(binary)),
        attachment('a2', 'https://example.test/a2', hash(binary)),
        attachment('a3', 'https://example.test/a3', hash(mismatch)),
        attachment('a4', 'https://example.test/a4', hash(Buffer.from('failure'))),
      ],
    },
  };
}

function attachment(id, fileUrl, checksumSha256) {
  return {
    id, programCaseId: 'program-1', fileName: `${id}.pdf`, fileUrl, fileType: 'pdf',
    detectedFileType: 'PDF', detectedMimeType: 'application/pdf', fileSizeBytes: null,
    checksumSha256, extractionStatus: 'COMPLETED', rawText: 'parser raw', cleanedText: 'parser cleaned',
    extractorType: 'PDFJS_TEXT', extractorVersion: 'fixture', failureCode: null, failureMessage: null,
    attemptCount: 1, lastAttemptedAt: null, extractedAt: null, isActive: true,
    createdAt: new Date('2026-01-03T00:00:00Z'), updatedAt: new Date('2026-01-03T00:00:00Z'),
  };
}

(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'source-snapshot-test-'));
  const crawlerFile = path.join(root, 'crawler.json');
  const output = path.join(root, 'output');
  const setup = baseProgram();
  const crawlerRecord = {
    sourceType: 'SOURCE', sourcePostId: '1', sourceUrl: setup.row.sourceUrl,
    sessions: [], attachments: setup.row.attachments.map((item) => ({ fileUrl: item.fileUrl })), rawText: 'crawler DTO',
  };
  await fs.writeFile(crawlerFile, JSON.stringify([crawlerRecord]));
  const crawler = await loadCrawlerSource(crawlerFile, 'fixture.json');
  const rows = { databaseName: 'fixture', programs: [setup.row] };
  let downloads = 0;
  const download = async (url) => {
    downloads += 1;
    if (url.endsWith('/a4')) throw Object.assign(new Error('failed'), { code: 'DOWNLOAD_FAILED' });
    const value = url.endsWith('/a3') ? Buffer.from('changed response') : setup.binary;
    const temp = path.join(root, `${downloads}.bin`);
    await fs.writeFile(temp, value);
    return {
      tempFilePath: temp, byteSize: value.length, checksumSha256: hash(value),
      responseContentType: 'application/pdf', finalHost: 'example.test', cleanup: async () => fs.rm(temp, { force: true }),
    };
  };
  const detect = async () => ({ detectedFileType: 'PDF', detectedMimeType: 'application/pdf' });
  const first = await buildSourceSnapshot({
    rows, crawler, outputDirectory: output,
    dependencies: { download, detect, now: () => new Date('2026-02-01T00:00:00Z') },
  });
  assert.equal(downloads, 4, 'fresh build must request every attachment URL');
  assert.equal(first.report.counts.verifiedSnapshots, 2);
  assert.equal(first.report.counts.hashMismatches, 1);
  assert.equal(first.report.counts.failedSnapshots, 2);
  assert.equal(first.report.counts.uniqueVerifiedBinaries, 1);
  assert.equal(first.manifest.attachmentSnapshots.find((item) => item.attachmentId === 'a1').linkedAttachmentIds.length, 2);
  const binaries = await fs.readdir(path.join(output, 'sha256'));
  assert.deepEqual(binaries, [hash(setup.binary)], 'same hash must store one binary directory');
  const firstHash = first.manifest.datasetSnapshotHash;
  const second = await buildSourceSnapshot({
    rows, crawler, outputDirectory: output,
    dependencies: { download, detect, now: () => new Date('2026-03-01T00:00:00Z') },
  });
  assert.equal(downloads, 6, 'verified attachments are reused while failed attachments retry');
  assert.equal(second.manifest.datasetSnapshotHash, firstHash, 'timestamps must not change dataset hash');
  const validated = await validateBuiltSnapshot({ rows, crawler, outputDirectory: output });
  assert.equal(validated.manifest.datasetSnapshotHash, firstHash);
  const record = JSON.parse((await fs.readFile(path.join(output, 'program-cases.jsonl'), 'utf8')).trim());
  assert.equal(record.sessions.length, 0);
  assert.equal(record.attachments[0].flattenedRepresentations[0].lossy, true);
  await fs.rm(root, { recursive: true, force: true });
  console.log('Program case source snapshot tests passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
