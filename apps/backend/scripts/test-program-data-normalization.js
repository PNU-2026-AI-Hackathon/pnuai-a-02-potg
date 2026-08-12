const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const moduleRoot = process.env.PROGRAM_NORMALIZATION_MODULE_ROOT
  ? path.resolve(process.env.PROGRAM_NORMALIZATION_MODULE_ROOT)
  : path.resolve(__dirname, '../dist/services/programDataNormalization');
const { normalizeProgram } = require(path.join(moduleRoot, 'normalizer.js'));

const crawlPath = process.env.PROGRAM_NORMALIZATION_CRAWL;
const reviewPath = process.env.PROGRAM_NORMALIZATION_REVIEW;
if (!crawlPath || !reviewPath) throw new Error('PROGRAM_NORMALIZATION_CRAWL and PROGRAM_NORMALIZATION_REVIEW are required');

const crawl = JSON.parse(fs.readFileSync(crawlPath, 'utf8'));
const review = JSON.parse(fs.readFileSync(reviewPath, 'utf8'));
const byId = new Map(crawl.records.map((record) => [record.idx, record]));

assert.equal(review.count, 20);
assert.equal(review.items.length, 20);
assert.equal(new Set(review.items.map((item) => item.raw.idx)).size, 20);

for (const item of review.items) {
  const original = byId.get(item.raw.idx);
  assert.ok(original, `Missing source record ${item.raw.idx}`);
  const enriched = { ...original, ...(review.sourceVerification?.results.find((result) => result.sourceId === original.idx)?.live ?? {}) };
  assert.deepEqual(item.raw, enriched);
  assert.deepEqual(item.normalized, normalizeProgram(enriched));
  assert.equal(item.normalized.sourceId, original.idx);
  assert.equal(item.normalized.sourceUrl, original.url);
  assert.deepEqual(item.normalized.attachments, original.attachments);
  if (item.normalized.description !== null) assert.equal(item.normalized.description, original.detailText.trim());
  for (const feeLine of item.normalized.evidence.feeLines) assert.ok(original.detailText.includes(feeLine));
}

const materialFee = review.items.find((item) => item.raw.idx === 2456).normalized;
assert.equal(materialFee.materialFeeAmount, 5000);
assert.equal(materialFee.isFree, null);

const freeWithMaterial = review.items.find((item) => item.raw.idx === 2702).normalized;
assert.equal(freeWithMaterial.isFree, true);
assert.equal(freeWithMaterial.materialFeeAmount, 30000);

const excluded = review.items.find((item) => item.raw.idx === 4201).normalized;
assert.equal(excluded.isExcluded, true);
assert.equal(excluded.normalizationStatus, 'excluded');

const capacityConflict = review.items.find((item) => item.raw.idx === 4383).normalized;
assert.equal(capacityConflict.capacity, 10);
assert.ok(capacityConflict.warnings.includes('CAPACITY_OVERRIDDEN_BY_DETAIL'));
assert.equal(capacityConflict.normalizationStatus, 'partial');

console.log('Program data normalization tests passed.');
