const assert = require('node:assert/strict');
const { stableHash, stableJson } = require('../dist/services/programCaseSourceSnapshot/stableJson');
const { buildProgramCaseSourceRecord } = require('../dist/services/programCaseSourceSnapshot/sourceContractBuilder');

function program() {
  return {
    id: 'p1', sourceType: 'SOURCE', sourcePostId: '1', sourceUrl: 'https://example.test/1',
    title: '제목', targetAudience: '대상', instructor: '강사', capacity: 10,
    currentApplicants: 1, applicationStatus: 'OPEN',
    educationStartDate: new Date('2026-01-01T00:00:00Z'), educationEndDate: new Date('2026-01-02T00:00:00Z'),
    educationStartDateText: '2026-01-01', educationEndDateText: '2026-01-02',
    location: null, feeText: null, preparationText: null, contactText: null,
    notices: '정리된 본문', rawText: 'HTML이 아닌 평탄화 본문', hasUnparsedAttachments: false,
    crawledAt: new Date('2026-01-03T00:00:00Z'), requestSucceeded: true, parseWarnings: [],
    createdAt: new Date(), updatedAt: new Date(), sessions: [], attachments: [],
  };
}

assert.equal(stableJson({ b: 1, a: { d: 2, c: 3 } }), '{"a":{"c":3,"d":2},"b":1}');
assert.equal(stableHash({ b: 1, a: 2 }), stableHash({ a: 2, b: 1 }));
const crawler = { sourceType: 'SOURCE', sourcePostId: '1', sourceUrl: 'https://example.test/1', rawText: 'DTO' };
const first = buildProgramCaseSourceRecord({ program: program(), crawlerRecord: crawler, crawlerSourceRef: 'fixture.json' });
const second = buildProgramCaseSourceRecord({ program: program(), crawlerRecord: { ...crawler }, crawlerSourceRef: 'fixture.json' });
assert.equal(first.recordHash, second.recordHash);
assert.deepEqual(first.sessions, [], 'missing sessions must not become a single session');
assert.equal(first.core.flattenedRepresentations[1].lossy, true);
assert.ok(first.core.flattenedRepresentations[1].provenance.unresolvedReasons.includes('CRAWLER_HTML_SNAPSHOT_UNAVAILABLE'));
assert.equal(first.crawler.provenance.lossy, true);
console.log('Program case source contract tests passed.');
