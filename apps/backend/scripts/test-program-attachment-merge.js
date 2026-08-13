const assert = require('node:assert/strict');
const fs = require('node:fs');
const { buildMergedSamples } = require('../src/cli/buildProgramAttachmentMergedSamples');

const crawl = process.env.PROGRAM_BOARD_CRAWL;
const enrichment = process.env.PROGRAM_ATTACHMENT_ENRICHMENT;
if (!crawl || !enrichment) throw new Error('PROGRAM_BOARD_CRAWL and PROGRAM_ATTACHMENT_ENRICHMENT are required');
const records = JSON.parse(fs.readFileSync(crawl, 'utf8')).records;
const samples = JSON.parse(fs.readFileSync(enrichment, 'utf8')).results;
const result = buildMergedSamples(records, samples);

assert.equal(result.count, 10);
assert.ok(result.summary.skippedDuplicates > 0, '기본정보와 같은 첨부 항목이 중복 제거되어야 한다');
assert.ok(result.summary.curriculumSessions >= 36, 'HWP와 단순 PDF 회차가 공통 구조로 변환되어야 한다');
for (const item of result.items) {
  assert.equal('selectedText' in item, false, '첨부 전체 원문을 최종 병합 데이터에 넣으면 안 된다');
  assert.equal('rawText' in item, false, '첨부 원문은 검수 근거 파일에만 있어야 한다');
  assert.ok(item.attachmentEvidence.url);
  assert.equal(new Set(item.curriculum.map((session) => session.session)).size, item.curriculum.length);
}

const japanese = result.items.find((item) => item.sourceId === 2480);
assert.equal(japanese.curriculum.length, 8);
assert.equal(japanese.curriculum[0].date, '9월17일');
assert.ok(japanese.curriculum[0].activity.includes('형용동사'));
assert.ok(!japanese.mergeAudit.added.some((item) => item.value === '비고'));

const boardGame = result.items.find((item) => item.sourceId === 2701);
assert.ok(!boardGame.mergeAudit.added.some((item) => /차시\s*세부 교육내용/.test(item.value)));

console.log('Program attachment merge tests passed.');
