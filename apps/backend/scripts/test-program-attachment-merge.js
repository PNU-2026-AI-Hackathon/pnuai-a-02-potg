const assert = require('node:assert/strict');
const fs = require('node:fs');
const { buildMergedSamples } = require('../src/cli/buildProgramAttachmentMergedSamples');

const crawl = process.env.PROGRAM_BOARD_CRAWL;
const enrichment = process.env.PROGRAM_ATTACHMENT_ENRICHMENT;
if (!crawl || !enrichment) throw new Error('PROGRAM_BOARD_CRAWL and PROGRAM_ATTACHMENT_ENRICHMENT are required');
const records = JSON.parse(fs.readFileSync(crawl, 'utf8')).records;
const samples = JSON.parse(fs.readFileSync(enrichment, 'utf8')).results;
const result = buildMergedSamples(records, samples);

assert.equal(result.count, samples.length);
assert.equal(result.count, 20);
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
assert.ok(japanese.curriculum[0].activity.includes('주요 형용동사 단어 접하기'));
assert.equal(japanese.curriculum[0].materialsOrNotes, null);
assert.ok(japanese.basicInfo.some((item) => item.label === '교육일시'));
assert.ok(!japanese.board.sections.some((section) => section.title === '운영 정보'));
assert.ok(!japanese.mergeAudit.added.some((item) => item.value === '비고'));
assert.ok(japanese.board.notices.some((notice) => notice.lines.some((line) => /비대면/.test(line))));
assert.ok(!japanese.board.intro.some((line) => /비대면/.test(line)));
assert.match(japanese.curriculum[0].activity, /^3과 중국어를 가장 좋아합니다 1\/2/);

const boardGame = result.items.find((item) => item.sourceId === 2701);
assert.ok(!boardGame.mergeAudit.added.some((item) => /차시\s*세부 교육내용/.test(item.value)));

const bookPlay = result.items.find((item) => item.sourceId === 2456);
assert.ok(bookPlay.basicInfo.some((item) => item.label === '상세 운영장소'));
assert.ok(!bookPlay.board.intro.some((line) => /첨부.*참고/.test(line)));
assert.ok(!bookPlay.board.intro.some((line) => /재료비\s*5,000원/.test(line)));
assert.ok(bookPlay.board.sections.some((section) => section.title === '준비 사항'));
assert.deepEqual(bookPlay.curriculum.map((session) => session.date), ['8월 10일', '8월 17일', '8월 24일', '8월 31일']);
assert.ok(bookPlay.curriculum[0].activity.startsWith('<한입에 덥석>'));
assert.ok(bookPlay.curriculum[1].activity.startsWith('<거울 속에 누구요>'));
assert.ok(bookPlay.basicInfo.some((item) => item.label === '온라인 진행 가능' && item.value === '가능'));

const reading = result.items.find((item) => item.sourceId === 2483);
assert.ok(reading.basicInfo.some((item) => item.label === '대상' && item.value === '초등학생 4~6학년'));
assert.ok(reading.board.notices.some((notice) => notice.lines.some((line) => /재료.*배부/.test(line))));
assert.ok(reading.curriculum.every((session) => session.date === null), '휴강으로 날짜 수가 어긋나면 일자를 추정하지 않는다');

const therapy = result.items.find((item) => item.sourceId === 2484);
assert.ok(therapy.basicInfo.some((item) => item.label === '재료비' && item.value === '없음'));
assert.ok(therapy.basicInfo.some((item) => item.label === '교재비' && item.value === '없음'));
assert.deepEqual(therapy.curriculum[0].referenceBooks, ['<나는요,>', '<이게 정말 나일까>']);
assert.equal(therapy.curriculum[0].referenceImages[0].filename, 'image_001.jpg');
assert.equal(therapy.curriculum.filter((session) => session.referenceImages.length === 1).length, 8);
assert.ok(!therapy.extractionWarnings.some((warning) => warning.code === 'REFERENCE_BOOK_NOT_EXTRACTED'));

