const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  buildProgramAttachmentInventory,
  extractionRouteOf,
} = require('../src/cli/buildProgramAttachmentInventory');

assert.equal(extractionRouteOf('.hwp'), 'HWP_TEXT');
assert.equal(extractionRouteOf('.hwpx'), 'HWPX_TEXT');
assert.equal(extractionRouteOf('.pdf'), 'PDF_CLASSIFY');
assert.equal(extractionRouteOf('.jpg'), 'IMAGE_OCR');
assert.equal(extractionRouteOf(null), 'UNKNOWN_REVIEW');

const crawlPath = process.env.PROGRAM_BOARD_CRAWL;
if (!crawlPath) throw new Error('PROGRAM_BOARD_CRAWL is required');
const records = JSON.parse(fs.readFileSync(path.resolve(crawlPath), 'utf8')).records;
const result = buildProgramAttachmentInventory(records);

assert.equal(result.schemaVersion, 'program-attachment-inventory/v1');
assert.equal(result.count, 198, '현재 351건 기준 text_with_supplement는 198건이어야 한다');
assert.equal(result.items.length, result.count);
assert.ok(result.items.every((item) => item.attachmentReviewStatus === 'ATTACHMENT_UNCHECKED'));
assert.ok(result.items.every((item) => item.bodyTextLength > 0));
assert.ok(result.items.every((item) => item.attachmentCount + item.inlineImageCount > 0));
assert.ok(result.items.every((item) => item.extractionRoutes.length > 0));
assert.equal(new Set(result.items.map((item) => item.sourceId)).size, result.count);

console.log('Program attachment inventory tests passed.');
