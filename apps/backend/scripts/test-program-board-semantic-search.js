require('ts-node/register');
const assert = require('node:assert/strict');
const { buildSearchDocuments, buildSearchDocument } = require('../src/services/programBoardSemanticSearch/profileBuilder');

const source = {
  sourceId: 4354, sourceUrl: 'https://example.test/4354', title: '환경 수업',
  targetGroup: '초등학생', targetDetail: '1~3학년', libraryName: '작은도서관',
  description: '목 표 자연과 환경을 배우고 만들기 활동을 한다. 교육대상 초등학생',
  board: { intro: [], sections: [{ id: 'content', items: [{ label: '운영내용', value: '기후와 생태 만들기' }, { label: '신청일시', value: '2026년 1월' }] }] },
};

const title = buildSearchDocument(source, 'title');
assert.equal(title.embeddingText, '[제목] 환경 수업');
const intro = buildSearchDocument(source, 'title+intro');
assert.match(intro.embeddingText, /기후와 생태 만들기/);
assert.doesNotMatch(intro.embeddingText, /2026년 1월/);
assert.doesNotMatch(intro.embeddingText, /\[대상\]/);
const target = buildSearchDocument(source, 'title+intro+target');
assert.match(target.embeddingText, /\[대상\] 1~3학년/);
assert.equal(target.checksum.length, 64);
assert.throws(() => buildSearchDocuments([source, source], 'title'), /duplicate sourceId/);
const detailed = buildSearchDocument({ ...source, description: '목 표 환경 교육\n교육대상 초등\n차시 일자 세부 교육내용\n1 8/1 첫 활동\n2 8/8 둘째 활동' }, 'title+intro+target');
assert.equal(detailed.detailLevel, 'detailed');
assert.equal(detailed.sessionCount, 2);
console.log('program board semantic search profile tests passed');
