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

// --- 코퍼스 어댑터 -----------------------------------------------------------

const { buildCorpusSources, toSearchSource } = require('../src/services/programBoardSemanticSearch/corpusAdapter');

const normalized = {
  sourceId: 4351, sourceUrl: 'https://example.test/4351', title: '클레이 수업',
  basicInfo: [{ label: '대상', value: '유아 6~7세' }, { label: '운영 도서관', value: '북파크 작은도서관' }],
  board: { intro: [], sections: [] },
  curriculum: [{ session: 1, activity: '첫 활동' }],
  lane: 'TEXT_ONLY',
};
const crawled = { idx: 4351, bodyText: '목 표 그림책을 읽고 표현한다. 교육대상 유아', programContent: { tables: [] } };

const mapped = toSearchSource(normalized, crawled);
assert.equal(mapped.targetDetail, '유아 6~7세', '대상은 기본정보에서 가져온다');
assert.equal(mapped.libraryName, '북파크 작은도서관');
assert.equal(mapped.sourceType, 'text', '본문만 있는 건은 텍스트 계열로 본다');
assert.equal(mapped.description, crawled.bodyText, '본문 원문을 이어 붙여야 소개를 살릴 수 있다');

// 정제가 항목을 못 뽑아도 본문 원문에 목표가 있으면 소개가 살아난다.
const withBody = buildSearchDocument(mapped, 'title+intro+target');
assert.match(withBody.embeddingText, /그림책을 읽고 표현한다/);
const withoutBody = buildSearchDocument(toSearchSource(normalized, null), 'title+intro+target');
assert.doesNotMatch(withoutBody.embeddingText, /그림책을 읽고 표현한다/);

assert.equal(toSearchSource({ ...normalized, lane: 'DOC_EXTRACT' }, crawled).sourceType, 'attachment');

// 크롤에 짝이 없어도 만들 수 있어야 한다. 정제 결과가 기준이다.
assert.equal(buildCorpusSources([normalized], []).length, 1);
assert.throws(() => buildCorpusSources([], []), /empty/);
assert.throws(() => buildCorpusSources([normalized, normalized], []), /duplicate sourceId/);

console.log('program board search corpus adapter tests passed');
