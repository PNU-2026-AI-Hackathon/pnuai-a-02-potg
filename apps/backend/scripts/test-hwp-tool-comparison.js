const assert = require('assert/strict');
const { extractDocument, tableText } = require('./hwpjs-extract-adapter');
const { SAMPLE_IDS, textMetrics } = require('../dist/cli/compareHwpExtractionTools');

const paragraph = (text, controls = []) => ({
  content: [...text].map((value) => ({ value })),
  controls,
});

const table = {
  rowCount: 2,
  content: [
    [{ items: [paragraph('대상')] }, { items: [paragraph('초등학생')] }],
    [{ items: [paragraph('장소')] }, { items: [paragraph('도서관')] }],
  ],
};

const document = {
  sections: [{ content: [paragraph('강의계획서', [table]), paragraph('두 번째 문단')] }],
};

assert.equal(SAMPLE_IDS.length, 4);
assert.equal(tableText(table), '[TABLE]\n대상\t초등학생\n장소\t도서관\n[/TABLE]');
assert.equal(
  extractDocument(document),
  '강의계획서\n[TABLE]\n대상\t초등학생\n장소\t도서관\n[/TABLE]\n두 번째 문단',
);
assert.deepEqual(textMetrics('한글\n\n본문'), {
  rawCharacters: 6,
  nonWhitespaceCharacters: 4,
  lineCount: 3,
  blankLineCount: 1,
});
console.log('HWP tool comparison mock tests passed.');
