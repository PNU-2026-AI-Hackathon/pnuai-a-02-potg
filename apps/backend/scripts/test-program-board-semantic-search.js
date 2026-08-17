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

// --- 닮은 프로그램 묶기 -------------------------------------------------------

const { groupSimilarPrograms, titleKey, targetKey } = require('../src/services/programBoardSemanticSearch/programGrouping');

assert.equal(titleKey('마술체험(일요일 10:00~11:00)'), titleKey('마술체험(일요일 15:00~16:00)'),
  '시간대만 다른 제목은 같은 것으로 본다');
assert.equal(titleKey('향기로운 크리스마스 캔들 만들기 1차'), titleKey('향기로운 크리스마스 캔들 만들기 3차'));
assert.notEqual(titleKey('들락날락 영어랑 놀자'), titleKey('들락날락 영어랑 놀자 1일 크리스마스 문화체험'));
assert.equal(targetKey('초등학생 전학년(2024학년도 기준)'), targetKey('초등학생 전학년 (2024학년도 기준'),
  '괄호 안 부연만 다른 대상은 같은 것으로 본다');

const slot = (sourceId, title, sessions = 0) => ({
  sourceId, sourceUrl: `https://example.test/${sourceId}`, title,
  targetGroup: null, targetDetail: '유아, 초등학생', libraryName: null, description: null,
  board: { intro: [], sections: [] },
  curriculum: Array.from({ length: sessions }, (_, index) => ({ session: index + 1, activity: '활동' })),
});
const sameDay = () => '2021-11-07 ~ 2021-11-07';

const folded = groupSimilarPrograms([
  slot(2552, '마술체험(일요일 10:00~11:00)'),
  slot(2553, '마술체험(일요일 11:00~12:00)'),
  slot(2554, '마술체험(일요일 13:00~14:00)'),
], sameDay);
assert.equal(folded.length, 1, '같은 날 시간대만 다른 건은 한 묶음이다');
assert.equal(folded[0].representative.sourceId, 2552, '같은 조건이면 먼저 등록된 것이 대표다');
assert.deepEqual(folded[0].variants.map((variant) => variant.sourceId), [2553, 2554],
  '나머지는 지우지 않고 대표에 딸려 보낸다');

// 회차가 더 많은 쪽이 대표가 된다.
const byDetail = groupSimilarPrograms([slot(2552, '마술체험(1부)'), slot(2553, '마술체험(2부)', 4)], sameDay);
assert.equal(byDetail[0].representative.sourceId, 2553);

// 대상이나 기간이 다르면 다른 프로그램이므로 묶이지 않는다.
const kinder = { ...slot(3595, '들락날락 영어랑 놀자'), targetDetail: '유아 6~7세' };
const elementary = { ...slot(3596, '들락날락 영어랑 놀자'), targetDetail: '초등학생 1~2학년' };
assert.equal(groupSimilarPrograms([kinder, elementary], sameDay).length, 2, '대상이 다르면 나눈다');
assert.equal(
  groupSimilarPrograms([slot(1, '생활과학교실'), slot(2, '생활과학교실')], (source) => (source.sourceId === 1 ? '상반기' : '하반기')).length,
  2,
  '기간이 다르면 나눈다',
);

console.log('program board search grouping tests passed');