const thinking = result.items.find((item) => item.sourceId === 2483);
assert.ok(thinking.curriculum.every((session) => session.referenceImages.length === 0));

const parentReading = result.items.find((item) => item.sourceId === 2698);
assert.ok(parentReading.board.notices.some((notice) => notice.lines.some((line) => /수강자의 상황.*변경/.test(line))));

const pictureBook = result.items.find((item) => item.sourceId === 2699);
assert.equal(pictureBook.curriculum[0].materials, '종합장과 필기도구');

const havruta = result.items.find((item) => item.sourceId === 2700);
assert.equal(havruta.curriculum.length, 8);
assert.ok(havruta.curriculum[0].activity.includes('오리엔테이션'));
assert.ok(havruta.curriculum[0].materials.includes('교재'));

const boardGamePdf = result.items.find((item) => item.sourceId === 2701);
assert.equal(boardGamePdf.curriculum.length, 8);
assert.ok(boardGamePdf.board.notices.some((notice) => notice.lines.some((line) => /장애인 대상 전화접수/.test(line))));
assert.ok(boardGamePdf.board.notices.some((notice) => notice.lines.some((line) => /세부 프로그램.*변경/.test(line))));
assert.ok(!boardGamePdf.board.intro.some((line) => /장애인 대상 전화접수/.test(line)));

const addedHwp = result.items.find((item) => item.sourceId === 2487);
assert.ok(addedHwp.curriculum.length > 0, '추가 HWP 표본의 회차 정보를 변환해야 한다');

const addedPdf = result.items.find((item) => item.sourceId === 2705);
assert.ok(addedPdf.curriculum.length > 0, '추가 PDF 표본의 회차 정보를 변환해야 한다');

const complexScienceTable = result.items.find((item) => item.sourceId === 2702);
assert.equal(complexScienceTable.curriculum.length, 8);
assert.ok(complexScienceTable.curriculum[0].activity.includes('고분자 밀도 병 만들기'));

const alternateUrlRecovered = result.items.find((item) => item.sourceId === 2704);
assert.equal(alternateUrlRecovered.reviewStatus, 'AUTO_REVIEW_CANDIDATE');
assert.equal(alternateUrlRecovered.curriculum.length, 8);
assert.deepEqual(alternateUrlRecovered.attachmentEvidence.selectedPages, [8]);

const insertedTitleRecovered = result.items.find((item) => item.sourceId === 2706);
assert.equal(insertedTitleRecovered.reviewStatus, 'AUTO_REVIEW_CANDIDATE');
assert.equal(insertedTitleRecovered.curriculum.length, 8);
assert.deepEqual(insertedTitleRecovered.attachmentEvidence.selectedPages, [10, 11]);
assert.equal(insertedTitleRecovered.curriculum[0].materials, '필기도구·사인펜');
assert.equal(insertedTitleRecovered.curriculum.filter((session) => session.referenceImages.length === 1).length, 8);
assert.ok(insertedTitleRecovered.board.sections.find((section) => section.id === 'content').items
  .some((item) => item.label === '강의목표' && !item.value.includes('운영방식')));

const phonics = result.items.find((item) => item.sourceId === 2703);
assert.ok(phonics.board.sections.find((section) => section.id === 'content').items.some((item) => item.label === '프로그램 소개'));
assert.equal(phonics.curriculum[0].teachingMethod, '이론과 개인/그룹실전연습');

assert.equal(alternateUrlRecovered.curriculum.filter((session) => session.referenceImages.length === 1).length, 8);
assert.ok(alternateUrlRecovered.board.sections.find((section) => section.id === 'content').items.some((item) => item.label === '참고자료'));

const socialScience = result.items.find((item) => item.sourceId === 2705);
assert.equal(socialScience.curriculum[0].category, 'Society');
assert.equal(socialScience.curriculum[1].category, 'Society');
assert.equal(socialScience.curriculum[0].activity, 'Princess Hyacinth');
assert.equal(socialScience.curriculum.filter((session) => session.referenceImages.length === 1).length, 8);

console.log('Program attachment merge tests passed.');
