const assert = require('node:assert/strict');
const { buildProgramCaseDocument } = require('../dist/services/programCaseDocument/programCaseDocumentBuilder');

function program(overrides = {}) {
  return {
    id: 'program-1',
    sourceType: 'COMMON_SOURCE',
    sourcePostId: 'post-1',
    sourceUrl: 'https://example.com/programs/1',
    title: '어린이 독서 미술 교실',
    targetAudience: '초등학생',
    instructor: '김강사',
    capacity: 15,
    currentApplicants: 0,
    applicationStatus: '접수중',
    educationStartDate: new Date('2026-01-10T00:00:00.000Z'),
    educationEndDate: new Date('2026-02-28T00:00:00.000Z'),
    educationStartDateText: '2026-01-10',
    educationEndDateText: '2026-02-28',
    location: '프로그램실',
    feeText: null,
    preparationText: '색연필, 가위, 풀',
    contactText: '',
    notices: '책을 읽고 미술 활동으로 표현합니다.',
    rawText: '어린이 독서 미술 교실 어린이 독서 미술 교실 상세한 프로그램 원문입니다. 책을 읽고 미술 활동으로 표현합니다.',
    ...overrides,
  };
}

const input = {
  program: program(),
  sessions: [
    { id: 'session-2', sessionNumber: 2, sessionDate: null, dateText: '', activity: '콜라주 활동', sortOrder: 1 },
    { id: 'session-1', sessionNumber: 1, sessionDate: '2026-01-10', dateText: '2026-01-10', activity: '인물 그리기', sortOrder: 0 },
  ],
  attachments: [
    {
      id: 'inactive',
      fileName: '이전 계획서.pdf',
      fileType: 'pdf',
      detectedFileType: 'PDF',
      extractionStatus: 'COMPLETED',
      cleanedText: '포함되면 안 됩니다.',
      extractorType: 'PDF_TEXT',
      isActive: false,
      createdAt: '2026-01-02',
    },
    {
      id: 'active',
      fileName: '강의계획서.hwp',
      fileType: 'hwp',
      detectedFileType: 'HWP',
      extractionStatus: 'COMPLETED',
      cleanedText: '1회차: 도서 소개\r\n\r\n\r\n2회차: 등장인물 이해',
      extractorType: 'HWP_TEXT',
      isActive: true,
      createdAt: '2026-01-01',
    },
  ],
};

const document = buildProgramCaseDocument(input);
assert.equal(document, buildProgramCaseDocument(input));
assert.match(document, /\[프로그램 기본 정보\]/);
assert.match(document, /현재 신청 인원: 0/);
assert.match(document, /1회차[\s\S]*2회차/);
assert.match(document, /파일명: 강의계획서\.hwp/);
assert.doesNotMatch(document, /이전 계획서/);
assert.doesNotMatch(document, /비용:/);
assert.equal(document.match(/책을 읽고 미술 활동으로 표현합니다\./g).length, 1);
assert.equal(document.match(/어린이 독서 미술 교실/g).length, 2);
assert.match(document, /1회차[\s\S]*활동: 인물 그리기\n\n2회차/);
assert.doesNotMatch(document, /\r/);
assert.doesNotMatch(document, /\n{3,}/);

const sparse = buildProgramCaseDocument({
  program: program({ notices: '', rawText: '', location: null, preparationText: null }),
  sessions: [],
  attachments: [],
});
assert.doesNotMatch(sparse, /\[프로그램 안내\]/);
assert.doesNotMatch(sparse, /\[원본 게시글 본문\]/);
assert.doesNotMatch(sparse, /\[회차별 활동\]/);
assert.doesNotMatch(sparse, /\[첨부파일 내용\]/);

const fakePhone = ['010', '0000', '0000'].join('-');
const fakeEmail = ['privacy-test', 'example.invalid'].join('@');
const privateDocument = buildProgramCaseDocument({
  program: program({
    instructor: '테스트강사',
    contactText: fakePhone,
    rawText: `프로그램 일정: 2026-08-01\n신청자 성명: 테스트이름 ${fakePhone}\n문의: ${fakeEmail}`,
  }),
  sessions: [],
  attachments: [{
    id: 'high-risk', fileName: '출석부.hwp', fileType: 'hwp', detectedFileType: 'HWP',
    extractionStatus: 'COMPLETED', cleanedText: '출석부\n테스트 행',
    extractorType: 'HWP_TEXT', isActive: true, createdAt: '2026-01-01',
  }],
});
assert.doesNotMatch(privateDocument, /테스트강사|테스트이름/);
assert.equal(privateDocument.includes(fakePhone), false);
assert.equal(privateDocument.includes(fakeEmail), false);
assert.doesNotMatch(privateDocument, /출석부/);
assert.match(privateDocument, /2026-08-01/);

console.log('Program case document builder tests passed.');
