const assert = require('node:assert/strict');
const { comparableTitle, matchDocumentSection, normalizeActivityText, normalizeExtractedKoreanSpacing, structureAttachmentText } = require('../src/services/programAttachmentEnrichment/sectionMatcher');

assert.equal(comparableTitle('[미리내] 자녀 독서지도'), '자녀독서지도');
const matched = matchDocumentSection({
  pages: [
    { pageNumber: 1, text: '표지' },
    { pageNumber: 2, text: '자녀 독서지도\n1회차 책 읽기' },
    { pageNumber: 3, text: '계속되는 내용' },
    { pageNumber: 4, text: '생각 쑥쑥 그림책\n새 프로그램' },
  ],
  targetTitle: '[미리내] 자녀 독서지도',
  knownProgramTitles: ['[미리내] 자녀 독서지도', '[미리내] 생각 쑥쑥 그림책'],
});
assert.equal(matched.status, 'SECTION_MATCHED');
assert.deepEqual(matched.selectedPages, [2, 3]);
assert.ok(!matched.selectedText.includes('새 프로그램'));

const aliasMatched = matchDocumentSection({
  pages: [
    { pageNumber: 1, text: '생활영어 강의계획서 프로그램명 매체를 통해 배우는 생활 영어' },
    { pageNumber: 2, text: '학부모 독서지도 계획안 *미리내 도서관 프로그램명 책 읽기로 몸과 마음 성장하기' },
    { pageNumber: 3, text: '어린이 그림책 지도 계획안 프로그램명 생각 쏙쏙 그림책' },
  ],
  targetTitle: '[미리내] 자녀 독서지도',
  knownProgramTitles: [],
});
assert.equal(aliasMatched.status, 'SECTION_MATCHED');
assert.deepEqual(aliasMatched.selectedPages, [2]);

const insertedWordsMatched = matchDocumentSection({
  pages: [{ pageNumber: 10, text: '강의계획서 프로그램명 생각 톡톡! 창의력up! 미술아 놀자!' }],
  targetTitle: '[부곡 1동] 생각톡톡! 미술아 놀자',
  knownProgramTitles: [],
});
assert.equal(insertedWordsMatched.status, 'SECTION_MATCHED');
assert.deepEqual(insertedWordsMatched.selectedPages, [10]);

const structured = structureAttachmentText('강좌명 | 일본어 초급반 | 강사명 | 시카다\n1 | 9/17 | 형용동사 | 복습');
assert.deepEqual(structured.labeled, [{ label: '강좌명', value: '일본어 초급반' }, { label: '강사명', value: '시카다' }]);
assert.deepEqual(structured.curriculum[0], { session: 1, date: '9/17', content: '형용동사', note: '복습' });

const pdfStructured = structureAttachmentText('프로그램명 책 읽기로 몸과 마음 성장하기\n대상 성인\n1 4/12 독서교육의 중요성\n설명\n2 4/19 책 고르기');
assert.equal(pdfStructured.curriculum.length, 2);
assert.deepEqual(pdfStructured.curriculum[0], { session: 1, date: '4/12', content: '독서교육의 중요성 설명', note: null });
assert.ok(pdfStructured.labeled.some((item) => item.label === '프로그램명'));
assert.equal(normalizeExtractedKoreanSpacing('일본어글자쓰기읽기부터간단한대화까지할수있게함'), '일본어 글자 쓰기·읽기부터 간단한 대화까지 할 수 있게 함');
assert.equal(normalizeActivityText('ㆍ 그림책 보기 ㆍ 의견 나누기'), '• 그림책 보기\n• 의견 나누기');
assert.equal(normalizeExtractedKoreanSpacing('3과중국어를가장좋아합니다1/2(형용동사)'), '3과 중국어를 가장 좋아합니다 1/2(형용동사)');

const online = structureAttachmentText('교육대상 | 유아 6-7세 | 온라인 가능 여부 | ⍔가능 ⃞ 불가능');
assert.ok(online.labeled.some((item) => item.label === '온라인 가능 여부'));

const referenceBook = structureAttachmentText('HWP 강의 계획서\n차시 | 세부 교육내용 | 참고 도서 | 비고\n1 | 활동 | |');
assert.ok(referenceBook.extractionWarnings.some((warning) => warning.code === 'REFERENCE_BOOK_NOT_EXTRACTED'));

console.log('Program attachment section matcher tests passed.');
